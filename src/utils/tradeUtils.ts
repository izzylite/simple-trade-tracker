import { Trade } from '../types/dualWrite';
import { isSameDay } from 'date-fns';
import { calculatePercentageOfValueAtDate } from './dynamicRiskUtils';

export const getDayTrades = (date: Date, trades: Trade[]): Trade[] => {
  return trades.filter(trade => isSameDay(trade.trade_date, date));
};

export const getTotalForDay = (date: Date, trades: Trade[]): number => {
  return getDayTrades(date, trades).reduce((total, trade) => {
    return total + trade.amount;
  }, 0);
};

export const getDayPercentage = (date: Date, trades: Trade[], accountBalance: number): number => {
  const total = getTotalForDay(date, trades);
  return calculatePercentageOfValueAtDate(total, accountBalance, trades, date);
};

// formatCurrency is now imported from formatters.ts