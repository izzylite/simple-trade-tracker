import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { log } from "./supabase.ts";
import type { NewsResult } from "../run-orion-task/serper.ts";

export type SearchProvider = "serper" | "tavily";
export type CacheEndpoint = "news" | "search";

/**
 * Cache key format: `<provider>::<endpoint>::<query>::<num>::<timeRange>`.
 * Provider is the first segment so a future migration can `LIKE 'tavily::%'`
 * to scope deletes/scans by provider.
 */
export function makeCacheKey(
  provider: SearchProvider,
  endpoint: CacheEndpoint,
  query: string,
  num: number,
  timeRange?: string
): string {
  return `${provider}::${endpoint}::${query}::${num}::${timeRange ?? ""}`;
}

export async function readCache(
  supabase: SupabaseClient,
  cacheKey: string,
  ttlSeconds: number
): Promise<NewsResult[] | null> {
  const cutoff = new Date(Date.now() - ttlSeconds * 1000).toISOString();
  const { data, error } = await supabase
    .from("serper_cache")
    .select("results")
    .eq("cache_key", cacheKey)
    .gte("fetched_at", cutoff)
    .maybeSingle();
  if (error) {
    log("search cache read error", "warn", error);
    return null;
  }
  if (!data) return null;
  return data.results as NewsResult[];
}

export async function writeCache(
  supabase: SupabaseClient,
  cacheKey: string,
  endpoint: CacheEndpoint,
  query: string,
  results: NewsResult[]
): Promise<void> {
  const { error } = await supabase.from("serper_cache").upsert({
    cache_key: cacheKey,
    query,
    endpoint,
    results,
    fetched_at: new Date().toISOString(),
  });
  if (error) {
    log("search cache write error", "warn", error);
  }
}
