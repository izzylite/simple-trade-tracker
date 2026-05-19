import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  useTheme,
} from '@mui/material';
import {
  CalendarMonthOutlined,
  CheckCircle as CheckIcon,
  Timelapse,
  TipsAndUpdates,
  TrendingUp,
} from '@mui/icons-material';
import { format, startOfDay, startOfWeek, endOfWeek } from 'date-fns';
import { Trade, Calendar } from '../../types/dualWrite';
import { TradeRepository } from 'services/repositories/TradeRepository';
import { calculateCumulativePnLToDateAsync } from '../../utils/dynamicRiskUtils';
import { logger } from 'utils/logger';
import { EYEBROW_SX, TNUM, MONO_FONT } from 'styles/designTokens';
import CardShell from 'components/common/CardShell';
import CompareBar from 'components/common/CompareBar';
import InfoStrip from 'components/common/InfoStrip';
import { formatCurrency } from 'utils/formatters';

interface ProgressSectionProps {
  calendarId: string;
  currentBalance: number;
  currentDate: Date; // The date to determine which week to show progress for
  calendar: Calendar; // Calendar data to get targets from
  weekTrades?: Trade[]; // Optional pre-fetched trades for the week (avoids redundant DB query)
}

interface MotivationalTip {
  message: string;
  subMessage: string;
  trades?: { r2: number; r1: number };
}

/**
 * Generate a motivational tip based on remaining amount and risk per trade
 */
const generateMotivationalTip = (
  remainingAmount: number,
  riskPerTrade: number,
  totalPnL: number,
  profitTarget: number
): MotivationalTip | null => {
  if (remainingAmount <= 0) {
    return {
      message: "You've hit your target!",
      subMessage: "Outstanding work! Consider locking in your gains or pushing further."
    };
  }

  if (!riskPerTrade || riskPerTrade <= 0) {
    const progressPercent = profitTarget > 0 ? Math.round((totalPnL / profitTarget) * 100) : 0;
    if (progressPercent >= 75) {
      return {
        message: "Almost there!",
        subMessage: "You're so close to your target. Stay focused and trust your process."
      };
    }
    if (progressPercent >= 50) {
      return {
        message: "Halfway there!",
        subMessage: "Great progress! Keep executing your strategy with discipline."
      };
    }
    return {
      message: "Focus on the process",
      subMessage: "Take it one trade at a time. Quality setups lead to consistent results."
    };
  }

  const rMultiplesNeeded = remainingAmount / riskPerTrade;
  const combinations = [
    { r2: 1, r1: 0, total: 2 },
    { r2: 0, r1: 2, total: 2 },
    { r2: 1, r1: 1, total: 3 },
    { r2: 2, r1: 0, total: 4 },
    { r2: 0, r1: 3, total: 3 },
    { r2: 1, r1: 2, total: 4 },
    { r2: 2, r1: 1, total: 5 },
    { r2: 0, r1: 4, total: 4 },
    { r2: 3, r1: 0, total: 6 },
  ];

  const validCombination = combinations.find(
    combo => (combo.r2 * 2 + combo.r1 * 1) >= rMultiplesNeeded
  );

  if (validCombination) {
    const { r2, r1 } = validCombination;
    const totalTrades = r2 + r1;

    const encouragements = [
      "No pressure, you've got this!",
      "Stay patient and wait for your setup.",
      "Trust your process!",
      "One quality trade at a time.",
      "You're closer than you think!",
      "Focus on execution, not the outcome."
    ];

    const randomEncouragement = encouragements[Math.floor(Math.random() * encouragements.length)];

    return {
      message: `You need at least ${totalTrades} trade${totalTrades > 1 ? 's' : ''}`,
      subMessage: randomEncouragement,
      trades: { r2, r1 }
    };
  }

  const tradesNeeded = Math.ceil(rMultiplesNeeded / 2);
  return {
    message: `About ${tradesNeeded} solid trades to go.`,
    subMessage: "Break it down into small wins. Every R counts!"
  };
};

const ProgressSection: React.FC<ProgressSectionProps> = ({
  calendarId,
  currentBalance,
  currentDate,
  calendar,
  weekTrades: weekTradesProp
}) => {
  const theme = useTheme();
  // State - only used when weekTradesProp is not provided
  const [weekTradesState, setWeekTrades] = useState<Trade[]>([]);
  const [cumulativePnLBeforeWeek, setCumulativePnLBeforeWeek] = useState<number>(0);

  // Use prop if provided, otherwise fall back to state (fetched from DB)
  const weekTrades = weekTradesProp ?? weekTradesState;

  // Extract targets from calendar
  const weeklyTargetPercentage = calendar?.weekly_target;
  const accountBalance = calendar?.account_balance || 0;
  const riskPerTrade = calendar?.risk_per_trade;

  // Get week boundaries for the current date - memoized to prevent infinite re-renders
  const { weekStart, weekEnd, weekStartTime } = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 }); // Sunday
    const end = endOfWeek(currentDate, { weekStartsOn: 0 }); // Saturday
    return { weekStart: start, weekEnd: end, weekStartTime: start.getTime() };
  }, [currentDate.getTime()]);

  // Use calendar.id for dependency instead of calendar object to prevent re-renders
  const calendarIdForEffect = calendar?.id;

  // Fetch week trades and cumulative P&L before week
  // Skip fetching trades if weekTrades prop is provided (optimization from parent)
  useEffect(() => {
    const fetchWeekData = async () => {
      if (!calendarId || !calendar) return;

      try {
        // Only fetch trades from DB if not provided via props
        if (!weekTradesProp) {
          const tradeRepo = new TradeRepository();
          const trades = await tradeRepo.getTradesByDateRange(calendarId, weekStart, weekEnd);
          setWeekTrades(trades);
        }

        // Calculate cumulative P&L before the week start
        const pnl = await calculateCumulativePnLToDateAsync(weekStart, calendar);
        setCumulativePnLBeforeWeek(pnl);
      } catch (error) {
        logger.error('Error fetching week data:', error);
        if (!weekTradesProp) {
          setWeekTrades([]);
        }
        setCumulativePnLBeforeWeek(0);
      }
    };

    fetchWeekData();
  }, [calendarId, calendarIdForEffect, weekStartTime, weekTradesProp]);

  // Calculate traded days (unique days with trades in current week)
  const tradedDaysCount = new Set(
    weekTrades.map(trade => format(startOfDay(new Date(trade.trade_date)), 'yyyy-MM-dd'))
  ).size;

  // Calculate total P&L for the week
  const totalPnL = weekTrades.reduce((sum, trade) => sum + trade.amount, 0);

  // Calculate account balance at start of week for dynamic risk
  const baselineAccountValue = accountBalance + cumulativePnLBeforeWeek;

  // Calculate target amount using baseline account value (accounts for dynamic risk)
  const profitTarget = baselineAccountValue > 0 && weeklyTargetPercentage
    ? (weeklyTargetPercentage / 100) * baselineAccountValue
    : 0;

  // Calculate risk amount in dollars (risk_per_trade is stored as percentage)
  const riskAmountDollars = riskPerTrade && baselineAccountValue > 0
    ? (riskPerTrade / 100) * baselineAccountValue
    : 0;

  const tradedDaysTarget = 5; // Default to 5 trading days per week

  // Progress percentages
  const tradedDaysProgress = Math.min((tradedDaysCount / tradedDaysTarget) * 100, 100);
  const profitProgress = profitTarget > 0 ? Math.min((totalPnL / profitTarget) * 100, 100) : 0;
  const profitTargetReached = totalPnL >= profitTarget;
  const tradedDaysReached = tradedDaysCount >= tradedDaysTarget;

  // Display values capped at targets
  const displayedTradedDays = Math.min(tradedDaysCount, tradedDaysTarget);
  const displayedPnL = Math.min(totalPnL, profitTarget);

  // Calculate remaining amount and generate tip - memoized to prevent random changes on re-render
  const motivationalTip = useMemo(() => {
    const remainingAmount = profitTarget - totalPnL;
    return generateMotivationalTip(
      remainingAmount,
      riskAmountDollars,
      totalPnL,
      profitTarget
    );
  }, [profitTarget, totalPnL, riskAmountDollars]);

  // Don't render if no targets are set
  if (!weeklyTargetPercentage || !accountBalance) {
    return null;
  }

  const pnlColor =
    totalPnL > 0
      ? theme.palette.success.main
      : totalPnL < 0
        ? theme.palette.error.main
        : theme.palette.text.primary;

  return (
    <CardShell
      radius="lg"
      sx={{ mb: 2 }}
      head={{
        icon: <TrendingUp sx={{ fontSize: 16 }} />,
        title: 'Weekly progress',
      }}
      innerSx={{ p: 1.75, display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      {/* Traded Days Progress */}
      <Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            mb: 0.75,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
            {tradedDaysReached ? (
              <CheckIcon sx={{ color: 'success.main', fontSize: 14 }} />
            ) : (
              <CalendarMonthOutlined sx={{ fontSize: 14, color: 'text.secondary' }} />
            )}
            <Typography sx={EYEBROW_SX}>Traded days</Typography>
          </Box>
          <Typography
            sx={{
              fontSize: '0.8rem',
              fontWeight: 700,
              color: 'text.primary',
              fontFeatureSettings: TNUM,
              letterSpacing: '-0.01em',
            }}
          >
            {displayedTradedDays} / {tradedDaysTarget}
          </Typography>
        </Box>
        <CompareBar
          value={tradedDaysProgress}
          pct
          color={
            tradedDaysReached
              ? theme.palette.success.main
              : theme.palette.primary.main
          }
        />
      </Box>

      {/* Profit Target Progress */}
      <Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            mb: 0.75,
            flexWrap: 'wrap',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
            {profitTargetReached ? (
              <CheckIcon sx={{ color: 'success.main', fontSize: 14 }} />
            ) : (
              <Timelapse sx={{ fontSize: 14, color: 'text.secondary' }} />
            )}
            <Typography sx={EYEBROW_SX}>
              Profit target{' '}
              <Box component="span" sx={{ fontFamily: MONO_FONT, fontFeatureSettings: TNUM }}>
                {formatCurrency(profitTarget)}
              </Box>
            </Typography>
          </Box>
          <Typography
            sx={{
              fontFamily: MONO_FONT,
              fontSize: '0.8rem',
              fontWeight: 700,
              color: pnlColor,
              fontFeatureSettings: TNUM,
              letterSpacing: '-0.01em',
            }}
          >
            {formatCurrency(displayedPnL)} / {formatCurrency(profitTarget)}
          </Typography>
        </Box>
        <CompareBar
          value={profitProgress}
          pct
          color={
            profitTargetReached
              ? theme.palette.success.main
              : theme.palette.primary.main
          }
        />
      </Box>

      {/* Motivational Tip Section */}
      {motivationalTip && (
        <InfoStrip
          tone="warning"
          icon={<TipsAndUpdates sx={{ fontSize: 16 }} />}
        >
          <Box>
            {motivationalTip.trades ? (
              <>
                <Typography
                  sx={{
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: 'text.primary',
                    mb: 0.75,
                    display: 'block',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {motivationalTip.message}
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    mb: 0.5,
                    flexWrap: 'wrap',
                  }}
                >
                  {Array.from({ length: motivationalTip.trades.r2 }).map((_, i) => (
                    <Box
                      key={`r2-${i}`}
                      sx={{
                        px: 0.75,
                        py: 0.25,
                        borderRadius: `${theme.palette.custom.radius.md}px`,
                        backgroundColor: 'success.main',
                        color: 'success.contrastText',
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        letterSpacing: '0.02em',
                        fontFeatureSettings: TNUM,
                      }}
                    >
                      2R
                    </Box>
                  ))}
                  {Array.from({ length: motivationalTip.trades.r1 }).map((_, i) => (
                    <Box
                      key={`r1-${i}`}
                      sx={{
                        px: 0.75,
                        py: 0.25,
                        borderRadius: `${theme.palette.custom.radius.md}px`,
                        backgroundColor: 'primary.main',
                        color: 'primary.contrastText',
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        letterSpacing: '0.02em',
                        fontFeatureSettings: TNUM,
                      }}
                    >
                      1R
                    </Box>
                  ))}
                  <Typography
                    sx={{
                      color: 'text.secondary',
                      fontWeight: 500,
                      fontSize: '0.7rem',
                      ml: 0.25,
                    }}
                  >
                    to reach your target
                  </Typography>
                </Box>
              </>
            ) : (
              <Typography
                sx={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'text.primary',
                  mb: 0.5,
                  display: 'block',
                  letterSpacing: '-0.01em',
                }}
              >
                {motivationalTip.message}
              </Typography>
            )}
            <Typography
              sx={{
                fontSize: '0.72rem',
                color: 'text.secondary',
                display: 'block',
                lineHeight: 1.45,
              }}
            >
              {motivationalTip.subMessage}
            </Typography>
          </Box>
        </InfoStrip>
      )}
    </CardShell>
  );
};

export default ProgressSection;
