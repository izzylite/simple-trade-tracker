/**
 * Per-turn USD cost estimator for Gemini calls.
 *
 * Used by ai-trading-agent's `logTurnAudit` to emit a dollar figure
 * alongside the existing token counts. Cheap observability — we already
 * have the per-round `usageMetadata` from each Gemini call; this just
 * sums fresh/cached/output across rounds and multiplies by the model's
 * per-million-token price.
 *
 * Pricing source: https://ai.google.dev/gemini-api/docs/pricing
 *
 * Override per-model pricing via env var `GEMINI_PRICE_OVERRIDE` shaped
 * as JSON like `{"gemini-X": {"input": 1.50, "cached": 0.15, "output": 9.00}}`
 * — useful if pricing changes between deploys without needing a code
 * push to refresh the table.
 *
 * Estimates ONLY — Google's billing uses the same usageMetadata we see,
 * but rounding and unit-pricing tweaks make this directionally accurate,
 * not penny-perfect.
 */

const PRICES_PER_MILLION_TOKENS: Record<
  string,
  { input: number; cached: number; output: number }
> = {
  // Gemini 3 preview tier (paid). Source: ai.google.dev/gemini-api/docs/pricing
  // verified 2026-05-21.
  "gemini-3-flash-preview": { input: 0.50, cached: 0.05, output: 3.00 },
  "gemini-3-pro-preview":   { input: 1.50, cached: 0.15, output: 9.00 },

  // Earlier generations kept here as fallback for anyone still on 2.5
  // models. Numbers from the same docs page (2.5 Standard tier).
  "gemini-2.5-flash":       { input: 0.30, cached: 0.075, output: 2.50 },
  "gemini-2.5-pro":         { input: 1.25, cached: 0.31, output: 10.00 },
  "gemini-2.5-flash-lite":  { input: 0.10, cached: 0.025, output: 0.40 },
};

// Conservative default when GEMINI_MODEL is unrecognized — bias HIGH so
// surprise pricing doesn't hide in the logs. Picks the Pro-tier estimate.
const FALLBACK_PRICE = { input: 1.50, cached: 0.15, output: 9.00 };

function loadOverrides(): Record<string, { input: number; cached: number; output: number }> {
  const raw = Deno.env.get("GEMINI_PRICE_OVERRIDE");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function getPriceForModel(model: string) {
  const overrides = loadOverrides();
  return overrides[model] ?? PRICES_PER_MILLION_TOKENS[model] ?? FALLBACK_PRICE;
}

export interface UsageRound {
  promptTokenCount?: number | string;
  cachedContentTokenCount?: number | string;
  candidatesTokenCount?: number | string;
  thoughtsTokenCount?: number | string;
}

export interface TurnCostBreakdown {
  /** Tokens charged at the full input rate. */
  freshInputTokens: number;
  /** Tokens charged at the cached-input rate (typically 1/4 to 1/10). */
  cachedInputTokens: number;
  /** Output + thinking. Thinking is billed at output rate. */
  outputTokens: number;
  /** Estimated USD cost, rounded to 4 decimal places. */
  usd: number;
  /** Model used for pricing — included for clarity in logs. */
  model: string;
  /** Resolved per-million pricing (after override lookup). */
  pricePerMillion: { input: number; cached: number; output: number };
}

/**
 * Compute the USD cost of a turn from the per-round usageMetadata snapshots.
 *
 * Why "fresh = prompt - cached" instead of just summing promptTokenCount:
 * Gemini's billing splits the prompt into the part that came from the
 * cache prefix (cached) and the part that didn't (fresh). The
 * promptTokenCount field is the total, cachedContentTokenCount is the
 * cached portion. Charging the full input rate on cachedContentTokenCount
 * overcounts cost ~4×.
 */
export function estimateTurnCost(
  rounds: UsageRound[],
  model: string,
): TurnCostBreakdown {
  let freshInputTokens = 0;
  let cachedInputTokens = 0;
  let outputTokens = 0;

  for (const r of rounds) {
    const prompt = Number(r.promptTokenCount ?? 0);
    const cached = Number(r.cachedContentTokenCount ?? 0);
    const candidates = Number(r.candidatesTokenCount ?? 0);
    const thoughts = Number(r.thoughtsTokenCount ?? 0);
    freshInputTokens += Math.max(0, prompt - cached);
    cachedInputTokens += cached;
    outputTokens += candidates + thoughts;
  }

  const p = getPriceForModel(model);
  const usd =
    (freshInputTokens / 1_000_000) * p.input +
    (cachedInputTokens / 1_000_000) * p.cached +
    (outputTokens / 1_000_000) * p.output;

  return {
    freshInputTokens,
    cachedInputTokens,
    outputTokens,
    usd: Math.round(usd * 10_000) / 10_000,
    model,
    pricePerMillion: p,
  };
}

/** Format a TurnCostBreakdown as a single greppable log line suffix. */
export function formatCostLine(c: TurnCostBreakdown): string {
  return (
    `[USAGE_DOLLARS] model=${c.model} ` +
    `fresh=${c.freshInputTokens} cached=${c.cachedInputTokens} output=${c.outputTokens} ` +
    `usd=$${c.usd.toFixed(4)} ` +
    `(rates per 1M: in=$${c.pricePerMillion.input} cached=$${c.pricePerMillion.cached} out=$${c.pricePerMillion.output})`
  );
}
