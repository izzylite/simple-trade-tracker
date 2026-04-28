import { log } from '../_shared/supabase.ts';
import { summarizeToolCalls } from '../_shared/toolLabels.ts';
import {
  searchNewsMultiple,
  searchNewsMultipleCached,
  searchBreakingMultipleCached,
} from '../_shared/searchProvider.ts';
import type { SerperBatchResult } from './serper.ts';
import {
  generateBriefingWithScrape,
  type BriefingWithScrapeResult,
} from './gemini.ts';
import {
  getMarketPrices,
  formatPriceLine,
  type PriceSnapshot,
} from './prices.ts';
import { scrapeArticle } from '../_shared/scrapeProvider.ts';
import { buildMarketResearchSystemPrompt } from './market-research-prompt.ts';
import { buildTemporalContext } from '../ai-trading-agent/systemPrompt.ts';
import {
  symbolsToCurrencies,
  symbolsToReadableNames,
} from './symbols.ts';
import type {
  OrionTask,
  TaskResult,
  MarketResearchConfig,
  SupabaseClient,
} from './types.ts';
import type { NewsResult } from './serper.ts';

// Defensive cap on macro queries per task. Each query fires a search-provider
// call every sweep, so an unbounded list burns API quota linearly. UI enforces
// the same cap at save time; the edge function trims here in case a stale row
// or direct DB edit bypassed validation.
const MAX_MACRO_QUERIES = 10;

const DEFAULT_MACRO_QUERIES = [
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

// `^VIX` is always included as a risk-on/off tell — regardless of what the
// trader watches, a 20% VIX spike is a "something real is happening" signal
// worth showing. Same logic for `DX-Y.NYB` (ICE dollar index) which cross-
// asset traders need whether they trade FX or not. (`DX=F` does not resolve.)
const ALWAYS_ON_SYMBOLS = ['^VIX', 'DX-Y.NYB'];
const MAX_WATCHLIST_SIZE = 12;

// Watchlist = always-on risk tells + user picks, capped. The UI requires
// `watchlist_symbols` to be non-empty at save time, so the user's list is
// always the dominant input here.
function buildWatchlist(customSymbols: string[]): string[] {
  const set = new Set<string>(ALWAYS_ON_SYMBOLS);
  for (const sym of customSymbols) {
    const trimmed = sym.trim();
    if (!trimmed) continue;
    set.add(trimmed);
    if (set.size >= MAX_WATCHLIST_SIZE) break;
  }
  return Array.from(set);
}

export async function handleMarketResearch(
  task: OrionTask,
  supabase: SupabaseClient
): Promise<TaskResult | null> {
  const config = task.config as unknown as MarketResearchConfig;

  // Staleness guard: cache TTL must stay shorter than task frequency, or
  // consecutive runs see identical cached news and briefings go stale.
  const frequencySeconds = (config.frequency_minutes ?? 30) * 60;
  const effectiveMinFreq = Math.min(frequencySeconds, MIN_TASK_FREQUENCY_SECONDS);
  if (
    NEWS_CACHE_TTL_SECONDS >= effectiveMinFreq ||
    BREAKING_CACHE_TTL_SECONDS >= effectiveMinFreq
  ) {
    log('Market research: cache TTL >= task frequency (will serve stale news)', 'warn', {
      frequency_seconds: frequencySeconds,
      news_ttl: NEWS_CACHE_TTL_SECONDS,
      breaking_ttl: BREAKING_CACHE_TTL_SECONDS,
    });
  }

  // User-picked symbols drive news queries and currency filtering. Watchlist
  // adds ALWAYS_ON risk tells (VIX, DXY) on top, but those are excluded from
  // instrument news queries so we don't drown the briefing in DXY/VIX
  // headlines every sweep — those are already covered by macro queries.
  const userSymbols = (config.watchlist_symbols ?? []).filter(
    (s) => s.trim().length > 0
  );
  const watchlist = buildWatchlist(userSymbols);
  const instrumentNames = symbolsToReadableNames(userSymbols).slice(0, 5);

  const [newsBundle, economicEvents, recentBriefings, priceMap] =
    await Promise.all([
      gatherMarketNews(supabase, config),
      fetchUpcomingEvents(supabase, userSymbols),
      fetchRecentBriefings(supabase, task.id, 5),
      getMarketPrices(supabase, watchlist, 60),
    ]);

  const prices: PriceSnapshot[] = Object.values(priceMap).filter(
    (p): p is PriceSnapshot => p !== null
  );

  let instrumentNews: NewsResult[] = [];
  let instrumentErrorCount = 0;
  let instrumentTotalQueries = 0;
  if (instrumentNames.length > 0) {
    const batch = await searchNewsMultiple(
      supabase,
      instrumentNames.map((n) => `${n} trading analysis today`),
      3,
      'tavily'
    );
    instrumentNews = batch.results;
    instrumentErrorCount = batch.errorCount;
    instrumentTotalQueries = batch.totalQueries;
  }

  const allNews = deduplicateNews([...newsBundle.news, ...instrumentNews]);
  const breakingNews = deduplicateNews(newsBundle.breaking);

  // Outage detection: if every search-provider call errored, the data source
  // is down (Tavily key pool exhausted, all keys cooling down, or Tavily
  // upstream itself unavailable) and any briefing we generate would be
  // meaningless. Surface a medium-significance "data source unavailable"
  // card so the user knows the monitor ran but couldn't work — distinct
  // from "market is quiet," which is also silent. Threshold filter would
  // normally suppress this; bypass it because an outage notification IS
  // the signal the user needs. Significance stays `medium` (not `high`)
  // so an outage doesn't promote past a user's `min_significance: 'high'`
  // threshold — outage cards aren't actionable, just informational.
  const totalErrors = newsBundle.errorCount + instrumentErrorCount;
  const totalQueries = newsBundle.totalQueries + instrumentTotalQueries;
  if (totalQueries > 0 && totalErrors === totalQueries) {
    log('Market research: search provider outage detected — all queries failed', 'error', {
      totalErrors,
      totalQueries,
    });
    return {
      content_html:
        '<h4>Data Source Unavailable</h4>' +
        '<p>Orion could not reach its news data source on this sweep. ' +
        'This is a temporary upstream issue — the next scheduled run will retry. ' +
        'No market catalysts can be assessed until the feed is back.</p>',
      content_plain:
        'Data Source Unavailable — Orion could not reach its news data source ' +
        'on this sweep. The next scheduled run will retry.',
      significance: 'medium',
      metadata: {
        title: 'Data source unavailable',
        generated_at: new Date().toISOString(),
        search_outage: true,
        failed_queries: totalErrors,
      },
    };
  }

  const briefing = await callGeminiForBriefing(
    supabase,
    config,
    allNews,
    breakingNews,
    economicEvents,
    instrumentNames,
    recentBriefings,
    prices
  );

  const result = parseBriefingResponse(briefing.json);
  if (briefing.scrapedUrls.length > 0) {
    result.metadata = { ...result.metadata, scraped_urls: briefing.scrapedUrls };
  }
  if (briefing.scrapedUrlsFailed.length > 0) {
    result.metadata = {
      ...result.metadata,
      scraped_urls_failed: briefing.scrapedUrlsFailed,
    };
  }

  // Record tool usage so TaskResultCard can surface the same "N tools used"
  // chip the chat UI shows. One entry per successfully-executed search query
  // (errored queries are excluded so the count reflects what actually fed the
  // briefing), one per scrape attempt (success + fail, matching how chat
  // displays attempted tool calls even when they error), and one per
  // successfully-fetched price snapshot (the briefing quotes these numbers,
  // so they count as a tool the pipeline invoked before Gemini).
  const successfulSearches = Math.max(0, totalQueries - totalErrors);
  const rawToolCalls: Array<{ name: string }> = [
    ...Array.from({ length: successfulSearches }, () => ({ name: 'search_web' })),
    ...prices.map(() => ({ name: 'get_market_price' })),
    ...(economicEvents.length > 0 ? [{ name: 'get_economic_events' }] : []),
    ...briefing.scrapedUrls.map(() => ({ name: 'scrape_url' })),
    ...briefing.scrapedUrlsFailed.map(() => ({ name: 'scrape_url' })),
  ];
  if (rawToolCalls.length > 0) {
    result.metadata = {
      ...result.metadata,
      tool_calls: summarizeToolCalls(rawToolCalls),
    };
  }

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
  market: string[];
}

function buildSearchQueries(config: MarketResearchConfig): CategorizedQueries {
  const macroQueries = (config.macro_queries ?? DEFAULT_MACRO_QUERIES)
    .slice(0, MAX_MACRO_QUERIES);

  const market: string[] = config.markets.map(
    (m) => `${m} market outlook today`
  );

  return {
    macro: macroQueries,
    market,
  };
}

// Cache TTLs:
//   NEWS_TTL: 5 min — news articles don't change meaningfully within a window
//     that short, and with N shared queries × M users we collapse to N total
//     search-provider calls per 5-min window across the whole user base.
//   BREAKING_TTL: 2 min — breaking content needs to be fresher, but same
//     sharing logic applies.
//   Instrument queries skip the cache (user-specific by watchlist choice).
//
// INVARIANT: both TTLs MUST be shorter than the minimum task frequency
// (currently 15 min). If cache TTL >= frequency, consecutive runs would see
// the same cached news and the briefing would go stale. Enforced at runtime
// in handleMarketResearch (warns on violation) so a future config change
// that lowers frequency below 5 min can't silently break the system.
const NEWS_CACHE_TTL_SECONDS = 300;
const BREAKING_CACHE_TTL_SECONDS = 120;
const MIN_TASK_FREQUENCY_SECONDS = 15 * 60;

interface MarketNewsBundle {
  news: NewsResult[];
  breaking: NewsResult[];
  /** How many search-provider queries errored across all batches (HTTP-layer failures). */
  errorCount: number;
  /** Total search-provider queries attempted. Used with errorCount to detect outage. */
  totalQueries: number;
}

const EMPTY_BATCH: SerperBatchResult = {
  results: [],
  errorCount: 0,
  totalQueries: 0,
};

async function gatherMarketNews(
  supabase: SupabaseClient,
  config: MarketResearchConfig
): Promise<MarketNewsBundle> {
  const queries = buildSearchQueries(config);

  // All template queries (macro/market/breaking) hit the shared cache.
  // Users on the same template with unedited queries share cache entries;
  // edited queries produce new cache keys automatically via the query string.
  const [macroBatch, marketBatch, breakingBatch] =
    await Promise.all([
      queries.macro.length > 0
        ? searchNewsMultipleCached(supabase, queries.macro, 3, NEWS_CACHE_TTL_SECONDS, 'tavily')
        : Promise.resolve(EMPTY_BATCH),
      queries.market.length > 0
        ? searchNewsMultipleCached(supabase, queries.market, 4, NEWS_CACHE_TTL_SECONDS, 'tavily')
        : Promise.resolve(EMPTY_BATCH),
      // Breaking-content stays on Serper. Tavily has no past-hour bucket
      // (only day/week/month/year) and empirical testing showed its `day`
      // results skew 4-12h old — it ranks by relevance, not recency. Serper's
      // qdr:h is a literal "past 60 minutes" filter, irreplaceable here for
      // catching political posts / central-bank surprises / flash headlines.
      // Macro and instrument queries above stay on Tavily — they're daily-
      // cycle content where freshness within an hour doesn't matter.
      searchBreakingMultipleCached(
        supabase,
        BREAKING_MACRO_QUERIES,
        'qdr:h',
        3,
        BREAKING_CACHE_TTL_SECONDS,
        'serper'
      ),
    ]);

  return {
    news: [...macroBatch.results, ...marketBatch.results],
    breaking: breakingBatch.results,
    errorCount:
      macroBatch.errorCount +
      marketBatch.errorCount +
      breakingBatch.errorCount,
    totalQueries:
      macroBatch.totalQueries +
      marketBatch.totalQueries +
      breakingBatch.totalQueries,
  };
}

async function fetchUpcomingEvents(
  supabase: SupabaseClient,
  watchlistSymbols: string[]
): Promise<EconomicEvent[]> {
  const today = new Date().toISOString().split('T')[0];

  // Derive the currency filter from the user's watchlist. EURUSD=X contributes
  // EUR+USD; ^N225 contributes JPY; GC=F contributes USD; etc. If the watchlist
  // is empty (shouldn't happen — UI requires non-empty at save time), fall
  // back to USD so we still get the most market-moving events.
  const relevantCurrencies =
    watchlistSymbols.length > 0
      ? symbolsToCurrencies(watchlistSymbols)
      : ['USD'];

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
  // Outage briefings describe system state, not market events. Feeding them
  // into Gemini's "Previously Reported" dedup section would bias it toward
  // suppressing genuine news that happens to follow an outage. Use JSONB
  // containment via PostgREST's `not.cs` so the filter runs at the DB.
  const { data, error } = await supabase
    .from('orion_task_results')
    .select('metadata, content_plain, created_at')
    .eq('task_id', taskId)
    .not('metadata', 'cs', '{"search_outage":true}')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    log('Failed to fetch recent briefings', 'error', error);
    return [];
  }

  interface BriefingRow {
    metadata: Record<string, unknown> | null;
    content_plain: string | null;
    created_at: string;
  }
  return ((data ?? []) as BriefingRow[]).map((r) => ({
    title: (r.metadata?.title as string | undefined) ?? 'Previous briefing',
    content_plain: r.content_plain ?? '',
    created_at: r.created_at,
  }));
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
  supabase: SupabaseClient,
  config: MarketResearchConfig,
  news: NewsResult[],
  breaking: NewsResult[],
  events: EconomicEvent[],
  instruments: string[],
  recentBriefings: RecentBriefing[],
  prices: PriceSnapshot[]
): Promise<BriefingWithScrapeResult> {
  const systemPrompt = buildMarketResearchSystemPrompt(
    config.frequency_minutes ?? 30
  );

  const newsSection =
    news.length > 0
      ? news
          .slice(0, 30)
          .map(
            (n) =>
              `- [${n.source || 'Web'}] ${n.title}: ${n.snippet}` +
              `${n.date ? ` (${n.date})` : ''}` +
              `${n.link ? ` | URL: ${n.link}` : ''}`
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
              `${n.date ? ` (${n.date})` : ''}` +
              `${n.link ? ` | URL: ${n.link}` : ''}`
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
      ? `Instruments the trader is watching: ${instruments.join(', ')}`
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

  const priceSection =
    prices.length > 0
      ? prices.map((p) => `- ${formatPriceLine(p)}`).join('\n')
      : '(No price data available this sweep — describe moves qualitatively.)';

  // Temporal context lives in the user turn (not systemInstruction) to keep
  // the cache prefix stable across sweeps — same pattern as chat briefings.
  const userPrompt = `[Current time — ${buildTemporalContext()}]

Generate a market research briefing.
Markets of interest: ${config.markets.join(', ')}.

## Previously Reported (DEDUPLICATE AGAINST THESE)
These are briefings already sent to the trader for this same task. Do NOT re-surface these events unless there is a genuinely new development. If the current news cycle is dominated by these already-reported stories, return significance="low" and keep the briefing brief — the system will suppress the output.

${previouslyReportedSection}

## Breaking Content (past hour — TREAT AS HIGHEST PRIORITY)
These items were published in the last 60 minutes. A political post, ceasefire announcement, central-bank speaker line, or surprise headline here is almost certainly the day's top catalyst. If any item describes a head-of-state statement, military/diplomatic action, central-bank surprise, or major data miss — AND is not already in the Previously Reported section — raise significance to "high" and lead the briefing with it.

${breakingSection}

## Price Snapshot (use ONLY these numbers when citing moves)
Live intraday quotes. Every pip count, percentage move, or "X is +Y%" claim in your briefing MUST be supported by a line in this section. If the relevant instrument isn't listed here, describe the move qualitatively ("bid firmly", "under pressure") instead of inventing a number. Cross-check catalyst news against these moves: a big-sounding headline with a <0.15% move on the relevant pair is probably already priced in or not real.

${priceSection}

## Recent Market News (past day)
${newsSection}

## Upcoming Economic Events (today and tomorrow)
${eventsSection}

${instrumentSection}

Generate the JSON briefing now.`;

  return generateBriefingWithScrape(
    systemPrompt,
    userPrompt,
    (url) => scrapeArticle(supabase, url, 3600, 'tavily')
  );
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
