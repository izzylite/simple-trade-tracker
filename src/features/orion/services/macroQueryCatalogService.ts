import { supabase } from 'config/supabase';
import { logger } from 'utils/logger';
import type { MacroQueryEntry, Market } from 'features/orion/data/macroQueryCatalog';

/**
 * Macro query catalog service.
 *
 * Fetches the predefined macro query catalog from Supabase
 * (public.macro_query_catalog). Caches the result in-memory for the lifetime
 * of the page session — the catalog rarely changes (operator-edited via
 * Supabase dashboard) and is small (~70 rows × ~200 bytes ≈ 14 KB).
 *
 * Reload semantics: call `invalidateMacroQueryCatalog()` to force a refetch
 * (e.g. from a "refresh" button in an admin UI). Otherwise the catalog is
 * fetched once per session on first request.
 */

interface CatalogRow {
  id: string;
  query: string;
  markets: string[];
  is_market_wide: boolean;
  symbols: string[];
  category: string;
  display_order: number;
}

let cachedCatalog: MacroQueryEntry[] | null = null;
let inflight: Promise<MacroQueryEntry[]> | null = null;

function rowToEntry(row: CatalogRow): MacroQueryEntry {
  return {
    id: row.id,
    query: row.query,
    markets: row.markets as Market[],
    isMarketWide: row.is_market_wide,
    symbols: row.symbols,
    category: row.category,
    displayOrder: row.display_order,
  };
}

export async function getMacroQueryCatalog(): Promise<MacroQueryEntry[]> {
  if (cachedCatalog) return cachedCatalog;
  if (inflight) return inflight;

  inflight = (async () => {
    const { data, error } = await supabase
      .from('macro_query_catalog')
      .select('id, query, markets, is_market_wide, symbols, category, display_order')
      .eq('is_enabled', true)
      .order('category', { ascending: true })
      .order('display_order', { ascending: true });

    if (error) {
      logger.error('Failed to fetch macro_query_catalog', error);
      throw error;
    }

    const entries = (data ?? []).map((r) => rowToEntry(r as CatalogRow));
    cachedCatalog = entries;
    return entries;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function invalidateMacroQueryCatalog(): void {
  cachedCatalog = null;
  inflight = null;
}
