/**
 * Exponential-backoff cooldown for keys hit by quota errors. Schedule is
 * deliberately short at the start (1h, 6h) so a transient burst doesn't
 * sideline a key for days, and long at the cap (30d) so a genuinely-dead
 * key doesn't keep getting picked.
 *
 * Failure counter resets to 0 on the next successful call (see markHealthy).
 */
const BACKOFF_SCHEDULE_SECONDS = [
  0,           // index 0 — unused (defensive)
  3600,        // 1h
  21600,       // 6h
  86400,       // 24h
  259200,      // 3d
  604800,      // 7d
  2592000,     // 30d (cap)
];

export function nextBackoffSeconds(consecutiveFailures: number): number {
  if (consecutiveFailures <= 0) return 0;
  if (consecutiveFailures >= BACKOFF_SCHEDULE_SECONDS.length) {
    return BACKOFF_SCHEDULE_SECONDS[BACKOFF_SCHEDULE_SECONDS.length - 1];
  }
  return BACKOFF_SCHEDULE_SECONDS[consecutiveFailures];
}

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { log } from "./supabase.ts";

export interface AcquiredKey {
  id: number;
  key: string;
}

/**
 * Reserve a key from the pool for `source`. Uses a SECURITY DEFINER RPC that
 * runs `SELECT ... FOR UPDATE SKIP LOCKED` so concurrent callers can't collide
 * on the same key.
 *
 * Returns null when:
 *   - The pool is empty for this source
 *   - All keys are cooling down (next_retry_at in the future) or disabled
 *
 * Callers MUST treat null as "data source unavailable" — same contract as
 * existing search functions returning null on API failure.
 */
export async function acquireKey(
  supabase: SupabaseClient,
  source: string
): Promise<AcquiredKey | null> {
  const { data, error } = await supabase
    .rpc("acquire_api_key", { p_source: source })
    .maybeSingle();

  if (error) {
    log("acquireKey: RPC failed", "error", { source, error });
    return null;
  }
  if (!data) {
    log("acquireKey: no available keys", "warn", { source });
    return null;
  }
  const row = data as { id: number; key: string };
  return { id: row.id, key: row.key };
}

/**
 * Mark a key as having hit a quota/rate error. Bumps the failure counter and
 * sets next_retry_at via the backoff schedule. The key stays in the pool but
 * is filtered out of acquireKey() until next_retry_at passes.
 */
export async function markQuotaExhausted(
  supabase: SupabaseClient,
  keyId: number,
  reason: string
): Promise<void> {
  // Read current failure count, then write updated state. Two-step is fine
  // here because last writer wins is acceptable — a slightly-too-short
  // cooldown from a race just means we retry sooner than ideal.
  const { data: row, error: readErr } = await supabase
    .from("api_keys")
    .select("consecutive_failures")
    .eq("id", keyId)
    .maybeSingle();

  if (readErr || !row) {
    log("markQuotaExhausted: failed to read row", "error", { keyId, error: readErr });
    return;
  }

  const newFailures = (row.consecutive_failures as number) + 1;
  const cooldownMs = nextBackoffSeconds(newFailures) * 1000;
  const nextRetry = new Date(Date.now() + cooldownMs).toISOString();

  const { error: writeErr } = await supabase
    .from("api_keys")
    .update({
      consecutive_failures: newFailures,
      next_retry_at: nextRetry,
      last_failure_reason: reason,
    })
    .eq("id", keyId);

  if (writeErr) {
    log("markQuotaExhausted: failed to write state", "error", { keyId, error: writeErr });
  }
}

/**
 * Mark a key as permanently dead (auth failure). Removed from the pool until
 * an operator manually re-enables it.
 */
export async function markDisabled(
  supabase: SupabaseClient,
  keyId: number,
  reason: string
): Promise<void> {
  const { error } = await supabase
    .from("api_keys")
    .update({ disabled: true, last_failure_reason: reason })
    .eq("id", keyId);
  if (error) {
    log("markDisabled: failed", "error", { keyId, error });
  }
}

/**
 * Reset failure state on successful call. Called after every 2xx response so
 * a key that recovers (e.g. monthly reset) goes back to the front of the queue.
 */
export async function markHealthy(
  supabase: SupabaseClient,
  keyId: number
): Promise<void> {
  const { error } = await supabase
    .from("api_keys")
    .update({
      consecutive_failures: 0,
      next_retry_at: null,
      last_failure_reason: null,
    })
    .eq("id", keyId);
  if (error) {
    log("markHealthy: failed", "error", { keyId, error });
  }
}
