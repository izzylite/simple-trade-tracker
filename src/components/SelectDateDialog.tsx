import React from 'react';
import {
  Button,
  Typography,
  IconButton,
  Box,
  Paper,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  EmojiEvents,
  CalendarMonth,
  CalendarToday,
  ViewCarousel as GalleryIcon
} from '@mui/icons-material';
import { addYears, subYears } from 'date-fns';
import { Trade, YearStats } from '../types/dualWrite';
import TargetBadge from '../components/TargetBadge';
import { BaseDialog } from './common';
import { scrollbarStyles } from '../styles/scrollbarStyles';
import { calculateTargetProgress } from '../utils/statsUtils';

interface SelectDateDialogProps {
  open: boolean;
  onClose: () => void;
  onDateSelect: (date: Date) => void;
  initialDate?: Date;
  trades: Trade[];
  accountBalance: number;
  monthlyTarget?: number;
  yearlyTarget?: number;
  yearStats: Record<string, YearStats>; // Pre-calculated year statistics
  onOpenGalleryMode?: (trades: Trade[], initialTradeId?: string, title?: string) => void;
}

const SelectDateDialog: React.FC<SelectDateDialogProps> = ({
  open,
  onClose,
  onDateSelect,
  initialDate,
  trades,
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
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

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
    if (onOpenGalleryMode && yearTrades.length > 0) {
      const title = `${currentYear} - All Trades (${yearTrades.length} trades)`;
      onOpenGalleryMode(yearTrades, yearTrades[0].id, title);
      onClose();
    }
  };

  const currentMonth = currentDate.getMonth();

  // Get yearly statistics from pre-calculated year_stats
  // Falls back to empty stats if year data not available
  const yearlyStats = React.useMemo(() => {
    const stats = yearStats[currentYear.toString()];

    if (!stats) {
      // Fallback for years with no trades or not yet calculated
      return {
        yearTrades: [],
        yearlyPnL: 0,
        yearlyWinCount: 0,
        yearlyLossCount: 0,
        yearlyWinRate: '0',
        yearlyGrowthPercentage: '0',
        accountValueAtStartOfYear: accountBalance,
        startOfYear: new Date(currentYear, 0, 1)
      };
    }

    // Calculate account value at start of year for target calculations
    const startOfYear = new Date(currentYear, 0, 1);
    const tradesBeforeYear = trades.filter(trade => new Date(trade.trade_date) < startOfYear);
    const accountValueAtStartOfYear = accountBalance + tradesBeforeYear.reduce((sum, trade) => sum + trade.amount, 0);

    // Filter year trades for gallery mode (still need actual trade objects)
    const yearTrades = trades.filter(trade => new Date(trade.trade_date).getFullYear() === currentYear);

    return {
      yearTrades,
      yearlyPnL: stats.yearly_pnl,
      yearlyWinCount: stats.win_count,
      yearlyLossCount: stats.loss_count,
      yearlyWinRate: stats.win_rate.toFixed(1),
      yearlyGrowthPercentage: stats.yearly_growth_percentage.toFixed(2),
      accountValueAtStartOfYear,
      startOfYear
    };
  }, [currentYear, yearStats, accountBalance, trades]);

  const {
    yearTrades,
    yearlyPnL,
    yearlyWinCount,
    yearlyLossCount,
    yearlyWinRate,
    yearlyGrowthPercentage,
    accountValueAtStartOfYear,
    startOfYear
  } = yearlyStats;

  // Get monthly statistics from pre-calculated year_stats
  const monthlyStats = React.useMemo(() => {
    const stats = new Map<number, {
      monthPnL: number;
      monthTrades: Trade[];
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
      // Fallback: create empty stats for all 12 months
      for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
        stats.set(monthIndex, {
          monthPnL: 0,
          monthTrades: [],
          accountValueAtStartOfMonth: accountBalance,
          targetProgress: null,
          growthPercentage: '0'
        });
      }
      return stats;
    }

    // Use pre-calculated monthly stats from year_stats
    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const monthStats = yearData.monthly_stats[monthIndex];
      const startOfMonth = new Date(currentYear, monthIndex, 1);

      // Filter trades for this month (still needed for gallery mode and target progress calculation)
      const monthTrades = trades.filter(trade => {
        const tradeDate = new Date(trade.trade_date);
        return tradeDate.getFullYear() === currentYear && tradeDate.getMonth() === monthIndex;
      });

      // Calculate target progress if monthly target is set
      let targetProgress = null;
      if (monthlyTarget && monthlyTarget > 0) {
        const progress = calculateTargetProgress(monthTrades, accountBalance, monthlyTarget, startOfMonth, trades);
        const targetAmount = (monthlyTarget / 100) * monthStats.account_value_at_start;
        targetProgress = {
          progress,
          isMet: monthStats.month_pnl >= targetAmount,
          rawProgress: (monthStats.month_pnl / targetAmount) * 100
        };
      }

      stats.set(monthIndex, {
        monthPnL: monthStats.month_pnl,
        monthTrades,
        accountValueAtStartOfMonth: monthStats.account_value_at_start,
        targetProgress,
        growthPercentage: monthStats.growth_percentage.toFixed(2)
      });
    }

    return stats;
  }, [currentYear, yearStats, accountBalance, monthlyTarget, trades]);

  // Get best month from pre-calculated year_stats
  const bestMonth = React.useMemo(() => {
    const yearData = yearStats[currentYear.toString()];

    if (!yearData || yearData.best_month_pnl <= 0) {
      return {
        name: 'None',
        pnl: 0
      };
    }

    return {
      name: months[yearData.best_month_index],
      pnl: yearData.best_month_pnl
    };
  }, [currentYear, yearStats, months]);

  // Calculate yearly target progress using memoized values
  const yearlyTargetProgress = React.useMemo(() => {
    if (!yearlyTarget || yearlyTarget <= 0) return null;

    const progress = calculateTargetProgress(yearTrades, accountBalance, yearlyTarget, startOfYear, trades);
    const targetAmount = (yearlyTarget / 100) * accountValueAtStartOfYear;

    return {
      progress,
      isMet: yearlyPnL >= targetAmount,
      rawProgress: (yearlyPnL / targetAmount) * 100
    };
  }, [yearlyTarget, yearTrades, accountBalance, startOfYear, trades, accountValueAtStartOfYear, yearlyPnL]);

  const dialogTitle = (
    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
      <CalendarToday sx={{
        fontSize: { xs: '1.5rem', sm: '1.6rem', md: '1.75rem' },
        color: theme.palette.primary.main
      }} />
      <Typography
        variant="h5"
        sx={{
          fontWeight: 700,
          flex: 1,
          color: 'text.primary',
          fontSize: { xs: '1.25rem', sm: '1.35rem', md: '1.5rem' },
          ml: { xs: 1, sm: 1.25, md: 1.5 }
        }}
      >
        Select Month
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {currentYear !== new Date().getFullYear() && (
          <Button
            onClick={handleToday}
            size={isSmDown ? 'small' : 'medium'}
            variant="outlined"
            startIcon={<CalendarToday sx={{ fontSize: '1.05rem' }} />}
            sx={{
              ml: 1,
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: 1.5,
              px: { xs: 1.5, sm: 1.75, md: 2 }
            }}
          >
            Today
          </Button>
        )}
        <IconButton onClick={handlePrevYear} sx={{ color: 'text.primary', bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
          <ChevronLeft />
        </IconButton>
        <Typography
          variant="h5"
          sx={{
            fontWeight: 800,
            color: 'text.primary',
            minWidth: { xs: 64, sm: 72, md: 80 },
            textAlign: 'center',
            letterSpacing: '-0.5px'
          }}
        >
          {currentYear}
        </Typography>
        <IconButton onClick={handleNextYear} sx={{ color: 'text.primary', bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
          <ChevronRight />
        </IconButton>
      </Box>
    </Box>
  );

  const dialogActions = (
    <Box sx={{ display: 'flex', gap: { xs: 1.5, sm: 2 } }}>

      <Button
        onClick={onClose}
        variant="outlined"
        size={isSmDown ? 'medium' : 'large'}
        sx={{
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 1.5,
          px: { xs: 2, sm: 2.5, md: 3 }
        }}
      >
        Cancel
      </Button>{onOpenGalleryMode && yearTrades.length > 0 && (
        <Button
          onClick={handleYearlyGalleryMode}
          variant="contained"
          size={isSmDown ? 'medium' : 'large'}
          startIcon={<GalleryIcon />}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 1.5,
            px: { xs: 2, sm: 2.5, md: 3 }
          }}
        >
          Gallery View
        </Button>
      )}

    </Box>
  );

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      title={dialogTitle}
      actions={dialogActions}
      maxWidth="sm"
      fullWidth
      hideFooterCancelButton
    >
      <Box sx={{
        pt: { xs: '12px', sm: '16px', md: '24px' },
        pb: { xs: '12px', sm: '16px', md: '24px' },
        ...scrollbarStyles(theme)
      }}>
        <Paper elevation={0} sx={{
          px: { xs: 2, sm: 2.5, md: 3 },
          py: { xs: 1.5, sm: 2, md: 2 },
          mb: 2,
          borderRadius: 2,
          bgcolor: theme => alpha(theme.palette.background.default, 0.5),
          border: '1px solid',
          borderColor: theme => theme.palette.divider,
          position: 'relative',
          overflow: 'hidden',
        }}>
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: { xs: 2, sm: 2.25, md: 2.5 },
            pl: 1
          }}>
            <Box sx={{ display: 'flex', flexDirection: 'row', gap: 0.5 }}>
              <Typography
                variant="h6"
                sx={{
                  color: 'text.primary',
                  fontSize: { xs: '1rem', sm: '1.05rem', md: '1.1rem' },
                  fontWeight: 600
                }}
              >
                Yearly Statistics
              </Typography>
              {yearlyTargetProgress && (
                <TargetBadge
                  progress={yearlyTargetProgress.rawProgress}
                  isMet={yearlyTargetProgress.isMet}
                  tooltipText={`${yearlyTargetProgress.isMet ? 'Yearly target achieved' : 'Progress towards yearly target'}: ${yearlyTargetProgress.rawProgress.toFixed(0)}%`}
                />
              )}
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                bgcolor: theme => alpha(theme.palette.success.light, 0.1),
                py: 0.75,
                px: 1.5,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'success.light'
              }}>
                <Typography variant="body2" sx={{
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  color: 'text.secondary'
                }}>
                  Best Month:
                </Typography>
                <Typography variant="body2" sx={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: 'success.main'
                }}>
                  {bestMonth.name} (${bestMonth.pnl.toLocaleString()})
                </Typography>
              </Box>


            </Box>

          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: { xs: 2, sm: 3, md: 4 }, width: '100%' }}>
            <Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 1 }}>
                <Box sx={{
                  p: 0.7,
                  borderRadius: 1,
                  bgcolor: theme => alpha(theme.palette.primary.main, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 1
                }}>
                  <TrendingUp sx={{
                    fontSize: { xs: '1.05rem', sm: '1.15rem', md: '1.2rem' },
                    color: 'primary.main'
                  }} />
                </Box>
                <Typography variant="body1" sx={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'text.primary',
                  textAlign: 'center'
                }}>
                  Yearly P&L
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 700,
                    fontSize: { xs: '1.35rem', sm: '1.4rem', md: '1.5rem' },
                    color: theme => {
                      if (yearlyPnL > 0) return theme.palette.success.main;
                      if (yearlyPnL < 0) return theme.palette.error.main;
                      return theme.palette.mode === 'dark' ? 'grey.300' : 'text.primary';
                    },
                    textAlign: 'center'
                  }}
                >
                  ${Math.abs(yearlyPnL).toLocaleString()}
                </Typography>
                <Box sx={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.5,
                }}>
                  <Typography variant="body2" sx={{
                    fontWeight: 500,
                    color: 'text.secondary',
                    fontSize: { xs: '0.85rem', sm: '0.9rem' },
                    textAlign: 'center'
                  }}>
                    Growth
                  </Typography>
                  <Typography variant="body2" sx={{
                    fontWeight: 700,
                    color: theme => {
                      if (yearlyPnL > 0) return theme.palette.success.main;
                      if (yearlyPnL < 0) return theme.palette.error.main;
                      return theme.palette.mode === 'dark' ? 'grey.300' : 'text.primary';
                    },
                    fontSize: '1rem',
                    textAlign: 'center'
                  }}>
                    {yearlyGrowthPercentage}%
                  </Typography>
                </Box>
              </Box>
            </Box>
            <Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 1 }}>
                <Box sx={{
                  p: 0.7,
                  borderRadius: 1,
                  bgcolor: theme => alpha(theme.palette.success.main, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 1
                }}>
                  <EmojiEvents sx={{
                    fontSize: { xs: '1.05rem', sm: '1.15rem', md: '1.2rem' },
                    color: 'success.main'
                  }} />
                </Box>
                <Typography variant="body1" sx={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'text.primary',
                  textAlign: 'center'
                }}>
                  Win Rate
                </Typography>
              </Box>
              <Typography variant="h5" sx={{
                fontWeight: 700,
                fontSize: { xs: '1.35rem', sm: '1.4rem', md: '1.5rem' },
                color: parseFloat(yearlyWinRate) > 50 ? 'success.main' : 'text.primary',
                textAlign: 'center'
              }}>
                {yearlyWinRate}%
              </Typography>
              <Typography variant="body1" sx={{
                fontWeight: 500,
                fontSize: '1rem',
                color: 'text.secondary',
                mt: 0.5,
                textAlign: 'center'
              }}>
                {yearlyWinCount} Ws / {yearlyLossCount} Ls
              </Typography>
            </Box>
            <Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 1 }}>
                <Box sx={{
                  p: 0.7,
                  borderRadius: 1,
                  bgcolor: theme => alpha(theme.palette.info.main, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 1
                }}>
                  <CalendarMonth sx={{
                    fontSize: { xs: '1.05rem', sm: '1.15rem', md: '1.2rem' },
                    color: 'info.main'
                  }} />
                </Box>
                <Typography variant="body1" sx={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'text.primary',
                  textAlign: 'center'
                }}>
                  Total Trades
                </Typography>
              </Box>
              <Typography variant="h5" sx={{
                fontWeight: 700,
                fontSize: { xs: '1.35rem', sm: '1.4rem', md: '1.5rem' },
                color: 'text.primary',
                textAlign: 'center'
              }}>
                {yearTrades.length}
              </Typography>
              <Typography variant="body1" sx={{
                fontWeight: 500,
                fontSize: '1rem',
                color: 'text.secondary',
                mt: 0.5,
                textAlign: 'center'
              }}>
                Trades this year
              </Typography>
            </Box>
          </Box>
        </Paper>
        <Typography
          variant="h6"
          sx={{
            color: 'text.primary',
            mb: { xs: 1.5, sm: 1.75, md: 2 },
            fontSize: { xs: '1rem', sm: '1.05rem', md: '1.1rem' },
            fontWeight: 600,
            pl: 1
          }}
        >
          Select a Month
        </Typography>
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          gap: { xs: 1, sm: 1.25, md: 1.5 }
        }}>
          {months.map((month, index) => {
            const stats = monthlyStats.get(index)!;
            const { monthPnL, targetProgress, growthPercentage } = stats;
            const hasEntries = monthPnL !== 0;

            return (
              <Paper
                key={month}
                onClick={() => handleMonthSelect(index)}
                elevation={0}
                sx={{
                  p: { xs: 1.5, sm: 2, md: 2.5 },
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: { xs: 0.75, sm: 0.85, md: 1 },
                  height: '100%',
                  bgcolor: theme => {
                    if (hasEntries) {
                      return theme.palette.mode === 'dark'
                        ? alpha('#fff', 0.08)
                        : alpha(theme.palette.primary.main, 0.04);
                    }
                    return theme.palette.mode === 'dark' ? 'transparent' : '#f5f5f5';
                  },
                  border: '1px solid',
                  borderColor: theme =>
                    currentMonth === index && currentYear === initialDate?.getFullYear()
                      ? theme.palette.primary.main
                      : theme.palette.mode === 'dark' ? alpha('#fff', 0.12) : theme.palette.grey[200],
                  borderRadius: 2,
                  transition: 'all 0.2s',
                  position: 'relative',
                  overflow: 'hidden',
                  ...(currentMonth === index && currentYear === initialDate?.getFullYear() && {
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '4px',
                      backgroundColor: 'primary.main',
                    }
                  }),
                  '&:hover': {
                    bgcolor: theme => theme.palette.mode === 'dark'
                      ? alpha('#fff', 0.12)
                      : alpha(theme.palette.primary.main, 0.08),
                    borderColor: 'primary.main',
                    transform: 'translateY(-2px)',
                    boxShadow: theme => `0 4px 12px ${alpha(theme.palette.primary.main, 0.2)}`
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5, mr: 1 }}>
                  <Typography
                    variant="h6"
                    sx={{
                      color: theme =>
                        currentMonth === index && currentYear === initialDate?.getFullYear()
                          ? theme.palette.primary.main
                          : theme.palette.text.primary,
                      fontWeight: 700,
                      fontSize: { xs: '1rem', sm: '1.05rem', md: '1.1rem' },
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {month}
                  </Typography>

                  {targetProgress && hasEntries && (
                    <Box sx={{ ml: 1 }}>
                      <TargetBadge
                        progress={targetProgress.rawProgress}
                        isMet={targetProgress.isMet}
                        tooltipText={`${targetProgress.isMet ? 'Monthly target achieved' : 'Progress towards monthly target'}: ${targetProgress.rawProgress.toFixed(0)}%`}
                      />
                    </Box>
                  )}
                </Box>
                {hasEntries && (
                  <>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Typography
                        variant="h6"
                        sx={{
                          color: monthPnL > 0 ? 'success.main' : 'error.main',
                          fontSize: { xs: '1.1rem', sm: '1.15rem', md: '1.2rem' },
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5
                        }}
                      >
                        ${Math.abs(monthPnL).toLocaleString()}
                        <Box component="span" sx={{ fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.9rem' }, fontWeight: 600 }}>
                          {monthPnL > 0 ? '↑' : '↓'}
                        </Box>
                      </Typography>

                      <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                      }}>
                        <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.secondary', fontSize: '0.75rem' }}>
                          Growth
                        </Typography>
                        <Typography variant="caption" sx={{
                          fontWeight: 600,
                          color: monthPnL > 0 ? 'success.main' : 'error.main',
                          fontSize: '0.75rem'
                        }}>
                          {growthPercentage}%
                        </Typography>
                      </Box>
                    </Box>

                  </>
                )}
              </Paper>
            );
          })}
        </Box>
      </Box>
    </BaseDialog>
  );
};

export default SelectDateDialog;