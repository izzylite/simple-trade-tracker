import React from 'react';
import {
  Button,
  Typography,
  IconButton,
  Box,
  useTheme,
  useMediaQuery,
  Tooltip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  EmojiEvents,
  CalendarMonth,
  CalendarToday,
  ViewCarousel as GalleryIcon,
  EventOutlined,
} from '@mui/icons-material';
import { addYears, subYears } from 'date-fns';
import { Trade, YearStats } from '../types/dualWrite';
import TargetBadge from './TargetBadge';
import { BaseDialog } from 'components/common';
import { useDialogTokens, MONO_FONT } from 'styles/dialogTokens';

interface SelectDateDialogProps {
  open: boolean;
  onClose: () => void;
  onDateSelect: (date: Date) => void;
  initialDate?: Date;
  accountBalance: number;
  monthlyTarget?: number;
  yearlyTarget?: number;
  yearStats: Record<string, YearStats>; // Pre-calculated year statistics
  onOpenGalleryMode?: (trades: Trade[], initialTradeId?: string, title?: string, fetchYear?: number) => void;
}

const SelectDateDialog: React.FC<SelectDateDialogProps> = ({
  open,
  onClose,
  onDateSelect,
  initialDate,
  accountBalance,
  monthlyTarget,
  yearlyTarget,
  yearStats,
  onOpenGalleryMode
}) => {
  const theme = useTheme();
  const isSmDown = useMediaQuery(theme.breakpoints.down('sm'));
  const [currentDate, setCurrentDate] = React.useState(initialDate || new Date());
  const currentYear = currentDate.getFullYear();
  const months = React.useMemo(() => [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ], []);

  // ── design tokens ────────────────────────────────────────────────────────
  const {
    isDark,
    violet,
    violetSoft,
    violetSofter,
    violetBorder,
    surfaceInset,
    hairline,
    monoLabelSx,
  } = useDialogTokens();
  const surfaceInsetHover = isDark ? 'rgba(255,255,255,0.06)' : alpha(theme.palette.text.primary, 0.05);

  React.useEffect(() => {
    if (initialDate) {
      setCurrentDate(initialDate);
    }
  }, [initialDate]);

  const handlePrevYear = () => setCurrentDate(prev => subYears(prev, 1));
  const handleNextYear = () => setCurrentDate(prev => addYears(prev, 1));
  const handleToday = () => setCurrentDate(new Date());

  const handleMonthSelect = (monthIndex: number) => {
    const newDate = new Date(currentYear, monthIndex, 1);
    onDateSelect(newDate);
    onClose();
  };

  const handleYearlyGalleryMode = () => {
    if (onOpenGalleryMode) {
      const yearData = yearStats[currentYear.toString()];
      const totalTrades = yearData?.total_trades || 0;
      const title = `${currentYear} - All Trades (${totalTrades} trades)`;
      onOpenGalleryMode([], undefined, title, currentYear);
      onClose();
    }
  };

  const currentMonth = currentDate.getMonth();
  const isInitialYear = currentYear === initialDate?.getFullYear();
  const todayYear = new Date().getFullYear();

  // Yearly statistics from pre-calculated year_stats
  const yearlyStats = React.useMemo(() => {
    const stats = yearStats[currentYear.toString()];
    const startOfYear = new Date(currentYear, 0, 1);

    if (!stats) {
      return {
        totalTrades: 0,
        yearlyPnL: 0,
        yearlyWinCount: 0,
        yearlyLossCount: 0,
        yearlyWinRate: '0',
        yearlyGrowthPercentage: '0',
        accountValueAtStartOfYear: accountBalance,
        startOfYear,
      };
    }

    let accountValueAtStartOfYear = accountBalance;
    Object.entries(yearStats).forEach(([year, yearData]) => {
      if (parseInt(year) < currentYear) {
        accountValueAtStartOfYear += yearData.yearly_pnl;
      }
    });

    return {
      totalTrades: stats.total_trades,
      yearlyPnL: stats.yearly_pnl,
      yearlyWinCount: stats.win_count,
      yearlyLossCount: stats.loss_count,
      yearlyWinRate: stats.win_rate.toFixed(1),
      yearlyGrowthPercentage: stats.yearly_growth_percentage.toFixed(2),
      accountValueAtStartOfYear,
      startOfYear,
    };
  }, [currentYear, yearStats, accountBalance]);

  const {
    totalTrades,
    yearlyPnL,
    yearlyWinCount,
    yearlyLossCount,
    yearlyWinRate,
    yearlyGrowthPercentage,
    accountValueAtStartOfYear,
  } = yearlyStats;

  // Monthly statistics from pre-calculated year_stats
  const monthlyStats = React.useMemo(() => {
    const stats = new Map<number, {
      monthPnL: number;
      tradeCount: number;
      accountValueAtStartOfMonth: number;
      targetProgress: {
        progress: number;
        isMet: boolean;
        rawProgress: number;
      } | null;
      growthPercentage: string;
    }>();

    const yearData = yearStats[currentYear.toString()];

    if (!yearData) {
      for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
        stats.set(monthIndex, {
          monthPnL: 0,
          tradeCount: 0,
          accountValueAtStartOfMonth: accountBalance,
          targetProgress: null,
          growthPercentage: '0',
        });
      }
      return stats;
    }

    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const monthStats = yearData.monthly_stats[monthIndex];

      let targetProgress = null;
      if (monthlyTarget && monthlyTarget > 0 && monthStats.account_value_at_start > 0) {
        const targetAmount = (monthlyTarget / 100) * monthStats.account_value_at_start;
        const rawProgress = targetAmount > 0 ? (monthStats.month_pnl / targetAmount) * 100 : 0;
        targetProgress = {
          progress: Math.min(rawProgress, 100),
          isMet: monthStats.month_pnl >= targetAmount,
          rawProgress,
        };
      }

      stats.set(monthIndex, {
        monthPnL: monthStats.month_pnl,
        tradeCount: monthStats.trade_count,
        accountValueAtStartOfMonth: monthStats.account_value_at_start,
        targetProgress,
        growthPercentage: monthStats.growth_percentage.toFixed(2),
      });
    }

    return stats;
  }, [currentYear, yearStats, accountBalance, monthlyTarget]);

  // Best month from pre-calculated year_stats
  const bestMonth = React.useMemo(() => {
    const yearData = yearStats[currentYear.toString()];
    if (!yearData || yearData.best_month_pnl <= 0) {
      return { name: 'None', pnl: 0 };
    }
    return {
      name: months[yearData.best_month_index],
      pnl: yearData.best_month_pnl,
    };
  }, [currentYear, yearStats, months]);

  // Yearly target progress
  const yearlyTargetProgress = React.useMemo(() => {
    if (!yearlyTarget || yearlyTarget <= 0 || accountValueAtStartOfYear <= 0) return null;
    const targetAmount = (yearlyTarget / 100) * accountValueAtStartOfYear;
    const rawProgress = targetAmount > 0 ? (yearlyPnL / targetAmount) * 100 : 0;
    return {
      progress: Math.min(rawProgress, 100),
      isMet: yearlyPnL >= targetAmount,
      rawProgress,
    };
  }, [yearlyTarget, accountValueAtStartOfYear, yearlyPnL]);

  // ── header title row (title + year stepper) ──────────────────────────────
  const dialogTitle = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
          Jump to a month
        </Typography>
        <Typography
          sx={{
            fontSize: '0.78rem',
            color: theme.palette.text.secondary,
            lineHeight: 1.3,
          }}
        >
          Browse {currentYear} by month, then pick one to open
        </Typography>
      </Box>

      {/* Year stepper */}
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.25,
          px: 0.5,
          py: 0.25,
          borderRadius: 1.5,
          backgroundColor: surfaceInset,
          border: `1px solid ${hairline}`,
        }}
      >
        <Tooltip title="Previous year">
          <IconButton
            onClick={handlePrevYear}
            size="small"
            sx={{
              color: theme.palette.text.secondary,
              width: 26,
              height: 26,
              borderRadius: 1,
              '&:hover': { backgroundColor: violetSofter, color: violet },
            }}
          >
            <ChevronLeft sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Typography
          sx={{
            fontFamily: MONO_FONT,
            fontWeight: 700,
            fontSize: '0.85rem',
            color: theme.palette.text.primary,
            minWidth: 44,
            textAlign: 'center',
            letterSpacing: '0.02em',
            px: 0.5,
          }}
        >
          {currentYear}
        </Typography>
        <Tooltip title="Next year">
          <IconButton
            onClick={handleNextYear}
            size="small"
            sx={{
              color: theme.palette.text.secondary,
              width: 26,
              height: 26,
              borderRadius: 1,
              '&:hover': { backgroundColor: violetSofter, color: violet },
            }}
          >
            <ChevronRight sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {currentYear !== todayYear && (
        <Tooltip title="Jump to current year">
          <Button
            onClick={handleToday}
            size="small"
            startIcon={<CalendarToday sx={{ fontSize: 14 }} />}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.78rem',
              color: violet,
              backgroundColor: violetSofter,
              border: `1px solid ${violetBorder}`,
              borderRadius: 1,
              px: 1.1,
              py: 0.25,
              minHeight: 0,
              ml: 0.5,
              '&:hover': { backgroundColor: violetSoft },
            }}
          >
            Today
          </Button>
        </Tooltip>
      )}
    </Box>
  );

  // ── footer actions ───────────────────────────────────────────────────────
  const dialogActions = onOpenGalleryMode && totalTrades > 0 ? (
    <Button
      onClick={handleYearlyGalleryMode}
      variant="contained"
      startIcon={<GalleryIcon sx={{ fontSize: 16 }} />}
      sx={{
        textTransform: 'none',
        fontWeight: 600,
        fontSize: '0.85rem',
        backgroundColor: violet,
        color: '#fff',
        borderRadius: 1.25,
        px: 1.75,
        py: 0.75,
        boxShadow: 'none',
        '&:hover': { backgroundColor: theme.palette.primary.dark, boxShadow: 'none' },
      }}
    >
      Gallery view
    </Button>
  ) : undefined;

  // Helper to format a positive/negative dollar amount with up/down glyph
  const renderPnL = (value: number, big = false) => {
    const positive = value > 0;
    const negative = value < 0;
    const color = positive
      ? theme.palette.success.main
      : negative
        ? theme.palette.error.main
        : theme.palette.text.primary;
    return (
      <Typography
        sx={{
          fontFamily: MONO_FONT,
          fontWeight: 700,
          fontSize: big ? { xs: '1.2rem', sm: '1.3rem' } : '1rem',
          color,
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: 0.4,
          letterSpacing: '-0.01em',
        }}
      >
        ${Math.abs(value).toLocaleString()}
        {value !== 0 && (
          <Box component="span" sx={{ fontSize: big ? '0.85rem' : '0.7rem', fontWeight: 600 }}>
            {positive ? '↑' : '↓'}
          </Box>
        )}
      </Typography>
    );
  };

  // Stat tile used in yearly summary
  const StatTile: React.FC<{
    icon: React.ReactNode;
    label: string;
    children: React.ReactNode;
    sub?: React.ReactNode;
    accent?: string;
  }> = ({ icon, label, children, sub, accent }) => (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
        p: 1.5,
        borderRadius: 1.5,
        backgroundColor: surfaceInset,
        border: `1px solid ${hairline}`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Box
          sx={{
            width: 22,
            height: 22,
            borderRadius: 0.75,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: alpha(accent || violet, isDark ? 0.18 : 0.14),
            color: accent || violet,
            border: `1px solid ${alpha(accent || violet, isDark ? 0.35 : 0.28)}`,
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Typography sx={{ ...monoLabelSx, fontSize: '0.62rem' }}>{label}</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
        {children}
      </Box>
      {sub && (
        <Typography
          sx={{
            fontSize: '0.72rem',
            color: theme.palette.text.secondary,
            fontWeight: 500,
          }}
        >
          {sub}
        </Typography>
      )}
    </Box>
  );

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      title={dialogTitle}
      headerIcon={<EventOutlined sx={{ fontSize: 18 }} />}
      actions={dialogActions}
      maxWidth="sm"
      fullWidth
      cancelButtonText="Close"
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
        {/* ── Yearly summary panel ────────────────────────────────────── */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              flexWrap: 'wrap',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={monoLabelSx}>{currentYear} · Year summary</Typography>
              {yearlyTargetProgress && (
                <TargetBadge
                  progress={yearlyTargetProgress.rawProgress}
                  isMet={yearlyTargetProgress.isMet}
                  tooltipText={`${
                    yearlyTargetProgress.isMet
                      ? 'Yearly target achieved'
                      : 'Progress towards yearly target'
                  }: ${yearlyTargetProgress.rawProgress.toFixed(0)}%`}
                />
              )}
            </Box>

            {bestMonth.pnl > 0 && (
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.75,
                  px: 1,
                  py: 0.3,
                  borderRadius: 999,
                  backgroundColor: alpha(theme.palette.success.main, isDark ? 0.16 : 0.12),
                  border: `1px solid ${alpha(theme.palette.success.main, isDark ? 0.4 : 0.3)}`,
                }}
              >
                <EmojiEvents sx={{ fontSize: 14, color: theme.palette.success.main }} />
                <Typography
                  sx={{
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    color: theme.palette.text.secondary,
                  }}
                >
                  Best:
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color: theme.palette.success.main,
                    fontFamily: MONO_FONT,
                  }}
                >
                  {bestMonth.name} · ${bestMonth.pnl.toLocaleString()}
                </Typography>
              </Box>
            )}
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
              gap: 1,
            }}
          >
            <StatTile
              icon={<TrendingUp sx={{ fontSize: 14 }} />}
              label="P&L"
              accent={
                yearlyPnL > 0
                  ? theme.palette.success.main
                  : yearlyPnL < 0
                    ? theme.palette.error.main
                    : violet
              }
              sub={
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'baseline', gap: 0.5 }}>
                  Growth
                  <Box
                    component="span"
                    sx={{
                      fontFamily: MONO_FONT,
                      fontWeight: 700,
                      color:
                        yearlyPnL > 0
                          ? theme.palette.success.main
                          : yearlyPnL < 0
                            ? theme.palette.error.main
                            : theme.palette.text.primary,
                    }}
                  >
                    {yearlyGrowthPercentage}%
                  </Box>
                </Box>
              }
            >
              {renderPnL(yearlyPnL, true)}
            </StatTile>

            <StatTile
              icon={<EmojiEvents sx={{ fontSize: 14 }} />}
              label="Win rate"
              accent={
                parseFloat(yearlyWinRate) > 50
                  ? theme.palette.success.main
                  : theme.palette.text.secondary
              }
              sub={`${yearlyWinCount} W · ${yearlyLossCount} L`}
            >
              <Typography
                sx={{
                  fontFamily: MONO_FONT,
                  fontWeight: 700,
                  fontSize: { xs: '1.2rem', sm: '1.3rem' },
                  color:
                    parseFloat(yearlyWinRate) > 50
                      ? theme.palette.success.main
                      : theme.palette.text.primary,
                  letterSpacing: '-0.01em',
                }}
              >
                {yearlyWinRate}%
              </Typography>
            </StatTile>

            <StatTile
              icon={<CalendarMonth sx={{ fontSize: 14 }} />}
              label="Trades"
              sub="Trades this year"
            >
              <Typography
                sx={{
                  fontFamily: MONO_FONT,
                  fontWeight: 700,
                  fontSize: { xs: '1.2rem', sm: '1.3rem' },
                  color: theme.palette.text.primary,
                  letterSpacing: '-0.01em',
                }}
              >
                {totalTrades}
              </Typography>
            </StatTile>
          </Box>
        </Box>

        {/* ── Month grid ─────────────────────────────────────────────── */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography sx={monoLabelSx}>Select a month</Typography>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, 1fr)',
                sm: 'repeat(3, 1fr)',
                md: 'repeat(4, 1fr)',
              },
              gap: 1,
            }}
          >
            {months.map((month, index) => {
              const stats = monthlyStats.get(index)!;
              const { monthPnL, targetProgress, growthPercentage, tradeCount } = stats;
              const hasEntries = monthPnL !== 0 || tradeCount > 0;
              const isSelected = currentMonth === index && isInitialYear;
              const positive = monthPnL > 0;
              const negative = monthPnL < 0;

              return (
                <Box
                  key={month}
                  onClick={() => handleMonthSelect(index)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleMonthSelect(index);
                    }
                  }}
                  sx={{
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.75,
                    p: 1.25,
                    borderRadius: 1.5,
                    backgroundColor: isSelected ? violetSoft : surfaceInset,
                    border: `1px solid ${isSelected ? violetBorder : hairline}`,
                    transition: 'all 120ms ease',
                    position: 'relative',
                    overflow: 'hidden',
                    outline: 'none',
                    '&:hover': {
                      backgroundColor: isSelected ? violetSoft : surfaceInsetHover,
                      borderColor: isSelected ? violetBorder : alpha(violet, 0.5),
                    },
                    '&:focus-visible': {
                      borderColor: violet,
                      boxShadow: `0 0 0 2px ${alpha(violet, 0.35)}`,
                    },
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 0.5,
                    }}
                  >
                    <Typography
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        color: isSelected ? violet : theme.palette.text.primary,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {isSmDown ? month.slice(0, 3) : month}
                    </Typography>

                    {targetProgress && hasEntries && (
                      <TargetBadge
                        progress={targetProgress.rawProgress}
                        isMet={targetProgress.isMet}
                        tooltipText={`${
                          targetProgress.isMet
                            ? 'Monthly target achieved'
                            : 'Progress towards monthly target'
                        }: ${targetProgress.rawProgress.toFixed(0)}%`}
                      />
                    )}
                  </Box>

                  {hasEntries ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                      <Typography
                        sx={{
                          fontFamily: MONO_FONT,
                          fontWeight: 700,
                          fontSize: '0.95rem',
                          letterSpacing: '-0.01em',
                          color: positive
                            ? theme.palette.success.main
                            : negative
                              ? theme.palette.error.main
                              : theme.palette.text.primary,
                          display: 'inline-flex',
                          alignItems: 'baseline',
                          gap: 0.4,
                        }}
                      >
                        ${Math.abs(monthPnL).toLocaleString()}
                        <Box component="span" sx={{ fontSize: '0.7rem', fontWeight: 600 }}>
                          {positive ? '↑' : negative ? '↓' : ''}
                        </Box>
                      </Typography>

                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.75,
                          fontSize: '0.7rem',
                          color: theme.palette.text.secondary,
                          fontWeight: 500,
                        }}
                      >
                        <Box component="span">
                          <Box
                            component="span"
                            sx={{
                              fontFamily: MONO_FONT,
                              fontWeight: 700,
                              color: positive
                                ? theme.palette.success.main
                                : negative
                                  ? theme.palette.error.main
                                  : theme.palette.text.primary,
                            }}
                          >
                            {growthPercentage}%
                          </Box>{' '}
                          growth
                        </Box>
                        <Box
                          component="span"
                          sx={{
                            width: 3,
                            height: 3,
                            borderRadius: '50%',
                            backgroundColor: alpha(theme.palette.text.secondary, 0.5),
                          }}
                        />
                        <Box component="span">
                          <Box
                            component="span"
                            sx={{
                              fontFamily: MONO_FONT,
                              fontWeight: 700,
                              color: theme.palette.text.primary,
                            }}
                          >
                            {tradeCount}
                          </Box>{' '}
                          {tradeCount === 1 ? 'trade' : 'trades'}
                        </Box>
                      </Box>
                    </Box>
                  ) : (
                    <Typography
                      sx={{
                        fontFamily: MONO_FONT,
                        fontSize: '0.7rem',
                        color: alpha(theme.palette.text.secondary, 0.7),
                        fontWeight: 500,
                      }}
                    >
                      No trades
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>
    </BaseDialog>
  );
};

export default SelectDateDialog;
