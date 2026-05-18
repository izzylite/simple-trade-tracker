/**
 * get_market_data action="history" — OHLC candles + optional chart + optional
 * market summary block (PDH/PDL + Asia/London/NY session H/L + breach state).
 *
 * Provider chain:
 *   1. Twelve Data /time_series (forex / US stocks / crypto)
 *   2. Yahoo Finance fallback (DXY, indices, futures, bonds — everything TD
 *      can't serve)
 *
 * Capacity caps (defined in shared.ts):
 *   - MAX_CANDLES = 200 for the text dump (~5.6k tokens at line-format)
 *   - MAX_CHART_CANDLES = 2000 for chart_only (no text dump, just an image)
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Candle } from "../../../_shared/twelvedata.ts";
import { getMarketHistory } from "../../../_shared/candleCache.ts";
import {
  isDaylightSavingTime,
  symbolSupportsSessionLevels,
} from "../../sessions.ts";
import {
  buildHistoryChartUrl,
  CHART_MIN_CANDLES,
  estimateWindowBars,
  formatCandleLine,
  INTERVAL_MINUTES,
  isCandleInterval,
  MAX_CANDLES,
  MAX_CHART_CANDLES,
  SUGGEST_COARSER,
  VALID_INTERVALS,
} from "./shared.ts";
import { executeGetSessionLevels } from "./session-levels.ts";

/** Cap on how many UTC days of session summary we'll fan out per history
 *  call. Beyond ~5 the output becomes noise and the API spend isn't worth
 *  it — long lookbacks should rely on the OHLC dump, not per-day sessions. */
const MAX_SESSION_SUMMARY_DAYS = 5;

/**
 * Produce a session summary block aligned with the history window. One
 * `executeGetSessionLevels` call per UTC day in [start_date, end_date],
 * newest day first, capped at MAX_SESSION_SUMMARY_DAYS. Without a window
 * the block covers just today.
 *
 * Per-day ref must land in the gap between NY PM close and Asia open, so
 * every session for that trading day reads as completed and Asia resolves
 * to "Tue 22/23 — Wed 07/08" (preceding Wed's London) rather than the
 * empty in-progress Asia just starting. No fixed UTC time covers both DST
 * states — branch on the queried day's DST flag.
 *
 *   DST OFF (winter):  NY PM ends 22:00, Asia opens 23:00 → gap 22-23 UTC
 *   DST ON  (summer):  NY PM ends 21:00, Asia opens 22:00 → gap 21-22 UTC
 */
async function buildMultiDaySessionBlock(
  symbol: string,
  args: { start_date?: string; end_date?: string },
  supabase?: SupabaseClient,
): Promise<string> {
  const dayMs = 86_400_000;
  const now = new Date();
  const toUtcMidnight = (d: Date) =>
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

  const parseDay = (s: string | undefined): Date | null => {
    if (!s) return null;
    const ms = Date.parse(s.includes(" ") ? s.replace(" ", "T") : s);
    return Number.isNaN(ms) ? null : new Date(ms);
  };

  const endDay = parseDay(args.end_date) ?? now;
  const startDay = parseDay(args.start_date) ?? endDay;
  const startUtcMs = toUtcMidnight(startDay);
  const endUtcMs = toUtcMidnight(endDay);
  const todayUtcMs = toUtcMidnight(now);

  const totalDays = Math.max(
    1,
    Math.floor((endUtcMs - startUtcMs) / dayMs) + 1,
  );

  const refs: Date[] = [];
  let cursor = endUtcMs;
  while (cursor >= startUtcMs && refs.length < MAX_SESSION_SUMMARY_DAYS) {
    if (cursor === todayUtcMs) {
      refs.push(now);
    } else if (cursor < todayUtcMs) {
      const isDST = isDaylightSavingTime(new Date(cursor), "EU");
      const hoursIntoDay = isDST ? 21.5 : 22.5;
      refs.push(new Date(cursor + hoursIntoDay * 3_600_000));
    }
    // Skip future days — can't summarize sessions that haven't happened.
    cursor -= dayMs;
  }

  if (refs.length === 0) return "";

  const blocks = await Promise.all(
    refs.map((ref) => executeGetSessionLevels({ symbol, ref }, supabase)),
  );

  const truncationNote = totalDays > MAX_SESSION_SUMMARY_DAYS
    ? `(showing session summary for last ${MAX_SESSION_SUMMARY_DAYS} of ` +
      `${totalDays} UTC days in window)\n\n`
    : "";

  return `${truncationNote}${blocks.join("\n\n")}\n\n`;
}

export async function executeGetMarketHistory(args: {
  symbol: string;
  interval: string;
  outputsize?: number;
  start_date?: string;
  end_date?: string;
  chart_only?: boolean;
  include_chart?: boolean;
  include_summary?: boolean;
}, supabase?: SupabaseClient): Promise<string> {
  const symbol = (args.symbol || "").trim();
  if (!symbol) return "Symbol is required.";

  const interval = (args.interval || "").trim();
  if (!isCandleInterval(interval)) {
    return `Invalid interval "${interval}". Valid: ${VALID_INTERVALS.join(", ")}.`;
  }

  // Range: prefer explicit start/end; else outputsize; else 30.
  const hasWindow = !!(args.start_date && args.end_date);

  // chart_only renders an image with no OHLC text dump → the token budget
  // doesn't apply, so allow far more bars (a full day of 5-min ≈ 288).
  const candleCap = args.chart_only ? MAX_CHART_CANDLES : MAX_CANDLES;

  // Reject windows that would blow past the cap BEFORE spending an API credit —
  // nudge Orion to a coarser interval instead of silently truncating.
  if (hasWindow) {
    const est = estimateWindowBars(interval, args.start_date!, args.end_date!);
    if (est !== null && est > candleCap) {
      const coarser = SUGGEST_COARSER[interval];
      return (
        `That window at ${interval} is roughly ${est} candles — over the ` +
        `${candleCap}-candle limit. Use a coarser interval (try ${coarser}) ` +
        `or narrow the window.`
      );
    }
  }

  const wantSize = Math.min(args.outputsize ?? 30, candleCap);
  const outputsize = hasWindow ? undefined : wantSize;

  // Unix [period1, period2] window — needed for the Yahoo fallback. For
  // outputsize mode we pad the lookback 3× to absorb weekends/holidays, then
  // slice down after fetching.
  const nowSec = Math.floor(Date.now() / 1000);
  const parseSec = (d: string): number => {
    const ms = Date.parse(d.includes(" ") ? d.replace(" ", "T") : d);
    return Number.isNaN(ms) ? NaN : Math.floor(ms / 1000);
  };
  const period2 = hasWindow ? parseSec(args.end_date!) : nowSec;
  const period1 = hasWindow
    ? parseSec(args.start_date!)
    : nowSec - wantSize * 3 * INTERVAL_MINUTES[interval] * 60;

  // Twelve Data primary, Yahoo fallback, with shared past-window cache.
  // Wrapper normalizes to oldest→newest regardless of source.
  const fetched = await getMarketHistory(supabase, {
    symbol,
    interval,
    outputsize,
    startDate: args.start_date,
    endDate: args.end_date,
    period1,
    period2,
  });
  const candles: Candle[] | null = fetched?.candles ?? null;

  if (candles === null) {
    if (interval === "2h" || interval === "4h") {
      return (
        `Could not fetch ${interval} history for "${symbol}". The ${interval} ` +
        `granularity isn't available for this instrument — use 1h or 1day.`
      );
    }
    return (
      `Could not fetch history for "${symbol}". The symbol may be unrecognized ` +
      `or the data source is unavailable. Try action="quote" for the current value.`
    );
  }
  if (candles.length === 0) {
    const win = hasWindow
      ? `${args.start_date} → ${args.end_date}`
      : "requested window";
    return (
      `No data for ${symbol} at ${interval} over ${win}. ` +
      `Likely the market was closed (weekend, holiday, pre-market) or the ` +
      `window is older than the intraday history limit. Try the nearest open ` +
      `trading day, or a coarser interval (1day goes back decades).`
    );
  }

  // Wrapper already returns oldest→newest. Cap output:
  // outputsize mode → last `wantSize`; window mode → last `candleCap`.
  const keep = hasWindow ? candleCap : wantSize;
  const ordered = candles.slice(-keep);
  const truncatedNote = candles.length > ordered.length
    ? `\n(showing last ${ordered.length} of ${candles.length} candles)`
    : "";

  // Render a chart only when asked: chart_only mode always wants one;
  // include_chart=true is the opt-in for the data+chart case. Skip the
  // QuickChart round-trip otherwise. (< CHART_MIN_CANDLES never renders.)
  const wantChart = args.chart_only || args.include_chart;
  const chartUrl = wantChart
    ? await buildHistoryChartUrl(symbol, interval, ordered)
    : null;

  // chart_only mode: skip the OHLC text dump entirely, return just the chart
  // URL. Saves ~1.5k tokens of context when the user only wants the picture.
  if (args.chart_only) {
    if (!chartUrl) {
      if (ordered.length < CHART_MIN_CANDLES) {
        return (
          `Only ${ordered.length} candle(s) in the window — too few to render ` +
          `a chart. Widen the window or set chart_only=false to see the data.`
        );
      }
      return (
        `Chart render failed for ${symbol} ${interval}. ` +
        `Retry, or set chart_only=false to get the OHLC data instead.`
      );
    }
    return `${symbol} ${interval} — ${ordered.length} candles\nChart: ${chartUrl}`;
  }

  // Opt-in market summary block — PDH/PDL + Asia/London/NY session H/L + breach
  // state. Costs one extra 15-min fetch per UTC day in the history window plus
  // a previous-trading-day extension. Silently skipped for single stocks.
  // Capped so a 30-day query doesn't fan out into 30 API calls.
  let sessionBlock = "";
  if (args.include_summary) {
    if (!symbolSupportsSessionLevels(symbol)) {
      sessionBlock =
        `(market summary skipped — "${symbol}" is RTH-only; ` +
        `Asian/London sessions don't apply to single-name stocks)\n\n`;
    } else {
      sessionBlock = await buildMultiDaySessionBlock(symbol, {
        start_date: args.start_date,
        end_date: args.end_date,
      }, supabase);
    }
  }

  const header = `${symbol} ${interval} — ${ordered.length} candles:`;
  const lines = ordered.map((c) => `  ${formatCandleLine(c)}`).join("\n");
  const chartLine = chartUrl ? `\nChart: ${chartUrl}` : "";
  return `${sessionBlock}${header}\n${lines}${truncatedNote}${chartLine}`;
}
