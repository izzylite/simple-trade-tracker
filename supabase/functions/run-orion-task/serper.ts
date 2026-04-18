import { log } from '../_shared/supabase.ts';
import type { SupabaseClient } from './types.ts';

export interface NewsResult {
  title: string;
  link: string;
  snippet: string;
  date?: string;
  source?: string;
}

export async function searchNews(
  query: string,
  num = 8
): Promise<NewsResult[]> {
  const apiKey = Deno.env.get('SERPER_API_KEY');
  if (!apiKey) {
    log('SERPER_API_KEY not configured', 'warn');
    return [];
  }

  try {
    const response = await fetch('https://google.serper.dev/news', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, gl: 'us', hl: 'en', num }),
    });

    if (!response.ok) {
      log(`Serper news search failed: ${response.status}`, 'error');
      return [];
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
    return [];
  }
}

export async function searchNewsMultiple(
  queries: string[],
  numPerQuery = 5
): Promise<NewsResult[]> {
  const results = await Promise.all(
    queries.map((q) => searchNews(q, numPerQuery))
  );
  return results.flat();
}

/**
 * Search organic Google results with a recency filter.
 *
 * Use this to catch breaking content that Google News hasn't indexed yet —
 * e.g. a politician's post, an unexpected central-bank statement, or early
 * reporting from outlets that haven't been picked up by Google News.
 *
 * `timeRange`:
 *   'qdr:h' = past hour
 *   'qdr:d' = past day
 *   'qdr:w' = past week
 */
export async function searchBreaking(
  query: string,
  timeRange: 'qdr:h' | 'qdr:d' | 'qdr:w' = 'qdr:h',
  num = 5
): Promise<NewsResult[]> {
  const apiKey = Deno.env.get('SERPER_API_KEY');
  if (!apiKey) return [];

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
      return [];
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
    return [];
  }
}

export async function searchBreakingMultiple(
  queries: string[],
  timeRange: 'qdr:h' | 'qdr:d' | 'qdr:w' = 'qdr:h',
  numPerQuery = 3
): Promise<NewsResult[]> {
  const results = await Promise.all(
    queries.map((q) => searchBreaking(q, timeRange, numPerQuery))
  );
  return results.flat();
}

// ============================================================
// Cached variants — shared across all users via serper_cache table
// ============================================================
//
// Only use for queries that are TRULY shared (macro/session/market/breaking
// baselines). Custom topics and instrument-specific queries must skip the
// cache because their keys would rarely hit.
// ============================================================

function makeCacheKey(
  endpoint: 'news' | 'search',
  query: string,
  num: number,
  timeRange?: string
): string {
  return `${endpoint}::${query}::${num}::${timeRange ?? ''}`;
}

async function readCache(
  supabase: SupabaseClient,
  cacheKey: string,
  ttlSeconds: number
): Promise<NewsResult[] | null> {
  const cutoff = new Date(Date.now() - ttlSeconds * 1000).toISOString();
  const { data, error } = await supabase
    .from('serper_cache')
    .select('results')
    .eq('cache_key', cacheKey)
    .gte('fetched_at', cutoff)
    .maybeSingle();
  if (error) {
    log('Serper cache read error', 'warn', error);
    return null;
  }
  if (!data) return null;
  return data.results as NewsResult[];
}

async function writeCache(
  supabase: SupabaseClient,
  cacheKey: string,
  endpoint: 'news' | 'search',
  query: string,
  results: NewsResult[]
): Promise<void> {
  const { error } = await supabase.from('serper_cache').upsert({
    cache_key: cacheKey,
    query,
    endpoint,
    results,
    fetched_at: new Date().toISOString(),
  });
  if (error) {
    log('Serper cache write error', 'warn', error);
  }
}

export async function searchNewsCached(
  supabase: SupabaseClient,
  query: string,
  num: number,
  ttlSeconds: number
): Promise<NewsResult[]> {
  const cacheKey = makeCacheKey('news', query, num);
  const cached = await readCache(supabase, cacheKey, ttlSeconds);
  if (cached) return cached;

  const fresh = await searchNews(query, num);
  if (fresh.length > 0) {
    await writeCache(supabase, cacheKey, 'news', query, fresh);
  }
  return fresh;
}

export async function searchNewsMultipleCached(
  supabase: SupabaseClient,
  queries: string[],
  numPerQuery: number,
  ttlSeconds: number
): Promise<NewsResult[]> {
  const results = await Promise.all(
    queries.map((q) => searchNewsCached(supabase, q, numPerQuery, ttlSeconds))
  );
  return results.flat();
}

export async function searchBreakingCached(
  supabase: SupabaseClient,
  query: string,
  timeRange: 'qdr:h' | 'qdr:d' | 'qdr:w',
  num: number,
  ttlSeconds: number
): Promise<NewsResult[]> {
  const cacheKey = makeCacheKey('search', query, num, timeRange);
  const cached = await readCache(supabase, cacheKey, ttlSeconds);
  if (cached) return cached;

  const fresh = await searchBreaking(query, timeRange, num);
  if (fresh.length > 0) {
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
): Promise<NewsResult[]> {
  const results = await Promise.all(
    queries.map((q) =>
      searchBreakingCached(supabase, q, timeRange, numPerQuery, ttlSeconds)
    )
  );
  return results.flat();
}
