import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { log } from "./supabase.ts";
import { fetchSerperScrape, type ScrapedArticle } from "./serperScrape.ts";
import { tavilyExtract } from "./tavily.ts";

// Re-export so callers can import the result shape from one place.
export type { ScrapedArticle } from "./serperScrape.ts";

export type ScrapeProvider = "serper" | "tavily";

// Article content is effectively immutable once published; 1h TTL is safe
// and shared across provider — a Tavily-extracted article is interchangeable
// with a Serper-scraped one of the same URL.
export const SCRAPE_DEFAULT_TTL_SECONDS = 3600;

// ============================================================
// Cache layer — provider-agnostic
// ============================================================
//
// The cache key is the URL. We deliberately do NOT prefix by provider:
// caching the URL→article mapping benefits both providers transparently.
// If Tavily populates a row and Serper later asks for the same URL, it
// gets the cache hit — and vice versa. Article content for a given URL
// doesn't depend on which provider fetched it.

async function readScrapeCache(
  supabase: SupabaseClient,
  url: string,
  ttlSeconds: number,
): Promise<ScrapedArticle | null> {
  const cutoff = new Date(Date.now() - ttlSeconds * 1000).toISOString();
  const { data, error } = await supabase
    .from("scraped_article_cache")
    .select("article")
    .eq("url", url)
    .gte("fetched_at", cutoff)
    .maybeSingle();
  if (error) {
    log("Scrape cache read error", "warn", error);
    return null;
  }
  if (!data) return null;
  return data.article as ScrapedArticle;
}

async function writeScrapeCache(
  supabase: SupabaseClient,
  url: string,
  article: ScrapedArticle,
): Promise<void> {
  const { error } = await supabase.from("scraped_article_cache").upsert({
    url,
    article,
    fetched_at: new Date().toISOString(),
  });
  if (error) log("Scrape cache write error", "warn", error);
}

// ============================================================
// Provider dispatch
// ============================================================

async function dispatchScrape(
  provider: ScrapeProvider,
  supabase: SupabaseClient,
  url: string,
): Promise<ScrapedArticle | null> {
  switch (provider) {
    case "tavily":
      return tavilyExtract(supabase, url);
    case "serper":
      return fetchSerperScrape(url);
    default: {
      // Exhaustiveness check — TS errors here if a new ScrapeProvider variant
      // is added without a case. Runtime throw catches stringly-typed inputs.
      const _exhaustive: never = provider;
      throw new Error(`scrapeProvider: unknown provider ${_exhaustive}`);
    }
  }
}

/**
 * Cache-aware scrape with provider routing.
 *
 * Cache hits return the stored article regardless of which provider
 * populated it (URL→article is provider-agnostic). On miss, dispatch to the
 * chosen provider and write through on success. Returns null on cache miss
 * + dispatch failure (key pool exhausted, network, paywall block, etc.).
 *
 * Provider defaults to 'serper' for backward compatibility with chat-side
 * callers that never specify the provider arg.
 */
export async function scrapeArticle(
  supabase: SupabaseClient,
  url: string,
  ttlSeconds = SCRAPE_DEFAULT_TTL_SECONDS,
  provider: ScrapeProvider = "serper",
): Promise<ScrapedArticle | null> {
  const cached = await readScrapeCache(supabase, url, ttlSeconds);
  if (cached) return cached;

  const fresh = await dispatchScrape(provider, supabase, url);
  if (fresh) {
    await writeScrapeCache(supabase, url, fresh);
  }
  return fresh;
}

/**
 * Cache-aware scrape that tries `primary` first, falls back to `fallback` on
 * primary failure. Used by the chat agent where a failed scrape could leave
 * an unanswered user question — the fallback preserves chat reliability when
 * the primary provider has a transient issue (key pool exhausted, paywall,
 * dynamic page Tavily can't render, etc).
 *
 * Defaults: Tavily primary (LLM-tuned content + free 10-key pool), Serper
 * fallback (broader coverage on edge-case sites). Cache is shared between
 * paths — a successful scrape from either provider populates the same row,
 * so the next caller (any provider, any pipeline) gets the cache hit.
 *
 * Returns null only if BOTH providers fail. Market-research uses the simpler
 * `scrapeArticle` (no fallback — null is an acceptable outcome there since
 * the briefing can still generate without one URL's content).
 */
export async function scrapeWithFallback(
  supabase: SupabaseClient,
  url: string,
  ttlSeconds = SCRAPE_DEFAULT_TTL_SECONDS,
  primary: ScrapeProvider = "tavily",
  fallback: ScrapeProvider = "serper",
): Promise<ScrapedArticle | null> {
  const cached = await readScrapeCache(supabase, url, ttlSeconds);
  if (cached) return cached;

  const primaryResult = await dispatchScrape(primary, supabase, url);
  if (primaryResult) {
    await writeScrapeCache(supabase, url, primaryResult);
    return primaryResult;
  }

  log(`scrapeWithFallback: ${primary} returned null, trying ${fallback}`, "warn", { url });
  const fallbackResult = await dispatchScrape(fallback, supabase, url);
  if (fallbackResult) {
    await writeScrapeCache(supabase, url, fallbackResult);
  }
  return fallbackResult;
}
