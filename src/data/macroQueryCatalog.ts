/**
 * Macro Query Catalog — types and client-side filter only.
 *
 * The catalog DATA lives in the Supabase `macro_query_catalog` table so
 * entries can be added/edited/disabled without a frontend redeploy. Fetch
 * via macroQueryCatalogService.ts; this file holds only the shape contract
 * and the pure filter helper.
 *
 * Storage model:
 *   - orion_tasks.config stores selected query STRINGS (not catalog IDs).
 *   - Edge function (run-orion-task) executes those strings directly and
 *     never reads this catalog — so renaming a catalog entry in the DB
 *     does not break existing tasks (they keep firing the old string until
 *     the user re-picks). Cache keys in serper_cache derive from the query
 *     string, so DB edits don't invalidate cache either.
 */

export type Market =
  | 'forex'
  | 'stocks'
  | 'crypto'
  | 'commodities'
  | 'indices'
  | 'bonds';

export const MARKET_VALUES: readonly Market[] = [
  'forex', 'stocks', 'crypto', 'commodities', 'indices', 'bonds',
] as const;

export interface MacroQueryEntry {
  id: string;
  query: string;
  markets: Market[];
  /**
   * When true, entry appears whenever any of `markets` is selected,
   * regardless of which symbols are in the user's watchlist (e.g. Fed FOMC
   * affects everything). When false, entry only appears if at least one
   * symbol in `symbols` is also in the user's watchlist.
   */
  isMarketWide: boolean;
  /** Yahoo Finance symbol IDs (EURUSD=X, ^GSPC, BTC-USD, CL=F, ...). */
  symbols: string[];
  category: string;
  displayOrder: number;
}

/**
 * Filter catalog entries by user's market + watchlist selection. Pure —
 * pass the fetched catalog in as the first arg (the service handles fetching
 * and caching).
 */
export function filterMacroQueries(
  catalog: MacroQueryEntry[],
  selectedMarkets: Market[],
  selectedSymbols: string[]
): MacroQueryEntry[] {
  if (selectedMarkets.length === 0) return [];

  const marketSet = new Set(selectedMarkets);
  const symbolSet = new Set(selectedSymbols);

  return catalog.filter((entry) => {
    if (!entry.markets.some((m) => marketSet.has(m))) return false;
    if (entry.isMarketWide) return true;
    if (selectedSymbols.length === 0) return false;
    return entry.symbols.some((s) => symbolSet.has(s));
  });
}

/** Lookup by query string — used to map stored task config to catalog entries. */
export function findCatalogEntryByQuery(
  catalog: MacroQueryEntry[],
  query: string
): MacroQueryEntry | undefined {
  return catalog.find((e) => e.query === query);
}
