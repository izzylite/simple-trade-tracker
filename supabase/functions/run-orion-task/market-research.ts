import { log } from '../_shared/supabase.ts';
import {
  searchNewsMultiple,
  searchNewsMultipleCached,
  searchBreakingMultipleCached,
} from './serper.ts';
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
// Breaking-content queries. Deliberately no politician, central banker, or
// head-of-state names hardcoded — those change with elections/appointments
// and would need code updates. "US President" / "Fed Chair" / "ECB" etc. are
// role-based and stable across administrations.
const BREAKING_MACRO_QUERIES = [
  'US President statement announcement',
  'White House policy announcement',
  'Federal Reserve Chair statement',
  'ECB OR Bank of England policy',
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

  const [newsBundle, economicEvents, instruments, recentBriefings] =
    await Promise.all([
      gatherMarketNews(supabase, config),
      fetchUpcomingEvents(supabase, config.sessions),
      config.instrument_aware
        ? fetchRecentInstruments(supabase, task.user_id, task.calendar_id)
        : Promise.resolve([]),
      fetchRecentBriefings(supabase, task.id, 3),
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
    instruments,
    recentBriefings
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

  // Attach citations so the UI can render a "Sources" pill on the card.
  // Take up to 6 unique-domain URLs from the news pool fed to Gemini.
  const citations = buildCitations([...allNews, ...breakingNews]);
  if (citations.length > 0) {
    result.metadata = { ...result.metadata, citations };
  }

  return result;
}

interface CitationEntry {
  id: string;
  url: string;
  title?: string;
  source?: string;
  toolName: string;
}

function buildCitations(news: NewsResult[]): CitationEntry[] {
  const seen = new Set<string>();
  const out: CitationEntry[] = [];
  for (const item of news) {
    if (!item.link) continue;
    let domain: string;
    try { domain = new URL(item.link).hostname.replace(/^www\./, ''); }
    catch { continue; }
    if (seen.has(domain)) continue;
    seen.add(domain);
    out.push({
      id: `${domain}-${out.length}`,
      url: item.link,
      title: item.title,
      source: item.source || domain,
      toolName: 'search_web',
    });
    if (out.length >= 6) break;
  }
  return out;
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

// Cache TTLs:
//   NEWS_TTL: 5 min — news articles don't change meaningfully within a window
//     that short, and with 14 shared queries × N users we collapse to 14 total
//     Serper calls per 5-min window across the whole user base.
//   BREAKING_TTL: 2 min — breaking content needs to be fresher, but same
//     sharing logic applies.
//   Custom topics and instrument queries skip the cache (rarely shared).
const NEWS_CACHE_TTL_SECONDS = 300;
const BREAKING_CACHE_TTL_SECONDS = 120;

async function gatherMarketNews(
  supabase: SupabaseClient,
  config: MarketResearchConfig
): Promise<{ news: NewsResult[]; breaking: NewsResult[] }> {
  const queries = buildSearchQueries(config);

  // Shared queries (macro/session/market/breaking) hit the cache.
  // Per-user queries (custom topics) bypass it.
  const [macroNews, sessionNews, marketNews, customNews, breakingNews] =
    await Promise.all([
      queries.macro.length > 0
        ? searchNewsMultipleCached(
            supabase,
            queries.macro,
            3,
            NEWS_CACHE_TTL_SECONDS
          )
        : Promise.resolve([]),
      queries.session.length > 0
        ? searchNewsMultipleCached(
            supabase,
            queries.session,
            5,
            NEWS_CACHE_TTL_SECONDS
          )
        : Promise.resolve([]),
      queries.market.length > 0
        ? searchNewsMultipleCached(
            supabase,
            queries.market,
            4,
            NEWS_CACHE_TTL_SECONDS
          )
        : Promise.resolve([]),
      queries.custom.length > 0
        ? searchNewsMultiple(queries.custom, 4)
        : Promise.resolve([]),
      searchBreakingMultipleCached(
        supabase,
        BREAKING_MACRO_QUERIES,
        'qdr:h',
        3,
        BREAKING_CACHE_TTL_SECONDS
      ),
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

interface RecentBriefing {
  title: string;
  content_plain: string;
  created_at: string;
}

// Pull the last N briefings this task already produced. We feed them into the
// Gemini prompt so the LLM can detect "same event, already reported" and rate
// the current sweep as `low` (which the threshold filter will suppress). Without
// this, a news event that stays in the cycle for hours would re-fire an alert
// on every sweep.
async function fetchRecentBriefings(
  supabase: SupabaseClient,
  taskId: string,
  limit: number
): Promise<RecentBriefing[]> {
  const { data, error } = await supabase
    .from('orion_task_results')
    .select('metadata, content_plain, created_at')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    log('Failed to fetch recent briefings', 'error', error);
    return [];
  }

  return (data ?? []).map((r) => ({
    title:
      (r.metadata as { title?: string } | null)?.title ?? 'Previous briefing',
    content_plain: r.content_plain ?? '',
    created_at: r.created_at,
  }));
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
  instruments: string[],
  recentBriefings: RecentBriefing[]
): Promise<string> {
  const systemPrompt = `You are Orion, an AI trading surprise detector. Every ${config.frequency_minutes ?? 30} minutes you sweep the market for catalysts. You only alert the trader when something actually happened — scheduled briefings don't exist in this system, so if nothing market-moving is present, rate significance="low" and keep the briefing brief (the UI will suppress it).

When a surprise IS present (breaking content with a real catalyst, unexpected central-bank speech, political statement, geopolitical shock, major data miss), rate it at the appropriate level ("medium" or "high") and OPEN the briefing with one sentence telling the trader:
1. What exactly happened
2. Which assets are moving and by how much
3. What the expected follow-through is (if any)

DEDUPLICATION (critical to avoid spam — default to suppressing):
You will be shown a "Previously Reported" section listing briefings this same task has already sent the trader in the past 90 minutes. The trader has ALREADY READ those. Your job now is to ask: "What has happened that the trader does not yet know?"

Two briefings report the SAME EVENT if they share the same central catalyst, regardless of framing, headline, or which angle you emphasize. Rephrasing, re-headlining, or shifting emphasis from one consequence of the same event to another is NOT a new event. Examples of what counts as duplication:
- Previous: "Shipping lane closure triggers oil spike"
  Current: "President threatens trading partner as shipping lane blockade escalates"
  → SAME EVENT (both center on the same underlying closure and its ripple effects). Return "low".
- Previous: "Fed Chair hints at dovish pivot"
  Current: "Fed Chair's speech calms markets, Nasdaq rallies"
  → SAME EVENT. Return "low".

Examples of GENUINELY NEW:
- Previous: "Country-A / Country-B ceasefire announced"
  Current: "Country-A launches retaliation strike 2 hours after ceasefire"
  → NEW (an actual new event, not a rephrase). Return "high".
- Previous: "Central bank rate decision pending at 12:00 UTC"
  Current: "Central bank surprise 50 bps cut, currency −200 pips"
  → NEW (the decision itself is a distinct event from the anticipation). Return "high".

DEFAULT RULE: If you are uncertain whether the current news cycle contains genuinely new events the trader doesn't already know, return significance="low". Being silent when there's doubt is the correct choice — the trader prefers a quiet system that only speaks when something real happens.

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

  const previouslyReportedSection =
    recentBriefings.length > 0
      ? recentBriefings
          .map(
            (b, i) =>
              `[${i + 1}] Sent at ${b.created_at}\n` +
              `    Title: ${b.title}\n` +
              `    Body: ${b.content_plain.substring(0, 500)}${b.content_plain.length > 500 ? '...' : ''}`
          )
          .join('\n\n')
      : '(No previous briefings — this is the first for this task.)';

  const userPrompt = `Generate a market research briefing for the following sessions: ${config.sessions.join(', ')}.
Markets of interest: ${config.markets.join(', ')}.

## Previously Reported (DEDUPLICATE AGAINST THESE)
These are briefings already sent to the trader for this same task. Do NOT re-surface these events unless there is a genuinely new development. If the current news cycle is dominated by these already-reported stories, return significance="low" and keep the briefing brief — the system will suppress the output.

${previouslyReportedSection}

## Breaking Content (past hour — TREAT AS HIGHEST PRIORITY)
These items were published in the last 60 minutes. A political post, ceasefire announcement, central-bank speaker line, or surprise headline here is almost certainly the day's top catalyst. If any item describes a head-of-state statement, military/diplomatic action, central-bank surprise, or major data miss — AND is not already in the Previously Reported section — raise significance to "high" and lead the briefing with it.

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
