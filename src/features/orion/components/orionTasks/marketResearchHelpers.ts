import type { MarketResearchConfig } from 'features/orion/types/orionTask';

export const MARKET_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'forex', label: 'Forex' },
  { value: 'stocks', label: 'Stocks' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'commodities', label: 'Commodities' },
  { value: 'indices', label: 'Indices' },
  { value: 'bonds', label: 'Bonds' },
];

export interface YahooSymbolOption {
  symbol: string;
  label: string;
  group: string;
}

/**
 * Curated catalog of Yahoo Finance symbols, grouped by asset class for the
 * Autocomplete picker. Not exhaustive — just the instruments traders actually
 * watch. Keyboard shortcuts / display labels are the primary UX, so the label
 * stays concise.
 */
export const YAHOO_SYMBOL_CATALOG: YahooSymbolOption[] = [
  // Forex — majors
  { symbol: 'EURUSD=X', label: 'EUR/USD', group: 'Forex majors' },
  { symbol: 'GBPUSD=X', label: 'GBP/USD', group: 'Forex majors' },
  { symbol: 'USDJPY=X', label: 'USD/JPY', group: 'Forex majors' },
  { symbol: 'USDCHF=X', label: 'USD/CHF', group: 'Forex majors' },
  { symbol: 'USDCAD=X', label: 'USD/CAD', group: 'Forex majors' },
  { symbol: 'AUDUSD=X', label: 'AUD/USD', group: 'Forex majors' },
  { symbol: 'NZDUSD=X', label: 'NZD/USD', group: 'Forex majors' },
  // Forex — crosses
  { symbol: 'EURGBP=X', label: 'EUR/GBP', group: 'Forex crosses' },
  { symbol: 'EURJPY=X', label: 'EUR/JPY', group: 'Forex crosses' },
  { symbol: 'EURCHF=X', label: 'EUR/CHF', group: 'Forex crosses' },
  { symbol: 'EURAUD=X', label: 'EUR/AUD', group: 'Forex crosses' },
  { symbol: 'EURCAD=X', label: 'EUR/CAD', group: 'Forex crosses' },
  { symbol: 'GBPJPY=X', label: 'GBP/JPY', group: 'Forex crosses' },
  { symbol: 'GBPAUD=X', label: 'GBP/AUD', group: 'Forex crosses' },
  { symbol: 'GBPCAD=X', label: 'GBP/CAD', group: 'Forex crosses' },
  { symbol: 'AUDJPY=X', label: 'AUD/JPY', group: 'Forex crosses' },
  { symbol: 'AUDNZD=X', label: 'AUD/NZD', group: 'Forex crosses' },
  { symbol: 'NZDJPY=X', label: 'NZD/JPY', group: 'Forex crosses' },
  { symbol: 'CADJPY=X', label: 'CAD/JPY', group: 'Forex crosses' },
  { symbol: 'CHFJPY=X', label: 'CHF/JPY', group: 'Forex crosses' },
  // Dollar / exotic FX
  { symbol: 'DX-Y.NYB', label: 'DXY — US Dollar Index', group: 'Forex crosses' },
  { symbol: 'USDMXN=X', label: 'USD/MXN', group: 'Forex crosses' },
  { symbol: 'USDZAR=X', label: 'USD/ZAR', group: 'Forex crosses' },
  { symbol: 'USDTRY=X', label: 'USD/TRY', group: 'Forex crosses' },
  { symbol: 'USDCNH=X', label: 'USD/CNH (offshore yuan)', group: 'Forex crosses' },
  // Equity indices — US
  { symbol: '^GSPC', label: 'S&P 500', group: 'Equity indices' },
  { symbol: '^IXIC', label: 'Nasdaq Composite', group: 'Equity indices' },
  { symbol: '^DJI', label: 'Dow Jones', group: 'Equity indices' },
  { symbol: '^RUT', label: 'Russell 2000', group: 'Equity indices' },
  { symbol: '^VIX', label: 'VIX', group: 'Equity indices' },
  // Equity indices — international
  { symbol: '^FTSE', label: 'FTSE 100', group: 'Equity indices' },
  { symbol: '^GDAXI', label: 'DAX', group: 'Equity indices' },
  { symbol: '^FCHI', label: 'CAC 40', group: 'Equity indices' },
  { symbol: '^STOXX50E', label: 'Euro Stoxx 50', group: 'Equity indices' },
  { symbol: '^N225', label: 'Nikkei 225', group: 'Equity indices' },
  { symbol: '^HSI', label: 'Hang Seng', group: 'Equity indices' },
  { symbol: '^AXJO', label: 'ASX 200', group: 'Equity indices' },
  // Index ETFs
  { symbol: 'SPY', label: 'SPY', group: 'Index ETFs' },
  { symbol: 'QQQ', label: 'QQQ', group: 'Index ETFs' },
  { symbol: 'IWM', label: 'IWM', group: 'Index ETFs' },
  { symbol: 'DIA', label: 'DIA', group: 'Index ETFs' },
  // Commodities — metals
  { symbol: 'GC=F', label: 'Gold', group: 'Commodities' },
  { symbol: 'SI=F', label: 'Silver', group: 'Commodities' },
  { symbol: 'HG=F', label: 'Copper', group: 'Commodities' },
  { symbol: 'PL=F', label: 'Platinum', group: 'Commodities' },
  { symbol: 'PA=F', label: 'Palladium', group: 'Commodities' },
  // Commodities — energy
  { symbol: 'CL=F', label: 'WTI Crude', group: 'Commodities' },
  { symbol: 'BZ=F', label: 'Brent Crude', group: 'Commodities' },
  { symbol: 'NG=F', label: 'Natural Gas', group: 'Commodities' },
  { symbol: 'HO=F', label: 'Heating Oil', group: 'Commodities' },
  { symbol: 'RB=F', label: 'Gasoline (RBOB)', group: 'Commodities' },
  // Commodities — agricultural
  { symbol: 'ZC=F', label: 'Corn', group: 'Commodities' },
  { symbol: 'ZS=F', label: 'Soybeans', group: 'Commodities' },
  { symbol: 'ZW=F', label: 'Wheat', group: 'Commodities' },
  { symbol: 'KC=F', label: 'Coffee', group: 'Commodities' },
  { symbol: 'SB=F', label: 'Sugar', group: 'Commodities' },
  { symbol: 'CT=F', label: 'Cotton', group: 'Commodities' },
  // Bonds / yields
  { symbol: '^TNX', label: 'US 10Y Yield', group: 'Bonds & yields' },
  { symbol: '^FVX', label: 'US 5Y Yield', group: 'Bonds & yields' },
  { symbol: '^TYX', label: 'US 30Y Yield', group: 'Bonds & yields' },
  { symbol: '^IRX', label: 'US 13W Yield', group: 'Bonds & yields' },
  { symbol: 'ZB=F', label: '30Y T-Bond Future', group: 'Bonds & yields' },
  { symbol: 'ZN=F', label: '10Y T-Note Future', group: 'Bonds & yields' },
  { symbol: 'ZF=F', label: '5Y T-Note Future', group: 'Bonds & yields' },
  { symbol: 'TLT', label: 'TLT (20Y+ Treasury ETF)', group: 'Bonds & yields' },
  // Crypto
  { symbol: 'BTC-USD', label: 'Bitcoin', group: 'Crypto' },
  { symbol: 'ETH-USD', label: 'Ethereum', group: 'Crypto' },
  { symbol: 'SOL-USD', label: 'Solana', group: 'Crypto' },
  { symbol: 'BNB-USD', label: 'BNB', group: 'Crypto' },
  { symbol: 'XRP-USD', label: 'XRP', group: 'Crypto' },
  { symbol: 'ADA-USD', label: 'Cardano', group: 'Crypto' },
  { symbol: 'DOGE-USD', label: 'Dogecoin', group: 'Crypto' },
  { symbol: 'AVAX-USD', label: 'Avalanche', group: 'Crypto' },
  { symbol: 'LINK-USD', label: 'Chainlink', group: 'Crypto' },
  { symbol: 'LTC-USD', label: 'Litecoin', group: 'Crypto' },
  // Mega-cap stocks
  { symbol: 'AAPL', label: 'Apple', group: 'Mega-cap stocks' },
  { symbol: 'MSFT', label: 'Microsoft', group: 'Mega-cap stocks' },
  { symbol: 'NVDA', label: 'NVIDIA', group: 'Mega-cap stocks' },
  { symbol: 'GOOGL', label: 'Alphabet Class A', group: 'Mega-cap stocks' },
  { symbol: 'META', label: 'Meta', group: 'Mega-cap stocks' },
  { symbol: 'AMZN', label: 'Amazon', group: 'Mega-cap stocks' },
  { symbol: 'TSLA', label: 'Tesla', group: 'Mega-cap stocks' },
  { symbol: 'JPM', label: 'JPMorgan', group: 'Mega-cap stocks' },
  { symbol: 'XOM', label: 'Exxon', group: 'Mega-cap stocks' },
  { symbol: 'BRK-B', label: 'Berkshire Hathaway B', group: 'Mega-cap stocks' },
];

/**
 * Friendly label for the sweep cadence used in the helper text under the
 * schedule row. Mirrors the segmented-control labels.
 */
export function formatFrequencyLabel(minutes: number): string {
  if (minutes === 60) return '1 hour';
  if (minutes === 1440) return '24 hours';
  if (minutes % 60 === 0) return `${minutes / 60} hours`;
  return `${minutes} min`;
}

/**
 * Backfill fields on stored task configs so the form never sees undefined
 * values. Coerces sub-hourly frequencies (15/30) to 60 — those are no longer
 * supported (the 1h NEWS_CACHE_TTL kept cold-missing across consecutive runs).
 */
export function hydrateMarketResearchConfig(
  raw: Record<string, unknown>
): MarketResearchConfig {
  const rawFreq = raw.frequency_minutes as number | undefined;
  const supportedFreqs = new Set([60, 120, 180, 240, 360, 1440]);
  const frequency = supportedFreqs.has(rawFreq ?? 0)
    ? (rawFreq as 60 | 120 | 180 | 240 | 360 | 1440)
    : 60;
  return {
    frequency_minutes: frequency,
    min_significance: (raw.min_significance as 'medium' | 'high') ?? 'high',
    subscribed_assets: Array.isArray(raw.subscribed_assets)
      ? (raw.subscribed_assets as string[])
      : [],
  };
}
