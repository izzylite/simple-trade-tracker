import type {
  OrionTask,
  SupabaseClient,
  TaskResult,
  WeeklyReviewConfig,
} from './types.ts';
import {
  BRIEFING_RENDER_RULES,
  countTradesInRange,
  emptyBriefingResult,
  generateBriefing,
} from './briefing-agent.ts';
import { getToneInstruction } from './tone.ts';

/**
 * Weekly performance review.
 *
 * Pre-query check: count trades in the past 7 days. If zero, skip Orion
 * entirely and return a friendly default — no point spending tokens
 * analysing nothing. Otherwise Orion calls calculate_performance_metrics
 * via execute_sql for this and the prior N weeks.
 */
export async function handleWeeklyReview(
  task: OrionTask,
  supabase: SupabaseClient
): Promise<TaskResult> {
  const config = task.config as unknown as WeeklyReviewConfig;
  const tone = getToneInstruction(config.tone);
  const comparisonWeeks = Math.max(1, config.comparison_weeks ?? 2);

  const now = new Date();
  const dateLabel = now.toISOString().slice(0, 10);
  const defaultTitle = `Weekly Review — week of ${dateLabel}`;

  // Rolling 7-day window — close enough for an activity check. Orion will
  // compute the exact calendar-week range via calculate_performance_metrics.
  const weekStart = new Date(now);
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);

  const tradeCount = await countTradesInRange(
    supabase,
    task.user_id,
    task.calendar_id,
    weekStart.toISOString(),
    now.toISOString()
  );
  if (tradeCount === 0) {
    return emptyBriefingResult(
      'No trades closed this week. Nothing to review.',
      defaultTitle
    );
  }

  const userMessage = `Generate a weekly performance review briefing for the week ending ${dateLabel} (UTC).

COACHING TONE: ${tone}

There were ${tradeCount} closed trade(s) in the past 7 days. Your review must cover:
1. This week's performance (win rate, P&L, trade count, session breakdown)
2. Week-over-week comparison against the previous ${comparisonWeeks} week(s) — highlight improvements and regressions
3. Patterns and observations — emerging setups, recurring mistakes, emotional trends
4. Focus areas for next week — 2-3 concrete actions

Use the calculate_performance_metrics RPC via execute_sql for this week and each comparison week. The function signature is:
  calculate_performance_metrics(p_calendar_id UUID, p_time_period TEXT, p_selected_date TIMESTAMPTZ, p_comparison_tags TEXT[]) RETURNS JSONB
Example call for this week:
  SELECT calculate_performance_metrics('${task.calendar_id}'::uuid, 'week', '${now.toISOString()}'::timestamptz, NULL);
For each comparison week, subtract 7 days from p_selected_date.
Also query the calendars row for target context (weekly_target, win_rate, profit_factor).

Significance guide:
- "high": significant win rate change (>10% absolute), large drawdown, or major pattern shift
- "medium": moderate changes, some notable trends
- "low": steady performance, no major changes

Required HTML sections: Week at a Glance, Performance Trends, Session Breakdown, Patterns & Observations, Focus Areas for Next Week. Keep under 800 words. Use <h4> for section headers, <strong> for key numbers, <ul>/<li> for lists.
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
    // Weekly does more querying than daily — extra budget for iterated RPC calls.
    maxTurns: 25,
  });
}
