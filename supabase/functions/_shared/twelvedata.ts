/**
 * Twelve Data adapter — primary live price + historical candle source.
 *
 * Replaces the unofficial Yahoo Finance scrape for forex, US stocks, and
 * crypto. Indices/futures/bonds/DXY fall back to Yahoo (see prices.ts).
 *
 * Quirks handled:
 *   - HTTP 200 with `{status:"error", code:...}` body on rate limit / bad
 *     symbol. We parse the body, never trust HTTP status alone.
 *   - `start_date === end_date` on /time_series sometimes 400s. Callers that
 *     want a single day should query a small window and filter.
 *   - Free tier: 8 credits/min, 800/day. Each /quote or /time_series = 1 credit.
 *
 * Env: TWELVE_DATA_API_KEY (required).
 */
import { log } from './supabase.ts';
import type { PriceSnapshot } from './prices.ts';

const BASE = 'https://api.twelvedata.com';

// ============================================================
// Symbol translation: Yahoo format → Twelve Data format
// ============================================================
//
// Orion + briefings + frontend all speak Yahoo format (see instruments.ts).
// Returning null means "this asset class is not on Twelve Data's free tier,
// caller should use the Yahoo fallback path."

const SYMBOL_OVERRIDES: Record<string, string> = {
  // Indices reachable on Pro only — let caller fall back to Yahoo.
  // (Map kept for future use; currently all null-routed below.)
};

export function yahooToTwelve(yahooSymbol: string): string | null {
  const s = yahooSymbol.trim();
  if (!s) return null;

  // Explicit override wins.
  if (SYMBOL_OVERRIDES[s]) return SYMBOL_OVERRIDES[s];

  // Forex: `EURUSD=X` → `EUR/USD`. 6-char base+quote followed by `=X`.
  if (s.endsWith('=X')) {
    const pair = s.slice(0, -2);
    if (pair.length === 6) {
      return `${pair.slice(0, 3)}/${pair.slice(3, 6)}`;
    }
    return null; // odd-shaped =X symbol (e.g. DX-Y.NYB hits other branch)
  }

  // Crypto: `BTC-USD` → `BTC/USD`. Must end in `-USD` (or other fiat we honor).
  if (/^[A-Z0-9]+-(USD|USDT|EUR)$/.test(s)) {
    return s.replace('-', '/');
  }

  // Caret-prefixed (^GSPC, ^VIX) = index → Pro plan only on Twelve Data.
  if (s.startsWith('^')) return null;

  // Futures (`GC=F`, `CL=F`) → Pro only. DXY (`DX-Y.NYB`) → not supported.
  if (s.endsWith('=F') || s.includes('.NYB')) return null;

  // Bare alphanumerics → assume US stock ticker (AAPL, MSFT, BRK-B…).
  if (/^[A-Z][A-Z0-9.\-]*$/.test(s)) return s;

  return null;
}

// ============================================================
// Response shapes
// ============================================================

interface TwelveError {
  code: number;
  status: 'error';
  message: string;
}

interface TwelveQuoteResponse {
  symbol?: string;
  name?: string;
  exchange?: string;
  currency?: string;
  currency_base?: string;
  currency_quote?: string;
  datetime?: string;
  timestamp?: number;
  last_quote_at?: number;
  open?: string;
  high?: string;
  low?: string;
  close?: string;
  previous_close?: string;
  change?: string;
  percent_change?: string;
  is_market_open?: boolean;
}

interface TwelveTimeSeriesValue {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume?: string;
}

interface TwelveTimeSeriesResponse {
  meta?: {
    symbol: string;
    interval: string;
    currency?: string;
    currency_base?: string;
    currency_quote?: string;
    exchange?: string;
    type?: string;
  };
  values?: TwelveTimeSeriesValue[];
  status?: string;
}

function isErrorBody(j: unknown): j is TwelveError {
  if (!j || typeof j !== 'object') return false;
  const obj = j as Record<string, unknown>;
  return obj.status === 'error' && typeof obj.code === 'number';
}

// ============================================================
// /quote — live snapshot (price, today's OHLC, prev close)
// ============================================================

export async function fetchQuote(yahooSymbol: string): Promise<PriceSnapshot | null> {
  const tdSymbol = yahooToTwelve(yahooSymbol);
  if (!tdSymbol) return null;

  const apiKey = Deno.env.get('TWELVE_DATA_API_KEY');
  if (!apiKey) {
    log('TWELVE_DATA_API_KEY not set', 'warn');
    return null;
  }

  const url =
    `${BASE}/quote?symbol=${encodeURIComponent(tdSymbol)}&apikey=${apiKey}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      log(`Twelve Data /quote HTTP ${res.status} for ${tdSymbol}`, 'warn');
      return null;
    }
    const body = (await res.json()) as TwelveQuoteResponse | TwelveError;
    if (isErrorBody(body)) {
      log(
        `Twelve Data /quote error ${body.code} for ${tdSymbol}: ${body.message}`,
        'warn',
      );
      return null;
    }
    return normalizeQuote(yahooSymbol, body);
  } catch (err) {
    log(`Twelve Data /quote exception for ${tdSymbol}`, 'warn', err);
    return null;
  }
}

function normalizeQuote(
  yahooSymbol: string,
  q: TwelveQuoteResponse,
): PriceSnapshot | null {
  const num = (v: string | undefined): number | null => {
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const price = num(q.close);
  const prev = num(q.previous_close);
  if (price === null || prev === null) return null;

  const change = price - prev;
  const percentChange = prev !== 0 ? (change / prev) * 100 : 0;
  const currency = q.currency || q.currency_quote || 'USD';

  return {
    symbol: yahooSymbol,
    displayName: q.name || yahooSymbol,
    price,
    change,
    percentChange,
    dayHigh: num(q.high) ?? price,
    dayLow: num(q.low) ?? price,
    previousClose: prev,
    quoteTime: q.last_quote_at || q.timestamp || Math.floor(Date.now() / 1000),
    currency,
  };
}

// ============================================================
// /time_series — historical candles
// ============================================================

export type CandleInterval =
  | '1min' | '5min' | '15min' | '30min'
  | '1h' | '2h' | '4h' | '1day' | '1week' | '1month';

export interface Candle {
  datetime: string; // ISO-ish: "2025-03-14 14:00:00" or "2025-03-14"
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface TimeSeriesOptions {
  interval: CandleInterval;
  outputsize?: number;      // default 30, max 5000
  startDate?: string;       // YYYY-MM-DD or "YYYY-MM-DD HH:mm:ss"
  endDate?: string;
  timezone?: string;        // e.g. "America/New_York"; default exchange tz
}

export async function fetchTimeSeries(
  yahooSymbol: string,
  opts: TimeSeriesOptions,
): Promise<Candle[] | null> {
  const tdSymbol = yahooToTwelve(yahooSymbol);
  if (!tdSymbol) return null;

  const apiKey = Deno.env.get('TWELVE_DATA_API_KEY');
  if (!apiKey) {
    log('TWELVE_DATA_API_KEY not set', 'warn');
    return null;
  }

  const params = new URLSearchParams({
    symbol: tdSymbol,
    interval: opts.interval,
    apikey: apiKey,
  });
  if (opts.outputsize) params.set('outputsize', String(opts.outputsize));
  if (opts.startDate) params.set('start_date', opts.startDate);
  if (opts.endDate) params.set('end_date', opts.endDate);
  if (opts.timezone) params.set('timezone', opts.timezone);

  const url = `${BASE}/time_series?${params.toString()}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      log(
        `Twelve Data /time_series HTTP ${res.status} for ${tdSymbol}`,
        'warn',
      );
      return null;
    }
    const body =
      (await res.json()) as TwelveTimeSeriesResponse | TwelveError;
    if (isErrorBody(body)) {
      // 400 "No data is available" on market-closed dates is expected;
      // surface as empty array so callers can distinguish from failure.
      if (body.code === 400 && /no data/i.test(body.message)) {
        return [];
      }
      log(
        `Twelve Data /time_series error ${body.code} for ${tdSymbol}: ${body.message}`,
        'warn',
      );
      return null;
    }
    const values = body.values;
    if (!values) return null;
    return values.map(normalizeCandle);
  } catch (err) {
    log(`Twelve Data /time_series exception for ${tdSymbol}`, 'warn', err);
    return null;
  }
}

function normalizeCandle(v: TwelveTimeSeriesValue): Candle {
  const c: Candle = {
    datetime: v.datetime,
    open: Number(v.open),
    high: Number(v.high),
    low: Number(v.low),
    close: Number(v.close),
  };
  if (v.volume !== undefined) c.volume = Number(v.volume);
  return c;
}

// ============================================================
// Formatter — compact OHLC line for Orion responses
// ============================================================

export function formatCandleLine(c: Candle, currency = ''): string {
  const dp = c.close < 10 ? 5 : c.close < 1000 ? 2 : 2;
  const cur = currency ? ` ${currency}` : '';
  const vol = c.volume != null ? `, vol ${c.volume.toLocaleString('en-US')}` : '';
  return (
    `${c.datetime}: O ${c.open.toFixed(dp)} ` +
    `H ${c.high.toFixed(dp)} L ${c.low.toFixed(dp)} C ${c.close.toFixed(dp)}${cur}${vol}`
  );
}

// ============================================================
// Technical indicators — /rsi /macd /atr /bbands
// ============================================================
//
// One unified entry point routes to the per-indicator endpoint. All four
// share the same auth + error model as /quote and /time_series. Coverage
// matches the time_series client (forex/US-stocks/crypto on free tier;
// indices/futures/bonds/DXY return null → caller surfaces "not supported").
//
// Period defaults match Twelve Data's own defaults: RSI/ATR=14, BBANDS=20.
// MACD uses fast=12, slow=26, signal=9 (standard); we don't expose tuning.

export type IndicatorName =
  | 'RSI' | 'MACD' | 'ATR' | 'BBANDS' | 'EMA' | 'SMA' | 'VWAP';

export interface IndicatorPoint {
  datetime: string;
  /** Indicator-specific keys. RSI/ATR/EMA/SMA/VWAP: {value}. MACD: {macd,
   *  signal, hist}. BBANDS: {upper, middle, lower}. Kept loose so the
   *  formatter handles each case without a wide type union per call site. */
  values: Record<string, number>;
}

export interface IndicatorOptions {
  interval: CandleInterval;
  /** Lookback period. Defaults: RSI 14, ATR 14, BBANDS 20, EMA 20, SMA 20,
   *  VWAP 9. Ignored for MACD (uses fixed fast=12 slow=26 signal=9). */
  period?: number;
  /** How many indicator points to return (default 1 — just the latest). */
  outputsize?: number;
}

const INDICATOR_ENDPOINT: Record<IndicatorName, string> = {
  RSI: 'rsi',
  MACD: 'macd',
  ATR: 'atr',
  BBANDS: 'bbands',
  EMA: 'ema',
  SMA: 'sma',
  VWAP: 'vwap',
};

export async function fetchIndicator(
  yahooSymbol: string,
  indicator: IndicatorName,
  opts: IndicatorOptions,
): Promise<IndicatorPoint[] | null> {
  const tdSymbol = yahooToTwelve(yahooSymbol);
  if (!tdSymbol) return null;

  const apiKey = Deno.env.get('TWELVE_DATA_API_KEY');
  if (!apiKey) {
    log('TWELVE_DATA_API_KEY not set', 'warn');
    return null;
  }

  const params = new URLSearchParams({
    symbol: tdSymbol,
    interval: opts.interval,
    apikey: apiKey,
  });
  // /macd doesn't take time_period (uses fast/slow/signal).
  if (indicator !== 'MACD' && opts.period) {
    params.set('time_period', String(opts.period));
  }
  if (opts.outputsize) params.set('outputsize', String(opts.outputsize));

  const url = `${BASE}/${INDICATOR_ENDPOINT[indicator]}?${params.toString()}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      log(
        `Twelve Data /${INDICATOR_ENDPOINT[indicator]} HTTP ${res.status} for ${tdSymbol}`,
        'warn',
      );
      return null;
    }
    const body = (await res.json()) as
      | { values?: Array<Record<string, string>>; status?: string }
      | TwelveError;
    if (isErrorBody(body)) {
      log(
        `Twelve Data /${INDICATOR_ENDPOINT[indicator]} error ${body.code} for ${tdSymbol}: ${body.message}`,
        'warn',
      );
      return null;
    }
    const raw = body.values;
    if (!raw) return null;
    return raw.map((v) => normalizeIndicatorPoint(indicator, v));
  } catch (err) {
    log(
      `Twelve Data /${INDICATOR_ENDPOINT[indicator]} exception for ${tdSymbol}`,
      'warn',
      err,
    );
    return null;
  }
}

function normalizeIndicatorPoint(
  indicator: IndicatorName,
  v: Record<string, string>,
): IndicatorPoint {
  const n = (key: string): number => {
    const x = Number(v[key]);
    return Number.isFinite(x) ? x : NaN;
  };
  const datetime = v.datetime;
  switch (indicator) {
    case 'RSI':
      return { datetime, values: { value: n('rsi') } };
    case 'ATR':
      return { datetime, values: { value: n('atr') } };
    case 'EMA':
      return { datetime, values: { value: n('ema') } };
    case 'SMA':
      return { datetime, values: { value: n('sma') } };
    case 'VWAP':
      return { datetime, values: { value: n('vwap') } };
    case 'MACD':
      return {
        datetime,
        values: {
          macd: n('macd'),
          signal: n('macd_signal'),
          hist: n('macd_hist'),
        },
      };
    case 'BBANDS':
      return {
        datetime,
        values: {
          upper: n('upper_band'),
          middle: n('middle_band'),
          lower: n('lower_band'),
        },
      };
  }
}

// ============================================================
// /symbol_search — fuzzy resolution of company / ticker names
// ============================================================
//
// Free tier: returns up to ~30 matches across all asset classes. We trim
// to the most useful columns; Orion uses this to disambiguate "tesla" →
// TSLA before chaining into a quote/history call.

export interface SymbolMatch {
  symbol: string;
  instrumentName: string;
  exchange: string;
  country: string;
  type: string; // "Common Stock", "ETF", "Index", "Physical Currency", ...
}

interface TwelveSymbolSearchResponse {
  data?: Array<{
    symbol: string;
    instrument_name?: string;
    exchange?: string;
    country?: string;
    instrument_type?: string;
  }>;
  status?: string;
}

export async function fetchSymbolSearch(
  query: string,
  outputsize = 10,
): Promise<SymbolMatch[] | null> {
  const q = query.trim();
  if (!q) return [];

  const apiKey = Deno.env.get('TWELVE_DATA_API_KEY');
  if (!apiKey) {
    log('TWELVE_DATA_API_KEY not set', 'warn');
    return null;
  }

  const params = new URLSearchParams({
    symbol: q,
    outputsize: String(outputsize),
    apikey: apiKey,
  });
  const url = `${BASE}/symbol_search?${params.toString()}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      log(`Twelve Data /symbol_search HTTP ${res.status} for "${q}"`, 'warn');
      return null;
    }
    const body = (await res.json()) as TwelveSymbolSearchResponse | TwelveError;
    if (isErrorBody(body)) {
      log(
        `Twelve Data /symbol_search error ${body.code} for "${q}": ${body.message}`,
        'warn',
      );
      return null;
    }
    const data = body.data;
    if (!data) return [];
    return data.map((d) => ({
      symbol: d.symbol,
      instrumentName: d.instrument_name ?? '',
      exchange: d.exchange ?? '',
      country: d.country ?? '',
      type: d.instrument_type ?? '',
    }));
  } catch (err) {
    log(`Twelve Data /symbol_search exception for "${q}"`, 'warn', err);
    return null;
  }
}
