import { log } from '../_shared/supabase.ts';
import { generateContent } from './gemini.ts';
import type {
  OrionTask,
  TaskResult,
  MonthlyRollupConfig,
  SupabaseClient,
} from './types.ts';

export async function handleMonthlyRollup(
  task: OrionTask,
  supabase: SupabaseClient
): Promise<TaskResult> {
  const config = task.config as unknown as MonthlyRollupConfig;

  const now = new Date();

  const [currentMetrics, chartData, comparisonMonths, calendar, topInstruments] =
    await Promise.all([
      fetchMonthlyMetrics(supabase, task.calendar_id, now),
      fetchChartData(supabase, task.calendar_id, now),
      fetchComparisonMonths(
        supabase,
        task.calendar_id,
        now,
        config.comparison_months
      ),
      fetchCalendarContext(supabase, task.calendar_id),
      fetchInstrumentRankings(supabase, task.user_id, task.calendar_id, now),
    ]);

  const briefingJson = await callGeminiForMonthlyRollup(
    currentMetrics,
    chartData,
    comparisonMonths,
    calendar,
    topInstruments
  );

  return parseRollupResponse(briefingJson);
}

async function fetchMonthlyMetrics(
  supabase: SupabaseClient,
  calendarId: string,
  date: Date
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.rpc(
    'calculate_performance_metrics',
    {
      p_calendar_id: calendarId,
      p_time_period: 'month',
      p_selected_date: date.toISOString(),
      p_comparison_tags: null,
    }
  );

  if (error) {
    log('Failed to fetch monthly metrics', 'error', error);
    return null;
  }
  return data;
}

async function fetchChartData(
  supabase: SupabaseClient,
  calendarId: string,
  date: Date
): Promise<unknown[] | null> {
  const { data, error } = await supabase.rpc('calculate_chart_data', {
    p_calendar_id: calendarId,
    p_time_period: 'month',
    p_selected_date: date.toISOString(),
  });

  if (error) {
    log('Failed to fetch chart data', 'error', error);
    return null;
  }
  return data;
}

async function fetchComparisonMonths(
  supabase: SupabaseClient,
  calendarId: string,
  endDate: Date,
  numMonths: number
): Promise<Array<{ month: string; metrics: Record<string, unknown> | null }>> {
  const results: Array<{ month: string; metrics: Record<string, unknown> | null }> = [];

  for (let i = 1; i <= numMonths; i++) {
    const monthDate = new Date(endDate);
    monthDate.setMonth(monthDate.getMonth() - i);

    const { data, error } = await supabase.rpc(
      'calculate_performance_metrics',
      {
        p_calendar_id: calendarId,
        p_time_period: 'month',
        p_selected_date: monthDate.toISOString(),
        p_comparison_tags: null,
      }
    );

    const monthLabel = monthDate.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    results.push({
      month: monthLabel,
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
      'account_balance, current_balance, monthly_target, yearly_target, ' +
      'win_rate, profit_factor, total_trades, max_drawdown, ' +
      'monthly_pnl, yearly_pnl'
    )
    .eq('id', calendarId)
    .single();

  if (error) {
    log('Failed to fetch calendar context', 'error', error);
    return null;
  }
  return data;
}

async function fetchInstrumentRankings(
  supabase: SupabaseClient,
  userId: string,
  calendarId: string,
  date: Date
): Promise<InstrumentStat[]> {
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);

  const { data, error } = await supabase
    .from('trades')
    .select('name, amount, trade_type')
    .eq('user_id', userId)
    .eq('calendar_id', calendarId)
    .eq('is_deleted', false)
    .gte('trade_date', monthStart.toISOString())
    .not('name', 'is', null);

  if (error) {
    log('Failed to fetch instrument data', 'error', error);
    return [];
  }

  const byName: Record<string, { pnl: number; wins: number; losses: number; total: number }> = {};
  for (const t of data ?? []) {
    if (!t.name) continue;
    if (!byName[t.name]) byName[t.name] = { pnl: 0, wins: 0, losses: 0, total: 0 };
    byName[t.name].pnl += Number(t.amount);
    byName[t.name].total += 1;
    if (t.trade_type === 'win') byName[t.name].wins += 1;
    if (t.trade_type === 'loss') byName[t.name].losses += 1;
  }

  return Object.entries(byName)
    .map(([name, stats]) => ({
      name,
      pnl: stats.pnl,
      wins: stats.wins,
      losses: stats.losses,
      total: stats.total,
      winRate: stats.total > 0 ? (stats.wins / stats.total) * 100 : 0,
    }))
    .sort((a, b) => b.pnl - a.pnl);
}

async function callGeminiForMonthlyRollup(
  currentMetrics: Record<string, unknown> | null,
  chartData: unknown[] | null,
  comparisonMonths: Array<{ month: string; metrics: Record<string, unknown> | null }>,
  calendar: Record<string, unknown> | null,
  instruments: InstrumentStat[]
): Promise<string> {
  const systemPrompt = `You are Orion, an AI trading analyst. Generate a comprehensive monthly performance rollup.

Respond ONLY with a JSON object in this exact format:
{
  "significance": "low" | "medium" | "high",
  "title": "Short title (max 60 chars)",
  "briefing_html": "HTML formatted rollup",
  "briefing_plain": "Plain text version"
}

Significance guide:
- "high": Significant equity curve changes, major drawdown events, notable month-over-month shifts
- "medium": Moderate performance, some trends worth noting
- "low": Steady month, consistent with prior performance

HTML formatting rules:
- Use <h4> for section headers
- Use <p> for paragraphs, <ul>/<li> for lists, <strong> for emphasis
- Use <table> for instrument rankings (columns: Instrument, Trades, Win Rate, P&L)
- Keep under 1000 words
- Include sections: Month at a Glance, Instrument Rankings, Equity Curve Analysis, Month-over-Month Comparison, Strategic Recommendations`;

  const metricsText = currentMetrics
    ? JSON.stringify(currentMetrics, null, 2)
    : 'No performance data available.';

  const chartText = chartData && chartData.length > 0
    ? `Equity curve data (date, pnl, cumulative):\n${JSON.stringify(chartData, null, 2)}`
    : 'No chart data available.';

  const comparisonText = comparisonMonths
    .map((m) =>
      m.metrics
        ? `${m.month}: ${JSON.stringify(m.metrics, null, 2)}`
        : `${m.month}: No data`
    )
    .join('\n\n');

  const instrumentText = instruments.length > 0
    ? instruments
        .map(
          (i) =>
            `${i.name}: ${i.total} trades | Win rate: ${i.winRate.toFixed(0)}% | P&L: $${i.pnl.toFixed(2)}`
        )
        .join('\n')
    : 'No instrument data.';

  const calendarText = calendar
    ? `Account: $${(calendar as any).account_balance} | Current: $${(calendar as any).current_balance} | ` +
      `Monthly target: $${(calendar as any).monthly_target || 'Not set'} | ` +
      `Max drawdown: ${(calendar as any).max_drawdown || 0}% | ` +
      `Monthly P&L: $${(calendar as any).monthly_pnl || 0}`
    : 'Calendar context unavailable.';

  const userPrompt = `Generate a comprehensive monthly performance rollup.

## This Month's Performance Metrics
${metricsText}

## Equity Curve
${chartText}

## Instrument Rankings
${instrumentText}

## Previous ${comparisonMonths.length} Month(s) for Comparison
${comparisonText}

## Account Context
${calendarText}

Analyze the full month. Rank instruments. Assess the equity curve for drawdown events. Compare month-over-month. Generate the JSON rollup now.`;

  return generateContent(systemPrompt, userPrompt);
}

function parseRollupResponse(rawJson: string): TaskResult {
  try {
    const parsed = JSON.parse(rawJson);
    return {
      content_html: parsed.briefing_html || '<p>Rollup unavailable.</p>',
      content_plain: parsed.briefing_plain || 'Rollup unavailable.',
      significance: ['low', 'medium', 'high'].includes(parsed.significance)
        ? parsed.significance
        : null,
      metadata: {
        title: parsed.title || 'Monthly Rollup',
        generated_at: new Date().toISOString(),
      },
    };
  } catch {
    log('Failed to parse monthly rollup response', 'error', {
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

interface InstrumentStat {
  name: string;
  pnl: number;
  wins: number;
  losses: number;
  total: number;
  winRate: number;
}
