import {
  INSTRUMENTS,
  ASSET_CLASSES,
  ASSET_TAG_GROUP,
  instrumentsForClasses,
  assetTagsForClasses,
  getCurrenciesForInstrument,
  getInstrumentCategory,
  extractInstrumentsFromTags,
  getRelevantCurrenciesFromTags,
} from '../instrumentCatalog';

describe('ASSET_CLASSES', () => {
  it('offers exactly the four supported classes', () => {
    expect(ASSET_CLASSES).toEqual(['Forex', 'Indices', 'Metals', 'Crypto']);
  });
});

describe('instrumentsForClasses', () => {
  it('expands Forex to currency-pair symbols', () => {
    const forex = instrumentsForClasses(['Forex']);
    expect(forex).toContain('EURUSD');
    expect(forex).toContain('GBPJPY');
    expect(forex).not.toContain('BTCUSD');
    expect(forex).not.toContain('US30');
  });

  it('expands Indices to the bounded index list', () => {
    const indices = instrumentsForClasses(['Indices']);
    expect(indices).toContain('US30');
    expect(indices).toContain('GER40');
    expect(indices).not.toContain('EURUSD');
  });

  it('expands Metals and Crypto', () => {
    expect(instrumentsForClasses(['Metals'])).toEqual(
      expect.arrayContaining(['XAUUSD', 'XAGUSD']),
    );
    expect(instrumentsForClasses(['Crypto'])).toEqual(
      expect.arrayContaining(['BTCUSD', 'ETHUSD']),
    );
  });

  it('de-duplicates across multiple classes', () => {
    const both = instrumentsForClasses(['Forex', 'Indices']);
    expect(new Set(both).size).toBe(both.length);
    expect(both).toContain('EURUSD');
    expect(both).toContain('US30');
  });

  it('returns [] for unknown or empty class lists', () => {
    expect(instrumentsForClasses([])).toEqual([]);
    expect(instrumentsForClasses(['Bonds'])).toEqual([]);
  });
});

describe('assetTagsForClasses', () => {
  it('prefixes each instrument with the Asset group', () => {
    expect(assetTagsForClasses(['Crypto'])).toEqual(
      expect.arrayContaining(['Asset:BTCUSD', 'Asset:ETHUSD']),
    );
  });
});

describe('getCurrenciesForInstrument', () => {
  it('maps a forex pair to both currencies', () => {
    expect(getCurrenciesForInstrument('EURUSD')).toEqual(['EUR', 'USD']);
  });

  it('maps indices to their base currency', () => {
    expect(getCurrenciesForInstrument('US30')).toEqual(['USD']);
    expect(getCurrenciesForInstrument('GER40')).toEqual(['EUR']);
    expect(getCurrenciesForInstrument('JP225')).toEqual(['JPY']);
  });

  it('returns [] for unknown instruments', () => {
    expect(getCurrenciesForInstrument('AAPL')).toEqual([]);
  });
});

describe('getInstrumentCategory', () => {
  it('classifies an index', () => {
    expect(getInstrumentCategory('NAS100')).toBe('index');
  });

  it('returns "unknown" for unmapped symbols', () => {
    expect(getInstrumentCategory('AAPL')).toBe('unknown');
  });
});

describe('extractInstrumentsFromTags', () => {
  it('reads only Asset:-prefixed tags', () => {
    expect(
      extractInstrumentsFromTags(['Asset:EURUSD', 'Strategy:Breakout', 'Asset:US30']),
    ).toEqual(['EURUSD', 'US30']);
  });

  it('ignores the legacy pair: and Pairs: prefixes', () => {
    expect(extractInstrumentsFromTags(['pair:EURUSD', 'Pairs:GBPUSD'])).toEqual([]);
  });

  it('drops a malformed bare Asset: tag', () => {
    expect(extractInstrumentsFromTags(['Asset:'])).toEqual([]);
  });
});

describe('getRelevantCurrenciesFromTags', () => {
  it('collects de-duped currencies from Asset tags', () => {
    expect(
      getRelevantCurrenciesFromTags(['Asset:EURUSD', 'Asset:US30']).sort(),
    ).toEqual(['EUR', 'USD']);
  });
});

describe('INSTRUMENTS', () => {
  it('includes the new indices', () => {
    expect(INSTRUMENTS).toEqual(expect.arrayContaining(['US30', 'SPX500', 'UK100']));
  });
});
