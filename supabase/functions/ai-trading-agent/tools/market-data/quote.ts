/**
 * get_market_data action="quote" — current price + day stats.
 *
 * Fallback chain:
 *   1. Twelve Data (intraday — forex, US stocks, crypto) via shared cache
 *   2. Yahoo Finance (intraday — all asset classes, incl. indices/futures/bonds)
 *   3. Frankfurter/ECB (forex only, end-of-day reference rate — last resort)
 *
 * Each result carries a freshness label so the model adjusts language
 * ("live intraday" vs "end-of-day reference rate").
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getMarketPrice } from "../../../_shared/prices.ts";
import { log } from "../../../_shared/supabase.ts";

async function getForexPrice(
  baseCurrency: string,
  quoteCurrency: string,
): Promise<string> {
  try {
    baseCurrency = baseCurrency.toUpperCase().trim();
    quoteCurrency = quoteCurrency.toUpperCase().trim();

    const url =
      `https://api.frankfurter.app/latest?from=${baseCurrency}&to=${quoteCurrency}`;
    const response = await fetch(url);
    if (!response.ok) {
      return `Failed to fetch forex rate: ${response.status}. Make sure currency codes are valid (e.g., EUR, USD, GBP, JPY).`;
    }
    const data = await response.json();
    if (!data.rates || !data.rates[quoteCurrency]) {
      return `Forex pair ${baseCurrency}/${quoteCurrency} not found. Supported currencies: EUR, USD, GBP, JPY, CHF, CAD, AUD, NZD, and more.`;
    }
    const rate = data.rates[quoteCurrency];
    const date = data.date;
    let result = `${baseCurrency}/${quoteCurrency} Forex Rate:\n\n`;
    result += `💱 Exchange Rate: ${rate.toFixed(5)}\n`;
    result += `📅 Date: ${date}\n`;
    result += `\n1 ${baseCurrency} = ${rate.toFixed(5)} ${quoteCurrency}\n`;
    return result;
  } catch (error) {
    return `Forex rate error: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

export async function executeGetMarketPrice(
  symbol: string,
  supabase?: SupabaseClient,
): Promise<string> {
  const trimmed = symbol.trim();
  if (!trimmed) return "Symbol is required.";

  // Primary: Twelve Data → Yahoo fallback (chosen inside getMarketPrice).
  if (supabase) {
    const snap = await getMarketPrice(supabase, trimmed);
    if (snap) {
      const dp = snap.price < 10 ? 5 : 2;
      const arrow = snap.percentChange >= 0 ? "▲" : "▼";
      const priceStr = snap.price.toLocaleString("en-US", {
        minimumFractionDigits: dp,
        maximumFractionDigits: dp,
      });
      return [
        `${snap.displayName} (${snap.symbol})`,
        `Freshness: live intraday`,
        ``,
        `Price: ${priceStr} ${snap.currency}`,
        `Day change: ${arrow} ${snap.percentChange.toFixed(2)}%`,
        `Day range: ${snap.dayLow.toFixed(dp)} – ${snap.dayHigh.toFixed(dp)}`,
        `Previous close: ${snap.previousClose.toFixed(dp)}`,
      ].join("\n");
    }
  }

  log(`Primary price miss for ${trimmed}, trying forex EOD fallback`, "info");

  // Last resort: Frankfurter/ECB for forex symbols (EURUSD=X → EUR/USD).
  if (trimmed.endsWith("=X") && trimmed.length >= 8) {
    const pair = trimmed.replace("=X", "");
    const base = pair.substring(0, 3);
    const quote = pair.substring(3, 6);
    if (base.length === 3 && quote.length === 3) {
      const result = await getForexPrice(base, quote);
      if (
        !result.startsWith("Forex rate error") &&
        !result.startsWith("Failed")
      ) {
        return (
          result +
          "\n⚠️ Freshness: end-of-day reference rate (NOT intraday). " +
          "This is the last published daily rate, not a live quote. " +
          "Do NOT present this as a current or real-time price."
        );
      }
    }
  }

  return `Could not fetch price for "${trimmed}". All data sources failed or the symbol is unrecognized.`;
}
