import { Trade } from '../types/trade';
import { isAfter, isBefore, isSameDay, isSameMonth, isSameWeek, isSameYear, startOfDay } from 'date-fns';
import { calculateEffectiveMaxDailyDrawdown, calculatePercentageOfValueAtDate, DynamicRiskSettings } from './dynamicRiskUtils';
import { 
  DayStatus
} from '../components/StyledComponents'; 

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
    .filter(trade => trade.amount < 0 || trade.type === 'loss')
    .reduce((sum, trade) => sum + trade.amount, 0));
     
  // If no losses, return a high but reasonable number instead of 999
  // This represents an excellent profit factor without looking like an error
  if (grossLoss === 0) return grossProfit > 0 ? 50.0 : 0;
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


interface DayStats {
  netAmount: number;
  status: DayStatus;
  percentage: string;
  isDrawdownViolation: boolean;
}

export const calculateDayStats = (
  dayTrades: Trade[],
  accountBalance: number,
  maxDailyDrawdown: number,
  dynamicRiskSettings?: DynamicRiskSettings,
  allTrades?: Trade[],
  dayDate?: Date
): DayStats => {
  // Calculate net amount for the day
  const netAmount = dayTrades.reduce((sum, trade) => sum + trade.amount, 0);

  // Calculate percentage loss/gain relative to account value at start of day (excluding current day trades)
  const percentage = allTrades && dayDate
    ? calculatePercentageOfValueAtDate(netAmount, accountBalance, allTrades, startOfDay(dayDate)).toFixed(1)
    : accountBalance > 0 ? ((netAmount / accountBalance) * 100).toFixed(1) : '0';

  let status: DayStatus = 'neutral';
  if (dayTrades.length > 0) {
    status = netAmount > 0 ? 'win' : netAmount < 0 ? 'loss' : dayTrades.find(trade => trade.type === 'breakeven') ? 'breakeven' : 'neutral';
  }

  // Calculate effective max daily drawdown based on dynamic risk settings
  let effectiveMaxDailyDrawdown = maxDailyDrawdown;
 
  if (dynamicRiskSettings && allTrades) {
    effectiveMaxDailyDrawdown = calculateEffectiveMaxDailyDrawdown(
      maxDailyDrawdown,
      allTrades,
      dynamicRiskSettings
    );
  }

  // Check for drawdown violation - if the loss percentage exceeds effectiveMaxDailyDrawdown
  const percentageValue = parseFloat(percentage);
  const isDrawdownViolation = status === 'loss' && Math.abs(percentageValue) > effectiveMaxDailyDrawdown;

  return { netAmount, status, percentage, isDrawdownViolation };
};


interface MonthlyStats {
  totalPnL: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  netChange: number;
}

export const calculateMonthlyStats = (trades: Trade[], currentDate: Date, accountBalance: number): MonthlyStats => {
  const monthTrades = trades.filter(trade => isSameMonth(new Date(trade.date), currentDate));
  const totalPnL = monthTrades.reduce((sum, trade) => sum + trade.amount, 0);
  const winCount = monthTrades.filter(trade => trade.type === 'win').length;
  const lossCount = monthTrades.filter(trade => trade.type === 'loss').length;
  const winRate = monthTrades.length > 0 ? (winCount / monthTrades.length * 100) : 0;

  const winningTrades = monthTrades.filter(t => t.type === 'win');
  const losingTrades = monthTrades.filter(t => t.type === 'loss');

  // Calculate profit factor (gross profit / gross loss)
  const grossProfit = winningTrades.reduce((sum, t) => sum + t.amount, 0);
  const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.amount, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : winCount > 0 ? Infinity : 0;

  const avgWin = winCount > 0
    ? winningTrades.reduce((sum, t) => sum + t.amount, 0) / winCount
    : 0;

  const avgLoss = lossCount > 0
    ? losingTrades.reduce((sum, t) => sum + t.amount, 0) / lossCount
    : 0;

  const netChange = accountBalance > 0 ? (totalPnL / accountBalance * 100) : 0;

  return {
    totalPnL,
    winRate,
    profitFactor,
    avgWin,
    avgLoss,
    netChange
  };
};
