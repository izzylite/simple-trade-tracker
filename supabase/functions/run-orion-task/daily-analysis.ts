import { log } from '../_shared/supabase.ts';
import { generateContent } from './gemini.ts';
import type {
  OrionTask,
  TaskResult,
  DailyAnalysisConfig,
  SupabaseClient,
} from './types.ts';

const TONE_INSTRUCTIONS: Record<string, string> = {
  tough_love:
    'Be direct and challenging. Call out mistakes bluntly. ' +
    'Push the trader to be better. No sugar-coating. ' +
    'Example: "You broke your own rules again on trade #3. This is a pattern."',
  blunt_analyst:
    'Be factual and analytical. No emotional language. ' +
    'Present data objectively with clear conclusions. ' +
    'Example: "Win rate today: 40%. Below your 30-day average of 58%."',
  supportive_mentor:
    'Be encouraging but honest. Acknowledge what went well first, ' +
    'then gently address areas for improvement. Frame mistakes as learning. ' +
    'Example: "Good discipline on your first two trades. Let\'s look at what shifted after that."',
};

export async function handleDailyAnalysis(
  task: OrionTask,
  supabase: SupabaseClient
): Promise<TaskResult> {
  const config = task.config as unknown as DailyAnalysisConfig;

  const trades = await fetchTodaysTrades(
    supabase,
    task.user_id,
    task.calendar_id
  );

  if (trades.length === 0) {
    return {
      content_html: '<p>No trades closed today. Enjoy your evening!</p>',
      content_plain: 'No trades closed today. Enjoy your evening!',
      significance: null,
      metadata: { skipped: true, reason: 'zero_trades' },
    };
  }

  const calendar = await fetchCalendarSettings(
    supabase,
    task.calendar_id
  );

  const briefingJson = await callGeminiForAnalysis(
    config,
    trades,
    calendar
  );

  return parseAnalysisResponse(briefingJson);
}

async function fetchTodaysTrades(
  supabase: SupabaseClient,
  userId: string,
  calendarId: string
): Promise<TradeRow[]> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('trades')
    .select(
      'id, name, amount, trade_type, trade_date, ' +
      'entry_price, exit_price, stop_loss, take_profit, ' +
      'risk_to_reward, partials_taken, session, notes, tags'
    )
    .eq('user_id', userId)
    .eq('calendar_id', calendarId)
    .eq('is_deleted', false)
    .gte('trade_date', `${today}T00:00:00`)
    .lte('trade_date', `${today}T23:59:59`)
    .order('trade_date', { ascending: true });

  if (error) {
    log('Failed to fetch today trades', 'error', error);
    return [];
  }
  return data ?? [];
}

async function fetchCalendarSettings(
  supabase: SupabaseClient,
  calendarId: string
): Promise<CalendarSettings | null> {
  const { data, error } = await supabase
    .from('calendars')
    .select(
      'account_balance, risk_per_trade, max_daily_drawdown, ' +
      'weekly_target, monthly_target, required_tag_groups, ' +
      'win_rate, profit_factor, total_trades, current_balance'
    )
    .eq('id', calendarId)
    .single();

  if (error) {
    log('Failed to fetch calendar settings', 'error', error);
    return null;
  }
  return data;
}

async function callGeminiForAnalysis(
  config: DailyAnalysisConfig,
  trades: TradeRow[],
  calendar: CalendarSettings | null
): Promise<string> {
  const toneInstruction = TONE_INSTRUCTIONS[config.tone] || TONE_INSTRUCTIONS.tough_love;

  const wins = trades.filter((t) => t.trade_type === 'win');
  const losses = trades.filter((t) => t.trade_type === 'loss');
  const totalPnl = trades.reduce((sum, t) => sum + Number(t.amount), 0);

  const systemPrompt = `You are Orion, an AI trading coach. Generate an end-of-day trade analysis.

COACHING TONE: ${toneInstruction}

Respond ONLY with a JSON object in this exact format:
{
  "significance": "low" | "medium" | "high",
  "title": "Short title (max 60 chars)",
  "briefing_html": "HTML formatted analysis",
  "briefing_plain": "Plain text version"
}

Significance guide:
- "high": Major rule violations, unusual losses, significant drawdown, or exceptional performance
- "medium": Mixed results, some rule breaks, or notable patterns
- "low": Routine day, rules followed, expected outcomes

HTML formatting rules:
- Use <h4> for section headers
- Use <p> for paragraphs, <ul>/<li> for lists
- Use <strong> for key numbers
- Keep under 600 words
- Include sections: Day Summary, Trade Breakdown, Rule Compliance, Key Takeaway`;

  const tradesText = trades
    .map((t, i) => {
      let line = `Trade ${i + 1}: ${t.name || 'Unnamed'} | ${t.trade_type.toUpperCase()} | $${Number(t.amount).toFixed(2)}`;
      if (t.session) line += ` | Session: ${t.session}`;
      if (t.entry_price && t.exit_price)
        line += ` | Entry: ${t.entry_price} → Exit: ${t.exit_price}`;
      if (t.stop_loss) line += ` | SL: ${t.stop_loss}`;
      if (t.take_profit) line += ` | TP: ${t.take_profit}`;
      if (t.risk_to_reward) line += ` | R:R ${t.risk_to_reward}`;
      if (t.partials_taken) line += ` | Partials taken`;
      if (t.tags && t.tags.length > 0) line += ` | Tags: ${t.tags.join(', ')}`;
      if (t.notes) line += `\n  Notes: ${t.notes.substring(0, 200)}`;
      return line;
    })
    .join('\n');

  const calendarContext = calendar
    ? `Account balance: $${calendar.account_balance}
Current balance: $${calendar.current_balance || calendar.account_balance}
Risk per trade: ${calendar.risk_per_trade || 'Not set'}%
Max daily drawdown: $${calendar.max_daily_drawdown}
Overall win rate: ${calendar.win_rate || 0}%
Required tag groups: ${calendar.required_tag_groups?.join(', ') || 'None'}`
    : 'Calendar settings unavailable.';

  const userPrompt = `Analyze today's trading performance.

## Summary
Total trades: ${trades.length} | Wins: ${wins.length} | Losses: ${losses.length}
Net P&L: $${totalPnl.toFixed(2)}

## Trades
${tradesText}

## Account Context
${calendarContext}

Generate the JSON analysis now.`;

  return generateContent(systemPrompt, userPrompt);
}

function parseAnalysisResponse(rawJson: string): TaskResult {
  try {
    const parsed = JSON.parse(rawJson);
    return {
      content_html: parsed.briefing_html || '<p>Analysis unavailable.</p>',
      content_plain: parsed.briefing_plain || 'Analysis unavailable.',
      significance: ['low', 'medium', 'high'].includes(parsed.significance)
        ? parsed.significance
        : null,
      metadata: {
        title: parsed.title || 'Daily Analysis',
        generated_at: new Date().toISOString(),
      },
    };
  } catch {
    log('Failed to parse daily analysis response', 'error', {
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

interface TradeRow {
  id: string;
  name: string | null;
  amount: number;
  trade_type: string;
  trade_date: string;
  entry_price: number | null;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  risk_to_reward: number | null;
  partials_taken: boolean | null;
  session: string | null;
  notes: string | null;
  tags: string[] | null;
}

interface CalendarSettings {
  account_balance: number;
  risk_per_trade: number | null;
  max_daily_drawdown: number;
  weekly_target: number | null;
  monthly_target: number | null;
  required_tag_groups: string[] | null;
  win_rate: number | null;
  profit_factor: number | null;
  total_trades: number | null;
  current_balance: number | null;
}
