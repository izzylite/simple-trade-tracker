/**
 * get_market_data action="indicator" — RSI / MACD / ATR / BBANDS / EMA / SMA / VWAP
 * via Twelve Data per-indicator endpoints. Free-tier coverage: forex /
 * US-stocks / crypto. VWAP is intraday-only.
 */

import {
  type CandleInterval,
  fetchIndicator,
  type IndicatorName,
} from "../../../_shared/twelvedata.ts";
import {
  isCandleInterval,
  VALID_INTERVALS,
} from "./shared.ts";

const VALID_INDICATORS: ReadonlySet<IndicatorName> = new Set([
  "RSI",
  "MACD",
  "ATR",
  "BBANDS",
  "EMA",
  "SMA",
  "VWAP",
]);

const INDICATOR_DEFAULT_PERIOD: Record<IndicatorName, number> = {
  RSI: 14,
  ATR: 14,
  BBANDS: 20,
  EMA: 20,  // 20-period default — user names 50/200 when they want trend filter
  SMA: 20,  // same as EMA — period is the meaningful axis (20/50/200)
  VWAP: 9,  // TD /vwap default — moving VWAP over the last 9 bars
  MACD: 0,  // unused — MACD uses fast/slow/signal internally
};

function formatIndicatorLine(
  indicator: IndicatorName,
  datetime: string,
  values: Record<string, number>,
): string {
  // Format precision: indicators on percent/oscillator scale (RSI/MACD hist)
  // get 2dp; price-scale (ATR, BBands) gets 4dp.
  const dp2 = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : "n/a");
  const dp4 = (n: number) => (Number.isFinite(n) ? n.toFixed(4) : "n/a");
  switch (indicator) {
    case "RSI":
      return `${datetime}: RSI ${dp2(values.value)}`;
    case "ATR":
      return `${datetime}: ATR ${dp4(values.value)}`;
    case "EMA":
      return `${datetime}: EMA ${dp4(values.value)}`;
    case "SMA":
      return `${datetime}: SMA ${dp4(values.value)}`;
    case "VWAP":
      return `${datetime}: VWAP ${dp4(values.value)}`;
    case "MACD":
      return (
        `${datetime}: MACD ${dp4(values.macd)} ` +
        `signal ${dp4(values.signal)} hist ${dp4(values.hist)}`
      );
    case "BBANDS":
      return (
        `${datetime}: BB upper ${dp4(values.upper)} ` +
        `mid ${dp4(values.middle)} lower ${dp4(values.lower)}`
      );
  }
}

export async function executeGetIndicator(args: {
  symbol: string;
  indicator: string;
  interval: string;
  period?: number;
  outputsize?: number;
}): Promise<string> {
  const symbol = (args.symbol || "").trim();
  if (!symbol) return "Symbol is required.";

  const indicator =
    (args.indicator || "").trim().toUpperCase() as IndicatorName;
  if (!VALID_INDICATORS.has(indicator)) {
    return (
      `Invalid indicator "${args.indicator}". ` +
      `Valid: ${Array.from(VALID_INDICATORS).join(", ")}.`
    );
  }

  const interval = (args.interval || "").trim();
  if (!isCandleInterval(interval)) {
    return `Invalid interval "${interval}". Valid: ${VALID_INTERVALS.join(", ")}.`;
  }

  // Default to 1 point — just the latest reading is usually what's asked.
  // Cap at 20 to keep token cost bounded.
  const outputsize = Math.max(
    1,
    Math.min(
      20,
      Number.isFinite(args.outputsize) ? Number(args.outputsize) : 1,
    ),
  );

  const period = Number.isFinite(args.period)
    ? Number(args.period)
    : INDICATOR_DEFAULT_PERIOD[indicator];

  const points = await fetchIndicator(symbol, indicator, {
    interval: interval as CandleInterval,
    period: period > 0 ? period : undefined,
    outputsize,
  });

  if (points === null) {
    return (
      `Could not fetch ${indicator} for "${symbol}". ` +
      `Coverage on free tier is forex / US stocks / crypto only — indices ` +
      `(^GSPC…), futures (GC=F…), bonds (^TNX…), and DXY (DX-Y.NYB) aren't ` +
      `supported here. For those, fetch action="history" candles instead and ` +
      `reason about levels manually.`
    );
  }
  if (points.length === 0) {
    return (
      `No ${indicator} data for "${symbol}" at ${interval}. ` +
      `Likely the market was closed or the interval has no recent bars.`
    );
  }

  // Oldest → newest in the rendered output (matches history convention).
  const asc = [...points].reverse();
  const periodLabel = indicator === "MACD"
    ? "fast=12 slow=26 signal=9"
    : `period ${period}`;
  const header = `${symbol} ${indicator} (${periodLabel}, ${interval}) — ` +
    `${asc.length} point${asc.length === 1 ? "" : "s"}:`;
  const lines = asc
    .map((p) => `  ${formatIndicatorLine(indicator, p.datetime, p.values)}`)
    .join("\n");
  return `${header}\n${lines}`;
}
