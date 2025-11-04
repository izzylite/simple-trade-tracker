import React from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Paper
} from '@mui/material';
import {
  CalendarMonthOutlined,
  CheckCircle as CheckIcon,
  Timelapse
} from '@mui/icons-material';
import { format, startOfDay, startOfWeek, endOfWeek } from 'date-fns';
import { Trade, Calendar } from '../../types/dualWrite';

interface ProgressSectionProps {
  allTrades: Trade[];
  currentBalance: number;
  currentDate: Date; // The date to determine which week to show progress for
  calendar?: Calendar; // Calendar data to get targets from
}

const ProgressSection: React.FC<ProgressSectionProps> = ({
  allTrades,
  currentBalance,
  currentDate,
  calendar
}) => {
  // Extract targets from calendar
  const weeklyTargetPercentage = calendar?.weekly_target;
  const accountBalance = calendar?.account_balance || 0;

  // Don't render if no targets are set
  if (!weeklyTargetPercentage || !accountBalance) {
    return null;
  }

  // Get week boundaries for the current date
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 }); // Sunday
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 }); // Saturday

  // Filter trades to current week and exclude invalid dates
  const weekTrades = allTrades.filter(trade => {
    if (!trade.trade_date) return false;
    const tradeDate = new Date(trade.trade_date);
    if (isNaN(tradeDate.getTime())) return false;
    return tradeDate >= weekStart && tradeDate <= weekEnd;
  });

  // Calculate traded days (unique days with trades in current week)
  const tradedDaysCount = new Set(
    weekTrades.map(trade => format(startOfDay(new Date(trade.trade_date)), 'yyyy-MM-dd'))
  ).size;

  // Calculate total P&L for the week
  const totalPnL = weekTrades.reduce((sum, trade) => sum + trade.amount, 0);

  // Calculate account balance at start of week for dynamic risk
  const tradesBeforeWeek = allTrades.filter(trade => {
    if (!trade.trade_date) return false;
    const tradeDate = new Date(trade.trade_date);
    if (isNaN(tradeDate.getTime())) return false;
    return tradeDate < weekStart;
  });
  
  const baselineAccountValue = accountBalance + tradesBeforeWeek.reduce((sum, trade) => sum + trade.amount, 0);

  // Calculate target amount using baseline account value (accounts for dynamic risk)
  const profitTarget = baselineAccountValue > 0 ? (weeklyTargetPercentage / 100) * baselineAccountValue : 0;

  const tradedDaysTarget = 5; // Default to 5 trading days per week

  // Progress percentages
  const tradedDaysProgress = Math.min((tradedDaysCount / tradedDaysTarget) * 100, 100);
  const profitProgress = profitTarget > 0 ? Math.min((totalPnL / profitTarget) * 100, 100) : 0;
  const profitTargetReached = totalPnL >= profitTarget;
  const tradedDaysReached = tradedDaysCount >= tradedDaysTarget;

  // Display values capped at targets
  const displayedTradedDays = Math.min(tradedDaysCount, tradedDaysTarget);
  const displayedPnL = Math.min(totalPnL, profitTarget);

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        mb: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 1
      }}
    >
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        Progress
      </Typography>

      {/* Traded Days Progress */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          {tradedDaysReached ? (
            <CheckIcon sx={{ color: 'success.main', fontSize: 20 }} />
          ) : (
            <CalendarMonthOutlined  />
          )}
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Traded days
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={tradedDaysProgress}
          sx={{
            height: 8,
            borderRadius: 1,
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            '& .MuiLinearProgress-bar': {
              backgroundColor: tradedDaysReached ? 'success.main' : 'primary.main',
              borderRadius: 1
            }
          }}
        />
        <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 600 }}>
          {displayedTradedDays} / {tradedDaysTarget}
        </Typography>
      </Box>

      {/* Profit Target Progress */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          {profitTargetReached ? (
            <CheckIcon sx={{ color: 'success.main', fontSize: 20 }} />
          ) : (
             <Timelapse  />
          )}
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Reach your profit target of ${profitTarget.toLocaleString()}
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={profitProgress}
          sx={{
            height: 8,
            borderRadius: 1,
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            '& .MuiLinearProgress-bar': {
              backgroundColor: profitTargetReached ? 'success.main' : 'primary.main',
              borderRadius: 1
            }
          }}
        />
        <Typography
          variant="body1"
          sx={{
            mt: 0.5,
            fontWeight: 600,
            color: totalPnL >= 0 ? 'success.main' : 'error.main'
          }}
        >
          ${displayedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${profitTarget.toLocaleString()}
        </Typography>
      </Box>
    </Paper>
  );
};

export default ProgressSection;
