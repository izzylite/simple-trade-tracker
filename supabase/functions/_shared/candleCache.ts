/**
 * Candle history cache wrapper — Twelve Data primary, Yahoo fallback,
 * cross-user DB-backed cache keyed by UTC calendar day.
 *
 * Design (see migration 20260518000005):
 *   - One DB row per (symbol, interval, timezone, UTC date).
 *   - A row stores ALL bars for its UTC date, oldest→newest. Empty
 *     array means "market closed that day" — also a valid cache hit.
 *   - When a request misses, we expand the provider call to cover full
 *     UTC days (00:00–23:59:59), then bucket the response per UTC date
 *     and upsert one row per missing day.
 *   - On read we look up every requested day, concatenate cached + any
 *     freshly-fetched candles, then slice to the user's exact window.
 *
 * Today's day is never cached (its bars are still forming). Any request
 * whose end is >= today UTC bypasses the cache entirely.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { log } from "./supabase.ts";
import {
  type Candle,
  type CandleInterval,
  fetchTimeSeries,
} from "./twelvedata.ts";
import { fetchYahooTimeSeries } from "./prices.ts";

export type CandleSource = "twelvedata" | "yahoo";

export interface CandleHistoryRequest {
  /** Yahoo-format symbol (the wrapper translates internally). */
  symbol: string;
  interval: CandleInterval;
  startDate?: string;
  endDate?: string;
  /** Last-N-bars mode. Not cacheable — touches the forming bar. */
  outputsize?: number;
  /** Twelve `timezone` param — defaults to exchange tz on Twelve's side. */
  timezone?: string;
  /** Unix seconds for the Yahoo fallback path. Required when there's no
   *  start/end (outputsize mode). When start/end are set, the wrapper
   *  re-derives Yahoo's window from them internally. */
  period1: number;
  period2: number;
}

export interface CandleHistoryResult {
  /** Always oldest → newest. */
  candles: Candle[];
  source: CandleSource;
}

const MS_PER_DAY = 86_400_000;

// ============================================================
// Time helpers
// ============================================================

/** Parse "YYYY-MM-DD" or "YYYY-MM-DD HH:mm:ss" → UTC ms (or NaN). */
function parseDateMs(d: string): number {
  const ms = Date.parse(d.includes(" ") ? d.replace(" ", "T") : d);
  return Number.isNaN(ms) ? NaN : ms;
}

function startOfUtcDayMs(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function toIsoDate(ms: number): string {
  // "YYYY-MM-DD" — Postgres DATE-compatible.
  return new Date(ms).toISOString().slice(0, 10);
}

/** Parse a Candle's datetime → UTC ms. Handles both daily-format
 *  ("YYYY-MM-DD") and intraday ("YYYY-MM-DD HH:mm:ss"). */
function candleTimeMs(c: Candle): number {
  const iso = c.datetime.includes(" ")
    ? c.datetime.replace(" ", "T") + "Z"
    : c.datetime + "T00:00:00Z";
  return Date.parse(iso);
}

/** UTC calendar date the bar's start belongs to. */
function candleUtcDate(c: Candle): string {
  return toIsoDate(candleTimeMs(c));
}

// ============================================================
// Provider call (Twelve → Yahoo fallback)
// ============================================================

/**
 * Run the two-provider chain once. Returns oldest→newest, or null if
 * both providers were unreachable. Used both for uncached bypass paths
 * and for the expanded full-day fetch behind the cache.
 *
 * When startDate/endDate are present we derive Yahoo's period1/period2
 * from them, so an internally-expanded fetch doesn't have to thread new
 * period values through. For outputsize mode we use whatever the caller
 * passed in.
 */
async function fetchFromProviders(
  req: CandleHistoryRequest,
): Promise<CandleHistoryResult | null> {
  const twelve = await fetchTimeSeries(req.symbol, {
    interval: req.interval,
    outputsize: req.outputsize,
    startDate: req.startDate,
    endDate: req.endDate,
    timezone: req.timezone,
  });
  if (twelve !== null) {
    const asc = twelve.length > 0 ? [...twelve].reverse() : twelve;
    return { candles: asc, source: "twelvedata" };
  }

  // Yahoo fallback. If the caller has explicit dates, derive period
  // from them (handles internal expansion correctly); otherwise fall
  // back to caller-supplied period1/period2.
  let p1 = req.period1;
  let p2 = req.period2;
  if (req.startDate && req.endDate) {
    const sMs = parseDateMs(req.startDate);
    const eMs = parseDateMs(req.endDate);
    if (!Number.isNaN(sMs) && !Number.isNaN(eMs)) {
      p1 = Math.floor(sMs / 1000);
      p2 = Math.floor(eMs / 1000);
    }
  }
  if (Number.isNaN(p1) || Number.isNaN(p2)) return null;

  const yahoo = await fetchYahooTimeSeries(req.symbol, {
    interval: req.interval,
    period1: p1,
    period2: p2,
  });
  if (yahoo === null) return null;
  return { candles: yahoo, source: "yahoo" };
}

// ============================================================
// Cache I/O
// ============================================================

interface CachedDayRow {
  cache_date: string;
  candles: Candle[];
  source: CandleSource;
}

async function readCacheRows(
  supabase: SupabaseClient,
  req: CandleHistoryRequest,
  days: string[],
): Promise<CachedDayRow[]> {
  const { data, error } = await supabase
    .from("candle_cache")
    .select("cache_date, candles, source")
    .eq("symbol", req.symbol.toUpperCase())
    .eq("interval", req.interval)
    .eq("timezone", req.timezone ?? "")
    .in("cache_date", days);
  if (error) {
    log("Candle cache read error", "warn", error);
    return [];
  }
  return (data ?? []).map((r) => ({
    // Postgres DATE normally comes back as "YYYY-MM-DD", but driver
    // versions occasionally include a time/zone suffix. Slicing to 10
    // chars matches the format we generate locally via toIsoDate, so
    // Map keys line up regardless of driver quirks.
    cache_date: (r.cache_date as string).slice(0, 10),
    candles: r.candles as Candle[],
    source: r.source as CandleSource,
  }));
}

async function writeCacheRows(
  supabase: SupabaseClient,
  rows: Array<{
    symbol: string;
    interval: string;
    timezone: string;
    cache_date: string;
    candles: Candle[];
    source: CandleSource;
    fetched_at: string;
    accessed_at: string;
  }>,
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from("candle_cache").upsert(rows);
  if (error) log("Candle cache write error", "warn", error);
}

/** Fire-and-forget LRU bump. Stale accessed_at only shortens this
 *  row's lifetime by at most one cron tick — never a correctness risk. */
function bumpAccessedAt(
  supabase: SupabaseClient,
  req: CandleHistoryRequest,
  days: string[],
): void {
  if (days.length === 0) return;
  supabase
    .from("candle_cache")
    .update({ accessed_at: new Date().toISOString() })
    .eq("symbol", req.symbol.toUpperCase())
    .eq("interval", req.interval)
    .eq("timezone", req.timezone ?? "")
    .in("cache_date", days)
    .then(({ error }) => {
      if (error) log("Candle cache accessed_at bump failed", "warn", error);
    });
}

// ============================================================
// Slicing
// ============================================================

/** Filter candles to [startMs, endMs] inclusive. Matches Twelve's
 *  start_date/end_date semantics (both ends included). */
function sliceCandles(
  candles: Candle[],
  startMs: number,
  endMs: number,
): Candle[] {
  return candles.filter((c) => {
    const t = candleTimeMs(c);
    return t >= startMs && t <= endMs;
  });
}

// ============================================================
// Main entry point
// ============================================================

export async function getMarketHistory(
  supabase: SupabaseClient | undefined,
  req: CandleHistoryRequest,
): Promise<CandleHistoryResult | null> {
  // No-cache paths: outputsize mode, malformed dates, no supabase client.
  if (!req.startDate || !req.endDate || !supabase) {
    return fetchFromProviders(req);
  }
  const startMs = parseDateMs(req.startDate);
  const endMs = parseDateMs(req.endDate);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
    return fetchFromProviders(req);
  }

  // Anything reaching today (or future) UTC bypasses cache — today's
  // bars are still forming and the "full day" doesn't exist yet.
  const todayUtcMs = startOfUtcDayMs(Date.now());
  if (endMs >= todayUtcMs) {
    return fetchFromProviders(req);
  }

  // Past-only path. Enumerate UTC days in [startMs, endMs].
  const startDayMs = startOfUtcDayMs(startMs);
  const endDayMs = startOfUtcDayMs(endMs);
  const dayList: string[] = [];
  for (let d = startDayMs; d <= endDayMs; d += MS_PER_DAY) {
    dayList.push(toIsoDate(d));
  }

  const cachedRows = await readCacheRows(supabase, req, dayList);
  const cachedByDay = new Map(cachedRows.map((r) => [r.cache_date, r]));
  const missingDays = dayList.filter((d) => !cachedByDay.has(d));

  let fetched: CandleHistoryResult | null = null;
  const fetchedByDay = new Map<string, Candle[]>();
  if (missingDays.length > 0) {
    // Fetch the bounding range of all missing days, padded to full UTC
    // days. Disjoint missing days re-fetch the cached days in the middle
    // (data gets discarded, no DB write for those) — costs one extra API
    // credit only in fragmented cases. Single-day and contiguous misses
    // pay nothing extra.
    const earliest = missingDays[0];
    const latest = missingDays[missingDays.length - 1];
    const fetchStartIso = `${earliest} 00:00:00`;
    const fetchEndIso = `${latest} 23:59:59`;
    fetched = await fetchFromProviders({
      ...req,
      startDate: fetchStartIso,
      endDate: fetchEndIso,
    });
    if (fetched === null) return null;

    // Bucket fetched bars by their UTC date — used both for the write
    // payload below AND for the assembly loop. Days with no bars (market
    // closed) won't appear in the bucket; we still write a `[]` row for
    // every missing day so the next query gets an instant empty hit.
    for (const c of fetched.candles) {
      const d = candleUtcDate(c);
      const list = fetchedByDay.get(d);
      if (list) list.push(c);
      else fetchedByDay.set(d, [c]);
    }
    const nowIso = new Date().toISOString();
    const writePayload = missingDays.map((d) => ({
      symbol: req.symbol.toUpperCase(),
      interval: req.interval,
      timezone: req.timezone ?? "",
      cache_date: d,
      candles: fetchedByDay.get(d) ?? [],
      source: fetched!.source,
      fetched_at: nowIso,
      accessed_at: nowIso,
    }));
    await writeCacheRows(supabase, writePayload);
  }

  // Assemble: walk day list in order, take each day's bars from cache
  // when present, else from the fresh fetch's per-day bucket.
  const allCandles: Candle[] = [];
  let pickedSource: CandleSource | null = null;
  for (const day of dayList) {
    const row = cachedByDay.get(day);
    if (row) {
      allCandles.push(...row.candles);
      if (!pickedSource) pickedSource = row.source;
    } else {
      const fresh = fetchedByDay.get(day) ?? [];
      allCandles.push(...fresh);
      if (!pickedSource && fetched) pickedSource = fetched.source;
    }
  }

  // Bump LRU for the cached days that contributed. Skipped on full miss.
  if (cachedRows.length > 0) {
    bumpAccessedAt(supabase, req, cachedRows.map((r) => r.cache_date));
  }

  return {
    candles: sliceCandles(allCandles, startMs, endMs),
    // Fall back to twelvedata if we had no data anywhere (empty result
    // from an all-Saturday window). Caller treats this as cosmetic.
    source: pickedSource ?? "twelvedata",
  };
}
