// Instrument & currency catalog. Currently only ai-trading-agent imports
// from here (the get_recent_orion_briefings tool uses these to validate
// Orion's `instrument` filter and resolve aliases). run-orion-task writes
// the matching symbol/currency metadata into `orion_task_results.metadata`,
// derived independently via run-orion-task/symbols.ts — both code paths
// must stay aligned on the same Yahoo tickers and currency codes.
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

/**
 * Broker symbol (instrumentCatalog format) → Yahoo Finance symbol.
 * Used by run-asset-research to convert EURUSD → EURUSD=X for price fetching.
 * Instruments with no Yahoo equivalent map to undefined.
 */
export const BROKER_TO_YAHOO: Record<string, string> = {
  EURUSD: 'EURUSD=X', GBPUSD: 'GBPUSD=X', USDJPY: 'USDJPY=X',
  AUDUSD: 'AUDUSD=X', USDCAD: 'USDCAD=X', NZDUSD: 'NZDUSD=X',
  USDCHF: 'USDCHF=X', EURJPY: 'EURJPY=X', EURGBP: 'EURGBP=X',
  EURAUD: 'EURAUD=X', EURCAD: 'EURCAD=X', EURCHF: 'EURCHF=X',
  EURNZD: 'EURNZD=X', GBPJPY: 'GBPJPY=X', GBPAUD: 'GBPAUD=X',
  GBPCAD: 'GBPCAD=X', AUDJPY: 'AUDJPY=X', CADJPY: 'CADJPY=X',
  CHFJPY: 'CHFJPY=X', NZDJPY: 'NZDJPY=X', AUDNZD: 'AUDNZD=X',
  XAUUSD: 'GC=F',     XAGUSD: 'SI=F',
  BTCUSD: 'BTC-USD',  ETHUSD: 'ETH-USD',
  US30: '^DJI',       NAS100: '^IXIC',  SPX500: '^GSPC', US2000: '^RUT',
  GER40: '^GDAXI',    EU50: '^STOXX50E', UK100: '^FTSE',
  JP225: '^N225',     AUS200: '^AXJO',
};

/**
 * Broker symbol → ISO currency codes for economic-event filtering.
 * Mirrors getCurrenciesForInstrument in src/features/events/services/instrumentCatalog.ts.
 * Keep in sync when INSTRUMENT_MAPPINGS changes.
 */
export const BROKER_CURRENCIES: Record<string, string[]> = {
  EURUSD: ['EUR','USD'], GBPUSD: ['GBP','USD'], USDJPY: ['USD','JPY'],
  AUDUSD: ['AUD','USD'], USDCAD: ['USD','CAD'], NZDUSD: ['NZD','USD'],
  USDCHF: ['USD','CHF'], EURJPY: ['EUR','JPY'], EURGBP: ['EUR','GBP'],
  EURAUD: ['EUR','AUD'], EURCAD: ['EUR','CAD'], EURCHF: ['EUR','CHF'],
  EURNZD: ['EUR','NZD'], GBPJPY: ['GBP','JPY'], GBPAUD: ['GBP','AUD'],
  GBPCAD: ['GBP','CAD'], GBPCHF: ['GBP','CHF'], GBPNZD: ['GBP','NZD'],
  AUDJPY: ['AUD','JPY'], CADJPY: ['CAD','JPY'], CHFJPY: ['CHF','JPY'],
  NZDJPY: ['NZD','JPY'], AUDCAD: ['AUD','CAD'], AUDCHF: ['AUD','CHF'],
  AUDNZD: ['AUD','NZD'], CADCHF: ['CAD','CHF'], NZDCAD: ['NZD','CAD'],
  NZDCHF: ['NZD','CHF'], XAUUSD: ['USD'], XAGUSD: ['USD'],
  BTCUSD: ['USD'],       ETHUSD: ['USD'],
  US30: ['USD'],  NAS100: ['USD'], SPX500: ['USD'], US2000: ['USD'],
  GER40: ['EUR'], EU50: ['EUR'],   UK100: ['GBP'],
  JP225: ['JPY'], AUS200: ['AUD'],
};

/** Get currencies for a broker-format symbol. Falls back to ['USD']. */
export function getBrokerCurrencies(brokerSymbol: string): string[] {
  return BROKER_CURRENCIES[brokerSymbol] ?? ['USD'];
}
