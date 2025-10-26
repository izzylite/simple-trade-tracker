import React, { useMemo, useState } from 'react';
import { Box, Typography, Paper, IconButton, Tooltip } from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import {
  startOfWeek,
  endOfWeek,
  isSameWeek,
  format,
  eachDayOfInterval,
  isSameDay,
  addWeeks,
  subWeeks,
  startOfMonth,
  endOfMonth,
  eachWeekOfInterval,
  isSameMonth
} from 'date-fns';
import { Trade } from '../types/dualWrite';
import WinLossStats from './charts/WinLossStats';
import RiskRewardChart from './charts/RiskRewardChart';
import CumulativePnLChart from './charts/CumulativePnLChart';
import SessionPerformanceAnalysis from './charts/SessionPerformanceAnalysis';

interface WeeklyStatsSectionProps {
  trades: Trade[];
  currentDate: Date;
  accountBalance: number;
  maxDailyDrawdown: number;
}

const WeeklyStatsSection: React.FC<WeeklyStatsSectionProps> = ({
  trades,
  currentDate,
  accountBalance,
  maxDailyDrawdown
}) => {
  // State for selected week (defaults to current week)
  const [selectedWeekDate, setSelectedWeekDate] = useState(() => {
    // Find the current week within the current month
    const currentWeekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    return currentWeekStart;
  });

  // Get all weeks in the current month
  const monthWeeks = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);

    return eachWeekOfInterval(
      { start: monthStart, end: monthEnd },
      { weekStartsOn: 0 }
    );
  }, [currentDate]);

  // Update selected week when current date changes (month navigation)
  React.useEffect(() => {
    const currentWeekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    // Check if current week is in the current month, otherwise select first week of month
    const isCurrentWeekInMonth = monthWeeks.some(week =>
      isSameWeek(week, currentWeekStart, { weekStartsOn: 0 })
    );

    if (isCurrentWeekInMonth) {
      setSelectedWeekDate(currentWeekStart);
    } else {
      setSelectedWeekDate(monthWeeks[0] || currentWeekStart);
    }
  }, [currentDate, monthWeeks]);

  // Get selected week's trades
  const weeklyTrades = useMemo(() => {
    return trades.filter(trade => {
      const tradeDate = new Date(trade.trade_date);
      return isSameWeek(tradeDate, selectedWeekDate, { weekStartsOn: 0 }) &&
             isSameMonth(tradeDate, currentDate); // Ensure trades are from current month
    });
  }, [trades, selectedWeekDate, currentDate]);

  // Navigation functions
  const handlePrevWeek = () => {
    const prevWeek = subWeeks(selectedWeekDate, 1);
    // Only navigate if the previous week is within the current month
    if (monthWeeks.some(week => isSameWeek(week, prevWeek, { weekStartsOn: 0 }))) {
      setSelectedWeekDate(prevWeek);
    }
  };

  const handleNextWeek = () => {
    const nextWeek = addWeeks(selectedWeekDate, 1);
    // Only navigate if the next week is within the current month
    if (monthWeeks.some(week => isSameWeek(week, nextWeek, { weekStartsOn: 0 }))) {
      setSelectedWeekDate(nextWeek);
    }
  };

  // Check if navigation buttons should be disabled
  const canGoPrevWeek = useMemo(() => {
    const prevWeek = subWeeks(selectedWeekDate, 1);
    return monthWeeks.some(week => isSameWeek(week, prevWeek, { weekStartsOn: 0 }));
  }, [selectedWeekDate, monthWeeks]);

  const canGoNextWeek = useMemo(() => {
    const nextWeek = addWeeks(selectedWeekDate, 1);
    return monthWeeks.some(week => isSameWeek(week, nextWeek, { weekStartsOn: 0 }));
  }, [selectedWeekDate, monthWeeks]);

  // Get week number within the month
  const weekNumber = useMemo(() => {
    return monthWeeks.findIndex(week =>
      isSameWeek(week, selectedWeekDate, { weekStartsOn: 0 })
    ) + 1;
  }, [selectedWeekDate, monthWeeks]);

  // Calculate win/loss statistics for the week
  const weeklyWinLossStats = useMemo(() => {
    const wins = weeklyTrades.filter(trade => trade.trade_type === 'win');
    const losses = weeklyTrades.filter(trade => trade.trade_type === 'loss');
    const breakevens = weeklyTrades.filter(trade => trade.trade_type === 'breakeven');

    const totalWins = wins.length;
    const totalLosses = losses.length;
    const totalBreakevens = breakevens.length;
    const totalTrades = totalWins + totalLosses + totalBreakevens;

    // Calculate win rate excluding breakevens from the denominator
    const winRateDenominator = totalWins + totalLosses;
    const winRate = winRateDenominator > 0 ? (totalWins / winRateDenominator) * 100 : 0;

    const avgWin = totalWins > 0 ? wins.reduce((sum, trade) => sum + trade.amount, 0) / totalWins : 0;
    const avgLoss = totalLosses > 0 ? losses.reduce((sum, trade) => sum + Math.abs(trade.amount), 0) / totalLosses : 0;
    const avgBreakeven = totalBreakevens > 0 ? breakevens.reduce((sum, trade) => sum + trade.amount, 0) / totalBreakevens : 0;

    // Calculate consecutive streaks
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    let currentWinStreak = 0;
    let currentLossStreak = 0;
    let totalWinStreaks = 0;
    let totalLossStreaks = 0;
    let winStreakCount = 0;
    let lossStreakCount = 0;

    // Sort trades by date for streak calculation
    const sortedTrades = [...weeklyTrades].sort((a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime());

    sortedTrades.forEach(trade => {
      if (trade.trade_type === 'win') {
        currentWinStreak++;
        if (currentLossStreak > 0) {
          totalLossStreaks += currentLossStreak;
          lossStreakCount++;
          maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
          currentLossStreak = 0;
        }
      } else if (trade.trade_type === 'loss') {
        currentLossStreak++;
        if (currentWinStreak > 0) {
          totalWinStreaks += currentWinStreak;
          winStreakCount++;
          maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
          currentWinStreak = 0;
        }
      }
    });

    // Handle the last streak
    if (currentWinStreak > 0) {
      totalWinStreaks += currentWinStreak;
      winStreakCount++;
      maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
    } else if (currentLossStreak > 0) {
      totalLossStreaks += currentLossStreak;
      lossStreakCount++;
      maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
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
  }, [weeklyTrades]);

  // Calculate risk/reward statistics for the week
  const weeklyRiskRewardStats = useMemo(() => {
    const tradesWithRR = weeklyTrades.filter(trade => trade.risk_to_reward && trade.risk_to_reward > 0);
    
    if (tradesWithRR.length === 0) return { average: 0, max: 0, data: [] };

    const riskRewardValues = tradesWithRR.map(trade => trade.risk_to_reward!);
    const average = riskRewardValues.reduce((sum, value) => sum + value, 0) / riskRewardValues.length;
    const max = Math.max(...riskRewardValues);

    // Create data points for the line graph
    const data = tradesWithRR.map(trade => ({
      date: format(new Date(trade.trade_date), 'MM/dd'),
      rr: trade.risk_to_reward || 0
    }));

    return { average, max, data };
  }, [weeklyTrades]);

  // Calculate cumulative P&L chart data for the week
  const weeklyCumulativeData = useMemo(() => {
    const weekStart = startOfWeek(selectedWeekDate, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(selectedWeekDate, { weekStartsOn: 0 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

    let cumulativePnL = 0;

    return weekDays.map(day => {
      const dayTrades = weeklyTrades.filter(trade => isSameDay(new Date(trade.trade_date), day));
      const dailyPnL = dayTrades.reduce((sum, trade) => sum + trade.amount, 0);
      cumulativePnL += dailyPnL;

      return {
        date: format(day, 'EEE'),
        fullDate: day,
        pnl: dailyPnL,
        cumulativePnL,
        dailyChange: dailyPnL,
        trades: dayTrades
      };
    });
  }, [weeklyTrades, selectedWeekDate]);

  // Calculate session performance for the week
  const weeklySessionStats = useMemo(() => {
    const sessions = ['Asia', 'London', 'NY AM', 'NY PM'];
    
    return sessions.map(sessionName => {
      const sessionTrades = weeklyTrades.filter(trade => trade.session === sessionName);
      const totalTrades = sessionTrades.length;
      const winners = sessionTrades.filter(trade => trade.trade_type === 'win').length;
      const losers = sessionTrades.filter(trade => trade.trade_type === 'loss').length;
      const breakevens = sessionTrades.filter(trade => trade.trade_type === 'breakeven').length;
      
      // Calculate win rate excluding breakevens from the denominator
      const winRateDenominator = winners + losers;
      const winRate = winRateDenominator > 0 ? (winners / winRateDenominator) * 100 : 0;
      
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
  }, [weeklyTrades, accountBalance]);

  // Don't render if no trades for the week
  if (weeklyTrades.length === 0) {
    return (
      <Box sx={{ mt: 3, mb: 3 }}>
        <Paper sx={{ p: 3, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ color: 'text.primary' }}>
              Week {weekNumber} Statistics
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip title="Previous week">
                <span>
                  <IconButton
                    onClick={handlePrevWeek}
                    disabled={!canGoPrevWeek}
                    size="small"
                  >
                    <ChevronLeft />
                  </IconButton>
                </span>
              </Tooltip>
              <Typography variant="body2" sx={{ minWidth: '120px', textAlign: 'center', color: 'text.secondary' }}>
                {format(startOfWeek(selectedWeekDate, { weekStartsOn: 0 }), 'MMM d')} - {format(endOfWeek(selectedWeekDate, { weekStartsOn: 0 }), 'MMM d')}
              </Typography>
              <Tooltip title="Next week">
                <span>
                  <IconButton
                    onClick={handleNextWeek}
                    disabled={!canGoNextWeek}
                    size="small"
                  >
                    <ChevronRight />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No trades found for this week. Add some trades to see weekly statistics.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 3, mb: 3 }}>
      <Paper sx={{ p: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ color: 'text.primary' }}>
            Week {weekNumber} Statistics
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Previous week">
              <span>
                <IconButton
                  onClick={handlePrevWeek}
                  disabled={!canGoPrevWeek}
                  size="small"
                >
                  <ChevronLeft />
                </IconButton>
              </span>
            </Tooltip>
            <Typography variant="body2" sx={{ minWidth: '120px', textAlign: 'center', color: 'text.secondary' }}>
              {format(startOfWeek(selectedWeekDate, { weekStartsOn: 0 }), 'MMM d')} - {format(endOfWeek(selectedWeekDate, { weekStartsOn: 0 }), 'MMM d')}
            </Typography>
            <Tooltip title="Next week">
              <span>
                <IconButton
                  onClick={handleNextWeek}
                  disabled={!canGoNextWeek}
                  size="small"
                >
                  <ChevronRight />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Win/Loss Stats */}
          <WinLossStats
            winLossStats={weeklyWinLossStats}
            trades={weeklyTrades}
          />

          {/* Risk/Reward Chart */}
          {weeklyRiskRewardStats.data.length > 0 && (
            <RiskRewardChart riskRewardStats={weeklyRiskRewardStats} />
          )}

          {/* Cumulative P&L Chart */}
          <CumulativePnLChart
            chartData={weeklyCumulativeData}
            targetValue={null}
            setMultipleTradesDialog={() => {}} // No dialog for weekly stats
            timePeriod="month"
          />

         
        </Box>
      </Paper>
    </Box>
  );
};

export default WeeklyStatsSection;
