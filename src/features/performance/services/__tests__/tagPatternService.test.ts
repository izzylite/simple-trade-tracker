import { subDays } from 'date-fns';
import { tagPatternService } from 'features/performance/services/tagPatternService';
import { generateTagCombinationsInWorker } from 'features/performance/workers/tagPatternWorker';
import { win, loss, breakeven } from 'test-utils/makeTrade';

// The worker boundary is mocked so the analysis pipeline is deterministic and
// doesn't depend on jsdom's (absent) Web Worker support.
jest.mock('features/performance/workers/tagPatternWorker', () => ({
  generateTagCombinationsInWorker: jest.fn(),
}));

const mockGenerate = generateTagCombinationsInWorker as jest.MockedFunction<
  typeof generateTagCombinationsInWorker
>;

const recent = (days: number) => subDays(new Date(), days);

describe('getTagCombinationStats', () => {
  it('computes win rate excluding breakevens', () => {
    const trades = [
      win(100, recent(3), { tags: ['A'] }),
      win(50, recent(4), { tags: ['A'] }),
      loss(-40, recent(5), { tags: ['A'] }),
      breakeven(0, recent(6), { tags: ['A'] }),
    ];
    const stats = tagPatternService.getTagCombinationStats(trades, ['A'])!;
    expect(stats.total_trades).toBe(4); // breakeven counts toward volume
    expect(stats.wins).toBe(2);
    expect(stats.losses).toBe(1);
    expect(stats.win_rate).toBeCloseTo((2 / 3) * 100); // 2 / (2 wins + 1 loss)
    expect(stats.total_pnl).toBe(110);
  });

  it('matches only trades carrying every tag in the combination', () => {
    const trades = [
      win(100, recent(3), { tags: ['A', 'B'] }),
      win(100, recent(3), { tags: ['A'] }),
      loss(-50, recent(3), { tags: ['B'] }),
    ];
    const stats = tagPatternService.getTagCombinationStats(trades, ['A', 'B'])!;
    expect(stats.total_trades).toBe(1);
    expect(stats.wins).toBe(1);
  });

  it('flags an improving trend when recent win rate climbs', () => {
    const trades = [
      // historical window (30-90 days ago): all losses -> 0%
      loss(-10, recent(60), { tags: ['A'] }),
      loss(-10, recent(61), { tags: ['A'] }),
      loss(-10, recent(62), { tags: ['A'] }),
      // recent window (< 30 days): all wins -> 100%
      win(10, recent(3), { tags: ['A'] }),
      win(10, recent(4), { tags: ['A'] }),
      win(10, recent(5), { tags: ['A'] }),
    ];
    expect(tagPatternService.getTagCombinationStats(trades, ['A'])!.trend).toBe('improving');
  });

  it('flags a declining trend when recent win rate drops', () => {
    const trades = [
      win(10, recent(60), { tags: ['A'] }),
      win(10, recent(61), { tags: ['A'] }),
      win(10, recent(62), { tags: ['A'] }),
      loss(-10, recent(3), { tags: ['A'] }),
      loss(-10, recent(4), { tags: ['A'] }),
      loss(-10, recent(5), { tags: ['A'] }),
    ];
    expect(tagPatternService.getTagCombinationStats(trades, ['A'])!.trend).toBe('declining');
  });

  it('stays stable when either window has too few trades', () => {
    const trades = [
      win(10, recent(3), { tags: ['A'] }),
      win(10, recent(60), { tags: ['A'] }),
    ];
    expect(tagPatternService.getTagCombinationStats(trades, ['A'])!.trend).toBe('stable');
  });
});

describe('analyzeTagPatterns', () => {
  beforeEach(() => mockGenerate.mockReset());

  it('drops combinations below the minimum trade count', async () => {
    mockGenerate.mockResolvedValue([['A'], ['B']]);
    const trades = [
      ...Array.from({ length: 4 }, (_, i) => win(10, recent(i + 1), { tags: ['A'] })),
      loss(-10, recent(5), { tags: ['A'] }), // A: 5 trades
      win(10, recent(2), { tags: ['B'] }),
      loss(-10, recent(3), { tags: ['B'] }), // B: only 2 trades -> dropped
    ];
    const result = await tagPatternService.analyzeTagPatterns(trades);
    expect(result.topCombinations).toHaveLength(1);
    expect(result.topCombinations[0].tags).toEqual(['A']);
  });

  it('surfaces a high-performance insight for a strong, high-volume pattern', async () => {
    mockGenerate.mockResolvedValue([['A']]);
    const trades = [
      ...Array.from({ length: 4 }, (_, i) => win(10, recent(i + 1), { tags: ['A'] })),
      loss(-10, recent(5), { tags: ['A'] }), // 80% win rate over 5 trades
    ];
    const result = await tagPatternService.analyzeTagPatterns(trades);
    const insight = result.insights.find(i => i.type === 'high_performance');
    expect(insight).toBeDefined();
    expect(insight!.tagCombination).toEqual(['A']);
  });

  it('falls back to in-process generation when the worker rejects', async () => {
    mockGenerate.mockRejectedValue(new Error('worker unavailable'));
    const trades = Array.from({ length: 4 }, (_, i) =>
      win(10, recent(i + 1), { tags: ['A'] })
    );
    // Should not throw; fallback path still analyzes the combination.
    const result = await tagPatternService.analyzeTagPatterns(trades);
    expect(result.topCombinations.some(c => c.tags.includes('A'))).toBe(true);
  });
});
