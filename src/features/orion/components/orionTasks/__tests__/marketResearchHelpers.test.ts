import { hydrateMarketResearchConfig } from '../marketResearchHelpers';

describe('hydrateMarketResearchConfig', () => {
  it('returns sensible defaults from an empty object', () => {
    const cfg = hydrateMarketResearchConfig({});
    expect(cfg.frequency_minutes).toBe(60);
    expect(cfg.min_significance).toBe('high');
    expect(cfg.subscribed_assets).toEqual([]);
  });

  it('preserves subscribed_assets when present', () => {
    const cfg = hydrateMarketResearchConfig({
      subscribed_assets: ['EURUSD', 'XAUUSD'],
    });
    expect(cfg.subscribed_assets).toEqual(['EURUSD', 'XAUUSD']);
  });

  it('defaults subscribed_assets to [] when missing', () => {
    const cfg = hydrateMarketResearchConfig({ frequency_minutes: 120 });
    expect(cfg.subscribed_assets).toEqual([]);
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
});
