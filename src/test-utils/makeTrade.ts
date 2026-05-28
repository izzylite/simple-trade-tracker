import { Trade } from 'features/calendar/types/dualWrite';

let seq = 0;

/**
 * Build a Trade fixture for unit tests.
 *
 * Only the fields that matter for a given test need to be passed; everything
 * else gets a deterministic default. `trade_date` defaults to a fixed local
 * date so date-bucketing tests stay stable regardless of the runner timezone.
 *
 * Pass a Date (or year/month/day) explicitly when the test cares about the date.
 */
export const makeTrade = (overrides: Partial<Trade> = {}): Trade => {
  seq += 1;
  return {
    id: `trade-${seq}`,
    calendar_id: 'cal-1',
    user_id: 'user-1',
    amount: 0,
    trade_type: 'breakeven',
    // Local-time date (not ISO) so isSameMonth / getFullYear are TZ-stable.
    trade_date: new Date(2026, 0, 15),
    created_at: new Date(2026, 0, 15),
    updated_at: new Date(2026, 0, 15),
    ...overrides,
  };
};

/** Shorthand for a winning trade of a given amount on a given date. */
export const win = (amount: number, date?: Date, extra: Partial<Trade> = {}): Trade =>
  makeTrade({ trade_type: 'win', amount, ...(date ? { trade_date: date } : {}), ...extra });

/** Shorthand for a losing trade. `amount` should be negative. */
export const loss = (amount: number, date?: Date, extra: Partial<Trade> = {}): Trade =>
  makeTrade({ trade_type: 'loss', amount, ...(date ? { trade_date: date } : {}), ...extra });

/** Shorthand for a breakeven trade. */
export const breakeven = (amount = 0, date?: Date, extra: Partial<Trade> = {}): Trade =>
  makeTrade({ trade_type: 'breakeven', amount, ...(date ? { trade_date: date } : {}), ...extra });
