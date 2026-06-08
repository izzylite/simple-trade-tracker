import {
  corsHeaders,
  handleCors,
  log,
  createServiceClient,
  successResponse,
  errorResponse,
} from '../_shared/supabase.ts';
import {
  searchNewsMultipleCached,
  searchBreakingMultipleCached,
} from '../_shared/searchProvider.ts';
import type { SerperBatchResult } from '../run-orion-task/serper.ts';
import type { NewsResult } from '../_shared/searchCache.ts';
import { generateBriefingWithScrape } from '../run-orion-task/gemini.ts';
import {
  getMarketPrices,
  formatPriceLine,
  type PriceSnapshot,
} from '../run-orion-task/prices.ts';
import type { SupabaseClient as RunOrionSupabaseClient } from '../run-orion-task/types.ts';
import { scrapeArticle } from '../_shared/scrapeProvider.ts';
import { buildTemporalContext } from '../ai-trading-agent/systemPrompt.ts';
import { BROKER_TO_YAHOO, getBrokerCurrencies } from '../_shared/instruments.ts';
import { summarizeToolCalls, type ToolCallSummary } from '../_shared/toolLabels.ts';
import {
  getMarketDataTool,
  executeGetMarketData,
} from '../ai-trading-agent/tools/market-data/index.ts';
import { buildAssetResearchSystemPrompt } from './asset-research-prompt.ts';

const NEWS_CACHE_TTL_SECONDS = 3600;
const BREAKING_CACHE_TTL_SECONDS = 120;
const ALWAYS_ON_SYMBOLS = ['^VIX', 'DX-Y.NYB'];

// How many news / breaking items get rendered into the Gemini prompt. The
// citation list is built from these same sliced sets, so "Sources" on the card
// is an exact audit trail of what Gemini actually read — no more, no fewer.
const MAX_PROMPT_NEWS = 30;
const MAX_PROMPT_BREAKING = 15;

// Cap on Gemini-driven get_market_data calls per briefing. Pre-fetched prices
// cover the asset + risk tells; this budget lets Gemini pull live numbers for
// correlated/secondary instruments a catalyst is about. Bounded so the
// fixed-2-round flow can't fan out into an unbounded data loop.
const MAX_MARKET_DATA_CALLS = 5;

const BREAKING_MACRO_QUERIES = [
  'US President statement announcement',
  'White House policy announcement',
  'Federal Reserve Chair statement',
  'ECB OR Bank of England policy',
  'ceasefire OR war OR attack markets',
  'breaking news markets',
  'flash crash surge',
];

const EMPTY_BATCH: SerperBatchResult = { results: [], errorCount: 0, totalQueries: 0 };

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const expectedSecret = Deno.env.get('ORION_DISPATCHER_SECRET');
  if (!expectedSecret) return errorResponse('Dispatcher not configured', 500);
  const providedSecret = req.headers.get('x-orion-dispatcher-secret') ?? '';
  if (!constantTimeEquals(providedSecret, expectedSecret)) return errorResponse('Unauthorized', 401);

  let asset: string;
  try {
    const body = await req.json();
    asset = body?.asset;
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }
  if (!asset || typeof asset !== 'string') return errorResponse('asset is required', 400);

  const serviceClient = createServiceClient();

  // Verify we own the processing slot — bail if dispatcher didn't claim it
  const { data: poolRow } = await serviceClient
    .from('asset_research_pool')
    .select('id')
    .eq('asset', asset)
    .eq('status', 'processing')
    .maybeSingle();

  if (!poolRow) {
    log('Asset research: slot not in processing state, bailing', 'warn', { asset });
    return successResponse({ skipped: true, reason: 'not_claimed' });
  }

  try {
    // 1. Fetch fixed queries for this asset
    const { data: queryRows, error: queryErr } = await serviceClient
      .from('asset_macro_queries')
      .select('query')
      .eq('asset', asset)
      .eq('is_enabled', true)
      .order('display_order');

    if (queryErr) throw new Error(`asset_macro_queries fetch: ${queryErr.message}`);

    const queries = (queryRows ?? []).map((r: { query: string }) => r.query);
    if (queries.length === 0) {
      log('Asset research: no queries for asset', 'warn', { asset });
      await markPoolFailed(serviceClient, poolRow.id, 'No queries configured');
      return successResponse({ skipped: true, reason: 'no_queries' });
    }

    // 2. Build watchlist (Yahoo symbols) for price grounding
    const yahooSymbol = BROKER_TO_YAHOO[asset];
    const watchlist = [...ALWAYS_ON_SYMBOLS, ...(yahooSymbol ? [yahooSymbol] : [])];

    // 3. Derive currencies for economic events
    const currencies = getBrokerCurrencies(asset);

    // 4. Parallel data fetch
    const [macroBatch, breakingBatch, events, priceMap] = await Promise.all([
      searchNewsMultipleCached(serviceClient, queries, 3, NEWS_CACHE_TTL_SECONDS, 'tavily'),
      searchBreakingMultipleCached(
        serviceClient, BREAKING_MACRO_QUERIES, 'qdr:h', 3, BREAKING_CACHE_TTL_SECONDS, 'serper'
      ),
      fetchEconomicEvents(serviceClient, currencies),
      getMarketPrices(serviceClient as unknown as RunOrionSupabaseClient, watchlist, 60),
    ]);

    const prices = Object.values(priceMap).filter((p): p is PriceSnapshot => p !== null);

    // 5. Outage detection — if ALL searches failed, write a low-significance result
    const totalErrors = macroBatch.errorCount + breakingBatch.errorCount;
    const totalQueries = macroBatch.totalQueries + breakingBatch.totalQueries;

    let significance: string;
    let briefingHtml: string;
    let briefingPlain: string;
    let citations: CitationEntry[] = [];
    let toolCalls: ToolCallSummary[] = [];

    if (totalQueries > 0 && totalErrors === totalQueries) {
      significance = 'low';
      briefingHtml =
        '<p>Data source unavailable — news providers unreachable. Research will retry on next cycle.</p>';
      briefingPlain = 'Data source unavailable. Research will retry on next cycle.';
    } else {
      const allNews = deduplicateNews(macroBatch.results);
      const breaking = deduplicateNews(breakingBatch.results);
      const userPrompt = buildUserPrompt(asset, allNews, breaking, events, prices);
      const briefingResult = await generateBriefingWithScrape(
        buildAssetResearchSystemPrompt(),
        userPrompt,
        (url: string) => scrapeArticle(serviceClient, url, NEWS_CACHE_TTL_SECONDS, 'tavily'),
        [{
          declaration: getMarketDataTool,
          maxCalls: MAX_MARKET_DATA_CALLS,
          // Charts are a chat affordance — force them off so the briefing gets
          // numbers, not a QuickChart URL embedded in the card HTML.
          execute: (args: Record<string, unknown>) =>
            executeGetMarketData(
              { ...args, include_chart: false, chart_only: false },
              serviceClient as unknown as Parameters<typeof executeGetMarketData>[1]
            ),
        }]
      );
      const parsed = parseBriefing(briefingResult.json);
      significance = parsed.significance ?? 'low';
      briefingHtml = parsed.briefing_html;
      briefingPlain = parsed.briefing_plain;

      // Attribution surfaced on the delivered card (Sources pill + tools-used
      // chip). Built once here and stored on the shared pool row, so every
      // subscriber to this asset gets the same citation set and tool count —
      // consistent with the pooled-result design. Sources mirror EXACTLY the
      // news/breaking items rendered into the prompt (same slice limits), so
      // the list is a faithful "what Gemini read" trail the user can verify.
      // One search_web tool entry per successfully-executed query (errored
      // queries excluded), one per price snapshot, one for the economic-events
      // lookup, and one per scrape attempt.
      citations = buildCitations([
        ...allNews.slice(0, MAX_PROMPT_NEWS),
        ...breaking.slice(0, MAX_PROMPT_BREAKING),
      ]);
      const successfulSearches = Math.max(
        0,
        (macroBatch.totalQueries - macroBatch.errorCount) +
          (breakingBatch.totalQueries - breakingBatch.errorCount)
      );
      const rawToolCalls: Array<{ name: string; args?: Record<string, unknown> }> = [
        ...Array.from({ length: successfulSearches }, () => ({ name: 'search_web' })),
        ...prices.map(() => ({ name: 'get_market_data', args: { action: 'quote' } })),
        ...(events.length > 0 ? [{ name: 'get_economic_events' }] : []),
        ...briefingResult.scrapedUrls.map(() => ({ name: 'scrape_url' })),
        ...briefingResult.scrapedUrlsFailed.map(() => ({ name: 'scrape_url' })),
        // Gemini-driven market-data lookups it chose to make (action carries
        // the per-call label, e.g. get_market_data:quote → "Checking price").
        ...briefingResult.extraToolCalls,
      ];
      toolCalls = summarizeToolCalls(rawToolCalls);
    }

    // 6. Write result to pool
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { error: writeErr } = await serviceClient
      .from('asset_research_pool')
      .update({
        status: 'fresh',
        refreshed_at: new Date().toISOString(),
        expires_at: expiresAt,
        briefing_html: briefingHtml,
        briefing_plain: briefingPlain,
        significance,
        queries_used: queries,
        citations: citations.length > 0 ? citations : null,
        tool_calls: toolCalls.length > 0 ? toolCalls : null,
        error_detail: null,
      })
      .eq('id', poolRow.id)
      .eq('status', 'processing');  // belt-and-suspenders guard

    if (writeErr) throw new Error(`pool write: ${writeErr.message}`);

    log('Asset research complete', 'info', { asset, significance });
    return successResponse({ asset, significance });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log('Asset research failed', 'error', { asset, message });
    await markPoolFailed(serviceClient, poolRow.id, message);
    return errorResponse(message, 500);
  }
});

async function markPoolFailed(
  serviceClient: ReturnType<typeof createServiceClient>,
  poolRowId: string,
  message: string
): Promise<void> {
  const backoffMs = 15 * 60 * 1000;
  // If this update never runs (edge fn killed mid-flight), the pool row stays
  // 'processing'. That self-heals: claim_asset_for_research stamps a 10-min TTL
  // on expires_at at claim time, and the dispatcher reclaims a 'processing' row
  // once that TTL lapses (see migration 20260608100000_asset_research_claim_ttl).
  const { error } = await serviceClient
    .from('asset_research_pool')
    .update({
      status: 'failed',
      error_detail: message.slice(0, 500),
      expires_at: new Date(Date.now() + backoffMs).toISOString(),
    })
    .eq('id', poolRowId);
  if (error) log('Failed to mark pool row as failed', 'warn', { poolRowId, error: error.message });
}

interface CitationEntry {
  id: string;
  url: string;
  title?: string;
  source?: string;
  toolName: string;
}

// Every distinct source URL Gemini was given, deduped by exact link (NOT by
// domain — two different articles from the same site are two sources the user
// may want to verify) and uncapped. Renders as the "Sources" pill on the
// delivered card (TaskResultCard reads metadata.citations; the popover scrolls,
// so an arbitrary count is fine). The caller passes the same sliced sets that
// were rendered into the prompt, so this is a faithful audit of Gemini's reads.
function buildCitations(news: NewsResult[]): CitationEntry[] {
  const seen = new Set<string>();
  const out: CitationEntry[] = [];
  for (const item of news) {
    if (!item.link || seen.has(item.link)) continue;
    seen.add(item.link);
    let domain = item.link;
    try { domain = new URL(item.link).hostname.replace(/^www\./, ''); }
    catch { /* unparseable link — keep raw URL as the source label */ }
    out.push({
      id: `cite-${out.length}`,
      url: item.link,
      title: item.title,
      source: item.source || domain,
      toolName: 'search_web',
    });
  }
  return out;
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

interface EconomicEvent {
  currency: string;
  event_name: string;
  impact: string;
  time_utc: string;
  actual_value: string | null;
  forecast_value: string | null;
  previous_value: string | null;
}

async function fetchEconomicEvents(
  serviceClient: ReturnType<typeof createServiceClient>,
  currencies: string[]
): Promise<EconomicEvent[]> {
  if (currencies.length === 0) return [];
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const { data, error } = await serviceClient
    .from('economic_events')
    .select('currency,event_name,impact,time_utc,actual_value,forecast_value,previous_value')
    .gte('event_date', today)
    .lte('event_date', tomorrow)
    .in('currency', currencies)
    .in('impact', ['High', 'Medium'])
    .order('event_date', { ascending: true })
    .order('time_utc', { ascending: true })
    .limit(30);
  if (error) {
    log('Failed to fetch economic events', 'error', error);
    return [];
  }
  return (data ?? []) as EconomicEvent[];
}

function buildUserPrompt(
  asset: string,
  news: NewsResult[],
  breaking: NewsResult[],
  events: EconomicEvent[],
  prices: PriceSnapshot[]
): string {
  const newsSection =
    news.length > 0
      ? news
          .slice(0, MAX_PROMPT_NEWS)
          .map(
            (n) =>
              `- [${n.source || 'Web'}] ${n.title}: ${n.snippet}` +
              (n.date ? ` (${n.date})` : '') +
              (n.link ? ` | URL: ${n.link}` : '')
          )
          .join('\n')
      : 'No recent news found.';

  const breakingSection =
    breaking.length > 0
      ? breaking
          .slice(0, MAX_PROMPT_BREAKING)
          .map(
            (n) =>
              `- [${n.source || 'Web'}] ${n.title}: ${n.snippet}` +
              (n.date ? ` (${n.date})` : '')
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

  const priceSection =
    prices.length > 0
      ? prices.map((p) => `- ${formatPriceLine(p)}`).join('\n')
      : '(No price data available — describe moves qualitatively.)';

  return `[Current time — ${buildTemporalContext()}]

Generate a market research briefing for the instrument: ${asset}.

## Breaking Content (past hour — HIGHEST PRIORITY)
${breakingSection}

## Price Snapshot (cite ONLY these numbers for moves)
${priceSection}

## Recent Market News (past day)
${newsSection}

## Upcoming Economic Events (today and tomorrow)
${eventsSection}

Generate the JSON briefing now.`;
}

function parseBriefing(rawJson: string): {
  briefing_html: string;
  briefing_plain: string;
  significance: string | null;
} {
  try {
    const p = JSON.parse(rawJson);
    return {
      briefing_html: p.briefing_html || '<p>Briefing unavailable.</p>',
      briefing_plain: p.briefing_plain || 'Briefing unavailable.',
      significance: ['low', 'medium', 'high'].includes(p.significance) ? p.significance : null,
    };
  } catch {
    return {
      briefing_html: `<p>${rawJson.substring(0, 3000)}</p>`,
      briefing_plain: rawJson.substring(0, 3000),
      significance: null,
    };
  }
}

// Suppress unused-variable warning for EMPTY_BATCH — it is a typed sentinel
// value that documents the expected SerperBatchResult shape for callers and
// is available for future fallback use without introducing a runtime cost.
void EMPTY_BATCH;
