/**
 * MonthlyStats — current-month performance card.
 *
 * 2x3 grid of identical-footprint stat tiles. Sized to fit the side panel
 * (450px) without clipping; the page variant can scale up via container
 * width inheritance.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelectedCalendar } from 'features/calendar/contexts/SelectedCalendarContext';
import { format } from 'date-fns';
import {
  Box,
  Typography,
  IconButton,
  alpha,
  Tooltip,
  useTheme,
  Skeleton,
} from '@mui/material';
import {
  TrendingUp,
  EmojiEvents,
  CalendarMonth,
  Analytics,
  ViewCarousel as GalleryIcon,
} from '@mui/icons-material';
import { Trade, Calendar } from 'features/calendar/types/dualWrite';
import { formatCurrency } from 'utils/formatters';
import { calculateTargetProgress } from 'features/calendar/utils/statsUtils';
import { EYEBROW_SX, TNUM, getInsetSurface } from 'styles/designTokens';
import CardShell from 'components/common/CardShell';
import StatTile from 'components/common/StatTile';
import CompareBar from 'components/common/CompareBar';

interface MonthlyStatsProps {
  trades: Trade[];
  accountBalance: number;
  onDeleteTrade?: (id: string) => void;
  currentDate?: Date;
  monthlyTarget?: number;
  isReadOnly?: boolean;
  onOpenGalleryMode?: (
    trades: Trade[],
    initialTradeId?: string,
    title?: string,
  ) => void;
  calendarId?: string;
  dynamicRiskSettings?: import('features/calendar/utils/dynamicRiskUtils').DynamicRiskSettings;
  onUpdateTradeProperty?: (
    tradeId: string,
    updateCallback: (trade: Trade) => Trade,
  ) => Promise<Trade | undefined>;
  onUpdateCalendarProperty?: (
    calendarId: string,
    updateCallback: (calendar: Calendar) => Calendar,
  ) => Promise<Calendar | undefined>;
  onEditTrade?: (trade: Trade) => void;
  economicFilter?: (
    calendarId: string,
  ) => import('features/events/hooks/useEconomicCalendarFilters').EconomicCalendarFilterSettings;
  maxDailyDrawdown?: number;
  pnlBeforeMonth?: number;
  isPnlLoading?: boolean;
  calendar?: Calendar;
}

const MonthlyStats: React.FC<MonthlyStatsProps> = ({
  trades,
  accountBalance,
  currentDate = new Date(),
  monthlyTarget,
  onOpenGalleryMode,
  calendarId,
  pnlBeforeMonth,
  isPnlLoading = false,
}) => {
  const navigate = useNavigate();
  const { setCalendarId } = useSelectedCalendar();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const hairline = isDark ? 'rgba(255,255,255,0.08)' : theme.palette.divider;
  const surfaceInset = getInsetSurface(theme);

  const handleOpenPerformancePage = () => {
    if (calendarId) setCalendarId(calendarId);
    navigate('/performance');
  };

  // ── Derived metrics ────────────────────────────────────────────────────
  const monthTrades = trades.filter(
    (t) =>
      new Date(t.trade_date).getMonth() === currentDate.getMonth() &&
      new Date(t.trade_date).getFullYear() === currentDate.getFullYear(),
  );

  const netAmountForThisMonth = monthTrades.reduce((sum, t) => sum + t.amount, 0);
  const winCount = monthTrades.filter((t) => t.trade_type === 'win').length;
  const lossCount = monthTrades.filter((t) => t.trade_type === 'loss').length;
  const winRate =
    monthTrades.length > 0 ? (winCount / monthTrades.length) * 100 : 0;

  const totalWinAmount = monthTrades
    .filter((t) => t.trade_type === 'win')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalLossAmount = Math.abs(
    monthTrades
      .filter((t) => t.trade_type === 'loss')
      .reduce((sum, t) => sum + t.amount, 0),
  );
  const profitFactor =
    totalLossAmount > 0
      ? (totalWinAmount / totalLossAmount).toFixed(2)
      : totalWinAmount > 0
        ? '∞'
        : '0';

  // Best/worst day
  const dailyPnL = new Map<string, number>();
  monthTrades.forEach((t) => {
    const dateKey = new Date(t.trade_date).toDateString();
    dailyPnL.set(dateKey, (dailyPnL.get(dateKey) || 0) + t.amount);
  });
  let bestDay = 0;
  let bestDayDate = '';
  if (dailyPnL.size > 0) {
    const entries = Array.from(dailyPnL.entries());
    const bestEntry = entries.reduce((max, current) =>
      current[1] > max[1] ? current : max,
    );
    bestDay = bestEntry[1];
    bestDayDate = format(new Date(bestEntry[0]), 'EEE d');
  }

  // Start-of-month account value (for growth & target denominator)
  const startOfCurrentMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1,
  );
  const accountValueAtStartOfMonth =
    pnlBeforeMonth !== undefined
      ? accountBalance + pnlBeforeMonth
      : accountBalance +
        trades
          .filter((t) => new Date(t.trade_date) < startOfCurrentMonth)
          .reduce((sum, t) => sum + t.amount, 0);

  const growthPercentage =
    accountValueAtStartOfMonth > 0
      ? (netAmountForThisMonth / accountValueAtStartOfMonth) * 100
      : 0;

  const targetProgressValue =
    monthlyTarget && monthlyTarget > 0
      ? calculateTargetProgress(
          monthTrades,
          accountValueAtStartOfMonth,
          monthlyTarget,
        )
      : 0;
  const isTargetMet = monthlyTarget ? growthPercentage >= monthlyTarget : false;

  const monthActivePercent =
    monthTrades.length > 0 ? ((monthTrades.length / 30) * 100).toFixed(0) : '0';

  const handleMonthlyGalleryMode = () => {
    if (monthTrades.length > 0 && onOpenGalleryMode) {
      const monthName = format(currentDate, 'MMMM yyyy');
      const title = `${monthName} - Monthly Trades (${monthTrades.length} trades)`;
      onOpenGalleryMode(monthTrades, monthTrades[0].id, title);
    }
  };

  // ── PnL color signal ───────────────────────────────────────────────────
  const pnlColor =
    netAmountForThisMonth > 0
      ? theme.palette.success.main
      : netAmountForThisMonth < 0
        ? theme.palette.error.main
        : theme.palette.text.primary;

  // ── Action button shared styling ───────────────────────────────────────
  const actionBtnSx = {
    width: 26,
    height: 26,
    borderRadius: '8px',
    color: 'text.secondary',
    border: `1px solid ${hairline}`,
    bgcolor: surfaceInset,
    '&:hover': {
      color: 'primary.main',
      borderColor: alpha(theme.palette.primary.main, 0.4),
      bgcolor: alpha(theme.palette.primary.main, 0.08),
    },
  };

  const headerRight = (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      {calendarId && (
        <Tooltip title="Open performance page" arrow>
          <IconButton size="small" onClick={handleOpenPerformancePage} sx={actionBtnSx}>
            <Analytics sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      )}
      {monthTrades.length > 0 && onOpenGalleryMode && (
        <Tooltip title="View this month's trades in gallery mode" arrow>
          <IconButton size="small" onClick={handleMonthlyGalleryMode} sx={actionBtnSx}>
            <GalleryIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );

  return (
    <CardShell
      radius="lg"
      head={{
        title: 'Monthly performance',
        right: headerRight,
      }}
      innerSx={{ p: 1.75 }}
    >
      {/* ── 2×3 grid of stat tiles ──────────────────────────────────── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 1,
        }}
      >
        {/* Monthly P&L */}
        <StatTile
          size="sm"
          icon={<TrendingUp sx={{ fontSize: 14, color: pnlColor }} />}
          label="Monthly P&L"
          value={
            <>
              {formatCurrency(netAmountForThisMonth)}
              {!isPnlLoading && (
                <Tooltip
                  title={`Percentage based on account value at start of ${format(
                    currentDate,
                    'MMMM',
                  )}: ${formatCurrency(accountValueAtStartOfMonth)}`}
                  placement="top"
                  arrow
                >
                  <Box
                    component="span"
                    sx={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      color: pnlColor,
                      cursor: 'help',
                      ml: 0.5,
                    }}
                  >
                    ({growthPercentage >= 0 ? '+' : ''}
                    {growthPercentage.toFixed(1)}%)
                  </Box>
                </Tooltip>
              )}
              {isPnlLoading && (
                <Skeleton
                  variant="text"
                  width={40}
                  sx={{ fontSize: '0.75rem', display: 'inline-block', ml: 0.5 }}
                />
              )}
            </>
          }
          valueColor={pnlColor}
          footer={
            monthlyTarget ? (
              <Box>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    mb: 0.375,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: '0.62rem',
                      color: 'text.disabled',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Target
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      color: isTargetMet ? 'success.main' : 'primary.main',
                      fontFeatureSettings: TNUM,
                    }}
                  >
                    {targetProgressValue.toFixed(0)}%
                  </Typography>
                </Box>
                <CompareBar
                  value={targetProgressValue}
                  pct
                  color={isTargetMet ? theme.palette.success.main : theme.palette.primary.main}
                />
              </Box>
            ) : undefined
          }
        />

        {/* Win Rate */}
        <StatTile
          size="sm"
          icon={
            <EmojiEvents
              sx={{
                fontSize: 14,
                color: winRate > 50 ? 'success.main' : 'text.secondary',
              }}
            />
          }
          label="Win rate"
          value={`${winRate.toFixed(1)}%`}
          valueColor={
            winRate > 50 ? theme.palette.success.main : theme.palette.text.primary
          }
          subtitle={`${winCount}W · ${lossCount}L`}
          footer={
            (winCount > 0 || lossCount > 0) && (
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Box
                  sx={{
                    height: 4,
                    bgcolor: 'success.main',
                    borderRadius: 2,
                    flex: winCount || 0.01,
                    minWidth: winCount ? 4 : 0,
                  }}
                />
                <Box
                  sx={{
                    height: 4,
                    bgcolor: 'error.main',
                    borderRadius: 2,
                    flex: lossCount || 0.01,
                    minWidth: lossCount ? 4 : 0,
                  }}
                />
              </Box>
            )
          }
        />

        {/* Trades */}
        <StatTile
          size="sm"
          icon={<CalendarMonth sx={{ fontSize: 14, color: 'text.secondary' }} />}
          label="Trades"
          value={`${monthTrades.length}`}
          subtitle={`${monthActivePercent}% of month`}
        />

        {/* Started With */}
        <StatTile
          size="sm"
          label="Started with"
          value={
            isPnlLoading ? (
              <Skeleton variant="text" width={90} sx={{ fontSize: '0.95rem' }} />
            ) : (
              formatCurrency(accountValueAtStartOfMonth)
            )
          }
        />

        {/* Best Day */}
        <StatTile
          size="sm"
          label="Best day"
          value={bestDay > 0 ? formatCurrency(bestDay) : '—'}
          valueColor={bestDay > 0 ? theme.palette.success.main : undefined}
          subtitle={bestDayDate || undefined}
        />

        {/* Profit Factor */}
        <StatTile
          size="sm"
          label="Profit factor"
          value={profitFactor}
          valueColor={
            parseFloat(profitFactor) > 1
              ? theme.palette.success.main
              : theme.palette.text.primary
          }
        />
      </Box>
    </CardShell>
  );
};

export default MonthlyStats;
