// Shared instrument & currency catalog used by run-orion-task (writes
// briefing metadata) and ai-trading-agent (validates Orion's filters).
//
// IMPORTANT: keep INSTRUMENT_CATALOG in lockstep with YAHOO_SYMBOL_CATALOG in
// src/components/orionTasks/CreateTaskDialog.tsx — that's the user-facing
// picker. The frontend can't import this file (CRA blocks src/-external
// imports), so duplication is intentional. Adding a symbol means updating
// both lists.

/**
 * Currencies derivable from the YAHOO_SYMBOL_CATALOG via symbolsToCurrencies()
 * in supabase/functions/run-orion-task/symbols.ts. Used to detect when Orion's
 * `instrument` filter is actually a broad currency code (e.g. "EUR", "USD").
 */
export const VALID_BRIEFING_CURRENCIES = new Set<string>([
  "USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD",
  "HKD", "MXN", "ZAR", "TRY", "CNH",
]);

export interface InstrumentCatalogEntry {
  symbol: string;
  label: string;
}

/**
 * Mirror of YAHOO_SYMBOL_CATALOG. Each entry's `symbol` is the Yahoo Finance
 * ticker stored in metadata.symbols; `label` is the readable name stored in
 * metadata.instruments. Both are searchable for instrument-level filtering.
 */
export const INSTRUMENT_CATALOG: InstrumentCatalogEntry[] = [
  // Forex — majors
  { symbol: "EURUSD=X", label: "EUR/USD" },
  { symbol: "GBPUSD=X", label: "GBP/USD" },
  { symbol: "USDJPY=X", label: "USD/JPY" },
  { symbol: "USDCHF=X", label: "USD/CHF" },
  { symbol: "USDCAD=X", label: "USD/CAD" },
  { symbol: "AUDUSD=X", label: "AUD/USD" },
  { symbol: "NZDUSD=X", label: "NZD/USD" },
  // Forex — crosses
  { symbol: "EURGBP=X", label: "EUR/GBP" },
  { symbol: "EURJPY=X", label: "EUR/JPY" },
  { symbol: "EURCHF=X", label: "EUR/CHF" },
  { symbol: "EURAUD=X", label: "EUR/AUD" },
  { symbol: "EURCAD=X", label: "EUR/CAD" },
  { symbol: "GBPJPY=X", label: "GBP/JPY" },
  { symbol: "GBPAUD=X", label: "GBP/AUD" },
  { symbol: "GBPCAD=X", label: "GBP/CAD" },
  { symbol: "AUDJPY=X", label: "AUD/JPY" },
  { symbol: "AUDNZD=X", label: "AUD/NZD" },
  { symbol: "NZDJPY=X", label: "NZD/JPY" },
  { symbol: "CADJPY=X", label: "CAD/JPY" },
  { symbol: "CHFJPY=X", label: "CHF/JPY" },
  // Dollar / exotic FX
  { symbol: "DX-Y.NYB", label: "DXY US Dollar Index" },
  { symbol: "USDMXN=X", label: "USD/MXN" },
  { symbol: "USDZAR=X", label: "USD/ZAR" },
  { symbol: "USDTRY=X", label: "USD/TRY" },
  { symbol: "USDCNH=X", label: "USD/CNH offshore yuan" },
  // Equity indices — US
  { symbol: "^GSPC", label: "S&P 500" },
  { symbol: "^IXIC", label: "Nasdaq Composite" },
  { symbol: "^DJI", label: "Dow Jones" },
  { symbol: "^RUT", label: "Russell 2000" },
  { symbol: "^VIX", label: "VIX" },
  // Equity indices — international
  { symbol: "^FTSE", label: "FTSE 100" },
  { symbol: "^GDAXI", label: "DAX" },
  { symbol: "^FCHI", label: "CAC 40" },
  { symbol: "^STOXX50E", label: "Euro Stoxx 50" },
  { symbol: "^N225", label: "Nikkei 225" },
  { symbol: "^HSI", label: "Hang Seng" },
  { symbol: "^AXJO", label: "ASX 200" },
  // Index ETFs
  { symbol: "SPY", label: "SPY" },
  { symbol: "QQQ", label: "QQQ" },
  { symbol: "IWM", label: "IWM" },
  { symbol: "DIA", label: "DIA" },
  // Commodities — metals
  { symbol: "GC=F", label: "Gold" },
  { symbol: "SI=F", label: "Silver" },
  { symbol: "HG=F", label: "Copper" },
  { symbol: "PL=F", label: "Platinum" },
  { symbol: "PA=F", label: "Palladium" },
  // Commodities — energy
  { symbol: "CL=F", label: "WTI Crude" },
  { symbol: "BZ=F", label: "Brent Crude" },
  { symbol: "NG=F", label: "Natural Gas" },
  { symbol: "HO=F", label: "Heating Oil" },
  { symbol: "RB=F", label: "Gasoline RBOB" },
  // Commodities — agricultural
  { symbol: "ZC=F", label: "Corn" },
  { symbol: "ZS=F", label: "Soybeans" },
  { symbol: "ZW=F", label: "Wheat" },
  { symbol: "KC=F", label: "Coffee" },
  { symbol: "SB=F", label: "Sugar" },
  { symbol: "CT=F", label: "Cotton" },
  // Bonds & yields
  { symbol: "^TNX", label: "US 10Y Yield" },
  { symbol: "^FVX", label: "US 5Y Yield" },
  { symbol: "^TYX", label: "US 30Y Yield" },
  { symbol: "^IRX", label: "US 13W Yield" },
  { symbol: "ZB=F", label: "30Y T-Bond Future" },
  { symbol: "ZN=F", label: "10Y T-Note Future" },
  { symbol: "ZF=F", label: "5Y T-Note Future" },
  { symbol: "TLT", label: "TLT 20Y+ Treasury ETF" },
  // Crypto
  { symbol: "BTC-USD", label: "Bitcoin" },
  { symbol: "ETH-USD", label: "Ethereum" },
  { symbol: "SOL-USD", label: "Solana" },
  { symbol: "BNB-USD", label: "BNB" },
  { symbol: "XRP-USD", label: "XRP" },
  { symbol: "ADA-USD", label: "Cardano" },
  { symbol: "DOGE-USD", label: "Dogecoin" },
  { symbol: "AVAX-USD", label: "Avalanche" },
  { symbol: "LINK-USD", label: "Chainlink" },
  { symbol: "LTC-USD", label: "Litecoin" },
  // Mega-cap stocks
  { symbol: "AAPL", label: "Apple" },
  { symbol: "MSFT", label: "Microsoft" },
  { symbol: "NVDA", label: "NVIDIA" },
  { symbol: "GOOGL", label: "Alphabet" },
  { symbol: "META", label: "Meta" },
  { symbol: "AMZN", label: "Amazon" },
  { symbol: "TSLA", label: "Tesla" },
  { symbol: "JPM", label: "JPMorgan" },
  { symbol: "XOM", label: "Exxon" },
  { symbol: "BRK-B", label: "Berkshire Hathaway" },
];

/**
 * Common informal aliases users say that don't substring-match the catalog
 * (or that would false-match the wrong entry, like "ES" → "Tesla"). Maps the
 * lowercase input to either a currency code (3-letter) or an exact catalog
 * symbol. Resolution happens before the normal routing — the resolved value
 * is then re-fed through the currency check and catalog matcher.
 */
export const INSTRUMENT_ALIASES: Record<string, string> = {
  // Index futures shorthand → underlying index symbol
  "spx": "^GSPC",
  "es": "^GSPC",
  "nq": "^IXIC",
  "ndx": "^IXIC",
  "rty": "^RUT",
  "ym": "^DJI",
  // Informal currency nicknames → ISO codes
  "yen": "JPY",
  "pound": "GBP",
  "sterling": "GBP",
  "cable": "GBPUSD=X",
  "euro": "EUR",
  "dollar": "USD",
  "buck": "USD",
  "greenback": "USD",
  "swissie": "CHF",
  "swiss franc": "CHF",
  "loonie": "CAD",
  "aussie": "AUD",
  "kiwi": "NZD",
  // Bond shorthand
  "10y": "^TNX",
  "2y": "^FVX",
  "30y": "^TYX",
};

/**
 * Apply alias resolution. If the input is a known alias, return the canonical
 * form (currency code or catalog symbol). Otherwise return the trimmed input
 * unchanged so the caller can proceed with normal currency/catalog matching.
 */
export function resolveInstrumentInput(input: string): string {
  const key = input.trim().toLowerCase();
  return INSTRUMENT_ALIASES[key] ?? input.trim();
}

/**
 * True if `input` (case-insensitive) is one of the currency codes that can
 * appear in metadata.currencies. Used by the briefings tool to route a single
 * `instrument` filter to either currency-level or instrument-level matching.
 */
export function isBriefingCurrency(input: string): boolean {
  return VALID_BRIEFING_CURRENCIES.has(input.trim().toUpperCase());
}

/**
 * Return catalog entries whose symbol or label contains `input` as a
 * case-insensitive substring. Empty array means "no recognized instrument".
 */
export function matchInstrumentCatalog(input: string): InstrumentCatalogEntry[] {
  const q = input.trim().toLowerCase();
  if (!q) return [];
  return INSTRUMENT_CATALOG.filter(
    (e) => e.symbol.toLowerCase().includes(q) || e.label.toLowerCase().includes(q),
  );
}
