/**
 * get_market_data action="search" — fuzzy name → ticker resolution via
 * Twelve Data /symbol_search.
 */

import { fetchSymbolSearch } from "../../../_shared/twelvedata.ts";

export async function executeSymbolSearch(args: {
  query: string;
}): Promise<string> {
  const q = (args.query || "").trim();
  if (!q) return 'Query is required for action="search".';

  const matches = await fetchSymbolSearch(q, 10);
  if (matches === null) {
    return (
      `Symbol search failed for "${q}". The data source may be unavailable — ` +
      `retry shortly, or pass the catalog symbol directly if you know it.`
    );
  }
  if (matches.length === 0) {
    return `No symbols matched "${q}". Try a different spelling or use the catalog form (e.g. "AAPL", "EURUSD=X").`;
  }

  // Cap formatted output at 8 even though we requested 10 — keeps reply
  // compact; Orion almost always wants the top 1-3.
  const top = matches.slice(0, 8);
  const lines = top.map((m) => {
    const tail = [m.exchange, m.country, m.type].filter(Boolean).join(", ");
    const name = m.instrumentName ? ` — ${m.instrumentName}` : "";
    return `  ${m.symbol}${name}${tail ? ` (${tail})` : ""}`;
  }).join("\n");
  return `Matches for "${q}" (top ${top.length}):\n${lines}`;
}
