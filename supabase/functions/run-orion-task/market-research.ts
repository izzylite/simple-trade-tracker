import { log } from '../_shared/supabase.ts';
import { searchNewsMultiple } from './serper.ts';
import { generateContent } from './gemini.ts';
import type {
  OrionTask,
  TaskResult,
  MarketResearchConfig,
  SupabaseClient,
} from './types.ts';
import type { NewsResult } from './serper.ts';

const SESSION_SEARCH_TERMS: Record<string, string> = {
  asia: 'Asian session Nikkei Shanghai Hang Seng ASX',
  london: 'London session FTSE DAX Euro Stoxx European markets',
  ny_am: 'New York morning session S&P 500 Nasdaq Wall Street',
  ny_pm: 'New York afternoon session US market closing',
};

const SESSION_CURRENCIES: Record<string, string[]> = {
  asia: ['JPY', 'AUD', 'NZD', 'CNY'],
  london: ['GBP', 'EUR', 'CHF'],
  ny_am: ['USD', 'CAD'],
  ny_pm: ['USD', 'CAD'],
};

export async function handleMarketResearch(
  task: OrionTask,
  supabase: SupabaseClient
): Promise<TaskResult> {
  const config = task.config as unknown as MarketResearchConfig;

  const [newsResults, economicEvents, instruments] = await Promise.all([
    gatherMarketNews(config),
    fetchUpcomingEvents(supabase, config.sessions),
    config.instrument_aware
      ? fetchRecentInstruments(supabase, task.user_id, task.calendar_id)
      : Promise.resolve([]),
  ]);

  let instrumentNews: NewsResult[] = [];
  if (instruments.length > 0) {
    instrumentNews = await searchNewsMultiple(
      instruments.slice(0, 5).map((i) => `${i} trading analysis today`),
      3
    );
  }

  const allNews = deduplicateNews([...newsResults, ...instrumentNews]);

  const briefingJson = await callGeminiForBriefing(
    config,
    allNews,
    economicEvents,
    instruments
  );

  return parseBriefingResponse(briefingJson);
}

function buildSearchQueries(config: MarketResearchConfig): string[] {
  const queries: string[] = [];

  for (const session of config.sessions) {
    const terms = SESSION_SEARCH_TERMS[session];
    if (terms) {
      queries.push(`${terms} today`);
    }
  }

  for (const market of config.markets) {
    queries.push(`${market} market outlook today`);
  }

  for (const topic of config.custom_topics) {
    queries.push(topic);
  }

  return queries;
}

async function gatherMarketNews(
  config: MarketResearchConfig
): Promise<NewsResult[]> {
  const queries = buildSearchQueries(config);
  if (queries.length === 0) return [];
  return searchNewsMultiple(queries, 5);
}

async function fetchUpcomingEvents(
  supabase: SupabaseClient,
  sessions: string[]
): Promise<EconomicEvent[]> {
  const today = new Date().toISOString().split('T')[0];

  const relevantCurrencies = sessions
    .flatMap((s) => SESSION_CURRENCIES[s] || [])
    .filter((v, i, a) => a.indexOf(v) === i);

  const { data, error } = await supabase
    .from('economic_events')
    .select(
      'id, currency, event_name, impact, event_date, time_utc, ' +
      'actual_value, forecast_value, previous_value'
    )
    .gte('event_date', today)
    .lte('event_date', addDays(today, 1))
    .in('currency', relevantCurrencies)
    .in('impact', ['High', 'Medium'])
    .order('event_date', { ascending: true })
    .order('time_utc', { ascending: true })
    .limit(30);

  if (error) {
    log('Failed to fetch economic events', 'error', error);
    return [];
  }
  return data ?? [];
}

async function fetchRecentInstruments(
  supabase: SupabaseClient,
  userId: string,
  calendarId: string
): Promise<string[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data, error } = await supabase
    .from('trades')
    .select('name')
    .eq('user_id', userId)
    .eq('calendar_id', calendarId)
    .gte('trade_date', thirtyDaysAgo.toISOString())
    .not('name', 'is', null)
    .order('trade_date', { ascending: false })
    .limit(100);

  if (error) {
    log('Failed to fetch recent instruments', 'error', error);
    return [];
  }

  const names = (data ?? [])
    .map((t: { name: string | null }) => t.name)
    .filter((n): n is string => !!n && n.trim().length > 0);

  return [...new Set(names)].slice(0, 10);
}

function deduplicateNews(results: NewsResult[]): NewsResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = r.title.toLowerCase().substring(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function callGeminiForBriefing(
  config: MarketResearchConfig,
  news: NewsResult[],
  events: EconomicEvent[],
  instruments: string[]
): Promise<string> {
  const systemPrompt = `You are Orion, an AI trading assistant. Generate a concise market research briefing.

Respond ONLY with a JSON object in this exact format:
{
  "significance": "low" | "medium" | "high",
  "title": "Short briefing title (max 60 chars)",
  "briefing_html": "HTML formatted briefing",
  "briefing_plain": "Plain text version of the briefing"
}

Significance guide:
- "high": Major market-moving events (central bank decisions, unexpected data, geopolitical shocks)
- "medium": Notable events that could affect trading (scheduled data releases, earnings, moderate moves)
- "low": Routine market conditions, no major catalysts

HTML formatting rules:
- Use <h4> for section headers
- Use <p> for paragraphs
- Use <ul>/<li> for lists
- Use <strong> for emphasis on key data points
- Keep total length under 800 words
- Include sections: Key Headlines, Economic Calendar, Market Outlook
- If instruments are provided, include an Instrument Focus section`;

  const newsSection =
    news.length > 0
      ? news
          .slice(0, 15)
          .map(
            (n) =>
              `- [${n.source || 'Web'}] ${n.title}: ${n.snippet}` +
              `${n.date ? ` (${n.date})` : ''}`
          )
          .join('\n')
      : 'No recent news found.';

  const eventsSection =
    events.length > 0
      ? events
          .map(
            (e) =>
              `- [${e.impact}] ${e.currency} ${e.event_name} at ${e.time_utc}` +
              (e.forecast_value ? ` (forecast: ${e.forecast_value})` : '') +
              (e.previous_value ? ` (prev: ${e.previous_value})` : '') +
              (e.actual_value ? ` (actual: ${e.actual_value})` : '')
          )
          .join('\n')
      : 'No upcoming high/medium impact events.';

  const instrumentSection =
    instruments.length > 0
      ? `Instruments the trader actively trades: ${instruments.join(', ')}`
      : '';

  const userPrompt = `Generate a market research briefing for the following sessions: ${config.sessions.join(', ')}.
Markets of interest: ${config.markets.join(', ')}.

## Recent Market News
${newsSection}

## Upcoming Economic Events (today and tomorrow)
${eventsSection}

${instrumentSection}

Generate the JSON briefing now.`;

  return generateContent(systemPrompt, userPrompt);
}

function parseBriefingResponse(rawJson: string): TaskResult {
  try {
    const parsed = JSON.parse(rawJson);

    return {
      content_html: parsed.briefing_html || '<p>Briefing unavailable.</p>',
      content_plain: parsed.briefing_plain || 'Briefing unavailable.',
      significance: ['low', 'medium', 'high'].includes(parsed.significance)
        ? parsed.significance
        : null,
      metadata: {
        title: parsed.title || 'Market Research',
        generated_at: new Date().toISOString(),
      },
    };
  } catch {
    log('Failed to parse Gemini briefing response', 'error', {
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

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

interface EconomicEvent {
  id: string;
  currency: string;
  event_name: string;
  impact: string;
  event_date: string;
  time_utc: string;
  actual_value: string | null;
  forecast_value: string | null;
  previous_value: string | null;
}
