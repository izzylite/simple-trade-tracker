/**
 * get_market_data — action-dispatched universal market data tool.
 *
 * action="quote"     — current price + day stats (Twelve Data intraday primary,
 *                      Yahoo fallback, Frankfurter forex EOD last resort).
 * action="history"   — historical OHLC candles via Twelve Data /time_series
 *                      with Yahoo fallback for indices/futures/bonds/DXY.
 *                      Optional include_summary flag prepends a market summary
 *                      block: previous-day H/L + Asia/London/NY session H/L
 *                      + breach state for each.
 * action="indicator" — RSI/MACD/ATR/BBANDS/EMA/SMA/VWAP via Twelve Data
 *                      per-indicator endpoints. Free-tier coverage:
 *                      forex/US-stocks/crypto. VWAP is intraday-only.
 * action="search"    — fuzzy name-to-ticker resolution via /symbol_search.
 *
 * Future actions reserved: "earnings" (earnings calendar).
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { GeminiFunctionDeclaration } from "../types.ts";
import { executeGetMarketPrice } from "./quote.ts";
import { executeGetMarketHistory } from "./history.ts";
import { executeGetIndicator } from "./indicator.ts";
import { executeSymbolSearch } from "./search.ts";

export const getMarketDataTool: GeminiFunctionDeclaration = {
  name: "get_market_data",
  description:
    `Universal market data. Pick ONE \`action\`: "quote" (current price + day stats), "history" (OHLC candles for past dates / today's shape; opt-in include_summary for PDH/PDL + Asia/London/NY session H/L + breach state), "indicator" (RSI/MACD/ATR/BBANDS/EMA/SMA/VWAP), "search" (resolve company name → ticker). See TIER 4 MARKET DATA REFERENCE in the system prompt for the symbol catalog, indicator defaults, asset-class coverage caveats, and chart rules. Tool dispatcher validates per-action required params server-side.`,
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["quote", "history", "indicator", "search"],
        description:
          "Sub-action. Default to 'quote' when no past-time / indicator / name-lookup intent.",
      },
      symbol: {
        type: "string",
        description:
          'Catalog symbol (e.g. "EURUSD=X", "^GSPC", "GC=F", "BTC-USD", "AAPL"). Required for quote/history/indicator.',
      },
      indicator: {
        type: "string",
        enum: ["RSI", "MACD", "ATR", "BBANDS", "EMA", "SMA", "VWAP"],
        description: "Required for action='indicator'. Ignored otherwise.",
      },
      period: {
        type: "integer",
        description:
          "action='indicator' lookback. Defaults per indicator (RSI/ATR 14, BBANDS/EMA/SMA 20, VWAP 9). MACD ignores. Override when user names one.",
      },
      query: {
        type: "string",
        description: "action='search'. Free-text company / asset name.",
      },
      interval: {
        type: "string",
        enum: [
          "1min",
          "5min",
          "15min",
          "30min",
          "1h",
          "2h",
          "4h",
          "1day",
          "1week",
          "1month",
        ],
        description:
          "REQUIRED for history + indicator. Pick coarsest that answers. Indices/futures/bonds/DXY: no 2h/4h. VWAP: intraday only.",
      },
      outputsize: {
        type: "integer",
        description:
          "history: 1–200 candles. indicator: 1–20 (default 1). Ignored if start_date+end_date set.",
      },
      start_date: {
        type: "string",
        description:
          'action="history" window start. "YYYY-MM-DD" or "YYYY-MM-DD HH:mm:ss". Pair with end_date.',
      },
      end_date: {
        type: "string",
        description: 'action="history" window end. Pair with start_date.',
      },
      include_chart: {
        type: "boolean",
        description:
          'action="history". Attach candlestick chart below reply. Default false. Off for plain numeric lookups.',
      },
      chart_only: {
        type: "boolean",
        description:
          'action="history". Skip OHLC dump, return chart only. Implies a chart. Use for "show me the chart" requests.',
      },
      include_summary: {
        type: "boolean",
        description:
          'action="history". Prepend a server-computed market summary block: (1) previous trading day H/L (PDH/PDL) with breach state today, (2) Asian/London/NY-AM/NY-PM session H/L + session-on-session sweep state. Set true for "did we sweep Asian high/low" / "where did London top out" / "is NY above PDH" / "Asia range" / "liquidity grab" / "yesterday\'s high" / "any sweep of PDL today" — all answerable from one call. Each level is classified as SWEPT (pierced + closed back inside), BROKEN (pierced + still beyond), or INTACT. Walks back through weekend / holiday gaps so Monday queries get Friday\'s PDH/PDL. Forex / indices / futures / crypto only; single-name stocks silently skip (RTH-only, no overnight tape). Ignored when chart_only=true (chart_only returns just the image, no text annotations). Default false.',
      },
    },
    required: ["action"],
  },
};

export async function executeGetMarketData(
  args: Record<string, unknown>,
  supabase?: SupabaseClient,
): Promise<string> {
  const action = typeof args.action === "string" ? args.action : "";
  const sym = typeof args.symbol === "string" ? args.symbol : "";

  if (action === "quote") {
    if (!sym) {
      return `get_market_data action="quote" requires \`symbol\` (catalog format, e.g. "EURUSD=X", "AAPL").`;
    }
    return await executeGetMarketPrice(sym, supabase);
  }

  if (action === "history") {
    // Surface missing required fields before delegating — the downstream
    // "Invalid interval ''" error is less actionable than these hints.
    if (!sym) {
      return `get_market_data action="history" requires \`symbol\` (catalog format).`;
    }
    const interval = typeof args.interval === "string"
      ? args.interval.trim()
      : "";
    if (!interval) {
      return (
        `get_market_data action="history" requires \`interval\`. ` +
        `Common choices: "1day" for daily candles ("yesterday's range"), ` +
        `"1h" for intraday context, "5min" for sub-hour detail. ` +
        `Pick the coarsest that answers the question and retry.`
      );
    }
    return await executeGetMarketHistory({
      symbol: sym,
      interval,
      outputsize: typeof args.outputsize === "number"
        ? args.outputsize
        : undefined,
      start_date: typeof args.start_date === "string"
        ? args.start_date
        : undefined,
      end_date: typeof args.end_date === "string" ? args.end_date : undefined,
      chart_only: args.chart_only === true,
      include_chart: args.include_chart === true,
      include_summary: args.include_summary === true,
    }, supabase);
  }

  if (action === "indicator") {
    if (!sym) {
      return `get_market_data action="indicator" requires \`symbol\` (catalog format).`;
    }
    const indicator = typeof args.indicator === "string" ? args.indicator : "";
    if (!indicator) {
      return (
        `get_market_data action="indicator" requires \`indicator\`. ` +
        `Valid: RSI, MACD, ATR, BBANDS, EMA, SMA, VWAP.`
      );
    }
    const interval = typeof args.interval === "string"
      ? args.interval.trim()
      : "";
    if (!interval) {
      return (
        `get_market_data action="indicator" requires \`interval\`. ` +
        `Common choices: "1day" for daily readings, "1h" for intraday momentum.`
      );
    }
    // VWAP is intraday-only by convention — a 1day/1week/1month VWAP collapses
    // to single-bar values that aren't useful. Reject early with a clear retry
    // hint instead of returning a useless number.
    if (
      indicator.toUpperCase() === "VWAP" &&
      (interval === "1day" || interval === "1week" || interval === "1month")
    ) {
      return (
        `VWAP is intraday-only — daily/weekly/monthly aggregation ` +
        `returns single-bar values that aren't useful for the "fair ` +
        `value" reading traders watch. Retry with an intraday interval ` +
        `("15min" for "where's VWAP right now", "5min" for finer ` +
        `detail, "1h" for session-shape).`
      );
    }
    return await executeGetIndicator({
      symbol: sym,
      indicator,
      interval,
      period: typeof args.period === "number" ? args.period : undefined,
      outputsize: typeof args.outputsize === "number"
        ? args.outputsize
        : undefined,
    });
  }

  if (action === "search") {
    const query = typeof args.query === "string" ? args.query : "";
    if (!query) {
      return (
        `get_market_data action="search" requires \`query\` ` +
        `(free-text company or asset name, e.g. "Tesla", "Apple").`
      );
    }
    return await executeSymbolSearch({ query });
  }

  return (
    `get_market_data: invalid action "${action}". Valid: ` +
    `"quote" (current price), "history" (OHLC candles), ` +
    `"indicator" (RSI/MACD/ATR/BBANDS), "search" (name→ticker).`
  );
}
