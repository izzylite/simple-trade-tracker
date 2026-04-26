/**
 * Memory module — database operations.
 *
 * Three responsibilities:
 *
 * 1. Pre-load (`fetchMemory`) — used by the chat function and the briefing
 *    agent at request start to inject memory into the system prompt before
 *    the LLM runs. Uses raw PostgREST so the helper is dependency-light
 *    and safe to import from any edge function (no supabase-js needed).
 *
 * 2. Mutation (`updateMemory`) — invoked by the `update_memory` tool while
 *    the LLM is running. Dispatches to per-op handlers (ADD / UPDATE /
 *    REMOVE / REPLACE_SECTION).
 *
 * 3. Audit (`memory_audit`) — destructive ops write a row via writeAuditEntry
 *    so we can investigate "why did the bullet I asked Orion about disappear".
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { log } from "../supabase.ts";
import { AGENT_MEMORY_TAG } from "../noteTags.ts";
import {
  buildMemoryContent,
  compactSections,
  deduplicateInsights,
  jaccard,
  parseMemorySections,
  tokenizeForDedup,
  validateInsightBatch,
  validateInsightFormat,
} from "./parser.ts";
import {
  ALL_MEMORY_OPS,
  AUDITED_MEMORY_OPS,
  type EpisodicEventType,
  MEMORY_OP_MATCH_THRESHOLD,
  MEMORY_SECTION_ORDER,
  MEMORY_SIZE_COMPACT_CHARS,
  MEMORY_SIZE_WARN_CHARS,
  type MemoryOp,
  type MemorySection,
  type UpdateMemoryParams,
} from "./types.ts";
import { writeAuditEntry } from "./audit.ts";
import { recordEvent } from "./episodic.ts";

// =============================================================================
// Pre-load: fetch the current memory note as plaintext.
// =============================================================================

/**
 * Fetch the AGENT_MEMORY note content for a user+calendar. Returns null when
 * no memory exists yet or on any error — callers treat "no memory" as the
 * signal to bootstrap one on first significant interaction.
 */
export async function fetchMemory(
  userId: string,
  calendarId?: string,
): Promise<string | null> {
  if (!calendarId) {
    log("[Memory] No calendar ID, skipping memory fetch", "info");
    return null;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    log("[Memory] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", "warn");
    return null;
  }

  try {
    const params = new URLSearchParams({
      user_id: `eq.${userId}`,
      calendar_id: `eq.${calendarId}`,
      tags: `cs.{${AGENT_MEMORY_TAG}}`,
      select: "content",
      limit: "1",
    });
    const url = `${supabaseUrl}/rest/v1/notes?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      log(`[Memory] Failed to fetch: ${response.status}`, "warn");
      return null;
    }

    const notes = await response.json();
    if (notes && notes.length > 0 && notes[0].content) {
      const content = notes[0].content;
      log(`[Memory] Loaded ${content.length} chars of memory`, "info");
      return content;
    }

    log("[Memory] No existing memory found", "info");
    return null;
  } catch (error) {
    log(`[Memory] Error fetching: ${error}`, "error");
    return null;
  }
}

// =============================================================================
// Internal: row fetch with the fields needed for optimistic locking.
// =============================================================================

interface MemoryRow {
  id: string;
  content: string;
  updated_at: string;
}

async function fetchMemoryRow(
  supabase: SupabaseClient,
  userId: string,
  calendarId: string,
): Promise<{ row: MemoryRow | null; error: string | null }> {
  // limit(1)+maybeSingle() rather than .single() — pre-migration data or a
  // future schema slip could leave two rows. .single() would throw;
  // maybeSingle picks the oldest deterministically.
  const { data, error } = await supabase
    .from("notes")
    .select("id, content, updated_at")
    .eq("user_id", userId)
    .eq("calendar_id", calendarId)
    .contains("tags", [AGENT_MEMORY_TAG])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) return { row: null, error: error.message };
  return { row: data as MemoryRow | null, error: null };
}

// =============================================================================
// Internal: bootstrap a fresh memory note (only used by the ADD path).
// =============================================================================

async function createInitialMemory(
  supabase: SupabaseClient,
  userId: string,
  calendarId: string,
  section: MemorySection,
  insights: string[],
): Promise<string> {
  const sections: Record<MemorySection, string[]> = {
    TRADER_PROFILE: [],
    PERFORMANCE_PATTERNS: [],
    STRATEGY_PREFERENCES: [],
    PSYCHOLOGICAL_PATTERNS: [],
    LESSONS_LEARNED: [],
    ACTIVE_FOCUS: [],
  };
  sections[section] = insights;
  const content = buildMemoryContent(sections);

  const { data, error } = await supabase
    .from("notes")
    .insert({
      user_id: userId,
      calendar_id: calendarId,
      title: "Memory",
      content,
      by_assistant: true,
      is_archived: false,
      is_pinned: true,
      tags: [AGENT_MEMORY_TAG],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    // 23505 = unique_violation — a parallel session won the race and already
    // created the AGENT_MEMORY row (notes_agent_memory_singleton_idx).
    // Fall back to the merge path so we don't lose the caller's insights.
    if (error.code === "23505") {
      log(
        "[createInitialMemory] Lost race for initial memory; falling back to ADD merge",
        "warn",
      );
      return await updateMemory(supabase, userId, calendarId, {
        op: "ADD",
        section,
        new_insights: insights,
      });
    }
    log(`[createInitialMemory] Insert failed: ${error.message}`, "error");
    return `Failed to create memory: ${error.message}`;
  }

  log(`[createInitialMemory] Memory created with ID: ${data.id}`, "info");
  return `Memory initialized with ${insights.length} insight(s) in ${section}.`;
}

// =============================================================================
// Internal: fuzzy-match a target_text against a list of bullets.
// =============================================================================

interface MatchResult {
  // Indices of bullets whose Jaccard score against the target exceeds
  // MEMORY_OP_MATCH_THRESHOLD. Includes ties.
  indices: number[];
  // Score of the best match (0 if none).
  bestScore: number;
}

function findFuzzyMatches(target: string, bullets: string[]): MatchResult {
  const targetSig = tokenizeForDedup(target);
  const indices: number[] = [];
  let bestScore = 0;
  for (let i = 0; i < bullets.length; i++) {
    const score = jaccard(targetSig, tokenizeForDedup(bullets[i]));
    if (score >= MEMORY_OP_MATCH_THRESHOLD) indices.push(i);
    if (score > bestScore) bestScore = score;
  }
  return { indices, bestScore };
}

// =============================================================================
// Internal: per-op section mutation. Pure — operates on a sections record
// and returns the new state plus metadata for the audit log + response.
// =============================================================================

interface OpResult {
  sections: Record<MemorySection, string[]>;
  // For audit trail: the bullet that was modified/removed (if any) and the
  // jaccard score that picked it.
  beforeText: string | null;
  afterText: string | null;
  matchScore: number | null;
  // Human-readable summary of what happened, returned to the LLM.
  summary: string;
}

type OpOutcome =
  | { ok: true; result: OpResult }
  | { ok: false; reason: string };

function applyAdd(
  sections: Record<MemorySection, string[]>,
  section: MemorySection,
  insights: string[],
): OpOutcome {
  const before = sections[section];
  const merged = [...before, ...insights];
  const deduped = deduplicateInsights(merged);
  const next = { ...sections, [section]: deduped };
  const added = deduped.length - before.length;
  return {
    ok: true,
    result: {
      sections: next,
      beforeText: null,
      afterText: null,
      matchScore: null,
      summary:
        `ADD: appended ${added} insight(s) to ${section} (${insights.length - added} dedup'd).`,
    },
  };
}

function applyUpdate(
  sections: Record<MemorySection, string[]>,
  section: MemorySection,
  targetText: string,
  newText: string,
): OpOutcome {
  const bullets = sections[section];
  if (bullets.length === 0) {
    return {
      ok: false,
      reason:
        `UPDATE failed: ${section} is empty — nothing to update. Use op="ADD" to create a new bullet.`,
    };
  }
  const { indices, bestScore } = findFuzzyMatches(targetText, bullets);
  if (indices.length === 0) {
    return {
      ok: false,
      reason:
        `UPDATE failed: no bullet in ${section} matched target_text (best similarity ${bestScore.toFixed(2)} below threshold ${MEMORY_OP_MATCH_THRESHOLD}). Current ${section}:\n${bullets.map((b) => `- ${b}`).join("\n")}`,
    };
  }
  if (indices.length > 1) {
    return {
      ok: false,
      reason:
        `UPDATE failed: target_text matched ${indices.length} bullets in ${section}. Be more specific. Candidates:\n${indices.map((i) => `- ${bullets[i]}`).join("\n")}`,
    };
  }
  const idx = indices[0];
  const before = bullets[idx];
  const next = [...bullets];
  next[idx] = newText;
  return {
    ok: true,
    result: {
      sections: { ...sections, [section]: next },
      beforeText: before,
      afterText: newText,
      matchScore: bestScore,
      summary: `UPDATE: replaced bullet in ${section} (match score ${bestScore.toFixed(2)}).`,
    },
  };
}

function applyRemove(
  sections: Record<MemorySection, string[]>,
  section: MemorySection,
  targetText: string,
): OpOutcome {
  const bullets = sections[section];
  if (bullets.length === 0) {
    return {
      ok: false,
      reason: `REMOVE failed: ${section} is already empty.`,
    };
  }
  const { indices, bestScore } = findFuzzyMatches(targetText, bullets);
  if (indices.length === 0) {
    return {
      ok: false,
      reason:
        `REMOVE failed: no bullet in ${section} matched target_text (best similarity ${bestScore.toFixed(2)} below threshold ${MEMORY_OP_MATCH_THRESHOLD}). Current ${section}:\n${bullets.map((b) => `- ${b}`).join("\n")}`,
    };
  }
  if (indices.length > 1) {
    return {
      ok: false,
      reason:
        `REMOVE failed: target_text matched ${indices.length} bullets in ${section}. Be more specific. Candidates:\n${indices.map((i) => `- ${bullets[i]}`).join("\n")}`,
    };
  }
  const idx = indices[0];
  const before = bullets[idx];
  const next = bullets.filter((_, i) => i !== idx);
  return {
    ok: true,
    result: {
      sections: { ...sections, [section]: next },
      beforeText: before,
      afterText: null,
      matchScore: bestScore,
      summary: `REMOVE: dropped bullet from ${section} (match score ${bestScore.toFixed(2)}).`,
    },
  };
}

function applyReplaceSection(
  sections: Record<MemorySection, string[]>,
  section: MemorySection,
  newInsights: string[],
): OpOutcome {
  if (section !== "ACTIVE_FOCUS") {
    return {
      ok: false,
      reason:
        `REPLACE_SECTION rejected: only ACTIVE_FOCUS may be replaced. Use ADD/UPDATE/REMOVE for ${section}.`,
    };
  }
  const before = sections[section];
  return {
    ok: true,
    result: {
      sections: { ...sections, [section]: newInsights },
      beforeText: before.length > 0 ? before.map((b) => `- ${b}`).join("\n") : null,
      afterText: newInsights.map((b) => `- ${b}`).join("\n"),
      matchScore: null,
      summary:
        `REPLACE_SECTION: replaced ACTIVE_FOCUS (was ${before.length} bullets, now ${newInsights.length}).`,
    },
  };
}

// =============================================================================
// Public: updateMemory — the only writer for AGENT_MEMORY rows.
// =============================================================================

const VALID_SECTIONS = new Set<string>(MEMORY_SECTION_ORDER);

/**
 * Apply a memory operation. Returns a human-readable string the tool
 * dispatcher hands back to the LLM (success message, validation error,
 * permission denial, etc.).
 *
 * Pipeline:
 *   1. Validate inputs and op-specific required fields.
 *   2. Permission check against allowedOps.
 *   3. Fetch existing memory row (bootstrap on first ADD if absent).
 *   4. Parse sections, dispatch to per-op handler (pure mutation).
 *   5. Data-loss guard for non-target sections.
 *   6. Compact if oversized.
 *   7. Persist with optimistic lock on updated_at (UPDATE/REMOVE/REPLACE).
 *   8. Write audit row for destructive ops (best-effort).
 */
export async function updateMemory(
  supabase: SupabaseClient,
  userId: string,
  calendarId: string,
  params: UpdateMemoryParams,
): Promise<string> {
  try {
    const op: MemoryOp = params.op ?? "ADD";
    const section = params.section;
    const allowedOps = params.allowedOps ?? ALL_MEMORY_OPS;

    log(
      `[updateMemory] op=${op} section=${section} allowed=[${[...allowedOps].join(",")}]`,
      "info",
    );

    // -------- 1. Input validation --------
    if (!VALID_SECTIONS.has(section)) {
      return `Invalid section: "${section}". Must be one of ${[...VALID_SECTIONS].join(", ")}.`;
    }

    if (op === "ADD" || op === "REPLACE_SECTION") {
      if (!Array.isArray(params.new_insights)) {
        return `${op} requires new_insights: string[].`;
      }
      if (params.new_insights.length === 0) {
        return `${op} requires at least one entry in new_insights.`;
      }
    }
    if (op === "UPDATE") {
      if (typeof params.target_text !== "string" || params.target_text.trim().length === 0) {
        return `UPDATE requires target_text identifying the bullet to replace.`;
      }
      if (typeof params.new_text !== "string" || params.new_text.trim().length === 0) {
        return `UPDATE requires new_text — the replacement bullet.`;
      }
    }
    if (op === "REMOVE") {
      if (typeof params.target_text !== "string" || params.target_text.trim().length === 0) {
        return `REMOVE requires target_text identifying the bullet to delete.`;
      }
    }

    // -------- 1b. Proposition format validation --------
    // Checks confidence + date tags on any new content. Strict in that we
    // reject the whole call on the first bad bullet, but lenient about
    // structure — colon shape "[Pattern]: [Evidence]" is a prompt convention,
    // not a schema. Skip validation for REMOVE (no new content).
    if (op === "ADD" || op === "REPLACE_SECTION") {
      const batchResult = validateInsightBatch(params.new_insights!);
      if (!batchResult.ok) {
        log(`[updateMemory] Format validation failed: ${batchResult.error}`, "warn");
        return `Memory update rejected: ${batchResult.error}`;
      }
    }
    if (op === "UPDATE") {
      const newTextResult = validateInsightFormat(params.new_text!);
      if (!newTextResult.ok) {
        log(`[updateMemory] Format validation failed: ${newTextResult.error}`, "warn");
        return `Memory update rejected: ${newTextResult.error}`;
      }
    }

    // -------- 2. Permission check --------
    if (!allowedOps.has(op)) {
      log(
        `[updateMemory] PERMISSION DENIED: op=${op} not in caller's allowedOps`,
        "warn",
      );
      return `Operation "${op}" not permitted in this context. Allowed: ${[...allowedOps].join(", ")}.`;
    }

    // -------- 3. Fetch row (bootstrap on ADD if absent) --------
    const { row, error: fetchErr } = await fetchMemoryRow(supabase, userId, calendarId);
    if (fetchErr) {
      log(`[updateMemory] Fetch failed: ${fetchErr}`, "error");
      return `Failed to fetch memory: ${fetchErr}`;
    }

    if (!row) {
      // No row yet — only ADD can bootstrap. UPDATE/REMOVE on empty memory
      // makes no sense; REPLACE_SECTION on a missing row is technically
      // possible but conceptually weird so we reject it too.
      if (op !== "ADD") {
        return `${op} failed: no memory exists yet for this calendar. Use op="ADD" first.`;
      }
      return await createInitialMemory(
        supabase,
        userId,
        calendarId,
        section,
        params.new_insights!,
      );
    }

    const existingContent = row.content || "";
    const originalParsed = parseMemorySections(existingContent);
    const sections = parseMemorySections(existingContent);

    // -------- 4. Dispatch to per-op handler --------
    let outcome: OpOutcome;
    switch (op) {
      case "ADD":
        outcome = applyAdd(sections, section, params.new_insights!);
        break;
      case "UPDATE":
        outcome = applyUpdate(sections, section, params.target_text!, params.new_text!);
        break;
      case "REMOVE":
        outcome = applyRemove(sections, section, params.target_text!);
        break;
      case "REPLACE_SECTION":
        outcome = applyReplaceSection(sections, section, params.new_insights!);
        break;
    }

    if (!outcome.ok) {
      log(`[updateMemory] Op rejected: ${outcome.reason}`, "warn");
      return outcome.reason;
    }
    const { sections: nextSections, beforeText, afterText, matchScore, summary } = outcome.result;

    // -------- 5. Data-loss guard --------
    // Non-target sections must never shrink (or vanish) as a side-effect of
    // an op against the target section. The target section is allowed to
    // shrink (REMOVE) or grow (ADD) or stay same (UPDATE) by design.
    for (const sectionKey of MEMORY_SECTION_ORDER) {
      if (sectionKey === section) continue;
      const before = originalParsed[sectionKey].length;
      const after = nextSections[sectionKey].length;
      if (before > 0 && after < before) {
        log(
          `[updateMemory] DATA LOSS DETECTED in ${sectionKey}: was ${before}, now ${after}. Aborting.`,
          "error",
        );
        return `Memory update aborted: data-loss guard tripped on ${sectionKey} (was ${before}, would be ${after}). Please report this issue.`;
      }
    }

    // -------- 6. Build content + compact if oversized --------
    const updatedContent = buildMemoryContent(nextSections);
    let finalContent = updatedContent;
    let compactionAuditEntry: { dropped: number; before: string; after: string } | null = null;
    if (updatedContent.length >= MEMORY_SIZE_COMPACT_CHARS) {
      const { sections: compacted, dropped } = compactSections(nextSections);
      if (dropped > 0) {
        finalContent = buildMemoryContent(compacted);
        compactionAuditEntry = {
          dropped,
          before: `${updatedContent.length} chars`,
          after: `${finalContent.length} chars`,
        };
        log(
          `[updateMemory] Compacted: dropped ${dropped} low-score bullets (${updatedContent.length} → ${finalContent.length} chars)`,
          "info",
        );
      }
    } else if (updatedContent.length >= MEMORY_SIZE_WARN_CHARS) {
      log(
        `[updateMemory] Memory approaching size limit (${updatedContent.length} chars)`,
        "warn",
      );
    }

    // -------- 7. Persist with optimistic lock --------
    // For destructive ops, we condition the UPDATE on updated_at matching
    // what we read. If a concurrent writer beat us, rowCount=0 and we
    // refetch+retry once. ADD doesn't strictly need the lock (worst case
    // is one of two parallel ADDs gets dedup'd) but applying it
    // uniformly costs nothing and prevents lost-write surprises in
    // multi-tab scenarios.
    const newUpdatedAt = new Date().toISOString();
    const { error: writeErr, count } = await supabase
      .from("notes")
      .update({ content: finalContent, updated_at: newUpdatedAt }, { count: "exact" })
      .eq("id", row.id)
      .eq("updated_at", row.updated_at);

    if (writeErr) {
      log(`[updateMemory] Write failed: ${writeErr.message}`, "error");
      return `Failed to update memory: ${writeErr.message}`;
    }
    if (count === 0) {
      // Optimistic-lock miss. For ADD this is recoverable: retry the whole
      // op against the fresh state. For destructive ops we bail rather
      // than re-applying against a state the LLM didn't reason about.
      log(
        `[updateMemory] Optimistic lock miss on ${op}: row updated_at changed underneath us`,
        "warn",
      );
      if (op === "ADD") {
        return await updateMemory(supabase, userId, calendarId, params);
      }
      return `Memory update aborted: another session modified memory while this op was being applied. Re-read memory and try again with the current state.`;
    }

    // -------- 8. Audit (destructive ops only, best-effort) --------
    if (AUDITED_MEMORY_OPS.has(op)) {
      await writeAuditEntry(supabase, {
        user_id: userId,
        calendar_id: calendarId,
        op: op as "UPDATE" | "REMOVE" | "REPLACE_SECTION",
        section,
        before_text: beforeText,
        after_text: afterText,
        match_score: matchScore,
      });
    }
    if (compactionAuditEntry) {
      await writeAuditEntry(supabase, {
        user_id: userId,
        calendar_id: calendarId,
        op: "COMPACT",
        section,
        before_text: compactionAuditEntry.before,
        after_text: compactionAuditEntry.after,
        match_score: null,
      });
    }

    log(`[updateMemory] SUCCESS: ${summary}`, "info");
    return summary;
  } catch (error) {
    log(`[updateMemory] UNEXPECTED ERROR: ${error}`, "error");
    return `Memory update error: ${error instanceof Error ? error.message : "Unknown"}`;
  }
}

// =============================================================================
// Combined: applyRuleChange — atomic record_event + update_memory pairing.
// =============================================================================
//
// Designed because Gemini's AUTO function-calling consistently emits a single
// tool per turn. Asking the model to coordinate record_event + update_memory
// via prompt rules (R4 / M4) failed in practice — model logged the event but
// skipped the memory mutation, leaving stale state.
//
// One tool, one call, both writes. Returns a combined human-readable string.
// Failures are partial: if record_event succeeds but update_memory fails,
// the event is retained (it's append-only and represents the user's claim
// regardless of memory state) and the model can retry the memory part on
// its next turn with the rejection message.

export interface ApplyRuleChangeParams {
  event_type: EpisodicEventType;
  summary: string;
  // Memory side. memory_op + memory_section are required; the rest depend
  // on the op (mirrors UpdateMemoryParams).
  memory_op: MemoryOp;
  memory_section: MemorySection;
  new_insights?: string[];
  target_text?: string;
  new_text?: string;
  allowedOps?: Set<MemoryOp>;
}

export async function applyRuleChange(
  supabase: SupabaseClient,
  userId: string,
  calendarId: string,
  params: ApplyRuleChangeParams,
): Promise<string> {
  log(
    `[applyRuleChange] event_type=${params.event_type} memory_op=${params.memory_op} section=${params.memory_section}`,
    "info",
  );

  // Step 1: episodic log. Fires regardless of memory_op since the event
  // ("user said X happened") is independent of whether memory can be
  // mutated cleanly.
  const eventResult = await recordEvent(supabase, userId, calendarId, {
    event_type: params.event_type,
    summary: params.summary,
  });

  // Step 2: core memory. Even if step 1 returned an error string, we still
  // attempt the memory update — they're independent concerns.
  const memoryResult = await updateMemory(supabase, userId, calendarId, {
    op: params.memory_op,
    section: params.memory_section,
    new_insights: params.new_insights,
    target_text: params.target_text,
    new_text: params.new_text,
    allowedOps: params.allowedOps,
  });

  // Combined return — model sees both outcomes. If memory rejected the op
  // (no match / multi-match / permission), the rejection message is in
  // memoryResult and the model can retry the memory leg only.
  return `[event] ${eventResult}\n[memory] ${memoryResult}`;
}
