/**
 * Memory module — type definitions and constants.
 *
 * Memory is stored as a single notes row tagged AGENT_MEMORY per
 * (user, calendar). This file owns the schema describing how that row's
 * markdown content decomposes into sections and what bounds we enforce
 * during merge / compaction.
 */

export type MemorySection =
  | "TRADER_PROFILE"
  | "PERFORMANCE_PATTERNS"
  | "STRATEGY_PREFERENCES"
  | "PSYCHOLOGICAL_PATTERNS"
  | "LESSONS_LEARNED"
  | "ACTIVE_FOCUS";

export const MEMORY_SECTION_ORDER: MemorySection[] = [
  "TRADER_PROFILE",
  "PERFORMANCE_PATTERNS",
  "STRATEGY_PREFERENCES",
  "PSYCHOLOGICAL_PATTERNS",
  "LESSONS_LEARNED",
  "ACTIVE_FOCUS",
];

// Soft cap: warn at this size. Hard cap: trigger compaction. Roughly tuned to
// 2.5k tokens (warn) / 3k tokens (compact) given an avg of ~3.3 chars/token.
export const MEMORY_SIZE_WARN_CHARS = 8000;
export const MEMORY_SIZE_COMPACT_CHARS = 10000;

// Per-section cap once compaction kicks in. Prevents one runaway section from
// monopolizing the budget.
export const MEMORY_PER_SECTION_CAP = 25;

// =============================================================================
// Memory operations (update_memory ops)
// =============================================================================

// Must stay in sync with the Postgres ENUM public.memory_audit_op defined in
// migrations/20260426000000_memory_v2_episodic_and_audit.sql, plus the ADD
// flavour which doesn't get audited (additive ops are recoverable from the
// note's prior content).
export type MemoryOp = "ADD" | "UPDATE" | "REMOVE" | "REPLACE_SECTION";

// Ops that should write a memory_audit row when executed (destructive).
export const AUDITED_MEMORY_OPS: Set<MemoryOp> = new Set([
  "UPDATE",
  "REMOVE",
  "REPLACE_SECTION",
]);

// Default permission set for the chat function. Briefing-agent overrides
// to {ADD} only since unattended jobs shouldn't perform destructive edits
// without user-in-the-loop signal.
export const ALL_MEMORY_OPS: Set<MemoryOp> = new Set([
  "ADD",
  "UPDATE",
  "REMOVE",
  "REPLACE_SECTION",
]);

// Fuzzy-match threshold for UPDATE / REMOVE target identification. Higher
// than ADD's dedup threshold (0.65) because destructive ops need stronger
// confidence before mutating a specific bullet.
export const MEMORY_OP_MATCH_THRESHOLD = 0.85;

export interface UpdateMemoryParams {
  // Defaults to "ADD" when omitted, preserving pre-Step-5 dispatcher
  // behaviour. Step 6 will teach the model to set this explicitly.
  op?: MemoryOp;
  section: MemorySection;
  // ADD: bullets to append to the section.
  // REPLACE_SECTION: the new contents (only honoured for ACTIVE_FOCUS).
  new_insights?: string[];
  // UPDATE / REMOVE: fuzzy-matched against existing bullets. Required
  // for those ops; ignored otherwise.
  target_text?: string;
  // UPDATE: replacement text for the matched bullet. Required for UPDATE.
  new_text?: string;
  // Caller permission scope. Defaults to all ops.
  allowedOps?: Set<MemoryOp>;
}

// =============================================================================
// Episodic memory (agent_memory_events table)
// =============================================================================

// Event types — must stay in sync with the Postgres ENUM
// public.agent_memory_event_type defined in
// migrations/20260426000000_memory_v2_episodic_and_audit.sql.
export type EpisodicEventType =
  | "pattern_observed"
  | "user_correction"
  | "strategy_discussion"
  | "decision_made"
  | "rule_changed";

export const EPISODIC_EVENT_TYPES: EpisodicEventType[] = [
  "pattern_observed",
  "user_correction",
  "strategy_discussion",
  "decision_made",
  "rule_changed",
];

// Per-day write cap per (user, calendar). Prevents the agent from spamming
// record_event under a runaway prompt. Generous enough to never bite normal
// usage. Mirror of the soft cap discussed in the v2 plan (review C2).
export const EPISODIC_DAILY_WRITE_CAP = 50;

// Recall result limits.
export const EPISODIC_RECALL_DEFAULT_LIMIT = 10;
export const EPISODIC_RECALL_MAX_LIMIT = 50;

// Length bound mirrors the DB CHECK constraint on summary.
export const EPISODIC_SUMMARY_MAX_LENGTH = 500;

export interface EpisodicEvent {
  id: string;
  occurred_at: string; // ISO timestamp
  event_type: EpisodicEventType;
  summary: string;
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface RecordEventInput {
  event_type: EpisodicEventType;
  summary: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface RecallEventsFilter {
  event_types?: EpisodicEventType[];
  tags?: string[];
  since?: string; // ISO timestamp
  query?: string; // text-match against summary (ILIKE)
  limit?: number;
}
