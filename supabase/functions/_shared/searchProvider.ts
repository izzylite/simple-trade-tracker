import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  searchNews as serperSearchNews,
  searchBreaking as serperSearchBreaking,
  type NewsResult,
  type NewsTimeRange,
  type SerperBatchResult,
} from "../run-orion-task/serper.ts";
import { tavilySearchNews, tavilySearchBreaking } from "./tavily.ts";
import {
  makeCacheKey,
  readCache,
  writeCache,
  type SearchProvider,
} from "./searchCache.ts";

export type { SearchProvider } from "./searchCache.ts";

interface NewsCallArgs {
  supabase: SupabaseClient;
  query: string;
  num: number;
  timeRange: NewsTimeRange;
}

interface BreakingCallArgs {
  supabase: SupabaseClient;
  query: string;
  timeRange: NewsTimeRange;
  num: number;
}

async function dispatchNews(
  provider: SearchProvider,
  args: NewsCallArgs
): Promise<NewsResult[] | null> {
  if (provider === "tavily") {
    return tavilySearchNews(args.supabase, args.query, args.num, args.timeRange);
  }
  return serperSearchNews(args.query, args.num, args.timeRange);
}

async function dispatchBreaking(
  provider: SearchProvider,
  args: BreakingCallArgs
): Promise<NewsResult[] | null> {
  if (provider === "tavily") {
    return tavilySearchBreaking(args.supabase, args.query, args.timeRange, args.num);
  }
  return serperSearchBreaking(args.query, args.timeRange, args.num);
}

/**
 * Cached single-news call routed through the chosen provider. Same null/empty
 * contract as the underlying provider functions.
 */
export async function searchNewsCached(
  supabase: SupabaseClient,
  query: string,
  num: number,
  ttlSeconds: number,
  provider: SearchProvider,
  timeRange: NewsTimeRange = "qdr:d"
): Promise<NewsResult[] | null> {
  const cacheKey = makeCacheKey(provider, "news", query, num, timeRange);
  const cached = await readCache(supabase, cacheKey, ttlSeconds);
  if (cached) return cached;

  const fresh = await dispatchNews(provider, { supabase, query, num, timeRange });
  if (fresh && fresh.length > 0) {
    await writeCache(supabase, cacheKey, "news", query, fresh);
  }
  return fresh;
}

export async function searchNewsMultipleCached(
  supabase: SupabaseClient,
  queries: string[],
  numPerQuery: number,
  ttlSeconds: number,
  provider: SearchProvider,
  timeRange: NewsTimeRange = "qdr:d"
): Promise<SerperBatchResult> {
  const settled = await Promise.all(
    queries.map((q) =>
      searchNewsCached(supabase, q, numPerQuery, ttlSeconds, provider, timeRange)
    )
  );
  return aggregateBatch(settled);
}

export async function searchBreakingCached(
  supabase: SupabaseClient,
  query: string,
  timeRange: NewsTimeRange,
  num: number,
  ttlSeconds: number,
  provider: SearchProvider
): Promise<NewsResult[] | null> {
  const cacheKey = makeCacheKey(provider, "search", query, num, timeRange);
  const cached = await readCache(supabase, cacheKey, ttlSeconds);
  if (cached) return cached;

  const fresh = await dispatchBreaking(provider, { supabase, query, timeRange, num });
  if (fresh && fresh.length > 0) {
    await writeCache(supabase, cacheKey, "search", query, fresh);
  }
  return fresh;
}

export async function searchBreakingMultipleCached(
  supabase: SupabaseClient,
  queries: string[],
  timeRange: NewsTimeRange,
  numPerQuery: number,
  ttlSeconds: number,
  provider: SearchProvider
): Promise<SerperBatchResult> {
  const settled = await Promise.all(
    queries.map((q) =>
      searchBreakingCached(supabase, q, timeRange, numPerQuery, ttlSeconds, provider)
    )
  );
  return aggregateBatch(settled);
}

/**
 * Uncached batch news search through a provider. Used for instrument queries
 * which are user-specific and rarely cache-hit, so caching is wasted work.
 */
export async function searchNewsMultiple(
  supabase: SupabaseClient,
  queries: string[],
  numPerQuery: number,
  provider: SearchProvider,
  timeRange: NewsTimeRange = "qdr:d"
): Promise<SerperBatchResult> {
  const settled = await Promise.all(
    queries.map((q) =>
      dispatchNews(provider, { supabase, query: q, num: numPerQuery, timeRange })
    )
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
