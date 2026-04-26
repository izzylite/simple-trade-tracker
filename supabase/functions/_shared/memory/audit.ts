/**
 * Memory module — audit log for destructive operations.
 *
 * Writes are best-effort (audit failure must NOT abort the underlying memory
 * mutation). The trigger cap_memory_audit_rows_trigger keeps the table
 * bounded at 100 rows per (user, calendar). See migration 20260426000000.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Inline log shim — see parser.ts for why we don't import from supabase.ts.
type LogLevel = "info" | "warn" | "error";
function log(message: string, level: LogLevel = "info"): void {
  const ts = new Date().toISOString();
  console[level](`[${ts}] ${message.toUpperCase()}: ${message}`);
}

// Must stay in sync with the public.memory_audit_op enum.
export type MemoryAuditOp = "UPDATE" | "REMOVE" | "COMPACT" | "REPLACE_SECTION";

export interface AuditEntry {
  user_id: string;
  calendar_id: string;
  op: MemoryAuditOp;
  section: string;
  before_text: string | null;
  after_text: string | null;
  match_score: number | null;
}

/**
 * Insert an audit row. Failures are logged but never thrown — the audit
 * trail is debugging infrastructure, not a correctness gate. If the audit
 * insert fails (e.g. table missing on a partially-deployed environment),
 * the underlying memory write should still succeed.
 */
export async function writeAuditEntry(
  supabase: SupabaseClient,
  entry: AuditEntry,
): Promise<void> {
  try {
    const { error } = await supabase
      .from("memory_audit")
      .insert({
        user_id: entry.user_id,
        calendar_id: entry.calendar_id,
        op: entry.op,
        section: entry.section,
        before_text: entry.before_text,
        after_text: entry.after_text,
        match_score: entry.match_score,
      });
    if (error) {
      log(
        `[memoryAudit] Insert failed (op=${entry.op} section=${entry.section}): ${error.message}`,
        "warn",
      );
      return;
    }
    log(
      `[memoryAudit] Wrote ${entry.op} for ${entry.section} (match_score=${entry.match_score ?? "n/a"})`,
      "info",
    );
  } catch (err) {
    log(
      `[memoryAudit] Unexpected error: ${err instanceof Error ? err.message : err}`,
      "error",
    );
  }
}
