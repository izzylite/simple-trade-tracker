/**
 * Reserved system note-tag values — Deno mirror.
 *
 * Edge functions cannot import from `src/`, so this file mirrors the
 * frontend constants in `src/types/note.ts`. Keep both in sync — every
 * tag value below MUST exist there with the same value, and vice versa.
 *
 * Used by:
 *  - ai-trading-agent/tools.ts (note CRUD permission checks, tool descriptions)
 *  - ai-trading-agent/systemPrompt.ts (tag list in schema reference)
 *  - ai-trading-agent/index.ts (GUIDELINE reminder injection)
 *  - _shared/orionGuideline.ts (PostgREST `cs.{...}` filter on the GUIDELINE tag)
 */

export const SLASH_COMMAND_TAG = 'SLASH_COMMAND';
export const GUIDELINE_TAG = 'GUIDELINE';
export const GAME_PLAN_TAG = 'GAME_PLAN';
export const LESSON_LEARNED_TAG = 'LESSON_LEARNED';
export const RISK_MANAGEMENT_TAG = 'RISK_MANAGEMENT';
export const PSYCHOLOGY_TAG = 'PSYCHOLOGY';
export const GENERAL_TAG = 'GENERAL';
export const STRATEGY_TAG = 'STRATEGY';
export const INSIGHT_TAG = 'INSIGHT';
export const AGENT_MEMORY_TAG = 'AGENT_MEMORY';

export const SYSTEM_NOTE_TAGS = [
  SLASH_COMMAND_TAG,
  GUIDELINE_TAG,
  GAME_PLAN_TAG,
  LESSON_LEARNED_TAG,
  RISK_MANAGEMENT_TAG,
  PSYCHOLOGY_TAG,
  GENERAL_TAG,
  STRATEGY_TAG,
  INSIGHT_TAG,
  AGENT_MEMORY_TAG,
] as const;
