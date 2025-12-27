import { Trade } from '../types/dualWrite';

/**
 * Ensures a value is a Date object.
 * Handles both Date objects and ISO string representations.
 */
export function ensureDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Normalizes trade date fields to ensure they are Date objects.
 * Useful when receiving trades from RPC calls or sync events where
 * dates may be serialized as ISO strings.
 */
export function normalizeTradeDates<T extends Partial<Trade>>(trade: T): T {
  return {
    ...trade,
    trade_date: trade.trade_date ? ensureDate(trade.trade_date) : trade.trade_date,
    created_at: trade.created_at ? ensureDate(trade.created_at) : trade.created_at,
    updated_at: trade.updated_at ? ensureDate(trade.updated_at) : trade.updated_at,
  };
}
