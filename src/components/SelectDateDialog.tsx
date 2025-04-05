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
  Stack,
  Paper,
  useTheme
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  EmojiEvents,
  CalendarMonth,
  CalendarToday,
  Close as CloseIcon
} from '@mui/icons-material';
import { addYears, subYears } from 'date-fns';
import { Trade } from '../types/trade';
import { dialogProps } from '../styles/dialogStyles';

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: theme.shape.borderRadius * 2,
    backgroundColor: theme.palette.mode === 'dark' ? theme.palette.background.paper : '#fff',
  },
}));

const MonthButton = styled(Button)(({ theme }) => ({
  width: '100%',
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  justifyContent: 'flex-start',
  textAlign: 'left',
  border: `1px solid ${theme.palette.mode === 'dark' ? alpha(theme.palette.divider, 0.1) : theme.palette.grey[200]}`,
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.08 : 0.04),
    borderColor: theme.palette.primary.main,
  },
}));

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
    >
      <DialogTitle sx={{ 
        pb: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        borderBottom: '1px solid',
        borderColor: theme => theme.palette.mode === 'dark' ? alpha('#fff', 0.12) : theme.palette.grey[200],
        bgcolor: theme => theme.palette.mode === 'dark' ? 'background.paper' : '#fff'
      }}>
        <CalendarToday sx={{ 
          fontSize: '1.25rem', 
          color: theme => theme.palette.mode === 'dark' ? 'grey.300' : 'text.primary' 
        }} />
        <Typography variant="h6" sx={{ fontWeight: 500, flex: 1, color: 'text.primary' }}>
          Select Month
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {currentYear !== new Date().getFullYear() && (
            <Button
              onClick={handleToday}
              size="small"
              startIcon={<CalendarToday sx={{ fontSize: '1rem' }} />}
              sx={{ 
                ml: 1,
                textTransform: 'none',
                fontWeight: 500,
                color: 'primary.main'
              }}
            >
              Today
            </Button>
          )}
          <IconButton onClick={handlePrevYear} size="small" sx={{ color: 'text.primary' }}>
            <ChevronLeft />
          </IconButton>
          <Typography variant="h6" sx={{ fontWeight: 500, color: 'text.primary' }}>
            {currentYear}
          </Typography>
          <IconButton onClick={handleNextYear} size="small" sx={{ color: 'text.primary' }}>
            <ChevronRight />
          </IconButton>
        </Box>
      </DialogTitle>

      <Box sx={{ 
        px: 3, 
        py: 2,
        borderBottom: '1px solid',
        borderColor: theme => theme.palette.mode === 'dark' ? alpha('#fff', 0.12) : theme.palette.grey[200],
        bgcolor: theme => theme.palette.mode === 'dark' ? 'background.paper' : '#fff'
      }}>
        <Typography 
          variant="subtitle2" 
          sx={{ 
            color: theme => theme.palette.mode === 'dark' ? 'grey.300' : 'text.secondary',
            mb: 2,
            fontSize: '0.875rem',
            fontWeight: 500
          }}
        >
          Yearly Statistics
        </Typography>
        <Stack direction="row" spacing={4} alignItems="center">
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              <TrendingUp sx={{ 
                fontSize: '1rem', 
                color: theme => theme.palette.mode === 'dark' ? 'grey.300' : 'text.secondary'
              }} />
              <Typography variant="body2" sx={{ 
                fontSize: '0.75rem',
                color: theme => theme.palette.mode === 'dark' ? 'grey.300' : 'text.secondary'
              }}>
                Yearly P&L
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography 
                variant="body1"
                sx={{ 
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  color: theme => {
                    if (yearlyPnL > 0) return theme.palette.success.main;
                    if (yearlyPnL < 0) return theme.palette.error.main;
                    return theme.palette.mode === 'dark' ? 'grey.300' : 'text.primary';
                  }
                }}
              >
                ${Math.abs(yearlyPnL).toLocaleString()}
              </Typography>
              <Typography 
                sx={{ 
                  fontSize: '0.875rem',
                  color: theme => {
                    if (yearlyPnL > 0) return theme.palette.success.main;
                    if (yearlyPnL < 0) return theme.palette.error.main;
                    return theme.palette.mode === 'dark' ? 'grey.300' : 'text.primary';
                  },
                  fontWeight: 600
                }}
              >
                ({yearlyGrowthPercentage}%)
              </Typography>
            </Box>
            {yearlyTargetProgress && (
              <Box sx={{ width: '100%', mt: 1 }}>
                <Box sx={{ 
                  width: '100%', 
                  height: 4, 
                  bgcolor: theme => alpha(theme.palette.primary.main, 0.1),
                  borderRadius: 1,
                  overflow: 'hidden'
                }}>
                  <Box sx={{ 
                    width: `${yearlyTargetProgress.progress}%`,
                    height: '100%',
                    bgcolor: theme => yearlyTargetProgress.isMet ? theme.palette.success.main : theme.palette.primary.main,
                    transition: 'width 0.3s ease-in-out'
                  }} />
                </Box>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: theme => theme.palette.mode === 'dark' ? 'grey.400' : 'text.secondary',
                    fontSize: '0.75rem',
                    mt: 0.5,
                    display: 'block'
                  }}
                >
                  {yearlyTargetProgress.rawProgress.toFixed(1)}% of yearly target
                </Typography>
              </Box>
            )}
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              <EmojiEvents sx={{ 
                fontSize: '1rem',
                color: theme => theme.palette.mode === 'dark' ? 'grey.300' : 'text.secondary'
              }} />
              <Typography variant="body2" sx={{ 
                fontSize: '0.75rem',
                color: theme => theme.palette.mode === 'dark' ? 'grey.300' : 'text.secondary'
              }}>
                Win Rate
              </Typography>
            </Box>
            <Typography variant="body1" sx={{ 
              fontWeight: 500, 
              fontSize: '0.875rem', 
              color: 'text.primary'
            }}>
              {yearlyWinRate}% ({yearlyWinCount}W - {yearlyLossCount}L)
            </Typography>
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              <CalendarMonth sx={{ 
                fontSize: '1rem',
                color: theme => theme.palette.mode === 'dark' ? 'grey.300' : 'text.secondary'
              }} />
              <Typography variant="body2" sx={{ 
                fontSize: '0.75rem',
                color: theme => theme.palette.mode === 'dark' ? 'grey.300' : 'text.secondary'
              }}>
                Total Trades
              </Typography>
            </Box>
            <Typography variant="body1" sx={{ 
              fontWeight: 500, 
              fontSize: '0.875rem', 
              color: 'text.primary'
            }}>
              {yearTrades.length} trades
            </Typography>
          </Box>
        </Stack>
      </Box>

      <DialogContent sx={{ 
        pt: '16px !important',
        bgcolor: theme => theme.palette.mode === 'dark' ? 'background.paper' : '#fff'
      }}>
        <Box sx={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 1
        }}>
          {months.map((month, index) => {
            const monthPnL = getMonthPnL(index);
            const hasEntries = monthPnL !== 0;
            const targetProgress = getMonthTargetProgress(index);
            
            return (
              <Paper
                key={month}
                onClick={() => handleMonthSelect(index)}
                elevation={0}
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.5,
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
                  borderRadius: 1,
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: theme => theme.palette.mode === 'dark'
                      ? alpha('#fff', 0.12)
                      : alpha(theme.palette.primary.main, 0.08),
                    borderColor: 'primary.main',
                    transform: 'translateY(-1px)',
                    boxShadow: theme => `0 2px 8px ${alpha(theme.palette.primary.main, 0.15)}`
                  }
                }}
              >
                <Typography 
                  variant="body1" 
                  sx={{ 
                    color: theme => 
                      currentMonth === index && currentYear === initialDate?.getFullYear()
                        ? theme.palette.primary.main
                        : theme.palette.text.primary,
                    fontWeight: 500
                  }}
                >
                  {month}
                </Typography>
                {hasEntries && (
                  <>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: monthPnL > 0 ? 'success.main' : 'error.main',
                        fontSize: '0.875rem',
                        fontWeight: 500
                      }}
                    >
                      ${Math.abs(monthPnL).toLocaleString()}
                    </Typography>
                    {targetProgress && (
                      <Box sx={{ width: '100%' }}>
                        <Box sx={{ 
                          width: '100%', 
                          height: 4, 
                          bgcolor: theme => alpha(theme.palette.primary.main, 0.1),
                          borderRadius: 1,
                          overflow: 'hidden'
                        }}>
                          <Box sx={{ 
                            width: `${Math.max(Math.min(targetProgress.progress, 100),0)}%`,
                            height: '100%',
                            bgcolor: theme => targetProgress.isMet ? theme.palette.success.main : theme.palette.primary.main,
                            transition: 'width 0.3s ease-in-out'
                          }} />
                        </Box>
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            color: theme => theme.palette.mode === 'dark' ? 'grey.400' : 'text.secondary',
                            fontSize: '0.75rem',
                            mt: 0.5,
                            display: 'block'
                          }}
                        >
                          {targetProgress.rawProgress.toFixed(1)}% of target
                        </Typography>
                      </Box>
                    )}
                  </>
                )}
              </Paper>
            );
          })}
        </Box>
      </DialogContent>
      <DialogActions sx={{ 
        px: 3, 
        pb: 2,
        bgcolor: theme => theme.palette.mode === 'dark' ? 'background.paper' : '#fff',
        borderTop: '1px solid',
        borderColor: theme => theme.palette.mode === 'dark' ? alpha('#fff', 0.12) : theme.palette.grey[200]
      }}>
        <Button 
          onClick={onClose}
          sx={{ 
            textTransform: 'none',
            fontWeight: 500,
            color: 'text.primary'
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SelectDateDialog; 