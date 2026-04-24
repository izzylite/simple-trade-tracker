import type {
  DailyAnalysisConfig,
  OrionTask,
  SupabaseClient,
  TaskResult,
} from './types.ts';
import {
  BRIEFING_RENDER_RULES,
  countTradesInRange,
  emptyBriefingResult,
  generateBriefing,
} from './briefing-agent.ts';
import { getToneInstruction } from './tone.ts';

/**
 * End-of-day trading coach briefing.
 *
 * Flow:
 *   1. Pre-query: count today's trades. If zero, return a friendly default
 *      without invoking Orion — saves the token cost on days the user didn't
 *      trade.
 *   2. Otherwise hand the job to the Orion agent (same one chat uses). It
 *      queries trades/metrics itself via execute_sql and generates the
 *      briefing in its own voice, with memory for continuity across days.
 */
export async function handleDailyAnalysis(
  task: OrionTask,
  supabase: SupabaseClient
): Promise<TaskResult> {
  const config = task.config as unknown as DailyAnalysisConfig;
  const tone = getToneInstruction(config.tone);

  const now = new Date();
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);
  const dateLabel = todayStart.toISOString().slice(0, 10);
  const defaultTitle = `Daily Analysis — ${dateLabel}`;

  // Pre-query short-circuit: no trades today → no Orion call.
  const tradeCount = await countTradesInRange(
    supabase,
    task.user_id,
    task.calendar_id,
    todayStart.toISOString(),
    tomorrowStart.toISOString()
  );
  if (tradeCount === 0) {
    return emptyBriefingResult(
      'No trades closed today. Enjoy your evening!',
      defaultTitle
    );
  }

  const userMessage = `Generate an end-of-day trade analysis briefing for ${dateLabel} (UTC).

COACHING TONE: ${tone}

There are ${tradeCount} closed trade(s) today. Query them via execute_sql:
  SELECT * FROM trades WHERE user_id = '${task.user_id}' AND calendar_id = '${task.calendar_id}' AND trade_date >= '${todayStart.toISOString()}' AND trade_date < '${tomorrowStart.toISOString()}' ORDER BY trade_date ASC;
Then analyse these dimensions:
1. Rule compliance — risk-per-trade adherence, required tag groups, daily-drawdown limits
2. Emotional patterns — revenge trades (loss followed by larger size or tighter entry), FOMO entries, over-trading, cutting winners early, letting losers run, size escalation after wins
3. Tag correlations — which tag combinations performed well or poorly today
4. Setup quality — did entries match the trader's plans; were R:R ratios honored

Also fetch the calendar's risk/drawdown settings for context.

Significance guide:
- "high": major rule violations, revenge trading, unusual losses, significant drawdown, or exceptional performance
- "medium": mixed results, isolated rule breaks, minor emotional patterns
- "low": routine day, rules followed, expected outcomes

Required HTML sections in order: Day Summary, Trade Breakdown, Rule Compliance, Emotional Patterns, Tag Performance (only if tags are present), Key Takeaway. Keep under 700 words.
${BRIEFING_RENDER_RULES}
Suggested response format (JSON):
{
  "significance": "low" | "medium" | "high",
  "title": "Short title (max 60 chars)",
  "briefing_html": "<h4>...</h4><p>...</p>",
  "briefing_plain": "Plain text version"
}

If you can't return JSON, just return HTML and we'll use defaults.`;

  return generateBriefing({
    userId: task.user_id,
    calendarId: task.calendar_id,
    userMessage,
    defaultTitle,
  });
}
