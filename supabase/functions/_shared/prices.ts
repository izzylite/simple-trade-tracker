import { log } from './supabase.ts';
import type { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fetchQuote as fetchTwelve } from './twelvedata.ts';
import type { Candle } from './twelvedata.ts';

type SupabaseClient = ReturnType<typeof createClient>;

export interface PriceSnapshot {
  symbol: string;
  displayName: string;
  price: number;
  change: number;
  percentChange: number;
  dayHigh: number;
  dayLow: number;
  previousClose: number;
  quoteTime: number;
  currency: string;
  /** Provider that served the data: 'twelvedata' (primary) or 'yahoo' (fallback). */
  source?: 'twelvedata' | 'yahoo';
}

// ============================================================
// Yahoo Finance adapter (intraday, unofficial)
// ============================================================

interface YahooChartResponse {
  chart: {
    result?: Array<{
      meta: {
        symbol: string;
        regularMarketPrice?: number;
        regularMarketTime?: number;
        regularMarketDayHigh?: number;
        regularMarketDayLow?: number;
        previousClose?: number;
        chartPreviousClose?: number;
        currency?: string;
        longName?: string;
        shortName?: string;
      };
    }>;
    error?: { code: string; description: string } | null;
  };
}

export async function fetchYahoo(symbol: string): Promise<PriceSnapshot | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      },
    });
    if (!response.ok) {
      log(`Yahoo fetch failed for ${symbol}: ${response.status}`, 'warn');
      return null;
    }
    const data = (await response.json()) as YahooChartResponse;
    const meta = data.chart?.result?.[0]?.meta;
    if (!meta || typeof meta.regularMarketPrice !== 'number') {
      return null;
    }
    const previousClose =
      (typeof meta.previousClose === 'number' ? meta.previousClose : undefined) ??
      (typeof meta.chartPreviousClose === 'number' ? meta.chartPreviousClose : undefined);
    if (typeof previousClose !== 'number') return null;

    const price = meta.regularMarketPrice;
    const change = price - previousClose;
    const percentChange = previousClose !== 0 ? (change / previousClose) * 100 : 0;

    return {
      symbol,
      displayName: meta.longName || meta.shortName || symbol,
      price,
      change,
      percentChange,
      dayHigh: meta.regularMarketDayHigh ?? price,
      dayLow: meta.regularMarketDayLow ?? price,
      previousClose,
      quoteTime: meta.regularMarketTime ?? Math.floor(Date.now() / 1000),
      currency: meta.currency ?? 'USD',
    };
  } catch (err) {
    log(`Yahoo fetch error for ${symbol}`, 'warn', err);
    return null;
  }
}

// ============================================================
// Yahoo Finance adapter — historical candles (chart endpoint)
// ============================================================
//
// Fallback for get_market_data(history) when Twelve Data can't reach an asset class
// (DXY, indices, futures, bonds). Yahoo carries all of them. Same scrape
// fragility as fetchYahoo above — UA-spoofed, unofficial endpoint.

const YAHOO_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// Twelve Data interval name → Yahoo interval name. `null` = Yahoo has no
// matching granularity (2h/4h) → caller should suggest 1h or 1day instead.
const YAHOO_INTERVAL: Record<string, string | null> = {
  '1min': '1m', '5min': '5m', '15min': '15m', '30min': '30m',
  '1h': '1h', '2h': null, '4h': null,
  '1day': '1d', '1week': '1wk', '1month': '1mo',
};

interface YahooChartSeriesResponse {
  chart: {
    result?: Array<{
      timestamp?: number[];
      indicators: {
        quote: Array<{
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
    error?: { code: string; description: string } | null;
  };
}

export interface YahooSeriesOptions {
  /** Twelve Data interval name (1min, 5min, 1h, 1day, 1week, 1month, …). */
  interval: string;
  /** Window start, unix seconds. */
  period1: number;
  /** Window end, unix seconds. */
  period2: number;
}

/**
 * Returns:
 *   - Candle[]  on success (chronological, oldest→newest, null-OHLC bars dropped)
 *   - []        when the window has no data (market closed / out of horizon)
 *   - null      when the symbol/interval is unsupported or the request failed
 */
export async function fetchYahooTimeSeries(
  symbol: string,
  opts: YahooSeriesOptions
): Promise<Candle[] | null> {
  const yInterval = YAHOO_INTERVAL[opts.interval];
  // undefined = unknown interval name; null = 2h/4h, no Yahoo equivalent.
  if (!yInterval) return null;
  if (opts.period2 <= opts.period1) return null;

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=${yInterval}&period1=${opts.period1}&period2=${opts.period2}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': YAHOO_UA } });
    if (!res.ok) {
      // 404 → bad/delisted symbol. Treat as "unsupported", not "no data".
      return null;
    }
    const data = (await res.json()) as YahooChartSeriesResponse;
    if (data.chart?.error) return null;
    const result = data.chart?.result?.[0];
    if (!result) return null;

    const ts = result.timestamp;
    if (!ts || ts.length === 0) return []; // market closed for this window
    const q = result.indicators?.quote?.[0];
    if (!q) return [];

    const out: Candle[] = [];
    const intradayLike = /m$|h$/.test(yInterval);
    for (let i = 0; i < ts.length; i++) {
      const o = q.open?.[i];
      const h = q.high?.[i];
      const l = q.low?.[i];
      const c = q.close?.[i];
      if (o == null || h == null || l == null || c == null) continue; // null edge bar
      const iso = new Date(ts[i] * 1000).toISOString();
      const candle: Candle = {
        // Daily+ → "YYYY-MM-DD"; intraday → "YYYY-MM-DD HH:mm:ss" (UTC).
        datetime: intradayLike ? iso.replace('T', ' ').slice(0, 19) : iso.slice(0, 10),
        open: o,
        high: h,
        low: l,
        close: c,
      };
      const v = q.volume?.[i];
      if (v != null) candle.volume = v;
      out.push(candle);
    }
    return out;
  } catch (err) {
    log(`Yahoo time_series error for ${symbol}`, 'warn', err);
    return null;
  }
}

// ============================================================
// Shared DB cache layer
// ============================================================

async function readPriceCache(
  supabase: SupabaseClient,
  symbol: string,
  ttlSeconds: number
): Promise<PriceSnapshot | null> {
  const cutoff = new Date(Date.now() - ttlSeconds * 1000).toISOString();
  const { data, error } = await supabase
    .from('price_cache')
    .select('snapshot')
    .eq('symbol', symbol)
    .gte('fetched_at', cutoff)
    .maybeSingle();
  if (error) {
    log('Price cache read error', 'warn', error);
    return null;
  }
  if (!data) return null;
  return data.snapshot as PriceSnapshot;
}

async function writePriceCache(
  supabase: SupabaseClient,
  symbol: string,
  snapshot: PriceSnapshot
): Promise<void> {
  const { error } = await supabase.from('price_cache').upsert({
    symbol,
    snapshot,
    fetched_at: new Date().toISOString(),
  });
  if (error) {
    log('Price cache write error', 'warn', error);
  }
}

export async function getMarketPrice(
  supabase: SupabaseClient,
  symbol: string,
  ttlSeconds = 60
): Promise<PriceSnapshot | null> {
  const cached = await readPriceCache(supabase, symbol, ttlSeconds);
  if (cached) return cached;

  // Primary: Twelve Data (forex, US stocks, crypto). Returns null for
  // unsupported asset classes (indices, futures, bonds, DXY) — those fall
  // through to Yahoo.
  let fresh: PriceSnapshot | null = await fetchTwelve(symbol);
  if (fresh) {
    fresh.source = 'twelvedata';
  } else {
    fresh = await fetchYahoo(symbol);
    if (fresh) fresh.source = 'yahoo';
  }

  if (fresh) {
    await writePriceCache(supabase, symbol, fresh);
  }
  return fresh;
}

export async function getMarketPrices(
  supabase: SupabaseClient,
  symbols: string[],
  ttlSeconds = 60
): Promise<Record<string, PriceSnapshot | null>> {
  const unique = Array.from(new Set(symbols));
  const entries = await Promise.all(
    unique.map(async (s) => [s, await getMarketPrice(supabase, s, ttlSeconds)] as const)
  );
  return Object.fromEntries(entries);
}

export function formatPriceLine(snap: PriceSnapshot): string {
  const dp = snap.price < 10 ? 5 : snap.price < 1000 ? 2 : 2;
  const arrow = snap.percentChange >= 0 ? '▲' : '▼';
  const priceStr = snap.price.toLocaleString('en-US', {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
  const changeStr = snap.percentChange.toFixed(2);
  return `${snap.displayName} (${snap.symbol}): ${priceStr} ${arrow} ${changeStr}% — day range ${snap.dayLow.toFixed(dp)} – ${snap.dayHigh.toFixed(dp)}, prev close ${snap.previousClose.toFixed(dp)}`;
}
