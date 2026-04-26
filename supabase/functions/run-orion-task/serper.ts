import { log } from '../_shared/supabase.ts';
import type { SupabaseClient } from './types.ts';

export interface NewsResult {
  title: string;
  link: string;
  snippet: string;
  date?: string;
  source?: string;
}

/**
 * Aggregate result for multi-query calls. `errorCount` counts queries that
 * failed at the HTTP layer (distinct from queries that returned zero results).
 * The handler uses this to distinguish "Serper is down" from "market is quiet"
 * — critical so a genuine upstream outage surfaces as a briefing instead of
 * being silently suppressed by the low-significance filter.
 */
export interface SerperBatchResult {
  results: NewsResult[];
  errorCount: number;
  totalQueries: number;
}

// Time-range filter for Google News queries.
//   'qdr:h' = past hour
//   'qdr:d' = past day (default for routine news queries — today's cycle only)
//   'qdr:w' = past week
// Without this, Google News's default corpus search can return articles from
// days or weeks ago that happen to match the keywords (e.g. an article titled
// "Today's Fed decision" published last week would still match a query about
// today's Fed news).
export type NewsTimeRange = 'qdr:h' | 'qdr:d' | 'qdr:w';

/**
 * Single news search. Returns:
 *   NewsResult[]  — success (may be empty if Google News had no matches)
 *   null          — Serper API failed (network error, 4xx/5xx, missing key)
 *
 * Callers MUST treat null and [] differently: null means "data source unavailable,"
 * [] means "genuinely nothing matched this query."
 */
export async function searchNews(
  query: string,
  num = 8,
  timeRange: NewsTimeRange = 'qdr:d'
): Promise<NewsResult[] | null> {
  const apiKey = Deno.env.get('SERPER_API_KEY');
  if (!apiKey) {
    log('SERPER_API_KEY not configured', 'warn');
    return null;
  }

  try {
    const response = await fetch('https://google.serper.dev/news', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, gl: 'us', hl: 'en', num, tbs: timeRange }),
    });

    if (!response.ok) {
      log(`Serper news search failed: ${response.status}`, 'error');
      return null;
    }

    const data = await response.json();
    const results: NewsResult[] = [];

    if (data.news) {
      for (const item of data.news.slice(0, num)) {
        results.push({
          title: item.title,
          link: item.link,
          snippet: item.snippet || item.description || '',
          date: item.date,
          source: item.source,
        });
      }
    }

    return results;
  } catch (err) {
    log('Serper news search error', 'error', err);
    return null;
  }
}

export async function searchNewsMultiple(
  queries: string[],
  numPerQuery = 5,
  timeRange: NewsTimeRange = 'qdr:d'
): Promise<SerperBatchResult> {
  const settled = await Promise.all(
    queries.map((q) => searchNews(q, numPerQuery, timeRange))
  );
  return aggregateBatch(settled);
}

/**
 * Search organic Google results with a recency filter.
 *
 * Use this to catch breaking content that Google News hasn't indexed yet —
 * e.g. a politician's post, an unexpected central-bank statement, or early
 * reporting from outlets that haven't been picked up by Google News.
 *
 * Returns null on API failure, [] on empty results (see searchNews).
 */
export async function searchBreaking(
  query: string,
  timeRange: 'qdr:h' | 'qdr:d' | 'qdr:w' = 'qdr:h',
  num = 5
): Promise<NewsResult[] | null> {
  const apiKey = Deno.env.get('SERPER_API_KEY');
  if (!apiKey) return null;

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        gl: 'us',
        hl: 'en',
        num,
        tbs: timeRange,
      }),
    });

    if (!response.ok) {
      log(`Serper breaking search failed: ${response.status}`, 'error');
      return null;
    }

    const data = await response.json();
    const results: NewsResult[] = [];

    if (data.organic) {
      for (const item of data.organic.slice(0, num)) {
        results.push({
          title: item.title,
          link: item.link,
          snippet: item.snippet || '',
          date: item.date,
          source: new URL(item.link).hostname.replace(/^www\./, ''),
        });
      }
    }

    return results;
  } catch (err) {
    log('Serper breaking search error', 'error', err);
    return null;
  }
}

export async function searchBreakingMultiple(
  queries: string[],
  timeRange: 'qdr:h' | 'qdr:d' | 'qdr:w' = 'qdr:h',
  numPerQuery = 3
): Promise<SerperBatchResult> {
  const settled = await Promise.all(
    queries.map((q) => searchBreaking(q, timeRange, numPerQuery))
  );
  return aggregateBatch(settled);
}

function aggregateBatch(
  settled: Array<NewsResult[] | null>
): SerperBatchResult {
  let errorCount = 0;
  const results: NewsResult[] = [];
  for (const r of settled) {
    if (r === null) {
      errorCount += 1;
    } else {
      results.push(...r);
    }
  }
  return { results, errorCount, totalQueries: settled.length };
}

// ============================================================
// Cached variants — delegate to shared searchCache module
// ============================================================
//
// Only use for queries that are TRULY shared (macro/session/market/breaking
// baselines). Custom topics and instrument-specific queries must skip the
// cache because their keys would rarely hit.
// ============================================================

import {
  makeCacheKey,
  readCache,
  writeCache,
} from '../_shared/searchCache.ts';

export async function searchNewsCached(
  supabase: SupabaseClient,
  query: string,
  num: number,
  ttlSeconds: number,
  timeRange: NewsTimeRange = 'qdr:d'
): Promise<NewsResult[] | null> {
  const cacheKey = makeCacheKey('serper', 'news', query, num, timeRange);
  const cached = await readCache(supabase, cacheKey, ttlSeconds);
  if (cached) return cached;

  const fresh = await searchNews(query, num, timeRange);
  if (fresh && fresh.length > 0) {
    await writeCache(supabase, cacheKey, 'news', query, fresh);
  }
  return fresh;
}

export async function searchNewsMultipleCached(
  supabase: SupabaseClient,
  queries: string[],
  numPerQuery: number,
  ttlSeconds: number,
  timeRange: NewsTimeRange = 'qdr:d'
): Promise<SerperBatchResult> {
  const settled = await Promise.all(
    queries.map((q) =>
      searchNewsCached(supabase, q, numPerQuery, ttlSeconds, timeRange)
    )
  );
  return aggregateBatch(settled);
}

export async function searchBreakingCached(
  supabase: SupabaseClient,
  query: string,
  timeRange: 'qdr:h' | 'qdr:d' | 'qdr:w',
  num: number,
  ttlSeconds: number
): Promise<NewsResult[] | null> {
  const cacheKey = makeCacheKey('serper', 'search', query, num, timeRange);
  const cached = await readCache(supabase, cacheKey, ttlSeconds);
  if (cached) return cached;

  const fresh = await searchBreaking(query, timeRange, num);
  if (fresh && fresh.length > 0) {
    await writeCache(supabase, cacheKey, 'search', query, fresh);
  }
  return fresh;
}

export async function searchBreakingMultipleCached(
  supabase: SupabaseClient,
  queries: string[],
  timeRange: 'qdr:h' | 'qdr:d' | 'qdr:w',
  numPerQuery: number,
  ttlSeconds: number
): Promise<SerperBatchResult> {
  const settled = await Promise.all(
    queries.map((q) =>
      searchBreakingCached(supabase, q, timeRange, numPerQuery, ttlSeconds)
    )
  );
  return aggregateBatch(settled);
}
