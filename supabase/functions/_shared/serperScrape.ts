import { log } from './supabase.ts';
import type { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type SupabaseClient = ReturnType<typeof createClient>;

/**
 * Structured article payload returned by the Serper `/scrape` endpoint.
 * Kept minimal — title + body text + origin URL is all any caller needs.
 * Callers that want a string-formatted version (e.g. the chat agent) can
 * format this downstream.
 */
export interface ScrapedArticle {
  url: string;
  title: string;
  text: string;
}

// Cap article body length — Gemini handles 3k chars cleanly and anything longer
// starts eating tokens without adding signal (most market-moving articles lead
// with the catalyst in the first 2-3 paragraphs).
export const SCRAPE_MAX_TEXT_LENGTH = 3000;

// Default TTL for the shared DB cache. 1 hour is safe because article content
// is effectively immutable once published.
export const SCRAPE_DEFAULT_TTL_SECONDS = 3600;

/**
 * Low-level Serper scrape. Returns structured data or null on any failure.
 * No caching — callers that want caching should use `scrapeArticle` instead.
 */
export async function fetchSerperScrape(url: string): Promise<ScrapedArticle | null> {
  const apiKey = Deno.env.get('SERPER_API_KEY');
  if (!apiKey) {
    log('SERPER_API_KEY not configured — scrape disabled', 'warn');
    return null;
  }

  try {
    new URL(url);
  } catch {
    log(`Invalid scrape URL: ${url}`, 'warn');
    return null;
  }

  try {
    const response = await fetch('https://google.serper.dev/scrape', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      log(`Serper scrape failed for ${url}: ${response.status}`, 'warn');
      return null;
    }

    const data = await response.json();
    const text = typeof data.text === 'string' ? data.text : '';
    if (!text) return null;

    return {
      url,
      title: data.metadata?.title ?? '',
      text:
        text.length > SCRAPE_MAX_TEXT_LENGTH
          ? text.substring(0, SCRAPE_MAX_TEXT_LENGTH) + '...'
          : text,
    };
  } catch (err) {
    log(`Serper scrape error for ${url}`, 'warn', err);
    return null;
  }
}

// ============================================================
// Shared DB cache layer
// ============================================================
//
// Every user (chat + market-research) asking about the same article URL
// hits one cached row instead of one Serper scrape each. Article content
// is effectively immutable so 1-hour TTL is safe. The cache table is
// service-role only; both agents call `createServiceClient()` so both
// can read/write through RLS.

async function readScrapeCache(
  supabase: SupabaseClient,
  url: string,
  ttlSeconds: number
): Promise<ScrapedArticle | null> {
  const cutoff = new Date(Date.now() - ttlSeconds * 1000).toISOString();
  const { data, error } = await supabase
    .from('scraped_article_cache')
    .select('article')
    .eq('url', url)
    .gte('fetched_at', cutoff)
    .maybeSingle();
  if (error) {
    log('Scrape cache read error', 'warn', error);
    return null;
  }
  if (!data) return null;
  return data.article as ScrapedArticle;
}

async function writeScrapeCache(
  supabase: SupabaseClient,
  url: string,
  article: ScrapedArticle
): Promise<void> {
  const { error } = await supabase.from('scraped_article_cache').upsert({
    url,
    article,
    fetched_at: new Date().toISOString(),
  });
  if (error) log('Scrape cache write error', 'warn', error);
}

/**
 * Cache-aware scrape: return a cached article if fresh enough, otherwise
 * fetch from Serper and write through. Pass the service-role client.
 */
export async function scrapeArticle(
  supabase: SupabaseClient,
  url: string,
  ttlSeconds = SCRAPE_DEFAULT_TTL_SECONDS
): Promise<ScrapedArticle | null> {
  const cached = await readScrapeCache(supabase, url, ttlSeconds);
  if (cached) return cached;

  const fresh = await fetchSerperScrape(url);
  if (fresh) {
    await writeScrapeCache(supabase, url, fresh);
  }
  return fresh;
}
