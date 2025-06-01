import { format, eachDayOfInterval, startOfMonth, endOfMonth, isSameMonth } from 'date-fns';
import { Trade } from '../types/trade';

export type TimePeriod = 'month' | 'year' | 'all';

export interface ChartDataPoint {
  date: string;
  pnl: number;
  cumulativePnL: number;
  isIncreasing: boolean;
  isDecreasing: boolean;
  dailyChange: number;
  isWin: boolean;
  isLoss: boolean;
  isBreakEven: boolean;
  trades: Trade[];
  fullDate: Date;
}

export interface SessionStats {
  session: string;
  totalTrades: number;
  winners: number;
  losers: number;
  breakevens: number;
  winRate: number;
  totalPnL: number;
  averagePnL: number;
  pnlPercentage: number;
}

// Function to filter trades based on selected time period
export const getFilteredTrades = (trades: Trade[], selectedDate: Date, period: TimePeriod): Trade[] => {
  switch (period) {
    case 'month':
      return trades.filter(trade => isSameMonth(new Date(trade.date), selectedDate));
    case 'year':
      return trades.filter(trade => new Date(trade.date).getFullYear() === selectedDate.getFullYear());
    case 'all':
      return trades;
    default:
      return trades;
  }
};

// Calculate chart data for cumulative P&L
export const calculateChartData = (
  trades: Trade[], 
  selectedDate: Date, 
  timePeriod: TimePeriod
): ChartDataPoint[] => {
  const filteredTrades = getFilteredTrades(trades, selectedDate, timePeriod);

  // Get the date range for the selected period
  let startDate, endDate;
  if (timePeriod === 'month') {
    startDate = startOfMonth(selectedDate);
    endDate = endOfMonth(selectedDate);
  } else if (timePeriod === 'year') {
    startDate = new Date(selectedDate.getFullYear(), 0, 1);
    endDate = new Date(selectedDate.getFullYear(), 11, 31);
  } else {
    // For 'all', use the first and last trade dates
    if (filteredTrades.length === 0) {
      startDate = new Date();
      endDate = new Date();
    } else {
      const sortedTrades = [...filteredTrades].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      startDate = new Date(sortedTrades[0].date);
      endDate = new Date(sortedTrades[sortedTrades.length - 1].date);
    }
  }

  // Generate an array of all days in the period
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  // Calculate cumulative P&L for each day
  let cumulative = 0;
  let prevCumulative = 0;

  return days.map(day => {
    // Find trades for this day
    const dayTrades = filteredTrades.filter(trade =>
      format(new Date(trade.date), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
    );

    // Calculate daily P&L
    const dailyPnL = dayTrades.reduce((sum, trade) => sum + trade.amount, 0);

    // Update cumulative P&L
    prevCumulative = cumulative;
    cumulative += dailyPnL;

    return {
      date: format(day, timePeriod === 'month' ? 'MM/dd' : 'MM/dd/yyyy'),
      pnl: dailyPnL,
      cumulativePnL: cumulative,
      isIncreasing: cumulative > prevCumulative,
      isDecreasing: cumulative < prevCumulative,
      dailyChange: cumulative - prevCumulative,
      isWin: dailyPnL > 0,
      isLoss: dailyPnL < 0,
      isBreakEven: dailyPnL === 0,
      trades: dayTrades,
      fullDate: new Date(day)
    };
  });
};

// Calculate session performance statistics
export const calculateSessionStats = (
  trades: Trade[], 
  selectedDate: Date, 
  timePeriod: TimePeriod, 
  accountBalance: number
): SessionStats[] => {
  const filteredTrades = getFilteredTrades(trades, selectedDate, timePeriod).filter(trade => trade.session !== undefined);
  const sessions = ['Asia', 'London', 'NY AM', 'NY PM'];

  return sessions.map(sessionName => {
    const sessionTrades = filteredTrades.filter(trade => trade.session === sessionName);
    const totalTrades = sessionTrades.length;
    const winners = sessionTrades.filter(trade => trade.type === 'win').length;
    const losers = sessionTrades.filter(trade => trade.type === 'loss').length;
    const breakevens = sessionTrades.filter(trade => trade.type === 'breakeven').length;

    // Calculate win rate excluding breakevens from the denominator
    const totalTradesForWinRate = winners + losers;
    const winRate = totalTradesForWinRate > 0 ? (winners / totalTradesForWinRate) * 100 : 0;

    const totalPnL = sessionTrades.reduce((sum, trade) => sum + trade.amount, 0);
    const averagePnL = totalTrades > 0 ? totalPnL / totalTrades : 0;
    const pnlPercentage = accountBalance > 0 ? (totalPnL / accountBalance) * 100 : 0;

    return {
      session: sessionName,
      totalTrades,
      winners,
      losers,
      breakevens,
      winRate,
      totalPnL,
      averagePnL,
      pnlPercentage
    };
  });
};

// Calculate target value for monthly target
export const calculateTargetValue = (monthlyTarget: number | undefined, accountBalance: number): number | null => {
  if (monthlyTarget === undefined || accountBalance <= 0) return null;
  return (monthlyTarget / 100) * accountBalance;
};

// Calculate drawdown violation value
export const calculateDrawdownViolationValue = (maxDailyDrawdown: number, accountBalance: number): number => {
  return -(maxDailyDrawdown / 100) * accountBalance;
};
