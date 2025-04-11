import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  IconButton,
  Box,
  Paper,
  useTheme
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  EmojiEvents,
  CalendarMonth,
  CalendarToday
} from '@mui/icons-material';
import { addYears, subYears } from 'date-fns';
import { Trade } from '../types/trade';
import { dialogProps } from '../styles/dialogStyles';
import { scrollbarStyles } from '../styles/scrollbarStyles';
import TargetBadge from '../components/TargetBadge';

interface SelectDateDialogProps {
  open: boolean;
  onClose: () => void;
  onDateSelect: (date: Date) => void;
  initialDate?: Date;
  trades: Trade[];
  accountBalance: number;
  monthlyTarget?: number;
  yearlyTarget?: number;
}

const SelectDateDialog: React.FC<SelectDateDialogProps> = ({
  open,
  onClose,
  onDateSelect,
  initialDate,
  trades,
  accountBalance,
  monthlyTarget,
  yearlyTarget
}) => {
  const theme = useTheme();
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

  const currentMonth = currentDate.getMonth();

  // Calculate yearly statistics
  const yearTrades = trades.filter(trade => new Date(trade.date).getFullYear() === currentYear);
  const yearlyPnL = yearTrades.reduce((sum, trade) => sum + trade.amount, 0);
  const yearlyWinCount = yearTrades.filter(trade => trade.type === 'win').length;
  const yearlyLossCount = yearTrades.filter(trade => trade.type === 'loss').length;
  const yearlyWinRate = yearTrades.length > 0 ? (yearlyWinCount / yearTrades.length * 100).toFixed(1) : '0';
  const yearlyGrowthPercentage = accountBalance > 0 ? (yearlyPnL / accountBalance * 100).toFixed(2) : '0';

  // Calculate monthly PnL for each month
  const getMonthPnL = (monthIndex: number) => {
    const monthTrades = trades.filter(trade =>
      new Date(trade.date).getFullYear() === currentYear &&
      new Date(trade.date).getMonth() === monthIndex
    );
    return monthTrades.reduce((sum, trade) => sum + trade.amount, 0);
  };

  // Find the best month
  const getBestMonth = () => {
    let bestMonthIndex = -1;
    let bestMonthPnL = 0;

    for (let i = 0; i < 12; i++) {
      const monthPnL = getMonthPnL(i);
      if (monthPnL > bestMonthPnL) {
        bestMonthPnL = monthPnL;
        bestMonthIndex = i;
      }
    }

    return {
      name: bestMonthIndex >= 0 ? months[bestMonthIndex] : 'None',
      pnl: bestMonthPnL
    };
  };

  const bestMonth = getBestMonth();

  // Calculate monthly target progress
  const getMonthTargetProgress = (monthIndex: number) => {
    if (!monthlyTarget || monthlyTarget <= 0) return null;
    const monthPnL = getMonthPnL(monthIndex);
    const targetAmount = (monthlyTarget / 100) * accountBalance;
    const progress = (monthPnL / targetAmount) * 100;
    return {
      progress: Math.min(Math.max(progress, 0), 100),
      isMet: monthPnL >= targetAmount,
      rawProgress: progress
    };
  };

  // Calculate monthly growth percentage
  const getMonthGrowthPercentage = (monthIndex: number) => {
    if (accountBalance <= 0) return '0';
    const monthPnL = getMonthPnL(monthIndex);
    return (monthPnL / accountBalance * 100).toFixed(2);
  };

  // Calculate yearly target progress
  const getYearlyTargetProgress = () => {
    if (!yearlyTarget || yearlyTarget <= 0) return null;
    const targetAmount = (yearlyTarget / 100) * accountBalance;
    const progress = (yearlyPnL / targetAmount) * 100;
    return {
      progress: Math.min(Math.max(progress, 0), 100),
      isMet: yearlyPnL >= targetAmount,
      rawProgress: progress
    };
  };

  const yearlyTargetProgress = getYearlyTargetProgress();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      {...dialogProps}
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: 'none',
          border: `1px solid ${theme.palette.divider}`,
          maxHeight: '90vh',
          overflow: 'hidden',
          '& .MuiDialogContent-root': {
            ...scrollbarStyles(theme)
          }
        }
      }}
    >
      <DialogTitle sx={{
        pb: 2,
        pt: 2.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        borderBottom: '1px solid',
        borderColor: theme => theme.palette.mode === 'dark' ? alpha('#fff', 0.12) : theme.palette.grey[200],
        bgcolor: theme => theme.palette.mode === 'dark' ? 'background.paper' : '#fff'
      }}>
        <CalendarToday sx={{
          fontSize: '1.75rem',
          color: theme => theme.palette.primary.main
        }} />
        <Typography variant="h5" sx={{ fontWeight: 700, flex: 1, color: 'text.primary', fontSize: '1.5rem' }}>
          Select Month
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {currentYear !== new Date().getFullYear() && (
            <Button
              onClick={handleToday}
              size="medium"
              variant="outlined"
              startIcon={<CalendarToday sx={{ fontSize: '1.1rem' }} />}
              sx={{
                ml: 1,
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: 1.5,
                px: 2
              }}
            >
              Today
            </Button>
          )}
          <IconButton onClick={handlePrevYear} sx={{ color: 'text.primary', bgcolor: theme => alpha(theme.palette.primary.main, 0.05) }}>
            <ChevronLeft />
          </IconButton>
          <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', minWidth: '80px', textAlign: 'center', letterSpacing: '-0.5px' }}>
            {currentYear}
          </Typography>
          <IconButton onClick={handleNextYear} sx={{ color: 'text.primary', bgcolor: theme => alpha(theme.palette.primary.main, 0.05) }}>
            <ChevronRight />
          </IconButton>
        </Box>
      </DialogTitle>



      <DialogContent sx={{
        pt: '24px !important',
        pb: '24px !important',
        bgcolor: theme => theme.palette.mode === 'dark' ? 'background.paper' : '#fff',
        '&::-webkit-scrollbar': {
          width: '8px',
          height: '8px',
        },
        '&::-webkit-scrollbar-track': {
          background: 'transparent'
        },
        '&::-webkit-scrollbar-thumb': {
          background: theme => alpha(theme.palette.primary.main, 0.2),
          borderRadius: '4px',
        },
        '&::-webkit-scrollbar-thumb:hover': {
          background: theme => alpha(theme.palette.primary.main, 0.3),
        }
      }}>
         <Paper elevation={0} sx={{
        px: 3,
        py: 2,
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
          mb: 2.5,
          pl: 1
        }}>
          <Box sx={{ display: 'flex', flexDirection: 'row', gap: 0.5 }}>
          <Typography
            variant="h6"
            sx={{
              color: 'text.primary',
              fontSize: '1.1rem',
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

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 4, width: '100%' }}>
          <Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 1 }}>
              <Box sx={{
                p: 0.8,
                borderRadius: 1,
                bgcolor: theme => alpha(theme.palette.primary.main, 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 1
              }}>
                <TrendingUp sx={{
                  fontSize: '1.2rem',
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
                  fontSize: '1.5rem',
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
                  fontSize: '0.9rem',
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
                p: 0.8,
                borderRadius: 1,
                bgcolor: theme => alpha(theme.palette.success.main, 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 1
              }}>
                <EmojiEvents sx={{
                  fontSize: '1.2rem',
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
              fontSize: '1.5rem',
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
                p: 0.8,
                borderRadius: 1,
                bgcolor: theme => alpha(theme.palette.info.main, 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 1
              }}>
                <CalendarMonth sx={{
                  fontSize: '1.2rem',
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
              fontSize: '1.5rem',
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
            mb: 2,
            fontSize: '1.1rem',
            fontWeight: 600,
            pl: 1
          }}
        >
          Select a Month
        </Typography>
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 1.5
        }}>
          {months.map((month, index) => {
            const monthPnL = getMonthPnL(index);
            const hasEntries = monthPnL !== 0;
            const targetProgress = getMonthTargetProgress(index);
            const growthPercentage = getMonthGrowthPercentage(index);

            return (
              <Paper
                key={month}
                onClick={() => handleMonthSelect(index)}
                elevation={0}
                sx={{
                  p: 2.5,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
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
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography
                    variant="h6"
                    sx={{
                      color: theme =>
                        currentMonth === index && currentYear === initialDate?.getFullYear()
                          ? theme.palette.primary.main
                          : theme.palette.text.primary,
                      fontWeight: 700,
                      fontSize: '1.1rem'
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
                          fontSize: '1.2rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5
                        }}
                      >
                        ${Math.abs(monthPnL).toLocaleString()}
                        <Box component="span" sx={{ fontSize: '0.9rem', fontWeight: 600 }}>
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
      </DialogContent>
      <DialogActions sx={{
        px: 3,
        py: 2,
        bgcolor: theme => theme.palette.mode === 'dark' ? 'background.paper' : '#fff',
        borderTop: '1px solid',
        borderColor: theme => theme.palette.mode === 'dark' ? alpha('#fff', 0.12) : theme.palette.grey[200]
      }}>
        <Button
          onClick={onClose}
          variant="outlined"
          size="large"
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 1.5,
            px: 3
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SelectDateDialog;