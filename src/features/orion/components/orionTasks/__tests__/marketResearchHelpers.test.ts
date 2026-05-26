import { hydrateMarketResearchConfig } from '../marketResearchHelpers';

describe('hydrateMarketResearchConfig', () => {
  it('returns sensible defaults from an empty object', () => {
    const cfg = hydrateMarketResearchConfig({});
    expect(cfg.markets).toEqual(['forex']);
    expect(cfg.frequency_minutes).toBe(60);
    expect(cfg.min_significance).toBe('high');
    expect(cfg.macro_queries).toEqual([]);
    expect(cfg.watchlist_symbols).toEqual([]);
  });

  it('preserves macro_queries when present', () => {
    const cfg = hydrateMarketResearchConfig({
      macro_queries: ['fed speech', 'cpi release'],
    });
    expect(cfg.macro_queries).toEqual(['fed speech', 'cpi release']);
  });

  it('migrates legacy custom_topics into macro_queries when macro_queries is missing', () => {
    const cfg = hydrateMarketResearchConfig({
      custom_topics: ['old topic'],
    });
    expect(cfg.macro_queries).toEqual(['old topic']);
  });

  it('upgrades sub-hourly frequencies to 60', () => {
    expect(hydrateMarketResearchConfig({ frequency_minutes: 15 }).frequency_minutes).toBe(60);
    expect(hydrateMarketResearchConfig({ frequency_minutes: 30 }).frequency_minutes).toBe(60);
  });

  it('keeps supported frequencies as-is', () => {
    for (const f of [60, 120, 180, 240, 360, 1440]) {
      expect(hydrateMarketResearchConfig({ frequency_minutes: f }).frequency_minutes).toBe(f);
    }
  });

  it('caps macro_queries at MAX_MACRO_QUERIES (10)', () => {
    const cfg = hydrateMarketResearchConfig({
      macro_queries: Array.from({ length: 20 }, (_, i) => `q${i}`),
    });
    expect(cfg.macro_queries).toHaveLength(10);
  });
});
