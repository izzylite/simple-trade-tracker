import { Trade } from '../types/dualWrite';
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
 * @returns Win rate percentage (excludes breakeven trades from calculation)
 */
export const calculateWinRate = (trades: Trade[]): number => {
  if (trades.length === 0) return 0;

  const winCount = trades.filter(trade => trade.trade_type === 'win').length;
  const lossCount = trades.filter(trade => trade.trade_type === 'loss').length;
  const totalWinLossTrades = winCount + lossCount;

  // If no wins or losses, return 0
  if (totalWinLossTrades === 0) return 0;

  return (winCount / totalWinLossTrades) * 100;
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
    .filter(trade => trade.amount < 0 || trade.trade_type === 'loss')
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
  max_drawdown: number;
  drawdown_start_date?: Date;
  drawdown_end_date?: Date;
  drawdown_recovery_needed: number;
  drawdown_duration: number;
} => {
  if (trades.length === 0) {
    return {
      max_drawdown: 0,
      drawdown_recovery_needed: 0,
      drawdown_duration: 0
    };
  }

  // Sort trades by date
  const sortedTrades = [...trades].sort((a, b) =>
    new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()
  );

  let balance = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let drawdown_start_date: Date | undefined;
  let drawdown_end_date: Date | undefined;
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
        drawdown_start_date = currentDrawdownStartDate || trade.trade_date;
        drawdown_end_date = trade.trade_date;

        // Calculate drawdown duration (number of trades)
        if (drawdown_start_date && drawdown_end_date) {
          const startIndex = sortedTrades.findIndex(t => t.trade_date === drawdown_start_date);
          const endIndex = sortedTrades.findIndex(t => t.trade_date === drawdown_end_date);
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
        currentDrawdownStartDate = trade.trade_date;
      }
    }
  });

  // Calculate recovery needed
  const drawdownRecoveryNeeded = maxDrawdown > 0
    ? (maxDrawdown / (100 - maxDrawdown)) * 100
    : 0;

  return {
    max_drawdown: maxDrawdown,
    drawdown_start_date,
    drawdown_end_date,
    drawdown_recovery_needed: drawdownRecoveryNeeded,
    drawdown_duration: drawdownDuration
  };
};


/**
 * Calculate target progress for a set of trades
 * @param trades Array of trades
 * @param accountBalance Initial account balance
 * @param target Target percentage
 * @param startDate Optional start date to calculate account value at start of period
 * @param allTrades Optional all trades array for calculating account value at start date
 * @returns Target progress percentage (capped at 100%)
 */
export const calculateTargetProgress = (
  trades: Trade[],
  accountBalance: number,
  target: number,
  startDate?: Date,
  allTrades?: Trade[]
): number => {
  if (!target || target <= 0 || !accountBalance) return 0;

  const totalPnL = calculateTotalPnL(trades);

  // Calculate account value at start of period if startDate and allTrades are provided
  let baselineAccountValue = accountBalance;
  if (startDate && allTrades) {
    const tradesBeforePeriod = allTrades.filter(trade => new Date(trade.trade_date) < startDate);
    baselineAccountValue = accountBalance + tradesBeforePeriod.reduce((sum, trade) => sum + trade.amount, 0);
  }

  if (baselineAccountValue <= 0) return 0;

  const targetAmount = (target / 100) * baselineAccountValue;

  // Cap progress at 100% to prevent overflow in UI components
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
    const tradeDate = new Date(trade.trade_date);
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
    const tradeDate = new Date(trade.trade_date);
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
    const tradeDate = new Date(trade.trade_date);
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
    const tradeDate = new Date(trade.trade_date);
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
    const tradeDate = new Date(trade.trade_date);
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
  avg_win: number;
  avg_loss: number;
} => {
  const winTrades = trades.filter(trade => trade.trade_type === 'win');
  const lossTrades = trades.filter(trade => trade.trade_type === 'loss');

  const avgWin = winTrades.length
    ? winTrades.reduce((sum, trade) => sum + trade.amount, 0) / winTrades.length
    : 0;

  const avgLoss = lossTrades.length
    ? Math.abs(lossTrades.reduce((sum, trade) => sum + trade.amount, 0)) / lossTrades.length
    : 0;

  return { avg_win: avgWin, avg_loss: avgLoss };
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
    status = netAmount > 0 ? 'win' : netAmount < 0 ? 'loss' : dayTrades.find(trade => trade.trade_type === 'breakeven') ? 'breakeven' : 'neutral';
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

 