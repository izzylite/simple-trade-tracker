// Yahoo-symbol → human-readable name & currency exposure.
//
// The watchlist is the single source of user intent: the symbols it contains
// drive both price grounding AND news queries / economic-calendar filtering.
// Forex pairs are parsed mechanically (XXXYYY=X). Indices, commodities, bonds,
// and crypto are explicit entries because their ticker is opaque.
// Unknown symbols fall back to a stripped display string + USD currency.

interface SymbolMeta {
  name: string;
  currencies: string[];
}

const SYMBOL_MAP: Record<string, SymbolMeta> = {
  // Dollar index
  'DX-Y.NYB': { name: 'US Dollar Index DXY', currencies: ['USD'] },
  // US equity indices
  '^GSPC': { name: 'S&P 500', currencies: ['USD'] },
  '^IXIC': { name: 'Nasdaq Composite', currencies: ['USD'] },
  '^DJI': { name: 'Dow Jones', currencies: ['USD'] },
  '^RUT': { name: 'Russell 2000', currencies: ['USD'] },
  '^VIX': { name: 'VIX volatility index', currencies: ['USD'] },
  // International indices
  '^FTSE': { name: 'FTSE 100', currencies: ['GBP'] },
  '^GDAXI': { name: 'DAX', currencies: ['EUR'] },
  '^FCHI': { name: 'CAC 40', currencies: ['EUR'] },
  '^STOXX50E': { name: 'Euro Stoxx 50', currencies: ['EUR'] },
  '^N225': { name: 'Nikkei 225', currencies: ['JPY'] },
  '^HSI': { name: 'Hang Seng', currencies: ['HKD'] },
  '^AXJO': { name: 'ASX 200', currencies: ['AUD'] },
  // Index ETFs (USD-denominated)
  'SPY': { name: 'S&P 500 ETF', currencies: ['USD'] },
  'QQQ': { name: 'Nasdaq 100 ETF', currencies: ['USD'] },
  'IWM': { name: 'Russell 2000 ETF', currencies: ['USD'] },
  'DIA': { name: 'Dow Jones ETF', currencies: ['USD'] },
  // Commodities — metals
  'GC=F': { name: 'gold', currencies: ['USD'] },
  'SI=F': { name: 'silver', currencies: ['USD'] },
  'HG=F': { name: 'copper', currencies: ['USD'] },
  'PL=F': { name: 'platinum', currencies: ['USD'] },
  'PA=F': { name: 'palladium', currencies: ['USD'] },
  // Commodities — energy
  'CL=F': { name: 'WTI crude oil', currencies: ['USD'] },
  'BZ=F': { name: 'Brent crude oil', currencies: ['USD'] },
  'NG=F': { name: 'natural gas', currencies: ['USD'] },
  'HO=F': { name: 'heating oil', currencies: ['USD'] },
  'RB=F': { name: 'RBOB gasoline', currencies: ['USD'] },
  // Commodities — agricultural
  'ZC=F': { name: 'corn', currencies: ['USD'] },
  'ZS=F': { name: 'soybeans', currencies: ['USD'] },
  'ZW=F': { name: 'wheat', currencies: ['USD'] },
  'KC=F': { name: 'coffee', currencies: ['USD'] },
  'SB=F': { name: 'sugar', currencies: ['USD'] },
  'CT=F': { name: 'cotton', currencies: ['USD'] },
  // Bonds / yields
  '^TNX': { name: 'US 10-year Treasury yield', currencies: ['USD'] },
  '^FVX': { name: 'US 5-year Treasury yield', currencies: ['USD'] },
  '^TYX': { name: 'US 30-year Treasury yield', currencies: ['USD'] },
  '^IRX': { name: 'US 13-week Treasury yield', currencies: ['USD'] },
  'ZB=F': { name: '30-year T-bond future', currencies: ['USD'] },
  'ZN=F': { name: '10-year T-note future', currencies: ['USD'] },
  'ZF=F': { name: '5-year T-note future', currencies: ['USD'] },
  'TLT': { name: '20+ Year Treasury ETF', currencies: ['USD'] },
};

// FX pair parser. Yahoo forex symbols follow `XXXYYY=X` for crosses and
// `YYY=X` for USD-base (implicit). We only recognise the 6-letter form here
// because the single-currency form is ambiguous and the catalog doesn't use it.
const FX_PAIR_RE = /^([A-Z]{3})([A-Z]{3})=X$/;

// Crypto pair parser. Yahoo uses `SYMBOL-USD` / `SYMBOL-EUR` etc. The quote
// currency drives economic-event exposure; the base is the readable asset.
const CRYPTO_RE = /^([A-Z0-9]{2,6})-([A-Z]{3})$/;

const CRYPTO_NAMES: Record<string, string> = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  SOL: 'Solana',
  BNB: 'BNB',
  XRP: 'XRP',
  ADA: 'Cardano',
  DOGE: 'Dogecoin',
  AVAX: 'Avalanche',
  LINK: 'Chainlink',
  LTC: 'Litecoin',
};

export function symbolToMeta(symbol: string): SymbolMeta {
  const explicit = SYMBOL_MAP[symbol];
  if (explicit) return explicit;

  const fx = FX_PAIR_RE.exec(symbol);
  if (fx) {
    const [, base, quote] = fx;
    return { name: `${base}/${quote}`, currencies: [base, quote] };
  }

  const crypto = CRYPTO_RE.exec(symbol);
  if (crypto) {
    const [, base, quote] = crypto;
    const name = CRYPTO_NAMES[base] ?? base;
    return { name, currencies: [quote] };
  }

  // Plain equity tickers (AAPL, TSLA, etc.) — assume USD-listed. Name is the
  // ticker itself; Gemini/Serper handle the "what is AAPL" lookup.
  return { name: symbol, currencies: ['USD'] };
}

export function symbolToReadableName(symbol: string): string {
  return symbolToMeta(symbol).name;
}

export function symbolsToCurrencies(symbols: string[]): string[] {
  const set = new Set<string>();
  for (const s of symbols) {
    for (const c of symbolToMeta(s).currencies) set.add(c);
  }
  return Array.from(set);
}

export function symbolsToReadableNames(symbols: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of symbols) {
    const name = symbolToMeta(s).name;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}
