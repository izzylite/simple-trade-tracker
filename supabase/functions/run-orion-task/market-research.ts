import { log } from '../_shared/supabase.ts';
import { searchNewsMultiple, searchBreakingMultiple } from './serper.ts';
import { generateContent } from './gemini.ts';
import type {
  OrionTask,
  TaskResult,
  MarketResearchConfig,
  SupabaseClient,
} from './types.ts';
import type { NewsResult } from './serper.ts';

const SESSION_SEARCH_TERMS: Record<string, string> = {
  asia: 'Asian markets Nikkei Shanghai Hang Seng ASX China Japan economic news',
  london: 'European markets FTSE DAX CAC Euro Stoxx UK inflation economic news',
  ny_am: 'US stocks S&P 500 Nasdaq Dow premarket earnings Wall Street',
  ny_pm: 'US market close bond yields Treasury dollar index DXY',
};

const SESSION_CURRENCIES: Record<string, string[]> = {
  asia: ['JPY', 'AUD', 'NZD', 'CNY'],
  london: ['GBP', 'EUR', 'CHF'],
  ny_am: ['USD', 'CAD'],
  ny_pm: ['USD', 'CAD'],
};

// Baseline macro/political/geopolitical queries that run on every briefing —
// these catch market-moving events that transcend specific session indices
// (central bank speakers, executive-branch statements, war/sanctions, commodity shocks).
const BASELINE_MACRO_QUERIES = [
  'Federal Reserve OR FOMC speech statement policy today',
  'ECB OR Bank of England OR Bank of Japan policy commentary today',
  'White House OR US President statement market impact today',
  'geopolitical tension war sanctions markets today',
  'oil price WTI Brent crude today',
  'gold silver commodity prices today',
  'US Treasury yields bond market today',
  'China US trade policy tariffs today',
];

// Queries for breaking content (organic Google search with past-hour filter).
// These catch political posts, flash headlines, and surprise announcements that
// haven't been indexed by Google News yet — targeted at the categories most
// likely to move markets minute-to-minute.
const BREAKING_MACRO_QUERIES = [
  'Trump OR President statement announcement',
  'Federal Reserve OR Powell',
  'ECB OR Lagarde OR Bank of England',
  'ceasefire OR war OR attack markets',
  'breaking news markets',
  'flash crash surge',
];

const SIGNIFICANCE_RANK: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

export async function handleMarketResearch(
  task: OrionTask,
  supabase: SupabaseClient
): Promise<TaskResult | null> {
  const config = task.config as unknown as MarketResearchConfig;

  const [newsBundle, economicEvents, instruments] = await Promise.all([
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

  const allNews = deduplicateNews([...newsBundle.news, ...instrumentNews]);
  const breakingNews = deduplicateNews(newsBundle.breaking);

  const briefingJson = await callGeminiForBriefing(
    config,
    allNews,
    breakingNews,
    economicEvents,
    instruments
  );

  const result = parseBriefingResponse(briefingJson);

  // Market Research is always a surprise monitor — suppress anything below
  // the configured significance threshold so the user isn't spammed on quiet
  // sweeps. No red dot, no card; the run still counts as executed.
  const threshold = config.min_significance ?? 'high';
  const thresholdRank = SIGNIFICANCE_RANK[threshold] ?? 2;
  const resultRank =
    result.significance !== null
      ? SIGNIFICANCE_RANK[result.significance] ?? 0
      : 0;
  if (resultRank < thresholdRank) {
    log('Market research sweep suppressed', 'info', {
      threshold,
      actual: result.significance,
    });
    return null;
  }

  return result;
}

interface CategorizedQueries {
  macro: string[];
  session: string[];
  market: string[];
  custom: string[];
}

function buildSearchQueries(config: MarketResearchConfig): CategorizedQueries {
  const session: string[] = [];
  for (const s of config.sessions) {
    const terms = SESSION_SEARCH_TERMS[s];
    if (terms) session.push(`${terms} today`);
  }

  const market: string[] = config.markets.map(
    (m) => `${m} market outlook today`
  );

  return {
    macro: [...BASELINE_MACRO_QUERIES],
    session,
    market,
    custom: [...config.custom_topics],
  };
}

async function gatherMarketNews(
  config: MarketResearchConfig
): Promise<{ news: NewsResult[]; breaking: NewsResult[] }> {
  const queries = buildSearchQueries(config);

  // Fewer results per macro query (many queries; avoid flooding the prompt).
  // More per session/market (focused, higher signal).
  const [macroNews, sessionNews, marketNews, customNews, breakingNews] =
    await Promise.all([
      queries.macro.length > 0
        ? searchNewsMultiple(queries.macro, 3)
        : Promise.resolve([]),
      queries.session.length > 0
        ? searchNewsMultiple(queries.session, 5)
        : Promise.resolve([]),
      queries.market.length > 0
        ? searchNewsMultiple(queries.market, 4)
        : Promise.resolve([]),
      queries.custom.length > 0
        ? searchNewsMultiple(queries.custom, 4)
        : Promise.resolve([]),
      // Breaking: organic search with past-hour filter for flash content
      searchBreakingMultiple(BREAKING_MACRO_QUERIES, 'qdr:h', 3),
    ]);

  return {
    news: [...macroNews, ...sessionNews, ...marketNews, ...customNews],
    breaking: breakingNews,
  };
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
  breaking: NewsResult[],
  events: EconomicEvent[],
  instruments: string[]
): Promise<string> {
  const systemPrompt = `You are Orion, an AI trading surprise detector. Every ${config.frequency_minutes ?? 30} minutes you sweep the market for catalysts. You only alert the trader when something actually happened — scheduled briefings don't exist in this system, so if nothing market-moving is present, rate significance="low" and keep the briefing brief (the UI will suppress it).

When a surprise IS present (breaking content with a real catalyst, unexpected central-bank speech, political statement, geopolitical shock, major data miss), rate it at the appropriate level ("medium" or "high") and OPEN the briefing with one sentence telling the trader:
1. What exactly happened
2. Which assets are moving and by how much
3. What the expected follow-through is (if any)

Respond ONLY with a JSON object in this exact format:
{
  "significance": "low" | "medium" | "high",
  "title": "Short briefing title (max 60 chars)",
  "briefing_html": "HTML formatted briefing",
  "briefing_plain": "Plain text version of the briefing"
}

Breaking content (past-hour items in the user prompt) outranks everything else. If there IS a breaking item — a political post, a ceasefire announcement, a central-bank surprise, a flash headline — that is the lede. Open the briefing with it.

Absent breaking content, prioritize these catalyst categories when scanning the news (from highest impact to lowest):
1. Central bank decisions and speeches (Fed, ECB, BoE, BoJ, PBoC)
2. Political statements from heads of state, executive orders, trade policy moves, presidential posts/tweets
3. Geopolitical shocks — wars, sanctions, coups, major diplomatic events
4. Scheduled economic data releases (CPI, NFP, GDP, PMI) and surprise data
5. Commodity shocks (oil supply, OPEC, gold safe-haven flows)
6. Bond market signals (yield curve, Treasury auctions, credit spreads)
7. Major corporate catalysts (mega-cap earnings, M&A, regulatory action)
8. Session-specific index moves

Significance guide:
- "high": Central bank surprise, major political/geopolitical shock, large unexpected data miss, commodity supply disruption
- "medium": Scheduled high-impact data, central bank speakers on-script, notable earnings, moderate market moves
- "low": Routine session with no major catalysts

HTML formatting rules:
- Use <h4> for section headers
- Use <p> for paragraphs
- Use <ul>/<li> for lists
- Use <strong> for emphasis on names, data, and numbers
- Keep total length under 800 words
- Required sections in order: Key Catalysts (political/central bank/geopolitical top-of-mind), Economic Calendar (today and tomorrow), Market Outlook (sessions and sentiment)
- Add an Instrument Focus section only if instruments are provided
- If a headline mentions a specific politician, central banker, or country, name them explicitly in the briefing`;

  const newsSection =
    news.length > 0
      ? news
          .slice(0, 30)
          .map(
            (n) =>
              `- [${n.source || 'Web'}] ${n.title}: ${n.snippet}` +
              `${n.date ? ` (${n.date})` : ''}`
          )
          .join('\n')
      : 'No recent news found.';

  const breakingSection =
    breaking.length > 0
      ? breaking
          .slice(0, 15)
          .map(
            (n) =>
              `- [${n.source || 'Web'}] ${n.title}: ${n.snippet}` +
              `${n.date ? ` (${n.date})` : ''}`
          )
          .join('\n')
      : 'No breaking content in the past hour.';

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

## Breaking Content (past hour — TREAT AS HIGHEST PRIORITY)
These items were published in the last 60 minutes. A political post, ceasefire announcement, central-bank speaker line, or surprise headline here is almost certainly the day's top catalyst. If any item describes a head-of-state statement, military/diplomatic action, central-bank surprise, or major data miss, raise significance to "high" and lead the briefing with it.

${breakingSection}

## Recent Market News (past day)
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
