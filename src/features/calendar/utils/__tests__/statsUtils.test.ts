import { calculateTargetProgress, calculateDayStats } from 'features/calendar/utils/statsUtils';
import { win, loss, breakeven } from 'test-utils/makeTrade';

describe('calculateTargetProgress', () => {
  it('returns 0 when target or balance is missing', () => {
    expect(calculateTargetProgress([win(100)], 10000, 0)).toBe(0);
    expect(calculateTargetProgress([win(100)], 0, 5)).toBe(0);
  });

  it('computes progress as pnl against the target amount', () => {
    // target 5% of 10000 = 500; pnl 250 -> 50%.
    expect(calculateTargetProgress([win(250)], 10000, 5)).toBe(50);
  });

  it('caps progress at 100% when the target is exceeded', () => {
    expect(calculateTargetProgress([win(2000)], 10000, 5)).toBe(100);
  });

  it('floors progress at 0% when net pnl is negative', () => {
    expect(calculateTargetProgress([loss(-300)], 10000, 5)).toBe(0);
  });

  it('rebaselines the target against account value at the start of the period', () => {
    const startDate = new Date(2026, 1, 1);
    const allTrades = [win(1000, new Date(2026, 0, 15))]; // before the period
    // baseline = 10000 + 1000 = 11000; target 5% = 550; period pnl 550 -> 100%.
    const periodTrades = [win(550, new Date(2026, 1, 10))];
    expect(calculateTargetProgress(periodTrades, 10000, 5, startDate, allTrades)).toBe(100);
  });
});

describe('calculateDayStats', () => {
  it('reports a neutral day with no trades', () => {
    const stats = calculateDayStats([], 10000, 2);
    expect(stats.status).toBe('neutral');
    expect(stats.netAmount).toBe(0);
    expect(stats.isDrawdownViolation).toBe(false);
  });

  it('classifies a net-positive day as a win with a balance-relative percentage', () => {
    const stats = calculateDayStats([win(300), loss(-100)], 10000, 2);
    expect(stats.status).toBe('win');
    expect(stats.netAmount).toBe(200);
    expect(stats.percentage).toBe('2.0');
  });

  it('treats a net-zero day containing a breakeven as breakeven', () => {
    const stats = calculateDayStats([breakeven(0)], 10000, 2);
    expect(stats.status).toBe('breakeven');
  });

  it('flags a drawdown violation when a losing day exceeds the dollar limit', () => {
    // limit = 2% of 10000 = 200; loss of 300 exceeds it.
    const stats = calculateDayStats([loss(-300)], 10000, 2);
    expect(stats.status).toBe('loss');
    expect(stats.isDrawdownViolation).toBe(true);
  });

  it('does not flag a loss within the drawdown limit', () => {
    const stats = calculateDayStats([loss(-100)], 10000, 2);
    expect(stats.isDrawdownViolation).toBe(false);
  });

  it('measures percentage against totalAccountValue when provided', () => {
    // baseValue overridden to 20000 -> 200 / 20000 = 1.0%.
    const stats = calculateDayStats([win(200)], 10000, 2, undefined, undefined, undefined, 20000);
    expect(stats.percentage).toBe('1.0');
  });

  it('avoids divide-by-zero for a non-positive base value', () => {
    const stats = calculateDayStats([win(200)], 0, 2);
    expect(stats.percentage).toBe('0');
  });
});
