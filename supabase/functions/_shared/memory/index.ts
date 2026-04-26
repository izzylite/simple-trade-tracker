/**
 * Memory module — public surface.
 *
 * Consumers should import from this barrel rather than reaching into the
 * internal files. That keeps the boundary stable as we add operations.ts
 * helpers (UPDATE/REMOVE), episodic.ts, and audit.ts in subsequent steps
 * without rippling through every call site.
 */

export {
  ALL_MEMORY_OPS,
  AUDITED_MEMORY_OPS,
  EPISODIC_DAILY_WRITE_CAP,
  EPISODIC_EVENT_TYPES,
  EPISODIC_RECALL_DEFAULT_LIMIT,
  EPISODIC_RECALL_MAX_LIMIT,
  EPISODIC_SUMMARY_MAX_LENGTH,
  type EpisodicEvent,
  type EpisodicEventType,
  MEMORY_OP_MATCH_THRESHOLD,
  MEMORY_PER_SECTION_CAP,
  MEMORY_SECTION_ORDER,
  MEMORY_SIZE_COMPACT_CHARS,
  MEMORY_SIZE_WARN_CHARS,
  type MemoryOp,
  type MemorySection,
  type RecallEventsFilter,
  type RecordEventInput,
  type UpdateMemoryParams,
} from "./types.ts";

export {
  buildMemoryContent,
  compactSections,
  deduplicateInsights,
  type InsightValidationResult,
  jaccard,
  normalizeMemoryContent,
  parseMemorySections,
  scoreInsight,
  tokenizeForDedup,
  validateInsightBatch,
  validateInsightFormat,
} from "./parser.ts";

export {
  applyRuleChange,
  type ApplyRuleChangeParams,
  fetchMemory,
  updateMemory,
} from "./operations.ts";

export {
  normalizeRecallFilter,
  recallEvents,
  recordEvent,
  validateRecordEventInput,
} from "./episodic.ts";
