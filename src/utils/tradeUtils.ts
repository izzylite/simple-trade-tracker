import { Trade } from '../types/trade';
import { isSameDay } from 'date-fns';

export const getDayTrades = (date: Date, trades: Trade[]): Trade[] => {
  return trades.filter(trade => isSameDay(trade.date, date));
};

export const getTotalForDay = (date: Date, trades: Trade[]): number => {
  return getDayTrades(date, trades).reduce((total, trade) => {
    return total + trade.amount;
  }, 0);
};

export const getDayPercentage = (date: Date, trades: Trade[], accountBalance: number): number => {
  const total = getTotalForDay(date, trades);
  return accountBalance > 0 ? (total / accountBalance) * 100 : 0;
};

export const formatCurrency = (amount: number): string => {
  const absAmount = Math.abs(amount);
  if (absAmount >= 1000) {
    return `$${(absAmount / 1000).toFixed(1)}k`;
  }
  return `$${absAmount.toFixed(2)}`;
}; 