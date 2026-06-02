/**
 * Agent Configuration — Model, thinking level, media resolution, seed,
 * code-execution toggle, and preflight threshold.
 *
 * All values are read from environment variables at module load time so
 * a deploy-time flip (e.g. canary a new model in staging) takes effect
 * without a code change.
 */

export const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';

// Gemini 3 thinking level: "minimal" | "low" | "medium" | "high".
// Default "medium" — enough reasoning for multi-step analysis without burning
// the token budget on shallow tool-routing queries.
export const THINKING_LEVEL = Deno.env.get('GEMINI_THINKING_LEVEL') ?? 'medium';

// Valid Gemini 3 thinking levels. Chat exposes only low/medium/high to users
// (Fast/Balanced/Deep); `minimal` stays internal. Used to validate the
// per-request `thinkingLevel` from the client so a malformed value can't reach
// the Gemini body. See: https://ai.google.dev/gemini-api/docs/thinking
export type ThinkingLevel = 'minimal' | 'low' | 'medium' | 'high';
export const VALID_THINKING_LEVELS: ReadonlySet<string> = new Set([
  'minimal',
  'low',
  'medium',
  'high',
]);

/**
 * Resolve the thinking level for an interactive chat turn. Precedence:
 *   client-sent value (validated) → GEMINI_THINKING_LEVEL env → 'low'.
 * The 'low' floor makes chat fast-by-default even if the env var is unset;
 * the client's Fast/Balanced/Deep control overrides per request. Reminder
 * and batch (market-research) paths never call this — they keep their own
 * defaults.
 */
export function resolveChatThinkingLevel(raw: unknown): ThinkingLevel {
  if (typeof raw === 'string' && VALID_THINKING_LEVELS.has(raw)) {
    return raw as ThinkingLevel;
  }
  if (VALID_THINKING_LEVELS.has(THINKING_LEVEL)) {
    return THINKING_LEVEL as ThinkingLevel;
  }
  return 'low';
}

// Gemini 3 mediaResolution. API expects the enum constants
// "MEDIA_RESOLUTION_LOW" | "MEDIA_RESOLUTION_MEDIUM" | "MEDIA_RESOLUTION_HIGH"
// (not the lowercase names from the prose docs — those return 400). Default
// MEDIUM for chart screenshots: HIGH wastes tokens on typical resolutions,
// LOW loses candlestick detail. Env accepts the short name for convenience.
// See: https://ai.google.dev/gemini-api/docs/vision#media-resolution
const MEDIA_RESOLUTION_MAP: Record<string, string> = {
  low: 'MEDIA_RESOLUTION_LOW',
  medium: 'MEDIA_RESOLUTION_MEDIUM',
  high: 'MEDIA_RESOLUTION_HIGH',
};
export const MEDIA_RESOLUTION = MEDIA_RESOLUTION_MAP[
  (Deno.env.get('GEMINI_MEDIA_RESOLUTION') ?? 'medium').toLowerCase()
] ?? 'MEDIA_RESOLUTION_MEDIUM';

// Optional deterministic seed for testing / eval reproducibility. When unset
// (production default) Gemini samples freely. Set GEMINI_SEED to a number to
// pin generation — used by orion-quality-check skill to detect regressions.
const GEMINI_SEED_RAW = Deno.env.get('GEMINI_SEED');
export const GEMINI_SEED = GEMINI_SEED_RAW && !Number.isNaN(Number(GEMINI_SEED_RAW))
  ? Number(GEMINI_SEED_RAW)
  : undefined;

// Toggle Gemini's built-in code_execution tool. Off by default — when on, the
// model can run Python sandboxed and return results inline. Useful for math /
// stats calculations the agent would otherwise approximate.
// See: https://ai.google.dev/gemini-api/docs/code-execution
export const ENABLE_CODE_EXECUTION = Deno.env.get('GEMINI_ENABLE_CODE_EXECUTION') === 'true';

// Preflight countTokens guard. When a request's contents serialise larger than
// this many KB, we call models:countTokens first and refuse if total tokens
// would exceed PROMPT_TOKEN_LIMIT. Off by default; set GEMINI_PREFLIGHT_KB to
// a number (e.g. 200) to enable. See: https://ai.google.dev/gemini-api/docs/tokens
export const PREFLIGHT_KB_THRESHOLD = (() => {
  const v = Number(Deno.env.get('GEMINI_PREFLIGHT_KB'));
  return Number.isFinite(v) && v > 0 ? v : 0; // 0 = disabled
})();
export const PROMPT_TOKEN_LIMIT = 900_000; // ~90% of 1M context, leaves room for output

export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
