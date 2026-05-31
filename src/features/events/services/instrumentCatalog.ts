import type { Currency } from 'features/events/types/economicCalendar';

/**
 * Pure instrument catalog: the canonical set of tradable instruments grouped by
 * asset class, with the currencies each one is exposed to (for economic-event
 * linking). No runtime imports — kept dependency-free so it is trivially
 * testable and can never form an import cycle with the services that consume it.
 */

export type InstrumentCategory =
  | 'major'
  | 'minor'
  | 'exotic'
  | 'crypto'
  | 'commodity'
  | 'index';

export interface InstrumentMapping {
  symbol: string;
  currencies: Currency[];
  category: InstrumentCategory;
}

/** The tag group instruments live under, e.g. `Asset:EURUSD`. */
export const ASSET_TAG_GROUP = 'Asset';

export const INSTRUMENT_MAPPINGS: InstrumentMapping[] = [
  // Major pairs
  { symbol: 'EURUSD', currencies: ['EUR', 'USD'], category: 'major' },
  { symbol: 'GBPUSD', currencies: ['GBP', 'USD'], category: 'major' },
  { symbol: 'USDJPY', currencies: ['USD', 'JPY'], category: 'major' },
  { symbol: 'AUDUSD', currencies: ['AUD', 'USD'], category: 'major' },
  { symbol: 'USDCAD', currencies: ['USD', 'CAD'], category: 'major' },
  { symbol: 'NZDUSD', currencies: ['NZD', 'USD'], category: 'major' },
  { symbol: 'USDCHF', currencies: ['USD', 'CHF'], category: 'major' },

  // EUR crosses
  { symbol: 'EURJPY', currencies: ['EUR', 'JPY'], category: 'minor' },
  { symbol: 'EURGBP', currencies: ['EUR', 'GBP'], category: 'minor' },
  { symbol: 'EURAUD', currencies: ['EUR', 'AUD'], category: 'minor' },
  { symbol: 'EURCAD', currencies: ['EUR', 'CAD'], category: 'minor' },
  { symbol: 'EURCHF', currencies: ['EUR', 'CHF'], category: 'minor' },
  { symbol: 'EURNZD', currencies: ['EUR', 'NZD'], category: 'minor' },

  // GBP crosses
  { symbol: 'GBPJPY', currencies: ['GBP', 'JPY'], category: 'minor' },
  { symbol: 'GBPAUD', currencies: ['GBP', 'AUD'], category: 'minor' },
  { symbol: 'GBPCAD', currencies: ['GBP', 'CAD'], category: 'minor' },
  { symbol: 'GBPCHF', currencies: ['GBP', 'CHF'], category: 'minor' },
  { symbol: 'GBPNZD', currencies: ['GBP', 'NZD'], category: 'minor' },

  // JPY crosses
  { symbol: 'AUDJPY', currencies: ['AUD', 'JPY'], category: 'minor' },
  { symbol: 'CADJPY', currencies: ['CAD', 'JPY'], category: 'minor' },
  { symbol: 'CHFJPY', currencies: ['CHF', 'JPY'], category: 'minor' },
  { symbol: 'NZDJPY', currencies: ['NZD', 'JPY'], category: 'minor' },

  // Other crosses
  { symbol: 'AUDCAD', currencies: ['AUD', 'CAD'], category: 'minor' },
  { symbol: 'AUDCHF', currencies: ['AUD', 'CHF'], category: 'minor' },
  { symbol: 'AUDNZD', currencies: ['AUD', 'NZD'], category: 'minor' },
  { symbol: 'CADCHF', currencies: ['CAD', 'CHF'], category: 'minor' },
  { symbol: 'NZDCAD', currencies: ['NZD', 'CAD'], category: 'minor' },
  { symbol: 'NZDCHF', currencies: ['NZD', 'CHF'], category: 'minor' },

  // Metals (vs USD)
  { symbol: 'XAUUSD', currencies: ['USD'], category: 'commodity' },
  { symbol: 'XAGUSD', currencies: ['USD'], category: 'commodity' },

  // Crypto (vs USD)
  { symbol: 'BTCUSD', currencies: ['USD'], category: 'crypto' },
  { symbol: 'ETHUSD', currencies: ['USD'], category: 'crypto' },

  // Indices (mapped to base currency for event linking)
  { symbol: 'US30', currencies: ['USD'], category: 'index' },
  { symbol: 'NAS100', currencies: ['USD'], category: 'index' },
  { symbol: 'SPX500', currencies: ['USD'], category: 'index' },
  { symbol: 'US2000', currencies: ['USD'], category: 'index' },
  { symbol: 'GER40', currencies: ['EUR'], category: 'index' },
  { symbol: 'EU50', currencies: ['EUR'], category: 'index' },
  { symbol: 'UK100', currencies: ['GBP'], category: 'index' },
  { symbol: 'JP225', currencies: ['JPY'], category: 'index' },
  { symbol: 'AUS200', currencies: ['AUD'], category: 'index' },
];

/** Flat symbol list for UI option sources. */
export const INSTRUMENTS = INSTRUMENT_MAPPINGS.map((m) => m.symbol);

/** Asset class → the instrument categories it contains. Order drives chip order. */
const CLASS_CATEGORIES: Record<string, InstrumentCategory[]> = {
  Forex: ['major', 'minor', 'exotic'],
  Indices: ['index'],
  Metals: ['commodity'],
  Crypto: ['crypto'],
};

/** Ordered asset-class labels for the calendar-creation chips. */
export const ASSET_CLASSES = Object.keys(CLASS_CATEGORIES);

/** Expand selected asset classes into their de-duped instrument symbols. */
export const instrumentsForClasses = (classes: string[]): string[] => {
  const categories = new Set<InstrumentCategory>();
  classes.forEach((cls) => {
    (CLASS_CATEGORIES[cls] || []).forEach((cat) => categories.add(cat));
  });
  return INSTRUMENT_MAPPINGS.filter((m) => categories.has(m.category)).map((m) => m.symbol);
};

/** Expand selected asset classes into `Asset:<SYMBOL>` tag strings. */
export const assetTagsForClasses = (classes: string[]): string[] =>
  instrumentsForClasses(classes).map((symbol) => `${ASSET_TAG_GROUP}:${symbol}`);

export const getCurrenciesForInstrument = (symbol: string): Currency[] => {
  const mapping = INSTRUMENT_MAPPINGS.find((m) => m.symbol === symbol);
  return mapping ? mapping.currencies : [];
};

export const getInstrumentCategory = (symbol: string): string => {
  const mapping = INSTRUMENT_MAPPINGS.find((m) => m.symbol === symbol);
  return mapping ? mapping.category : 'unknown';
};

export const getInstrumentMappings = (): InstrumentMapping[] => INSTRUMENT_MAPPINGS;

/** Extract instrument symbols from a trade's tags. Reads the `Asset:` group only. */
export const extractInstrumentsFromTags = (tags: string[]): string[] => {
  const prefix = `${ASSET_TAG_GROUP}:`;
  return tags.filter((tag) => tag.startsWith(prefix)).map((tag) => tag.slice(prefix.length));
};

/** All distinct currencies a trade is exposed to, derived from its Asset tags. */
export const getRelevantCurrenciesFromTags = (tags: string[]): Currency[] => {
  const currencies = new Set<Currency>();
  extractInstrumentsFromTags(tags).forEach((symbol) => {
    getCurrenciesForInstrument(symbol).forEach((c) => currencies.add(c));
  });
  return Array.from(currencies);
};
