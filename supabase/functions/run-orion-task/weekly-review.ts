import { log } from '../_shared/supabase.ts';
import { generateContent } from './gemini.ts';
import type {
  OrionTask,
  TaskResult,
  WeeklyReviewConfig,
  SupabaseClient,
} from './types.ts';

export async function handleWeeklyReview(
  task: OrionTask,
  supabase: SupabaseClient
): Promise<TaskResult> {
  const config = task.config as unknown as WeeklyReviewConfig;

  const now = new Date();

  const [currentMetrics, comparisonMetrics, calendar] = await Promise.all([
    fetchPerformanceMetrics(supabase, task.calendar_id, now),
    fetchComparisonWeeks(supabase, task.calendar_id, now, config.comparison_weeks),
    fetchCalendarContext(supabase, task.calendar_id),
  ]);

  const briefingJson = await callGeminiForWeeklyReview(
    config,
    currentMetrics,
    comparisonMetrics,
    calendar
  );

  return parseReviewResponse(briefingJson, 'Weekly Review');
}

async function fetchPerformanceMetrics(
  supabase: SupabaseClient,
  calendarId: string,
  date: Date
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.rpc(
    'calculate_performance_metrics',
    {
      p_calendar_id: calendarId,
      p_time_period: 'week',
      p_selected_date: date.toISOString(),
      p_comparison_tags: null,
    }
  );

  if (error) {
    log('Failed to fetch weekly metrics', 'error', error);
    return null;
  }
  return data;
}

async function fetchComparisonWeeks(
  supabase: SupabaseClient,
  calendarId: string,
  endDate: Date,
  numWeeks: number
): Promise<Array<{ weekStart: string; metrics: Record<string, unknown> | null }>> {
  const results: Array<{ weekStart: string; metrics: Record<string, unknown> | null }> = [];

  for (let i = 1; i <= numWeeks; i++) {
    const weekDate = new Date(endDate);
    weekDate.setDate(weekDate.getDate() - 7 * i);

    const { data, error } = await supabase.rpc(
      'calculate_performance_metrics',
      {
        p_calendar_id: calendarId,
        p_time_period: 'week',
        p_selected_date: weekDate.toISOString(),
        p_comparison_tags: null,
      }
    );

    results.push({
      weekStart: weekDate.toISOString().split('T')[0],
      metrics: error ? null : data,
    });
  }

  return results;
}

async function fetchCalendarContext(
  supabase: SupabaseClient,
  calendarId: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from('calendars')
    .select(
      'account_balance, current_balance, weekly_target, ' +
      'monthly_target, win_rate, profit_factor, total_trades'
    )
    .eq('id', calendarId)
    .single();

  if (error) {
    log('Failed to fetch calendar context', 'error', error);
    return null;
  }
  return data;
}

async function callGeminiForWeeklyReview(
  config: WeeklyReviewConfig,
  currentMetrics: Record<string, unknown> | null,
  comparisonWeeks: Array<{ weekStart: string; metrics: Record<string, unknown> | null }>,
  calendar: Record<string, unknown> | null
): Promise<string> {
  const systemPrompt = `You are Orion, an AI trading analyst. Generate a weekly performance review.

Respond ONLY with a JSON object in this exact format:
{
  "significance": "low" | "medium" | "high",
  "title": "Short title (max 60 chars)",
  "briefing_html": "HTML formatted review",
  "briefing_plain": "Plain text version"
}

Significance guide:
- "high": Significant win rate change (>10%), large drawdown, or major pattern shift
- "medium": Moderate changes, some notable trends
- "low": Steady performance, no major changes

HTML formatting rules:
- Use <h4> for section headers
- Use <p> for paragraphs, <ul>/<li> for lists, <strong> for emphasis
- Keep under 800 words
- Include sections: Week at a Glance, Performance Trends, Session Breakdown, Patterns & Observations, Focus Areas for Next Week`;

  const currentText = currentMetrics
    ? JSON.stringify(currentMetrics, null, 2)
    : 'No performance data available for this week.';

  const comparisonText = comparisonWeeks
    .map((w) =>
      w.metrics
        ? `Week of ${w.weekStart}: ${JSON.stringify(w.metrics, null, 2)}`
        : `Week of ${w.weekStart}: No data`
    )
    .join('\n\n');

  const calendarText = calendar
    ? `Account: $${(calendar as any).account_balance} | Current: $${(calendar as any).current_balance} | ` +
      `Weekly target: $${(calendar as any).weekly_target || 'Not set'} | ` +
      `Overall win rate: ${(calendar as any).win_rate || 0}%`
    : 'Calendar context unavailable.';

  const userPrompt = `Generate a weekly performance review.

## This Week's Performance
${currentText}

## Previous ${config.comparison_weeks} Week(s) for Comparison
${comparisonText}

## Account Context
${calendarText}

Analyze trends across weeks. Highlight improvements and regressions. Generate the JSON review now.`;

  return generateContent(systemPrompt, userPrompt);
}

function parseReviewResponse(rawJson: string, defaultTitle: string): TaskResult {
  try {
    const parsed = JSON.parse(rawJson);
    return {
      content_html: parsed.briefing_html || '<p>Review unavailable.</p>',
      content_plain: parsed.briefing_plain || 'Review unavailable.',
      significance: ['low', 'medium', 'high'].includes(parsed.significance)
        ? parsed.significance
        : null,
      metadata: {
        title: parsed.title || defaultTitle,
        generated_at: new Date().toISOString(),
      },
    };
  } catch {
    log(`Failed to parse ${defaultTitle} response`, 'error', {
      raw: rawJson.substring(0, 200),
    });
    return {
      content_html: `<p>${rawJson.substring(0, 3000)}</p>`,
      content_plain: rawJson.substring(0, 3000),
      significance: null,
      metadata: { parse_error: true },
    };
  }
}
