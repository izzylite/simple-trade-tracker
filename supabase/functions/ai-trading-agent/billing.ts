/**
 * Orion token billing and per-turn cost audit logging.
 *
 * billOrionTokensForRound: delta-bills the user's monthly Orion token meter
 * for one Gemini round. Fires via EdgeRuntime.waitUntil so it survives the
 * 150s wall-clock cutoff without delaying the response.
 *
 * logTurnAudit: emits one greppable per-turn log line tying token cost to a
 * conversation and the tools that ran.
 */

import { log } from '../_shared/supabase.ts';
import { estimateTurnCost, formatCostLine, type UsageRound } from '../_shared/geminiCost.ts';
import { incrementOrionTokens } from '../_shared/tierEnforcement.ts';
import { MODEL } from './agentConfig.ts';

/**
 * Coerce a usageMetadata field to a finite non-negative integer.
 * Gemini's usageMetadata sometimes ships partial payloads (cache-only
 * round, error-stripped response). `Number(undefined) = NaN`, and NaN
 * propagates through buildGate into the FE meter as "NaN%". This keeps
 * the gate output well-formed even when inputs aren't.
 */
export function finiteOrZero(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Bill the user's monthly Orion token meter for one Gemini round's full
 * consumption (prompt + output + thoughts). Fire-and-forget via
 * `EdgeRuntime.waitUntil` per memory `project_edge_fn_waituntil_persist` —
 * keeps the response fast and survives the 150s wall-clock cutoff that ends
 * the request early. Called from EVERY site that pushes to `roundUsages` so
 * every Gemini turn (initial, retry, continuation, synthesis, correction)
 * gets billed once and only once.
 */
export function billOrionTokensForRound(
  userId: string,
  usage: Record<string, unknown> | undefined,
  prevPromptTokens = 0
): void {
  if (!usage) return;
  // Delta-bill the prompt: each continuation round's promptTokenCount includes
  // the full growing prefix (system + history + all prior tool results).
  // Summing raw promptTokenCount across rounds would charge the shared prefix
  // N times. Instead, bill only the tokens added since the previous round.
  const promptDelta = Math.max(0, finiteOrZero(usage.promptTokenCount) - prevPromptTokens);
  const roundTotalTokens =
    promptDelta +
    finiteOrZero(usage.candidatesTokenCount) +
    finiteOrZero(usage.thoughtsTokenCount);
  if (roundTotalTokens <= 0) return;
  // @ts-ignore -- EdgeRuntime is Supabase-runtime-global, not in Deno types.
  EdgeRuntime.waitUntil(
    incrementOrionTokens(userId, roundTotalTokens)
      .then((res) => {
        if (res && res.consumed >= res.budget) {
          log('Orion budget exhausted post-round; next request will be blocked', 'info', {
            userId,
            consumed: res.consumed,
            budget: res.budget,
          });
        }
      })
      .catch((err) => log('Token increment failed', 'warn', err))
  );
}

/**
 * Emit one greppable per-turn audit line tying token cost to a conversation
 * and the tools that ran. This is the lightweight observability we keep
 * pre-telemetry-table (see CLAUDE.md "deferred: orion_tool_telemetry"):
 * 24h edge logs become filterable by conversationId during debugging, and
 * the firstPrompt→finalPrompt delta shows how much tool results (e.g. a
 * recall_conversations get returning a transcript page) inflated the
 * context this turn.
 *
 * Grep: `[TurnAudit] conv=<id>` for one conversation, or `tools=*recall*`
 * to find recall-heavy turns. firstPrompt = the turn's initial round
 * prompt; finalPrompt = the last round's prompt (the gap is mostly
 * tool-result tokens that DON'T persist into the next turn's history).
 */
export function logTurnAudit(
  conversationId: string | undefined,
  functionCalls: Array<{ name: string }>,
  firstRoundUsage: Record<string, unknown> | undefined,
  lastUsage: Record<string, unknown> | undefined,
  // Per-round usage snapshots so we can compute end-to-end dollar cost.
  // Optional for backward compat — when omitted, the [USAGE_DOLLARS] line
  // is skipped and only the existing [TurnAudit] line is emitted.
  roundUsages?: Array<Record<string, unknown>>,
): void {
  const toolNames = functionCalls.map((f) => f.name);
  const firstPrompt = Number(firstRoundUsage?.promptTokenCount ?? 0);
  const finalPrompt = Number(lastUsage?.promptTokenCount ?? 0);
  const finalOutput = Number(lastUsage?.candidatesTokenCount ?? 0);
  log(
    `[TurnAudit] conv=${conversationId ?? 'none'} ` +
    `tools=[${toolNames.join(',')}] ` +
    `firstPrompt=${firstPrompt} finalPrompt=${finalPrompt} ` +
    `toolInflation=${finalPrompt - firstPrompt} output=${finalOutput}`,
    'info'
  );

  // Dollar-cost line. Same observability cadence (one per turn) but charges
  // the FRESH portion of each round's prompt at the input rate and the
  // CACHED portion at the cache rate — matches Gemini's billing model.
  // Skipped when no round usages were captured (e.g. error paths).
  if (roundUsages && roundUsages.length > 0) {
    const breakdown = estimateTurnCost(roundUsages as UsageRound[], MODEL);
    log(formatCostLine(breakdown), 'info');
  }
}
