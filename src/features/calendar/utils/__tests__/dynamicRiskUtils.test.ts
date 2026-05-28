import {
  calculateRiskAmount,
  calculateEffectiveMaxDailyDrawdown,
  calculateEffectiveRiskPercentageAsync,
  calculateCumulativePnLToDateAsync,
  DynamicRiskSettings,
} from 'features/calendar/utils/dynamicRiskUtils';
import { Calendar } from 'features/calendar/types/dualWrite';
import { win } from 'test-utils/makeTrade';

/** Minimal Calendar fixture; only the fields the math reads are populated. */
const makeCalendar = (overrides: Partial<Calendar> = {}): Calendar =>
  ({
    id: 'cal-1',
    account_balance: 10000,
    year_stats: {},
    ...overrides,
  } as unknown as Calendar);

/** A YearStats with account_value_at_start set for a single month index. */
const yearStatsWithMonthStart = (monthIndex: number, valueAtStart: number) => ({
  year: 2026,
  yearly_pnl: 0,
  monthly_stats: Array.from({ length: 12 }, (_, i) => ({
    month_index: i,
    account_value_at_start: i === monthIndex ? valueAtStart : 0,
  })),
});

describe('calculateRiskAmount', () => {
  it('is a flat percentage of balance when no cumulative pnl', () => {
    expect(calculateRiskAmount(2, 10000)).toBe(200);
  });

  it('compounds against balance + cumulative pnl', () => {
    expect(calculateRiskAmount(2, 10000, 5000)).toBe(300);
  });

  it('coerces string-like numeric inputs', () => {
    // Inputs sometimes arrive as strings from form state.
    expect(calculateRiskAmount('2' as never, '10000' as never)).toBe(200);
  });
});

describe('calculateEffectiveMaxDailyDrawdown', () => {
  const settings: DynamicRiskSettings = {
    account_balance: 10000,
    risk_per_trade: 1,
    dynamic_risk_enabled: true,
    increased_risk_percentage: 2,
    profit_threshold_percentage: 5,
  };

  it('returns the base drawdown when dynamic risk is disabled', () => {
    expect(
      calculateEffectiveMaxDailyDrawdown(3, [win(9999)], {
        ...settings,
        dynamic_risk_enabled: false,
      })
    ).toBe(3);
  });

  it('returns the base drawdown when cumulative profit is below threshold', () => {
    // 100 / 10000 = 1% < 5% threshold -> dynamic risk inactive.
    expect(calculateEffectiveMaxDailyDrawdown(3, [win(100)], settings)).toBe(3);
  });

  it('scales the drawdown by the risk ratio once the threshold is met', () => {
    // 600 / 10000 = 6% >= 5% -> active; ratio = increased(2)/base(1) = 2.
    expect(calculateEffectiveMaxDailyDrawdown(3, [win(600)], settings)).toBe(6);
  });
});

describe('calculateCumulativePnLToDateAsync (provided trades)', () => {
  const targetDate = new Date(2026, 0, 15);

  it('adds same-month pnl before the target to the stored start value', async () => {
    const calendar = makeCalendar({
      account_balance: 10000,
      year_stats: { '2026': yearStatsWithMonthStart(0, 11000) as never },
    });
    const trades = [
      win(500, new Date(2026, 0, 10)), // before target, counts
      win(300, new Date(2026, 0, 20)), // after target, excluded
      win(999, new Date(2026, 1, 5)), // different month, excluded
    ];
    // start carry = 11000 - 10000 = 1000; + 500 before target = 1500.
    expect(await calculateCumulativePnLToDateAsync(targetDate, calendar, trades)).toBe(1500);
  });

  it('falls back to account_balance when the month has no stored start value', async () => {
    const calendar = makeCalendar({
      account_balance: 10000,
      // Year exists but monthly_stats is empty -> month lookup is undefined.
      year_stats: { '2026': { year: 2026, yearly_pnl: 0, monthly_stats: [] } as never },
    });
    const trades = [win(500, new Date(2026, 0, 10))];
    expect(await calculateCumulativePnLToDateAsync(targetDate, calendar, trades)).toBe(500);
  });

  it('sums prior-year pnl when the target year has no stats', async () => {
    const calendar = makeCalendar({
      account_balance: 10000,
      year_stats: { '2025': { year: 2025, yearly_pnl: 2000, monthly_stats: [] } as never },
    });
    const trades = [win(500, new Date(2026, 0, 10))];
    // carry = (10000 + 2000) - 10000 = 2000; + 500 before target = 2500.
    expect(await calculateCumulativePnLToDateAsync(targetDate, calendar, trades)).toBe(2500);
  });
});

describe('calculateEffectiveRiskPercentageAsync', () => {
  const base: DynamicRiskSettings = {
    account_balance: 10000,
    risk_per_trade: 1,
    dynamic_risk_enabled: true,
    increased_risk_percentage: 2,
    profit_threshold_percentage: 5,
  };
  const targetDate = new Date(2026, 0, 20);
  const calendar = makeCalendar({
    account_balance: 10000,
    year_stats: { '2026': yearStatsWithMonthStart(0, 10000) as never },
  });

  it('returns 0 when no base risk is configured', async () => {
    const result = await calculateEffectiveRiskPercentageAsync(
      targetDate,
      calendar,
      { ...base, risk_per_trade: undefined },
      []
    );
    expect(result).toBe(0);
  });

  it('returns base risk when dynamic risk is disabled', async () => {
    const result = await calculateEffectiveRiskPercentageAsync(
      targetDate,
      calendar,
      { ...base, dynamic_risk_enabled: false },
      [win(99999, new Date(2026, 0, 10))]
    );
    expect(result).toBe(1);
  });

  it('returns increased risk once cumulative profit clears the threshold', async () => {
    const result = await calculateEffectiveRiskPercentageAsync(
      targetDate,
      calendar,
      base,
      [win(600, new Date(2026, 0, 10))] // 6% >= 5%
    );
    expect(result).toBe(2);
  });

  it('stays at base risk below the threshold', async () => {
    const result = await calculateEffectiveRiskPercentageAsync(
      targetDate,
      calendar,
      base,
      [win(100, new Date(2026, 0, 10))] // 1% < 5%
    );
    expect(result).toBe(1);
  });
});
