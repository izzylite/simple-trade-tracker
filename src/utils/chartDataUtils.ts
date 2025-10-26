import { format, eachDayOfInterval, startOfMonth, endOfMonth, isSameMonth, getDay, parseISO } from 'date-fns';
import { Trade } from '../types/dualWrite';
import { Theme } from '@mui/material';

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
  total_trades: number;
  winners: number;
  losers: number;
  breakevens: number;
  win_rate: number;
  total_pnl: number;
  average_pnl: number;
  pnl_percentage: number;
}

// Function to filter trades based on selected time period
export const getFilteredTrades = (trades: Trade[], selectedDate: Date, period: TimePeriod): Trade[] => {
  switch (period) {
    case 'month':
      return trades.filter(trade => isSameMonth(new Date(trade.trade_date), selectedDate));
    case 'year':
      return trades.filter(trade => new Date(trade.trade_date).getFullYear() === selectedDate.getFullYear());
    case 'all':
      return trades;
    default:
      return trades;
  }
};
export const getTradesStats = (trades: Trade[]) => {

  // Create a map to store stats for each tag
  const stats = { wins: 0, losses: 0, breakevens: 0, total_pnl: 0 };
  trades.forEach(trade => {
    if (trade.trade_type === 'win') {
      stats.wins++;
    } else if (trade.trade_type === 'loss') {
      stats.losses++;
    } else if (trade.trade_type === 'breakeven') {
      stats.breakevens++;
    }
    stats.total_pnl += trade.amount;
  });

  // Calculate win rate excluding breakevens from the denominator
  const totalTradesForWinRate = stats.wins + stats.losses;
  const winRate = totalTradesForWinRate > 0 ? Math.round((stats.wins / totalTradesForWinRate) * 100) : 0;
  const totalTrades = stats.wins + stats.losses + stats.breakevens;

  return {
    trades,
    wins: stats.wins,
    losses: stats.losses,
    breakevens: stats.breakevens,
    totalTrades,
    winRate,
    total_pnl: stats.total_pnl
  };

}


export const getTagDayOfWeekChartData = (
trades: Trade[],  theme: Theme, winRateMetric : boolean = true) => {
  // Day of week names
  const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  

  // Group trades by day of week
  const tradesByDay = DAYS_OF_WEEK.map((day, index) => {
    // Get trades for this day of week
    const dayTrades = trades.filter(trade => {
      const tradeDate = new Date(trade.trade_date);
      return getDay(tradeDate) === index;
    });

    // Calculate statistics
    const totalTrades = dayTrades.length;
    const winTrades = dayTrades.filter(trade => trade.trade_type === 'win').length;
    const lossTrades = dayTrades.filter(trade => trade.trade_type === 'loss').length;
    const winRate = totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0;
    const totalPnL = dayTrades.reduce((sum, trade) => sum + trade.amount, 0);

    return {
      day,
      dayIndex: index,
      totalTrades,
      winTrades,
      lossTrades,
      winRate,
      pnl: totalPnL,
      trades: dayTrades
    };
  });
   // Define colors - memoized to prevent unnecessary re-renders
    const COLORS = { 
      neutral: theme.palette.grey[500],
      sunday: '#FF6384',
      monday: '#36A2EB',
      tuesday: '#FFCE56',
      wednesday: '#4BC0C0',
      thursday: '#9966FF',
      friday: '#FF9F40',
      saturday: '#C9CBCF'
    };

  return tradesByDay.map(dayData => ({
      day: dayData.day.substring(0, 3), // Abbreviate day names
      fullDay: dayData.day, 
      total_trades: dayData.totalTrades,
      win_trades: dayData.winTrades,
      loss_trades: dayData.lossTrades,
      value: winRateMetric? dayData.winRate : dayData.pnl,
      win_rate: dayData.winRate,
      pnl: dayData.pnl,
      trades: dayData.trades,
      color: COLORS[dayData.day.toLowerCase() as keyof typeof COLORS] || COLORS.neutral
    }));
 
};


// Calculate chart data for cumulative P&L - async to prevent UI blocking
export const calculateChartData = async (
  trades: Trade[],
  selectedDate: Date,
  timePeriod: TimePeriod
): Promise<ChartDataPoint[]> => {
  const filteredTrades = getFilteredTrades(trades, selectedDate, timePeriod);

  // Yield control to prevent UI blocking
  await new Promise(resolve => setTimeout(resolve, 0));

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
        new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()
      );
      startDate = new Date(sortedTrades[0].trade_date);
      endDate = new Date(sortedTrades[sortedTrades.length - 1].trade_date);
    }
  }

  // Generate an array of all days in the period
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  // Calculate cumulative P&L for each day
  let cumulative = 0;
  let prevCumulative = 0;

  // Process in chunks to prevent blocking for large datasets
  const chunkSize = 100;
  const result: ChartDataPoint[] = [];

  for (let i = 0; i < days.length; i += chunkSize) {
    const chunk = days.slice(i, i + chunkSize);

    // Process each day in the chunk sequentially to avoid unsafe references
    const chunkResult: ChartDataPoint[] = [];
    for (const day of chunk) {
      // Find trades for this day
      const dayTrades = filteredTrades.filter(trade =>
        format(new Date(trade.trade_date), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
      );

      // Calculate daily P&L
      const dailyPnL = dayTrades.reduce((sum, trade) => sum + trade.amount, 0);

      // Update cumulative P&L
      prevCumulative = cumulative;
      cumulative += dailyPnL;

      chunkResult.push({
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
      });
    }

    result.push(...chunkResult);

    // Yield control after each chunk
    if (i + chunkSize < days.length) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  return result;
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
    const winners = sessionTrades.filter(trade => trade.trade_type === 'win').length;
    const losers = sessionTrades.filter(trade => trade.trade_type === 'loss').length;
    const breakevens = sessionTrades.filter(trade => trade.trade_type === 'breakeven').length;

    // Calculate win rate excluding breakevens from the denominator
    const totalTradesForWinRate = winners + losers;
    const winRate = totalTradesForWinRate > 0 ? (winners / totalTradesForWinRate) * 100 : 0;

    const totalPnL = sessionTrades.reduce((sum, trade) => sum + trade.amount, 0);
    const averagePnL = totalTrades > 0 ? totalPnL / totalTrades : 0;
    const pnlPercentage = accountBalance > 0 ? (totalPnL / accountBalance) * 100 : 0;

    return {
      session: sessionName,
      total_trades: totalTrades,
      winners,
      losers,
      breakevens,
      win_rate: winRate,
      total_pnl: totalPnL,
      average_pnl: averagePnL,
      pnl_percentage: pnlPercentage
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

// Async performance calculation functions to prevent UI blocking

// Calculate win/loss statistics asynchronously
export const calculateWinLossStatsAsync = async (
  filteredTrades: Trade[]
): Promise<{
  total_trades: number;
  win_rate: number;
  winners: {
    total: number;
    avgAmount: number;
    maxConsecutive: number;
    avgConsecutive: number;
  };
  losers: {
    total: number;
    avgAmount: number;
    maxConsecutive: number;
    avgConsecutive: number;
  };
  breakevens: {
    total: number;
    avgAmount: number;
  };
}> => {
  // Yield control to prevent UI blocking
  await new Promise(resolve => setTimeout(resolve, 0));

  const wins = filteredTrades.filter(trade => trade.trade_type === 'win');
  const losses = filteredTrades.filter(trade => trade.trade_type === 'loss');
  const breakevens = filteredTrades.filter(trade => trade.trade_type === 'breakeven');

  const totalWins = wins.length;
  const totalLosses = losses.length;
  const totalBreakevens = breakevens.length;
  const totalTrades = totalWins + totalLosses + totalBreakevens;

  // Calculate win rate excluding breakevens from the denominator
  const winRateDenominator = totalWins + totalLosses;
  const winRate = winRateDenominator > 0 ? (totalWins / winRateDenominator) * 100 : 0;

  const totalWinAmount = wins.reduce((sum, trade) => sum + trade.amount, 0);
  const totalLossAmount = losses.reduce((sum, trade) => sum + trade.amount, 0);
  const totalBreakevenAmount = breakevens.reduce((sum, trade) => sum + trade.amount, 0);

  const avgWin = totalWins > 0 ? totalWinAmount / totalWins : 0;
  const avgLoss = totalLosses > 0 ? totalLossAmount / totalLosses : 0;
  const avgBreakeven = totalBreakevens > 0 ? totalBreakevenAmount / totalBreakevens : 0;

  // Yield control before calculating streaks
  await new Promise(resolve => setTimeout(resolve, 0));

  // Calculate consecutive wins and losses
  let currentWinStreak = 0;
  let maxWinStreak = 0;
  let totalWinStreaks = 0;
  let winStreakCount = 0;

  let currentLossStreak = 0;
  let maxLossStreak = 0;
  let totalLossStreaks = 0;
  let lossStreakCount = 0;

  // Sort trades by date
  const sortedTrades = [...filteredTrades].sort((a, b) =>
    new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()
  );

  sortedTrades.forEach(trade => {
    if (trade.trade_type === 'win') {
      currentWinStreak++;
      currentLossStreak = 0;

      if (currentWinStreak > maxWinStreak) {
        maxWinStreak = currentWinStreak;
      }
    } else if (trade.trade_type === 'loss') {
      if (currentWinStreak > 0) {
        totalWinStreaks += currentWinStreak;
        winStreakCount++;
      }
      currentWinStreak = 0;
      currentLossStreak++;

      if (currentLossStreak > maxLossStreak) {
        maxLossStreak = currentLossStreak;
      }
    } else if (trade.trade_type === 'breakeven') {
      // For breakeven trades, we don't reset the streaks
      // This allows a breakeven trade to maintain an existing streak
    }
  });

  // Handle the last streak
  if (currentWinStreak > 0) {
    totalWinStreaks += currentWinStreak;
    winStreakCount++;
  } else if (currentLossStreak > 0) {
    totalLossStreaks += currentLossStreak;
    lossStreakCount++;
  }

  const avgWinStreak = winStreakCount > 0 ? totalWinStreaks / winStreakCount : 0;
  const avgLossStreak = lossStreakCount > 0 ? totalLossStreaks / lossStreakCount : 0;

  return {
    total_trades: totalTrades,
    win_rate: winRate,
    winners: {
      total: totalWins,
      avgAmount: avgWin,
      maxConsecutive: maxWinStreak,
      avgConsecutive: avgWinStreak
    },
    losers: {
      total: totalLosses,
      avgAmount: avgLoss,
      maxConsecutive: maxLossStreak,
      avgConsecutive: avgLossStreak
    },
    breakevens: {
      total: totalBreakevens,
      avgAmount: avgBreakeven
    }
  };
};

// Calculate tag statistics asynchronously
export const calculateTagStatsAsync = async (
  filteredTrades: Trade[]
): Promise<Array<{
  tag: string;
  wins: number;
  losses: number;
  breakevens: number;
  total_trades: number;
  win_rate: number;
  total_pnl: number;
}>> => {
  // Yield control to prevent UI blocking
  await new Promise(resolve => setTimeout(resolve, 0));

  // Create a map to store stats for each tag
  const tagMap = new Map<string, { wins: number; losses: number; breakevens: number; total_pnl: number }>();

  filteredTrades.forEach(trade => {
    if (trade.tags) {
      trade.tags.forEach(tag => {
        const stats = tagMap.get(tag) || { wins: 0, losses: 0, breakevens: 0, total_pnl: 0 };
        if (trade.trade_type === 'win') {
          stats.wins++;
        } else if (trade.trade_type === 'loss') {
          stats.losses++;
        } else if (trade.trade_type === 'breakeven') {
          stats.breakevens++;
        }
        stats.total_pnl += trade.amount;
        tagMap.set(tag, stats);
      });
    }
  });

  // Yield control before processing results
  await new Promise(resolve => setTimeout(resolve, 0));

  // Convert map to array and calculate win rates
  return Array.from(tagMap.entries()).map(([tag, stats]) => {
    // Calculate win rate excluding breakevens from the denominator
    const totalTradesForWinRate = stats.wins + stats.losses;
    const winRate = totalTradesForWinRate > 0 ? Math.round((stats.wins / totalTradesForWinRate) * 100) : 0;
    const totalTrades = stats.wins + stats.losses + stats.breakevens;

    return {
      tag,
      wins: stats.wins,
      losses: stats.losses,
      breakevens: stats.breakevens,
      total_trades: totalTrades,
      win_rate: winRate,
      total_pnl: stats.total_pnl
    };
  }).sort((a, b) => b.total_trades - a.total_trades); // Sort by total trades descending
};

// Calculate daily summary data asynchronously
export const calculateDailySummaryDataAsync = async (
  filteredTrades: Trade[]
): Promise<Array<{
  date: Date;
  trades: number;
  session: string;
  pnl: number;
}>> => {
  // Yield control to prevent UI blocking
  await new Promise(resolve => setTimeout(resolve, 0));

  // Group trades by date
  const tradesByDate = filteredTrades.reduce((acc, trade) => {
    const dateKey = format(new Date(trade.trade_date), 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(trade);
    return acc;
  }, {} as { [key: string]: Trade[] });

  // Yield control before processing daily stats
  await new Promise(resolve => setTimeout(resolve, 0));

  // Calculate daily statistics
  return Object.entries(tradesByDate)
    .map(([date, dayTrades]) => {
      const totalPnL = dayTrades.reduce((sum, trade) => sum + trade.amount, 0);

      // Get the most common session for the day
      const sessionCounts = dayTrades.reduce((acc, trade) => {
        if (trade.session) {
          acc[trade.session] = (acc[trade.session] || 0) + 1;
        }
        return acc;
      }, {} as { [key: string]: number });

      // Find the session with the highest count
      let mostCommonSession = '';
      let highestCount = 0;

      Object.entries(sessionCounts).forEach(([session, count]) => {
        if (count > highestCount) {
          mostCommonSession = session;
          highestCount = count;
        }
      });

      return {
        date: parseISO(date),
        trades: dayTrades.length,
        session: mostCommonSession,
        pnl: totalPnL
      };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime()); // Sort by date descending
};

// Calculate risk to reward statistics asynchronously
export const calculateRiskRewardStatsAsync = async (
  filteredTrades: Trade[],
  timePeriod: TimePeriod
): Promise<{ average: number; max: number; data: Array<{ date: string; rr: number }> }> => {
  // Yield control to prevent UI blocking
  await new Promise(resolve => setTimeout(resolve, 0));

  const filteredTrades_ = filteredTrades.filter(trade => trade.risk_to_reward !== undefined)
    .sort((a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime());

  if (filteredTrades_.length === 0) return { average: 0, max: 0, data: [] };

  const riskRewardValues = filteredTrades_.map(trade => trade.risk_to_reward!);
  const average = riskRewardValues.reduce((sum, value) => sum + value, 0) / riskRewardValues.length;
  const max = Math.max(...riskRewardValues);

  // Yield control before creating data points
  await new Promise(resolve => setTimeout(resolve, 0));

  // Create data points for the line graph
  const data = filteredTrades_.map(trade => ({
    date: format(new Date(trade.trade_date), timePeriod === 'month' ? 'MM/dd' : 'MM/dd/yyyy'),
    rr: trade.risk_to_reward || 0
  }));

  return { average, max, data };
};

// Calculate session statistics asynchronously
export const calculateSessionStatsAsync = async (
  filteredTrades: Trade[],
  accountBalance: number
): Promise<SessionStats[]> => {
  // Yield control to prevent UI blocking
  await new Promise(resolve => setTimeout(resolve, 0));

  const filteredTrades_ = filteredTrades.filter(trade => trade.session !== undefined);
  const sessions = ['Asia', 'London', 'NY AM', 'NY PM'];

  return sessions.map(sessionName => {
    const sessionTrades = filteredTrades_.filter(trade => trade.session === sessionName);
    const totalTrades = sessionTrades.length;
    const winners = sessionTrades.filter(trade => trade.trade_type === 'win').length;
    const losers = sessionTrades.filter(trade => trade.trade_type === 'loss').length;
    const breakevens = sessionTrades.filter(trade => trade.trade_type === 'breakeven').length;

    // Calculate win rate excluding breakevens from the denominator
    const totalTradesForWinRate = winners + losers;
    const winRate = totalTradesForWinRate > 0 ? (winners / totalTradesForWinRate) * 100 : 0;

    const totalPnL = sessionTrades.reduce((sum, trade) => sum + trade.amount, 0);
    const averagePnL = totalTrades > 0 ? totalPnL / totalTrades : 0;
    const pnlPercentage = accountBalance > 0 ? (totalPnL / accountBalance) * 100 : 0;

    return {
      session: sessionName,
      total_trades: totalTrades,
      winners,
      losers,
      breakevens,
      win_rate: winRate,
      total_pnl: totalPnL,
      average_pnl: averagePnL,
      pnl_percentage: pnlPercentage
    };
  });
};

// Calculate comparison win/loss data asynchronously
export const calculateComparisonWinLossDataAsync = async (
  filteredTrades: Trade[],
  comparisonTags: string[]
): Promise<Array<{ name: string; value: number }> | null> => {
  if (comparisonTags.length === 0) return null;

  // Yield control to prevent UI blocking
  await new Promise(resolve => setTimeout(resolve, 0));

  const filteredTrades_ = filteredTrades
    .filter(trade => {
      if (!trade.tags) return false;
      return comparisonTags.some(tag => trade.tags!.includes(tag));
    });

  const wins = filteredTrades_.filter(trade => trade.trade_type === 'win');
  const losses = filteredTrades_.filter(trade => trade.trade_type === 'loss');
  const breakevens = filteredTrades_.filter(trade => trade.trade_type === 'breakeven');

  return [
    { name: 'Wins', value: wins.length },
    { name: 'Losses', value: losses.length },
    { name: 'Breakeven', value: breakevens.length }
  ].filter(item => item.value > 0); // Only include categories with values > 0
};

// Calculate all unique tags asynchronously
export const calculateAllTagsAsync = async (trades: Trade[]): Promise<string[]> => {
  // Yield control to prevent UI blocking
  await new Promise(resolve => setTimeout(resolve, 0));

  const tags = new Set<string>();
  trades.forEach(trade => {
    if (trade.tags) {
      trade.tags.forEach(tag => tags.add(tag));
    }
  });
  return Array.from(tags).sort();
};
