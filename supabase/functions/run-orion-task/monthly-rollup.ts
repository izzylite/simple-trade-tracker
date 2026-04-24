import type {
  MonthlyRollupConfig,
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
 * Monthly performance rollup.
 *
 * Pre-query check: count trades in the current calendar month. If zero,
 * skip the Orion invocation. Otherwise Orion fetches the metrics, equity
 * curve, and per-instrument stats itself via execute_sql.
 */
export async function handleMonthlyRollup(
  task: OrionTask,
  supabase: SupabaseClient
): Promise<TaskResult> {
  const config = task.config as unknown as MonthlyRollupConfig;
  const tone = getToneInstruction(config.tone);
  const comparisonMonths = Math.max(1, config.comparison_months ?? 3);

  const now = new Date();
  const monthLabel = now.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  const dateIso = now.toISOString().slice(0, 10);
  const defaultTitle = `Monthly Rollup — ${monthLabel}`;

  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  );
  const nextMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  );

  const tradeCount = await countTradesInRange(
    supabase,
    task.user_id,
    task.calendar_id,
    monthStart.toISOString(),
    nextMonthStart.toISOString()
  );
  if (tradeCount === 0) {
    return emptyBriefingResult(
      `No trades closed in ${monthLabel}. No performance data to analyse.`,
      defaultTitle
    );
  }

  const userMessage = `Generate a comprehensive monthly performance rollup for ${monthLabel} (reference date ${dateIso} UTC).

COACHING TONE: ${tone}

There were ${tradeCount} closed trade(s) this month. Your rollup must cover:
1. Month at a Glance — overall P&L, win rate, trade count, progress vs monthly target
2. Instrument Rankings — query trades grouped by instrument (name column), show trade count, win rate, and P&L per instrument, ranked by P&L
3. Equity Curve Analysis — drawdown events, recovery, streaks
4. Month-over-Month Comparison against the previous ${comparisonMonths} month(s)
5. Strategic Recommendations — what to keep, stop, start next month

Use these tools via execute_sql:
- calculate_performance_metrics(p_calendar_id UUID, p_time_period TEXT, p_selected_date TIMESTAMPTZ, p_comparison_tags TEXT[]) RETURNS JSONB
  This month: SELECT calculate_performance_metrics('${task.calendar_id}'::uuid, 'month', '${now.toISOString()}'::timestamptz, NULL);
  Prior months: subtract 1 month from p_selected_date per comparison month.
- calculate_chart_data(p_calendar_id UUID, p_time_period TEXT, p_selected_date TIMESTAMPTZ) RETURNS JSONB
  Equity curve: SELECT calculate_chart_data('${task.calendar_id}'::uuid, 'month', '${now.toISOString()}'::timestamptz);
- Per-instrument breakdown: SELECT name, amount, trade_type FROM trades WHERE user_id = '${task.user_id}' AND calendar_id = '${task.calendar_id}' AND trade_date >= '${monthStart.toISOString()}' AND trade_date < '${nextMonthStart.toISOString()}';
- calendars row for target context (monthly_target, max_drawdown, etc.)

Significance guide:
- "high": significant equity curve changes, major drawdown events, notable month-over-month shifts
- "medium": moderate performance, some trends worth noting
- "low": steady month, consistent with prior performance

HTML formatting: <h4> section headers, <strong> for key numbers, <ul>/<li> for lists, <table> for the instrument ranking (columns: Instrument, Trades, Win Rate, P&L). Keep under 1000 words.
${BRIEFING_RENDER_RULES}
Suggested response format (JSON):
{
  "significance": "low" | "medium" | "high",
  "title": "Short title (max 60 chars)",
  "briefing_html": "<h4>...</h4><p>...</p><table>...</table>",
  "briefing_plain": "Plain text version"
}

If you can't return JSON, just return HTML and we'll use defaults.`;

  return generateBriefing({
    userId: task.user_id,
    calendarId: task.calendar_id,
    userMessage,
    defaultTitle,
    // Monthly has the heaviest data gathering — per-month comparisons + equity curve + instruments.
    maxTurns: 30,
  });
}
