import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { log } from "./supabase.ts";
import {
  acquireKey,
  markDisabled,
  markHealthy,
  markQuotaExhausted,
} from "./apiKeyPool.ts";
import type { NewsResult } from "./searchCache.ts";
import type { NewsTimeRange } from "../run-orion-task/serper.ts";

// Tavily error codes (verified against /websites/tavily docs, 2026-04-26):
//   400 — bad request (our bug; log, don't penalize key)
//   401 — invalid API key → markDisabled (key is dead)
//   429 — rate limit (with retry-after header — we currently ignore the
//         header and apply standard backoff; revisit if 429s get common)
//   432 — plan/key monthly quota exceeded → markQuotaExhausted
//   433 — PayGo (pay-as-you-go) billing limit exceeded → markQuotaExhausted
//   5xx — Tavily-side outage; treat as transient → markQuotaExhausted
//
// 403 isn't documented by Tavily but is included defensively — middleware
// (Cloudflare, etc.) could return 403 for blocked or revoked keys.
const TAVILY_QUOTA_CODES = new Set([429, 432, 433]);
const TAVILY_AUTH_CODES = new Set([401, 403]);
const TAVILY_CLIENT_BUG_CODES = new Set([400]);

export interface TavilyResultItem {
  title: string;
  url: string;
  content: string;
  score?: number;
  published_date?: string;
}

export interface TavilyResponse {
  results: TavilyResultItem[];
  answer?: string;
  query?: string;
}

/**
 * Tavily has 4 time_range buckets: day/week/month/year. We only ever pass
 * day or week from this codebase. qdr:h (Serper's "past hour") downgrades
 * to "day" — coarser than ideal but the only legal value. This is acceptable
 * because breaking-content queries are also recency-filtered by Tavily's
 * news topic scoring, so the freshness signal isn't entirely lost.
 */
export function mapTimeRange(range: NewsTimeRange): "day" | "week" {
  if (range === "qdr:w") return "week";
  return "day";  // qdr:h and qdr:d both map here
}

/**
 * Map Tavily result items to the shared NewsResult shape (same as serper.ts).
 * If `cap` is undefined, returns all results. If `cap === 0`, returns an
 * empty array (treated as "skip") — callers passing 0 should expect no work.
 */
export function normalizeTavilyResponse(
  resp: TavilyResponse,
  cap?: number
): NewsResult[] {
  const out: NewsResult[] = [];
  const items = cap === undefined ? resp.results : resp.results.slice(0, cap);
  for (const item of items) {
    let source: string | undefined;
    try {
      source = new URL(item.url).hostname.replace(/^www\./, "");
    } catch {
      source = undefined;
    }
    out.push({
      title: item.title,
      link: item.url,
      snippet: item.content || "",
      date: item.published_date,
      source,
    });
  }
  return out;
}

interface TavilySearchParams {
  query: string;
  num: number;
  topic: "news" | "general";
  timeRange: NewsTimeRange;
}

/**
 * Single Tavily call. Returns null on API failure (key auth, quota exhausted
 * across pool, network), [] on empty results — mirrors searchNews contract.
 *
 * Pool exhaustion: when acquireKey returns null (every key cooling down),
 * this returns null too. Callers (market-research) treat that as outage.
 */
async function searchTavily(
  supabase: SupabaseClient,
  params: TavilySearchParams
): Promise<NewsResult[] | null> {
  const acquired = await acquireKey(supabase, "tavily");
  if (!acquired) return null;

  // 15s timeout: caps tail latency on Tavily hangs so a stuck request can't
  // burn the whole edge-function wall-clock budget. Aborted requests surface
  // as DOMException("...aborted...") in the catch block — same null-return
  // path as a network error, so callers see "data source unavailable."
  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), 15_000);

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: acquired.key,
        query: params.query,
        topic: params.topic,
        time_range: mapTimeRange(params.timeRange),
        max_results: params.num,
        include_raw_content: false,
      }),
      signal: ctrl.signal,
    });

    if (!response.ok) {
      const status = response.status;
      if (TAVILY_AUTH_CODES.has(status)) {
        await markDisabled(supabase, acquired.id, `auth_${status}`);
      } else if (TAVILY_QUOTA_CODES.has(status)) {
        await markQuotaExhausted(supabase, acquired.id, `quota_${status}`);
      } else if (status >= 500) {
        // Tavily-side outage. Same backoff path as quota — cost is a 1h
        // cooldown on a 5xx burst, which is fine since we have 9 other keys.
        await markQuotaExhausted(supabase, acquired.id, `server_${status}`);
      } else if (TAVILY_CLIENT_BUG_CODES.has(status)) {
        // 400 is our bug, not the key's fault. Don't penalize the key —
        // the next caller using this key will succeed. If 400 storms ever
        // become a thing (Tavily regression making valid queries 400),
        // cool the request down at the caller level, not the key level.
        log("Tavily: 400 bad request (client bug)", "error", {
          status, query: params.query,
        });
      } else {
        log("Tavily: unexpected status", "error", { status, query: params.query });
      }
      return null;
    }

    const data = (await response.json()) as TavilyResponse;
    await markHealthy(supabase, acquired.id);
    return normalizeTavilyResponse(data, params.num);
  } catch (err) {
    log("Tavily: network error", "error", err);
    // Don't mark the key — network errors aren't the key's fault.
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function tavilySearchNews(
  supabase: SupabaseClient,
  query: string,
  num = 8,
  timeRange: NewsTimeRange = "qdr:d"
): Promise<NewsResult[] | null> {
  return searchTavily(supabase, { query, num, topic: "news", timeRange });
}

export async function tavilySearchBreaking(
  supabase: SupabaseClient,
  query: string,
  timeRange: NewsTimeRange = "qdr:h",
  num = 5
): Promise<NewsResult[] | null> {
  // Tavily doesn't split news vs organic the way Serper does — `topic: "general"`
  // is the closest equivalent to organic search. Combined with mapTimeRange's
  // qdr:h → day fallback, this is "general web results from the past day,"
  // which is good enough to surface flash content Tavily's news index missed.
  return searchTavily(supabase, { query, num, topic: "general", timeRange });
}
