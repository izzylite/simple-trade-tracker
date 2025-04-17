import { Trade } from '../types/trade';
import { isAfter, isBefore, isSameDay, isSameMonth, isSameWeek, isSameYear, startOfDay } from 'date-fns';

/**
 * Calculate total PnL for a set of trades
 * @param trades Array of trades
 * @returns Total PnL
 */
export const calculateTotalPnL = (trades: Trade[]): number => {
  return trades.reduce((sum, trade) => sum + trade.amount, 0);
};

/**
 * Calculate win rate for a set of trades
 * @param trades Array of trades
 * @returns Win rate percentage
 */
export const calculateWinRate = (trades: Trade[]): number => {
  if (trades.length === 0) return 0;

  const winCount = trades.filter(trade => trade.type === 'win').length;
  return (winCount / trades.length) * 100;
};

/**
 * Calculate profit factor for a set of trades
 * @param trades Array of trades
 * @returns Profit factor (gross profit / gross loss)
 */
export const calculateProfitFactor = (trades: Trade[]): number => {
  const grossProfit = trades
    .filter(trade => trade.amount > 0)
    .reduce((sum, trade) => sum + trade.amount, 0);

  const grossLoss = Math.abs(trades
    .filter(trade => trade.amount < 0)
    .reduce((sum, trade) => sum + trade.amount, 0));

  if (grossLoss === 0) return grossProfit > 0 ? 999 : 0;
  return grossProfit / grossLoss;
};

/**
 * Calculate maximum drawdown for a set of trades
 * @param trades Array of trades
 * @returns Maximum drawdown percentage
 */
export const calculateMaxDrawdown = (trades: Trade[]): {
  maxDrawdown: number;
  drawdownStartDate?: Date;
  drawdownEndDate?: Date;
  drawdownRecoveryNeeded: number;
  drawdownDuration: number;
} => {
  if (trades.length === 0) {
    return {
      maxDrawdown: 0,
      drawdownRecoveryNeeded: 0,
      drawdownDuration: 0
    };
  }

  // Sort trades by date
  const sortedTrades = [...trades].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let balance = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let drawdownStartDate: Date | undefined;
  let drawdownEndDate: Date | undefined;
  let currentDrawdownStartDate: Date | undefined;
  let drawdownDuration = 0;

  sortedTrades.forEach(trade => {
    balance += trade.amount;

    if (balance > peak) {
      peak = balance;
      currentDrawdownStartDate = undefined;
    } else if (peak > 0) {
      const drawdown = (peak - balance) / peak * 100;

      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        drawdownStartDate = currentDrawdownStartDate || trade.date;
        drawdownEndDate = trade.date;

        // Calculate drawdown duration (number of trades)
        if (drawdownStartDate && drawdownEndDate) {
          const startIndex = sortedTrades.findIndex(t => t.date === drawdownStartDate);
          const endIndex = sortedTrades.findIndex(t => t.date === drawdownEndDate);
          if (startIndex !== -1 && endIndex !== -1) {
            drawdownDuration = endIndex - startIndex + 1;
          } else {
            // Fallback if dates can't be found
            drawdownDuration = 1;
          }
        } else {
          drawdownDuration = 1;
        }
      }

      if (!currentDrawdownStartDate) {
        currentDrawdownStartDate = trade.date;
      }
    }
  });

  // Calculate recovery needed
  const drawdownRecoveryNeeded = maxDrawdown > 0
    ? (maxDrawdown / (100 - maxDrawdown)) * 100
    : 0;

  return {
    maxDrawdown,
    drawdownStartDate,
    drawdownEndDate,
    drawdownRecoveryNeeded,
    drawdownDuration
  };
};

/**
 * Calculate target progress for a set of trades
 * @param trades Array of trades
 * @param accountBalance Initial account balance
 * @param target Target percentage
 * @returns Target progress percentage
 */
export const calculateTargetProgress = (
  trades: Trade[],
  accountBalance: number,
  target: number
): number => {
  if (!target || target <= 0 || !accountBalance) return 0;

  const totalPnL = calculateTotalPnL(trades);
  const targetAmount = (target / 100) * accountBalance;

  return Math.min(Math.max((totalPnL / targetAmount) * 100, 0), 100);
};

/**
 * Filter trades by date range
 * @param trades Array of trades
 * @param startDate Start date
 * @param endDate End date
 * @returns Filtered trades
 */
export const filterTradesByDateRange = (
  trades: Trade[],
  startDate: Date,
  endDate: Date
): Trade[] => {
  return trades.filter(trade => {
    const tradeDate = new Date(trade.date);
    return (
      !isBefore(tradeDate, startOfDay(startDate)) &&
      !isAfter(tradeDate, startOfDay(endDate))
    );
  });
};

/**
 * Filter trades by week
 * @param trades Array of trades
 * @param date Date within the week
 * @returns Filtered trades
 */
export const filterTradesByWeek = (
  trades: Trade[],
  date: Date
): Trade[] => {
  return trades.filter(trade => {
    const tradeDate = new Date(trade.date);
    return isSameWeek(tradeDate, date, { weekStartsOn: 1 });
  });
};

/**
 * Filter trades by month
 * @param trades Array of trades
 * @param date Date within the month
 * @returns Filtered trades
 */
export const filterTradesByMonth = (
  trades: Trade[],
  date: Date
): Trade[] => {
  return trades.filter(trade => {
    const tradeDate = new Date(trade.date);
    return isSameMonth(tradeDate, date) && isSameYear(tradeDate, date);
  });
};

/**
 * Filter trades by year
 * @param trades Array of trades
 * @param date Date within the year
 * @returns Filtered trades
 */
export const filterTradesByYear = (
  trades: Trade[],
  date: Date
): Trade[] => {
  return trades.filter(trade => {
    const tradeDate = new Date(trade.date);
    return isSameYear(tradeDate, date);
  });
};

/**
 * Filter trades by day
 * @param trades Array of trades
 * @param date Date
 * @returns Filtered trades
 */
export const filterTradesByDay = (
  trades: Trade[],
  date: Date
): Trade[] => {
  return trades.filter(trade => {
    const tradeDate = new Date(trade.date);
    return isSameDay(tradeDate, date);
  });
};

/**
 * Filter trades by tags
 * @param trades Array of trades
 * @param tags Array of tags to filter by
 * @returns Filtered trades
 */
export const filterTradesByTags = (
  trades: Trade[],
  tags: string[]
): Trade[] => {
  if (!tags.length) return trades;

  return trades.filter(trade => {
    if (!trade.tags || !trade.tags.length) return false;
    return tags.some(tag => trade.tags?.includes(tag));
  });
};

/**
 * Calculate average win and loss amounts
 * @param trades Array of trades
 * @returns Object with average win and loss
 */
export const calculateAverages = (trades: Trade[]): {
  avgWin: number;
  avgLoss: number;
} => {
  const winTrades = trades.filter(trade => trade.type === 'win');
  const lossTrades = trades.filter(trade => trade.type === 'loss');

  const avgWin = winTrades.length
    ? winTrades.reduce((sum, trade) => sum + trade.amount, 0) / winTrades.length
    : 0;

  const avgLoss = lossTrades.length
    ? Math.abs(lossTrades.reduce((sum, trade) => sum + trade.amount, 0)) / lossTrades.length
    : 0;

  return { avgWin, avgLoss };
};
