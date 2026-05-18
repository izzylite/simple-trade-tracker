/**
 * Constants + formatters + chart builder shared across the get_market_data
 * sub-actions (quote, history, indicator, search, session_levels).
 */

import { log } from "../../../_shared/supabase.ts";
import {
  type Candle,
  type CandleInterval,
  formatCandleLine,
} from "../../../_shared/twelvedata.ts";

// Two caps: the text path is bounded by MAX_CANDLES (each OHLC line ≈ 28
// tokens, so 200 ≈ 5.6k tokens). chart_only has no text dump, so the only
// constraint is a renderable/POST-able chart — MAX_CHART_CANDLES is much
// higher (a full day of 5-min bars ≈ 288, a week ≈ 2000).
export const MAX_CANDLES = 200;
export const MAX_CHART_CANDLES = 2000;

export const VALID_INTERVALS: readonly CandleInterval[] = [
  "1min", "5min", "15min", "30min",
  "1h", "2h", "4h", "1day", "1week", "1month",
] as const;

export function isCandleInterval(v: string): v is CandleInterval {
  return (VALID_INTERVALS as readonly string[]).includes(v);
}

export const INTERVAL_MINUTES: Record<CandleInterval, number> = {
  "1min": 1, "5min": 5, "15min": 15, "30min": 30,
  "1h": 60, "2h": 120, "4h": 240,
  "1day": 1440, "1week": 10080, "1month": 43200,
};

// Nudge map: when a window is too granular, point at the next step up.
export const SUGGEST_COARSER: Record<CandleInterval, CandleInterval> = {
  "1min": "30min", "5min": "1h", "15min": "1h", "30min": "4h",
  "1h": "4h", "2h": "1day", "4h": "1day",
  "1day": "1week", "1week": "1month", "1month": "1month",
};

/**
 * Conservative estimate of how many candles a [start, end] window spans at the
 * given interval. Treats the market as 24/7 (overestimates for equities —
 * that's the safe direction, we'd rather nudge than flood). Returns null if
 * the dates don't parse or the window is empty/inverted.
 */
export function estimateWindowBars(
  interval: CandleInterval,
  startDate: string,
  endDate: string,
): number | null {
  const parse = (d: string) =>
    Date.parse(d.includes(" ") ? d.replace(" ", "T") : d);
  const start = parse(startDate);
  const end = parse(endDate);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  return Math.ceil((end - start) / 60000 / INTERVAL_MINUTES[interval]);
}

// Minimum candles before we bother rendering a chart — fewer than 3 is just
// numbers, no shape to read.
export const CHART_MIN_CANDLES = 3;

/**
 * Render an OHLC candlestick via QuickChart `/chart/create`, return the short
 * URL. Failures (network, rate limit, plugin error) return null silently so
 * the data text response still ships.
 */
export async function buildHistoryChartUrl(
  symbol: string,
  interval: string,
  candles: Candle[],
): Promise<string | null> {
  if (candles.length < CHART_MIN_CANDLES) return null;

  // Pretty symbol label for chart title (Orion never sees this).
  let label = symbol;
  if (/^[A-Z]{6}=X$/.test(symbol)) {
    label = `${symbol.slice(0, 3)}/${symbol.slice(3, 6)}`;
  } else if (/^[A-Z0-9]+-(USD|USDT|EUR)$/.test(symbol)) {
    label = symbol.replace("-", "/");
  }

  // Convert "YYYY-MM-DD" or "YYYY-MM-DD HH:mm:ss" (UTC) → unix ms.
  const points: Array<
    { x: number; o: number; h: number; l: number; c: number }
  > = [];
  for (const cdl of candles) {
    const iso = cdl.datetime.includes(" ")
      ? `${cdl.datetime.replace(" ", "T")}Z`
      : `${cdl.datetime}T00:00:00Z`;
    const x = Date.parse(iso);
    if (Number.isNaN(x)) continue;
    points.push({ x, o: cdl.open, h: cdl.high, l: cdl.low, c: cdl.close });
  }
  if (points.length < CHART_MIN_CANDLES) return null;

  // TradingView-style palette: mint up, dark navy down, light grey canvas.
  const spec = {
    type: "candlestick",
    data: {
      datasets: [{
        label: `${label} ${interval}`,
        data: points,
        color: { up: "#26A69A", down: "#2A2E39", unchanged: "#26A69A" },
        borderColor: { up: "#26A69A", down: "#2A2E39", unchanged: "#26A69A" },
      }],
    },
    options: {
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: `${label} ${interval}`,
          color: "#2A2E39",
        },
      },
      scales: {
        x: {
          type: "time",
          grid: { color: "rgba(42,46,57,0.08)" },
          ticks: { color: "#2A2E39" },
        },
        y: {
          position: "right",
          grid: { color: "rgba(42,46,57,0.08)" },
          ticks: { color: "#2A2E39" },
        },
      },
    },
  };

  const body = {
    version: "4",
    backgroundColor: "#D1D4DC",
    width: 1100,
    height: 500,
    format: "png",
    chart: spec,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch("https://quickchart.io/chart/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      log(`QuickChart create HTTP ${res.status} for ${symbol}`, "warn");
      return null;
    }
    const j = (await res.json()) as { success?: boolean; url?: string };
    if (!j.success || !j.url) return null;
    return j.url;
  } catch (err) {
    log(`QuickChart create exception for ${symbol}`, "warn", err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export { type Candle, type CandleInterval, formatCandleLine };
