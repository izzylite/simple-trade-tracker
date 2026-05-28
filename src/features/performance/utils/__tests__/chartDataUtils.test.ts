import {
  getTradesStats,
  getFilteredTrades,
  calculateTargetValue,
  calculateDrawdownViolationValue,
  calculateWinLossStatsAsync,
  calculateTagStatsAsync,
  calculateRiskRewardStatsAsync,
  calculateSessionStatsAsync,
  calculateComparisonWinLossDataAsync,
  calculateAllTagsAsync,
} from 'features/performance/utils/chartDataUtils';
import { makeTrade, win, loss, breakeven } from 'test-utils/makeTrade';

describe('getTradesStats', () => {
  it('returns zeroed stats for empty input', () => {
    expect(getTradesStats([])).toEqual({
      trades: [],
      wins: 0,
      losses: 0,
      breakevens: 0,
      totalTrades: 0,
      winRate: 0,
      total_pnl: 0,
    });
  });

  it('returns zeroed stats for undefined input', () => {
    // Defensive guard — callers pass possibly-undefined arrays.
    expect(getTradesStats(undefined as never).totalTrades).toBe(0);
  });

  it('counts wins, losses, breakevens and sums pnl', () => {
    const stats = getTradesStats([win(100), loss(-40), breakeven(0), win(60)]);
    expect(stats.wins).toBe(2);
    expect(stats.losses).toBe(1);
    expect(stats.breakevens).toBe(1);
    expect(stats.totalTrades).toBe(4);
    expect(stats.total_pnl).toBe(120);
  });

  it('excludes breakevens from the win-rate denominator', () => {
    // 2 wins, 1 loss, 1 breakeven -> 2/(2+1) = 67% (rounded), not 2/4 = 50%.
    const stats = getTradesStats([win(1), win(1), loss(-1), breakeven(0)]);
    expect(stats.winRate).toBe(67);
  });

  it('returns winRate 0 when every trade is a breakeven (no divide-by-zero)', () => {
    const stats = getTradesStats([breakeven(0), breakeven(0)]);
    expect(stats.winRate).toBe(0);
    expect(stats.totalTrades).toBe(2);
  });
});

describe('getFilteredTrades', () => {
  const jan = new Date(2026, 0, 10);
  const feb = new Date(2026, 1, 10);
  const lastYear = new Date(2025, 0, 10);
  const trades = [
    win(10, jan),
    loss(-5, feb),
    win(20, lastYear),
  ];

  it('filters to the selected month', () => {
    const result = getFilteredTrades(trades, new Date(2026, 0, 1), 'month');
    expect(result).toHaveLength(1);
    expect(result[0].trade_date).toEqual(jan);
  });

  it('filters to the selected year', () => {
    const result = getFilteredTrades(trades, new Date(2026, 5, 1), 'year');
    expect(result).toHaveLength(2);
  });

  it('returns everything for the "all" period', () => {
    expect(getFilteredTrades(trades, new Date(), 'all')).toHaveLength(3);
  });

  it('returns [] for nullish trades', () => {
    expect(getFilteredTrades(undefined as never, new Date(), 'all')).toEqual([]);
  });
});

describe('calculateTargetValue', () => {
  it('returns null when target is undefined', () => {
    expect(calculateTargetValue(undefined, 10000)).toBeNull();
  });

  it('returns null when account balance is non-positive', () => {
    expect(calculateTargetValue(5, 0)).toBeNull();
    expect(calculateTargetValue(5, -100)).toBeNull();
  });

  it('computes target as a percentage of balance', () => {
    expect(calculateTargetValue(5, 10000)).toBe(500);
  });
});

describe('calculateDrawdownViolationValue', () => {
  it('returns the negative dollar drawdown limit', () => {
    expect(calculateDrawdownViolationValue(2, 10000)).toBe(-200);
  });
});

describe('calculateWinLossStatsAsync', () => {
  it('computes win rate excluding breakevens and average amounts', async () => {
    const result = await calculateWinLossStatsAsync([
      win(100),
      win(200),
      loss(-50),
      breakeven(0),
    ]);
    expect(result.total_trades).toBe(4);
    expect(result.win_rate).toBeCloseTo((2 / 3) * 100);
    expect(result.winners.total).toBe(2);
    expect(result.winners.avgAmount).toBe(150);
    expect(result.losers.total).toBe(1);
    expect(result.losers.avgAmount).toBe(-50);
    expect(result.breakevens.total).toBe(1);
  });

  it('tracks max and average consecutive streaks in date order', async () => {
    const d = (day: number) => new Date(2026, 0, day);
    // W W L W  ->  win streaks: [2, 1] (avg 1.5, max 2); loss streak: [1]
    const result = await calculateWinLossStatsAsync([
      win(1, d(1)),
      win(1, d(2)),
      loss(-1, d(3)),
      win(1, d(4)),
    ]);
    expect(result.winners.maxConsecutive).toBe(2);
    expect(result.winners.avgConsecutive).toBeCloseTo(1.5);
    expect(result.losers.maxConsecutive).toBe(1);
  });

  it('lets a breakeven preserve (not reset) an existing win streak', async () => {
    const d = (day: number) => new Date(2026, 0, day);
    // W BE W  -> single uninterrupted win streak of 2
    const result = await calculateWinLossStatsAsync([
      win(1, d(1)),
      breakeven(0, d(2)),
      win(1, d(3)),
    ]);
    expect(result.winners.maxConsecutive).toBe(2);
  });

  it('handles an all-breakeven set without dividing by zero', async () => {
    const result = await calculateWinLossStatsAsync([breakeven(0), breakeven(0)]);
    expect(result.win_rate).toBe(0);
    expect(result.winners.avgAmount).toBe(0);
  });
});

describe('calculateTagStatsAsync', () => {
  it('aggregates per-tag stats and sorts by trade count desc', async () => {
    const result = await calculateTagStatsAsync([
      win(100, undefined, { tags: ['A', 'B'] }),
      loss(-50, undefined, { tags: ['A'] }),
      win(30, undefined, { tags: ['A'] }),
    ]);
    // A appears on 3 trades, B on 1 -> A sorts first.
    expect(result[0].tag).toBe('A');
    expect(result[0].total_trades).toBe(3);
    expect(result[0].total_pnl).toBe(80);
    expect(result[0].win_rate).toBe(67); // 2 wins / (2 wins + 1 loss)
    expect(result[1].tag).toBe('B');
    expect(result[1].total_trades).toBe(1);
  });

  it('ignores trades without tags', async () => {
    const result = await calculateTagStatsAsync([win(10), loss(-5)]);
    expect(result).toEqual([]);
  });
});

describe('calculateRiskRewardStatsAsync', () => {
  it('averages defined risk_to_reward values and reports the max', async () => {
    const result = await calculateRiskRewardStatsAsync(
      [
        makeTrade({ risk_to_reward: 2, trade_date: new Date(2026, 0, 1) }),
        makeTrade({ risk_to_reward: 4, trade_date: new Date(2026, 0, 2) }),
        makeTrade({ risk_to_reward: undefined, trade_date: new Date(2026, 0, 3) }),
      ],
      'month'
    );
    expect(result.average).toBe(3);
    expect(result.max).toBe(4);
    expect(result.data).toHaveLength(2);
  });

  it('returns zeros for trades with no risk_to_reward', async () => {
    const result = await calculateRiskRewardStatsAsync([makeTrade({})], 'all');
    expect(result).toEqual({ average: 0, max: 0, data: [] });
  });
});

describe('calculateSessionStatsAsync', () => {
  it('buckets trades into the four sessions with balance-relative pnl%', async () => {
    const result = await calculateSessionStatsAsync(
      [
        win(100, undefined, { session: 'London' }),
        loss(-50, undefined, { session: 'London' }),
        win(200, undefined, { session: 'NY AM' }),
      ],
      10000
    );
    const london = result.find(s => s.session === 'London')!;
    expect(london.total_trades).toBe(2);
    expect(london.win_rate).toBe(50);
    expect(london.total_pnl).toBe(50);
    expect(london.pnlPercentage).toBeCloseTo(0.5);

    const nyam = result.find(s => s.session === 'NY AM')!;
    expect(nyam.total_pnl).toBe(200);
    expect(nyam.averagePnL).toBe(200);
  });

  it('avoids divide-by-zero when account balance is 0', async () => {
    const result = await calculateSessionStatsAsync(
      [win(100, undefined, { session: 'Asia' })],
      0
    );
    expect(result.find(s => s.session === 'Asia')!.pnlPercentage).toBe(0);
  });
});

describe('calculateComparisonWinLossDataAsync', () => {
  it('returns null when no comparison tags are supplied', async () => {
    expect(await calculateComparisonWinLossDataAsync([win(1)], [])).toBeNull();
  });

  it('counts win/loss/breakeven for trades carrying any comparison tag', async () => {
    const result = await calculateComparisonWinLossDataAsync(
      [
        win(1, undefined, { tags: ['setup-a'] }),
        loss(-1, undefined, { tags: ['setup-a'] }),
        win(1, undefined, { tags: ['unrelated'] }),
      ],
      ['setup-a']
    );
    expect(result).toEqual([
      { name: 'Wins', value: 1 },
      { name: 'Losses', value: 1 },
    ]);
  });
});

describe('calculateAllTagsAsync', () => {
  it('returns the unique sorted set of tags', async () => {
    const result = await calculateAllTagsAsync([
      win(1, undefined, { tags: ['b', 'a'] }),
      loss(-1, undefined, { tags: ['a', 'c'] }),
      breakeven(0),
    ]);
    expect(result).toEqual(['a', 'b', 'c']);
  });
});
