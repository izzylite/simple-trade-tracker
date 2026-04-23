import { log } from './supabase.ts';
import type { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

  const fresh = await fetchYahoo(symbol);
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
