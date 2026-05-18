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
 * Today's day is never WRITTEN to cache (its bars are still forming).
 * But a mixed-range request (e.g. "last week through now") still caches
 * its past UTC days — only today's bucket is held back from the upsert.
 * Today's portion is fetched in the same provider call that covers the
 * missing past days, so the mixed case costs one API credit, not two.
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

/** UTC ms → "YYYY-MM-DD HH:mm:ss" (the format Twelve Data's start_date /
 *  end_date params expect). */
function msToApiDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear() + "-" +
    pad(d.getUTCMonth() + 1) + "-" +
    pad(d.getUTCDate()) + " " +
    pad(d.getUTCHours()) + ":" +
    pad(d.getUTCMinutes()) + ":" +
    pad(d.getUTCSeconds())
  );
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
  // Daily outputsize → past-and-today window conversion.
  //
  // Orion asks for "last week candles" as outputsize=7 at interval=1day.
  // We rewrite the request to an explicit window of [today − (N−1) days,
  // now] so the mixed-range cache path below can cache the N−1 closed
  // past days while still fetching today's in-progress bar in the SAME
  // provider call (one API credit). Today's bucket is held back from
  // the upsert because the forming bar would go stale within minutes.
  //
  // We INCLUDE today (vs. the older "last N closed past days" framing)
  // because Orion needs the current intraday level for narration like
  // "price is currently at X" — dropping today silently hid that.
  //
  // Sub-daily intervals keep the bypass at the next check: per-UTC-day
  // rows don't fit intraday bar densities, and outputsize semantics
  // there (last N minutes/hours) are too volatile to cache usefully.
  if (
    !req.startDate &&
    !req.endDate &&
    req.outputsize !== undefined &&
    req.outputsize > 0 &&
    req.interval === "1day"
  ) {
    const todayUtcMs = startOfUtcDayMs(Date.now());
    const startMs = todayUtcMs - (req.outputsize - 1) * MS_PER_DAY;
    const endMs = Date.now();
    req = {
      ...req,
      startDate: msToApiDate(startMs),
      endDate: msToApiDate(endMs),
      outputsize: undefined,
    };
  }

  // No-cache paths: outputsize mode (anything not converted above),
  // malformed dates, no supabase client.
  if (!req.startDate || !req.endDate || !supabase) {
    return fetchFromProviders(req);
  }
  const startMs = parseDateMs(req.startDate);
  const rawEndMs = parseDateMs(req.endDate);
  if (Number.isNaN(startMs) || Number.isNaN(rawEndMs)) {
    return fetchFromProviders(req);
  }

  // Clamp request end to "now" so future-spanning requests can't drag
  // the fetch window into territory the provider has no data for. After
  // clamping, a fully-future range collapses to endMs < startMs → drop
  // to the provider's own error handling.
  const nowMs = Date.now();
  const endMs = Math.min(rawEndMs, nowMs);
  if (endMs < startMs) {
    return fetchFromProviders(req);
  }

  const todayUtcMs = startOfUtcDayMs(nowMs);
  const todayDateStr = toIsoDate(todayUtcMs);

  // Enumerate UTC days in [startMs, clamped endMs]. Today appears in
  // the list iff the request reaches at least today's midnight UTC.
  const startDayMs = startOfUtcDayMs(startMs);
  const endDayMs = startOfUtcDayMs(endMs);
  const dayList: string[] = [];
  for (let d = startDayMs; d <= endDayMs; d += MS_PER_DAY) {
    dayList.push(toIsoDate(d));
  }

  // Cache only knows about past UTC days. Strictly < today, never ==.
  const pastDaysInRange = dayList.filter((d) => d < todayDateStr);
  const todayInRange = dayList.includes(todayDateStr);

  const cachedRows = pastDaysInRange.length > 0
    ? await readCacheRows(supabase, req, pastDaysInRange)
    : [];
  const cachedByDay = new Map(cachedRows.map((r) => [r.cache_date, r]));
  const pastMissingDays = pastDaysInRange.filter((d) => !cachedByDay.has(d));

  // We need a provider call when any past day is missing OR when the
  // request touches today (today is never satisfied from cache).
  const needsFetch = pastMissingDays.length > 0 || todayInRange;

  let fetched: CandleHistoryResult | null = null;
  const fetchedByDay = new Map<string, Candle[]>();
  if (needsFetch) {
    // Fetch window:
    //   start = earliest missing past day at 00:00 UTC, OR — if only
    //           today's portion is needed — the user's start clamped
    //           to today's midnight (no point asking for yesterday's
    //           bars when we already have them cached).
    //   end   = clamped endMs when today is in range (use the user's
    //           actual end, don't fake 23:59:59 since today isn't done);
    //           otherwise latest missing past day at 23:59:59 to expand
    //           the response into a full-day cache row.
    const fetchStartMs = pastMissingDays.length > 0
      ? parseDateMs(`${pastMissingDays[0]} 00:00:00`)
      : Math.max(startMs, todayUtcMs);
    const fetchEndMs = todayInRange
      ? endMs
      : parseDateMs(
        `${pastMissingDays[pastMissingDays.length - 1]} 23:59:59`,
      );

    fetched = await fetchFromProviders({
      ...req,
      startDate: msToApiDate(fetchStartMs),
      endDate: msToApiDate(fetchEndMs),
    });
    if (fetched === null) return null;

    // Bucket the response by UTC date — used both for the write payload
    // below AND for the assembly loop. Days with no bars (market closed)
    // simply won't appear in the bucket; we still write a `[]` row for
    // every past missing day so the next query gets an instant empty
    // hit. Today's bucket is NEVER written — its bars are still forming.
    for (const c of fetched.candles) {
      const d = candleUtcDate(c);
      const list = fetchedByDay.get(d);
      if (list) list.push(c);
      else fetchedByDay.set(d, [c]);
    }
    if (pastMissingDays.length > 0) {
      const nowIso = new Date().toISOString();
      const writePayload = pastMissingDays.map((d) => ({
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
  }

  // Assemble: walk dayList in order; cached row wins for past days,
  // fetched bucket fills in everything else (past misses + today).
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

  // Bump LRU for cached past days that contributed.
  if (cachedRows.length > 0) {
    bumpAccessedAt(supabase, req, cachedRows.map((r) => r.cache_date));
  }

  return {
    candles: sliceCandles(allCandles, startMs, endMs),
    // Fall back to twelvedata if we had no data anywhere (empty result
    // from an all-closed window). Caller treats source as cosmetic.
    source: pickedSource ?? "twelvedata",
  };
}
