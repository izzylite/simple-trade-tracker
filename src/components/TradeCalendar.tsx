import React, { useState, useEffect, useMemo } from 'react';
import type { FC } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  useTheme,
  alpha,
  Paper,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  TextField,
  FormControl,
  Select,
  SelectChangeEvent,
  SxProps,
  Theme
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  CalendarToday,
  MoreVert,
  FileDownload,
  FileUpload,
  Settings,
  TrendingUp,
  EmojiEvents,
  CalendarMonth,
  Delete,
  Today,
  ArrowBack
} from '@mui/icons-material';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval,
  eachWeekOfInterval,
  isSameMonth, 
  isSameDay,
  startOfWeek,
  endOfWeek,
  isSameWeek,
  isToday
} from 'date-fns';
import { getDayTrades, getTotalForDay, getDayPercentage, formatCurrency } from '../utils/tradeUtils';
import { Trade } from '../types/trade';
import DayDialog from './DayDialog';
import SelectDateDialog from './SelectDateDialog';
import { exportTrades, importTrades } from '../utils/tradeExportImport';
import { CalendarCell, WeekdayHeader } from './CalendarGrid';
import {
  AccountBalanceCard,
  AccountBalanceTitle,
  AccountBalanceAmount,
  AccountBalanceChange,
  MonthlyStatsCard,
  MonthlyStatsTitle,
  MonthlyStatsGrid,
  MonthlyStatItem,
  MonthlyStatLabel,
  MonthlyStatValue, 
  StyledCalendarDay,
  DayStatus,
  AnimatedPulse,
  DayNumber,
  TradeAmount,
  TradeCount
} from './StyledComponents';
import {
  AnimatedContainer,
  AnimatedPaper,
  StaggeredSlideUp,
  AnimatedSlideUp,
  AnimatedSlideDown
} from './Animations';
import { useNavigate, useParams } from 'react-router-dom';
import { dialogProps } from '../styles/dialogStyles';

interface TradeCalendarProps {
  trades: Trade[];
  accountBalance: number;
  maxDailyDrawdown: number;
  weeklyTarget?: number;
  monthlyTarget?: number;
  yearlyTarget?: number;
  onAddTrade?: (trade: Omit<Trade, 'id'>) => void;
  onEditTrade?: (trade: Trade) => void;
  onDeleteTrade?: (tradeId: string) => void;
  onAccountBalanceChange: (balance: number) => void;
  onImportTrades?: (trades: Trade[]) => void;
  calendarName?: string;
  onClearMonthTrades: (month: number, year: number) => void;
}

interface AccountBalanceProps {
  balance: number;
  onChange: (balance: number) => void;
  trades: Trade[];
}

interface DayDialogProps {
  open: boolean;
  onClose: () => void;
  date: Date;
  trades: Trade[];
  onAddTrade?: (trade: Omit<Trade, 'id'>) => void;
  onEditTrade?: (trade: Trade) => void;
  onDeleteTrade?: (tradeId: string) => void;
  onDateChange: (date: Date) => void;
  accountBalance: number;
  onAccountBalanceChange: (balance: number) => void;
  allTrades?: Trade[];
}

interface NewTradeForm {
  amount: string;
  type: 'win' | 'loss';
}

interface DayStats {
  netAmount: number;
  status: DayStatus;
  percentage: string;
  isDrawdownViolation: boolean;
}

interface MonthlyStats {
  totalPnL: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  netChange: number;
}

interface WeeklyPnLProps {
  date: Date;
  trades: Trade[];
  monthStart: Date;
  weekIndex: number;
  currentMonth: number;
  accountBalance: number;
  weeklyTarget?: number;
  sx?: SxProps<Theme>;
}

interface MonthlyStatsProps {
  trades: Trade[];
  accountBalance: number;
  onImportTrades?: (trades: Trade[]) => void;
  onDeleteTrade?: (id: string) => void;
  currentDate?: Date;
  monthlyTarget?: number;
  onClearMonthTrades?: (month: number, year: number) => void;
}

const AccountBalance: React.FC<AccountBalanceProps> = ({ balance, onChange, trades }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempBalance, setTempBalance] = useState(balance.toString());

  const totalProfit = trades.length > 0 ? trades.reduce((sum, trade) => sum + trade.amount, 0) : 0;
  const profitPercentage = trades.length > 0 && balance > 0 ? (totalProfit / balance * 100).toFixed(2) : '0';
  const totalAccountValue = balance + totalProfit;

  const handleSubmit = () => {
    const newBalance = parseFloat(tempBalance);
    if (!isNaN(newBalance) && newBalance > 0) {
      onChange(newBalance);
      setIsEditing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setTempBalance(balance.toString());
    }
  };

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        gap: 0.5,
        p: 1.5,
        borderRadius: 1,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
          Account Balance:
        </Typography>
        {isEditing ? (
          <TextField
            value={tempBalance}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                setTempBalance(value);
              }
            }}
            onBlur={handleSubmit}
            onKeyDown={handleKeyPress}
            size="small"
            autoFocus
            sx={{ 
              width: '120px',
              '& .MuiInputBase-input': {
                py: 0.5,
                px: 1,
                fontSize: '0.875rem',
                color: 'text.primary'
              }
            }}
            InputProps={{
              startAdornment: (
                <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem', mr: 0.5 }}>
                  $
                </Typography>
              )
            }}
          />
        ) : (
          <Typography
            onClick={() => setIsEditing(true)}
            sx={{ 
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'text.primary',
              '&:hover': {
                color: 'primary.main'
              }
            }}
          >
            ${balance.toLocaleString()}
          </Typography>
        )}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography 
          variant="caption" 
          sx={{ 
            fontSize: '0.75rem',
            color: totalProfit > 0 ? 'success.main' : totalProfit < 0 ? 'error.main' : 'text.secondary',
            fontWeight: 500
          }}
        >
          ${trades.length > 0 ? Math.abs(totalProfit).toLocaleString() : '0'}
        </Typography>
        <Typography 
          variant="caption" 
          sx={{ 
            fontSize: '0.75rem',
            color: totalProfit > 0 ? 'success.main' : totalProfit < 0 ? 'error.main' : 'text.secondary',
            fontWeight: 500
          }}
        >
          ({profitPercentage}%)
        </Typography>
        <Typography 
          variant="caption" 
          sx={{ 
            fontSize: '0.75rem',
            color: 'text.secondary',
            fontWeight: 500
          }}
        >
          =
        </Typography>
        <Typography 
          variant="caption" 
          sx={{ 
            fontSize: '0.75rem',
            color: totalAccountValue > balance ? 'success.main' : totalAccountValue < balance ? 'error.main' : 'text.secondary',
            fontWeight: 500
          }}
        >
          ${totalAccountValue.toLocaleString()}
        </Typography>
      </Box>
    </Box>
  );
};

const MonthlyStats: React.FC<MonthlyStatsProps> = ({
  trades,
  accountBalance,
  onImportTrades,
  onDeleteTrade,
  currentDate = new Date(),
  monthlyTarget,
  onClearMonthTrades
}) => {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const monthTrades = trades.filter(trade => 
    new Date(trade.date).getMonth() === currentDate.getMonth() &&
    new Date(trade.date).getFullYear() === currentDate.getFullYear()
  );
  const totalPnL = monthTrades.reduce((sum, trade) => sum + trade.amount, 0);
  const winCount = monthTrades.filter(trade => trade.type === 'win').length;
  const lossCount = monthTrades.filter(trade => trade.type === 'loss').length;
  const winRate = monthTrades.length > 0 ? (winCount / monthTrades.length * 100).toFixed(1) : '0';
  const growthPercentage = accountBalance > 0 ? (totalPnL / accountBalance * 100).toFixed(2) : '0';
  
  // Calculate monthly target progress
  const targetProgress = monthlyTarget && monthlyTarget > 0 ? (parseFloat(growthPercentage) / monthlyTarget * 100).toFixed(0) : '0';
  const isTargetMet = monthlyTarget ? parseFloat(growthPercentage) >= monthlyTarget : false;

  const handleExport = () => {
    if (trades.length === 0) {
      return;
    }
    exportTrades(trades, accountBalance);
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onImportTrades) return;

    try {
      const importedTrades = await importTrades(file);
      onImportTrades(importedTrades);
    } catch (error) {
      console.error('Import failed:', error);
    }

    // Reset the input
    event.target.value = '';
  };

  const handleClearClick = () => {
    setShowClearConfirm(true);
  };

  const handleClearConfirm = () => {
    if (onClearMonthTrades) {
      onClearMonthTrades(currentDate.getMonth(), currentDate.getFullYear());
    }
    setShowClearConfirm(false);
  };

  return (
    <>
      <Stack 
        direction={{ xs: 'column', sm: 'row' }} 
        spacing={{ xs: 2, sm: 4 }} 
        sx={{ 
          ml: 1, 
          position: 'relative', 
          width: '100%',
          pb: { xs: 5, sm: 0 }
        }}
      >
        <Box sx={{ 
          flex: '0 0 auto',
          width: { xs: '100%', sm: 'auto' }
        }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 0.5, 
            mb: 0.5,
            justifyContent: { xs: 'center', sm: 'flex-start' }
          }}>
            <TrendingUp sx={{ fontSize: '1rem', color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
              Monthly P&L
            </Typography>
          </Box>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1, 
            justifyContent: { xs: 'center', sm: 'flex-start' }
          }}>
            <Typography 
              variant="body1"
              sx={{ 
                fontWeight: 600,
                fontSize: '0.875rem',
                color: totalPnL > 0 ? 'success.main' : totalPnL < 0 ? 'error.main' : 'text.primary'
              }}
            >
              {formatCurrency(totalPnL)}
            </Typography>
            <Typography 
              sx={{ 
                fontSize: '0.875rem',
                color: totalPnL > 0 ? 'success.main' : totalPnL < 0 ? 'error.main' : 'text.primary',
                fontWeight: 600
              }}
            >
              ({growthPercentage}%)
            </Typography>
          </Box>
          {monthlyTarget && (
            <Box sx={{ width: '100%', mt: 1 }}>
              <Box sx={{ 
                width: '100%', 
                height: '4px', 
                bgcolor: 'divider', 
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <Box sx={{ 
                  width: `${Math.max(Math.min(parseFloat(targetProgress), 100),0)}%`, 
                  height: '100%', 
                  bgcolor: isTargetMet ? 'success.main' : 'primary.main',
                  transition: 'width 0.3s ease'
                }} />
              </Box>
              <Typography 
                variant="caption" 
                color="text.secondary" 
                sx={{ 
                  fontSize: '0.75rem',
                  mt: 0.5,
                  display: 'block'
                }}
              >
                {targetProgress}% of monthly target
              </Typography>
            </Box>
          )}
        </Box>
        <Box sx={{ 
          flex: '0 0 auto',
          width: { xs: '100%', sm: 'auto' }
        }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 0.5, 
            mb: 0.5,
            justifyContent: { xs: 'center', sm: 'flex-start' }
          }}>
            <EmojiEvents sx={{ fontSize: '1rem', color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
              Win Rate
            </Typography>
          </Box>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: { xs: 'center', sm: 'flex-start' }
          }}>
            <Typography variant="body1" sx={{ fontWeight: 500, fontSize: '0.875rem', color: 'text.primary' }}>
              {winRate}% ({winCount}W - {lossCount}L)
            </Typography>
          </Box>
        </Box>
        <Box sx={{ 
          flex: '0 0 auto',
          width: { xs: '100%', sm: 'auto' }
        }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 0.5, 
            mb: 0.5,
            justifyContent: { xs: 'center', sm: 'flex-start' }
          }}>
            <CalendarMonth sx={{ fontSize: '1rem', color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
              Total Trades
            </Typography>
          </Box>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: { xs: 'center', sm: 'flex-start' }
          }}>
            <Typography variant="body1" sx={{ fontWeight: 500, fontSize: '0.875rem', color: 'text.primary' }}>
              {monthTrades.length} days
            </Typography>
          </Box>
        </Box>
        <Box sx={{ 
          position: { xs: 'absolute', sm: 'static' },
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          gap: 1,
          justifyContent: { xs: 'center', sm: 'flex-end' },
          mt: { xs: 2, sm: 0 },
          flex: 1,
          alignItems: 'flex-start'
        }}>
          <input
            type="file"
            accept=".xlsx"
            style={{ display: 'none' }}
            id="import-file"
            onChange={handleImport}
          />
          <label htmlFor="import-file">
            <Button
              component="span"
              size="small"
              variant="outlined"
              startIcon={<FileUpload />}
              sx={{ 
                color: 'text.secondary',
                fontSize: '0.75rem',
                fontWeight: 500,
                textTransform: 'none',
                minWidth: 'auto',
                p: 0.5,
                px: 1,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                '&:hover': {
                  bgcolor: 'action.hover',
                  color: 'text.primary',
                  borderColor: 'text.primary'
                }
              }}
            >
              Import
            </Button>
          </label>
          <Button
            size="small"
            variant="outlined"
            startIcon={<FileDownload />}
            onClick={handleExport}
            disabled={monthTrades.length === 0}
            sx={{ 
              color: 'text.secondary',
              fontSize: '0.75rem',
              fontWeight: 500,
              textTransform: 'none',
              minWidth: 'auto',
              p: 0.5,
              px: 1,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              '&:hover': {
                bgcolor: 'action.hover',
                color: 'text.primary',
                borderColor: 'text.primary'
              },
              '&.Mui-disabled': {
                color: 'text.disabled',
                bgcolor: 'action.disabledBackground',
                borderColor: 'divider'
              }
            }}
          >
            Export
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={handleClearClick}
            disabled={monthTrades.length === 0}
            sx={{ 
              color: 'error.main',
              fontSize: '0.75rem',
              fontWeight: 500,
              textTransform: 'none',
              minWidth: 'auto',
              p: 0.5,
              px: 1,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              '&:hover': {
                bgcolor: (theme) => alpha(theme.palette.error.main, 0.08),
                borderColor: 'error.main'
              },
              '&.Mui-disabled': {
                color: 'text.disabled',
                bgcolor: 'action.disabledBackground',
                borderColor: 'divider'
              }
            }}
          >
            Clear Month
          </Button>
        </Box>
      </Stack>
      <Dialog
        open={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Clear Trades</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to clear all trades? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowClearConfirm(false)}>Cancel</Button>
          <Button onClick={handleClearConfirm} color="error">Clear</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

const WeeklyPnL: React.FC<WeeklyPnLProps> = ({ date, trades, monthStart, weekIndex, currentMonth, accountBalance, weeklyTarget, sx }) => {
  const weekStart = startOfWeek(date, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(date, { weekStartsOn: 0 });
  
  const weekTrades = trades.filter(trade => 
    isSameWeek(new Date(trade.date), weekStart, { weekStartsOn: 0 }) &&
    new Date(trade.date).getMonth() === currentMonth
  );
  
  const totalPnL = weekTrades.reduce((sum, trade) => sum + trade.amount, 0);
  const percentage = accountBalance > 0 ? (totalPnL / accountBalance * 100).toFixed(1) : '0';
  const targetProgress = weeklyTarget && weeklyTarget > 0 ? (parseFloat(percentage) / weeklyTarget * 100).toFixed(0) : '0';
  const isTargetMet = weeklyTarget ? parseFloat(percentage) >= weeklyTarget : false;

  return (
    <Box sx={{  
      bgcolor: 'background.paper',
      borderRadius: 1,
      border: '1px solid',
      borderColor: 'divider',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
      ...sx
    }}>
      <Stack spacing={0.3} sx={{ alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <TrendingUp sx={{ fontSize: '0.875rem', color: 'text.secondary' }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
            Week {weekIndex + 1}
          </Typography>
        </Box>
        <Typography 
          variant="subtitle1"
          sx={{ 
            fontWeight: 600,
            color: totalPnL > 0 ? 'success.main' : totalPnL < 0 ? 'error.main' : 'text.primary',
            fontSize: '0.875rem',
            textAlign: 'center'
          }}
        >
          {formatCurrency(totalPnL)}
        </Typography>
        <Typography 
          variant="caption" 
          sx={{ 
            color: totalPnL > 0 ? 'success.main' : totalPnL < 0 ? 'error.main' : 'text.secondary',
            fontSize: '0.75rem',
            fontWeight: 500,
            textAlign: 'center'
          }}
        >
          {percentage}%
        </Typography>
        {weeklyTarget && (
          <>
            <Box sx={{ 
              width: '100%', 
              height: '4px', 
              bgcolor: 'divider', 
              borderRadius: '2px',
              overflow: 'hidden',
              mt: 0.5
            }}>
              <Box sx={{ 
                width: `${Math.max(Math.min(parseFloat(targetProgress), 100),0)}%`, 
                height: '100%', 
                bgcolor: isTargetMet ? 'success.main' : 'primary.main',
                transition: 'width 0.3s ease'
              }} />
            </Box>
            <Typography 
              variant="caption" 
              color="text.secondary" 
              sx={{ 
                fontSize: '0.75rem',
                textAlign: 'center'
              }}
            >
              {targetProgress}% of target
            </Typography>
          </>
        )}
        <Typography 
          variant="caption" 
          color="text.secondary" 
          sx={{ 
            fontSize: '0.75rem',
            textAlign: 'center'
          }}
        >
          {weekTrades.length} trades
        </Typography>
      </Stack>
    </Box>
  );
};

const MonthYearSelector: React.FC<{
  open: boolean;
  onClose: () => void;
  currentDate: Date;
  onDateSelect: (date: Date) => void;
  trades: Trade[];
  accountBalance: number;
}> = ({ 
  open, 
  onClose, 
  currentDate, 
  onDateSelect, 
  trades, 
  accountBalance 
}) => {
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const theme = useTheme();

  const handleMonthSelect = (monthIndex: number) => {
    const newDate = new Date(selectedYear, monthIndex, 1);
    onDateSelect(newDate);
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: theme.palette.mode === 'dark' ? 'background.default' : '#fff',
          borderRadius: 2
        }
      }}
    >
      <DialogTitle sx={{ 
        pb: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        borderBottom: '1px solid',
        borderColor: theme.palette.mode === 'dark' ? 'divider' : '#e0e0e0',
        bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#fff'
      }}>
        <CalendarToday sx={{ fontSize: '1.25rem', color: 'text.primary' }} />
        <Typography variant="h6" sx={{ fontWeight: 500, flex: 1, color: 'text.primary' }}>
          Select Month
        </Typography>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <Select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value as number)}
            sx={{
              bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#fff',
              '.MuiOutlinedInput-notchedOutline': {
                borderColor: theme.palette.mode === 'dark' ? 'divider' : '#e0e0e0',
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: 'text.primary',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: 'primary.main',
              },
              '.MuiSvgIcon-root': {
                color: 'text.primary',
              }
            }}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
              <MenuItem 
                key={month} 
                value={month}
                sx={{ 
                  py: 1,
                  fontSize: '0.875rem'
                }}
              >
                {month}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogTitle>

      <DialogContent sx={{ pt: '16px !important', bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#fff' }}>
        <Box sx={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 1
        }}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((month, index) => {
            const monthPnL = trades.filter(trade => 
              trade.date.getFullYear() === selectedYear && 
              trade.date.getMonth() === index
            ).reduce((sum, trade) => sum + trade.amount, 0);
            const hasEntries = monthPnL !== 0;
            
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
                  gap: 1,
                  bgcolor: theme.palette.mode === 'dark' 
                    ? hasEntries ? alpha(theme.palette.primary.main, 0.1) : 'background.paper'
                    : hasEntries ? alpha(theme.palette.primary.main, 0.08) : '#f5f5f5',
                  border: '1px solid',
                  borderColor: currentDate.getMonth() === index && currentDate.getFullYear() === selectedYear
                    ? 'primary.main'
                    : theme.palette.mode === 'dark' ? 'divider' : '#e0e0e0',
                  borderRadius: 1,
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: theme.palette.mode === 'dark'
                      ? alpha(theme.palette.primary.main, 0.2)
                      : alpha(theme.palette.primary.main, 0.12),
                    borderColor: 'primary.main',
                    transform: 'translateY(-1px)',
                    boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.15)}`
                  }
                }}
              >
                <Typography 
                  variant="body1" 
                  sx={{ 
                    color: currentDate.getMonth() === index && currentDate.getFullYear() === selectedYear
                      ? 'primary.main'
                      : 'text.primary',
                    fontWeight: 500
                  }}
                >
                  {month}
                </Typography>
                {hasEntries && (
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: monthPnL > 0 ? 'success.main' : 'error.main',
                      fontSize: '0.875rem',
                      fontWeight: 500
                    }}
                  >
                    {formatCurrency(monthPnL)}
                  </Typography>
                )}
              </Paper>
            );
          })}
        </Box>
      </DialogContent>
      <DialogActions sx={{ 
        px: 3, 
        pb: 2, 
        bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#fff',
        borderTop: '1px solid',
        borderColor: theme.palette.mode === 'dark' ? 'divider' : '#e0e0e0'
      }}>
        <Button 
          onClick={onClose}
          sx={{ 
            textTransform: 'none',
            fontWeight: 500,
            color: 'text.primary',
            '&:hover': {
              bgcolor: theme.palette.mode === 'dark' 
                ? alpha(theme.palette.common.white, 0.1)
                : alpha(theme.palette.common.black, 0.04)
            }
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const calculateDayStats = (trades: Trade[], accountBalance: number, maxDailyDrawdown: number): DayStats => {
  // Calculate net amount for the day
  const netAmount = trades.reduce((sum, trade) => sum + trade.amount, 0);
  
  // Calculate percentage loss/gain relative to account balance
  const percentage = accountBalance > 0 ? ((netAmount / accountBalance) * 100).toFixed(1) : '0';
  
  let status: DayStatus = 'neutral';
  if (trades.length > 0) {
    status = netAmount > 0 ? 'win' : netAmount < 0 ? 'loss' : 'neutral';
  }
  
  // Check for drawdown violation - if the loss percentage exceeds maxDailyDrawdown
  const percentageValue = parseFloat(percentage);
  const isDrawdownViolation = status === 'loss' && Math.abs(percentageValue) > maxDailyDrawdown;
  
  return { netAmount, status, percentage, isDrawdownViolation };
};

const calculateMonthlyStats = (trades: Trade[], currentDate: Date, accountBalance: number): MonthlyStats => {
  const monthTrades = trades.filter(trade => isSameMonth(new Date(trade.date), currentDate));
  const totalPnL = monthTrades.reduce((sum, trade) => sum + trade.amount, 0);
  const winCount = monthTrades.filter(trade => trade.type === 'win').length;
  const lossCount = monthTrades.filter(trade => trade.type === 'loss').length;
  const winRate = monthTrades.length > 0 ? (winCount / monthTrades.length * 100) : 0;
  
  const winningTrades = monthTrades.filter(t => t.type === 'win');
  const losingTrades = monthTrades.filter(t => t.type === 'loss');
  
  // Calculate profit factor (gross profit / gross loss)
  const grossProfit = winningTrades.reduce((sum, t) => sum + t.amount, 0);
  const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.amount, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : winCount > 0 ? Infinity : 0;
  
  const avgWin = winCount > 0 
    ? winningTrades.reduce((sum, t) => sum + t.amount, 0) / winCount 
    : 0;
  
  const avgLoss = lossCount > 0 
    ? losingTrades.reduce((sum, t) => sum + t.amount, 0) / lossCount 
    : 0;
  
  const netChange = accountBalance > 0 ? (totalPnL / accountBalance * 100) : 0;

  return {
    totalPnL,
    winRate,
    profitFactor,
    avgWin,
    avgLoss,
    netChange
  };
};

export const TradeCalendar: FC<TradeCalendarProps> = ({ 
  trades, 
  accountBalance,
  maxDailyDrawdown,
  weeklyTarget,
  monthlyTarget,
  yearlyTarget,
  onAddTrade,
  onEditTrade,
  onDeleteTrade,
  onAccountBalanceChange,
  onImportTrades,
  calendarName,
  onClearMonthTrades
}): React.ReactElement => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isMonthSelectorOpen, setIsMonthSelectorOpen] = useState(false);
  const theme = useTheme();
  const navigate = useNavigate();
  const { calendarId } = useParams();

  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    for (let day = firstDay; day <= lastDay; day.setDate(day.getDate() + 1)) {
      days.push(new Date(day));
    }

    return days;
  }, [currentDate]);

  const monthlyStats = useMemo(() => 
    calculateMonthlyStats(trades, currentDate, accountBalance),
    [trades, currentDate, accountBalance]
  );

  const handlePrevMonth = () => {
    setCurrentDate(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => addMonths(prev, 1));
  };

  const handleTodayClick = () => {
    setCurrentDate(new Date());
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  const handleAddTrade = onAddTrade ? (trade: Omit<Trade, 'id'>) => {
    onAddTrade(trade);
  } : undefined;

  const handleEditTrade = onEditTrade ? (trade: Trade) => {
    onEditTrade(trade);
  } : undefined;

  const handleDeleteTrade = onDeleteTrade ? (tradeId: string) => {
    onDeleteTrade(tradeId);
  } : undefined;

  const handleMonthClick = () => {
    setIsMonthSelectorOpen(true);
  };

  const handleMonthSelect = (date: Date) => {
    setCurrentDate(date);
    setIsMonthSelectorOpen(false);
  };

  const handleBackClick = () => {
    navigate('/');
  };

  return (
    <Box sx={{ 
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      p: 2
    }}>
      <Box sx={{ 
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%'
      }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2,
          mb: 2
        }}>
          <IconButton 
            onClick={handleBackClick}
            sx={{ 
              color: 'text.secondary',
              '&:hover': {
                color: 'primary.main',
                bgcolor: alpha(theme.palette.primary.main, 0.08)
              }
            }}
          >
            <ArrowBack />
          </IconButton>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            {calendarName || 'Trading Calendar'}
          </Typography>
        </Box>

        <AccountBalance
          balance={accountBalance}
          onChange={onAccountBalanceChange}
          trades={trades}
        />
        <MonthlyStats
          trades={trades}
          accountBalance={accountBalance}
          onImportTrades={onImportTrades}
          onDeleteTrade={onDeleteTrade}
          currentDate={currentDate}
          monthlyTarget={monthlyTarget}
          onClearMonthTrades={onClearMonthTrades}
        />

        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          mb: 0.5,
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1, sm: 0 }
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton onClick={handlePrevMonth}>
              <ChevronLeft />
            </IconButton>
            <Typography 
              variant="h5" 
              sx={{ 
                fontWeight: 600,
                cursor: 'pointer',
                width: '200px',
                textAlign: 'center',
                fontSize: { xs: '1.25rem', sm: '1.5rem' },
                '&:hover': {
                  color: 'primary.main'
                }
              }}
              onClick={handleMonthClick}
            >
              {format(currentDate, 'MMMM yyyy')}
            </Typography>
            <IconButton onClick={handleNextMonth}>
              <ChevronRight />
            </IconButton>
          </Box>
          <Button
            startIcon={<Today />}
            onClick={handleTodayClick}
            variant="outlined"
            size="small"
            sx={{
              minWidth: { xs: '100%', sm: 'auto' }
            }}
          >
            Today
          </Button>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: 'repeat(7, 1fr)', sm: 'repeat(8, 1fr)' },
            gap: 0.5,
            mb: 0.5
          }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Week'].map((day, index) => (
              <WeekdayHeader key={day} sx={{ display: index === 7 ? { xs: 'none', sm: 'flex' } : 'flex' }}>
                {day}
              </WeekdayHeader>
            ))}
          </Box>
          <Box sx={{ 
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(7, 1fr)', sm: 'repeat(8, 1fr)' },
            gap: 1
          }}>
            {eachWeekOfInterval(
              {
                start: startOfMonth(currentDate),
                end: endOfMonth(currentDate)
              },
              { weekStartsOn: 0 }
            ).map((weekStart, index) => {
              const weekDays = eachDayOfInterval({
                start: weekStart,
                end: endOfWeek(weekStart, { weekStartsOn: 0 })
              });
              
              return (
                <React.Fragment key={weekStart.toISOString()}>
                  {weekDays.map((day) => {
                    const dayTrades = trades.filter(trade => isSameDay(new Date(trade.date), day));
                    const dayStats = calculateDayStats(dayTrades, accountBalance, maxDailyDrawdown);
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    const isCurrentDay = isToday(day);

                    return (
                      <CalendarCell key={day.toISOString()}>
                        <StyledCalendarDay
                          onClick={() => handleDayClick(day)}
                          $isCurrentMonth={isCurrentMonth}
                          $dayStatus={dayStats.status}
                          sx={[
                            {
                              backgroundColor: dayStats.status === 'win' 
                                ? alpha(theme.palette.success.light, 0.3)
                                : dayStats.status === 'loss'
                                  ? alpha(theme.palette.error.light, 0.3)
                                  : theme.palette.background.paper,
                              transition: 'all 0.2s ease-in-out',
                              border: `1px solid ${theme.palette.divider}`,
                              boxShadow: `0 1px 2px ${alpha(theme.palette.common.black, 0.05)}`,
                              '&:hover': {
                                borderColor: theme.palette.primary.main,
                                backgroundColor: dayStats.status === 'win' 
                                  ? alpha(theme.palette.success.light, 0.25)
                                  : dayStats.status === 'loss'
                                    ? alpha(theme.palette.error.light, 0.25)
                                    : alpha(theme.palette.primary.light, 0.1)
                              }
                            },
                            !isCurrentMonth && {
                              opacity: 0.5,
                              backgroundColor: theme.palette.background.default
                            },
                            isCurrentDay && {
                              color: theme.palette.primary.main,
                              borderColor: theme.palette.primary.main,
                              borderWidth: 2
                            },
                            selectedDate && isSameDay(day, selectedDate) && {
                              borderColor: theme.palette.primary.main,
                              borderWidth: 2,
                              backgroundColor: alpha(theme.palette.primary.light, 0.1)
                            }
                          ]}
                        >
                          <DayNumber $isCurrentMonth={isCurrentMonth}>
                            {format(day, 'd')}
                          </DayNumber>
                          {dayTrades.length > 0 && (
                            <AnimatedPulse>
                              <Box sx={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                alignItems: 'center',
                                gap: 0.5
                              }}>
                                <TradeAmount $dayStatus={dayStats.status}>
                                  {formatCurrency(Math.abs(dayStats.netAmount))}
                                </TradeAmount>
                                <TradeCount>
                                  {dayTrades.length} trade{dayTrades.length !== 1 ? 's' : ''}
                                </TradeCount>
                                <Typography 
                                  variant="caption" 
                                  sx={{ 
                                    color: dayStats.status === 'win' ? 'success.main' : 
                                          dayStats.status === 'loss' ? 'error.main' : 'text.secondary',
                                    fontSize: '0.75rem',
                                    fontWeight: 500
                                  }}
                                >
                                  {dayStats.percentage}%
                                </Typography>
                                {dayStats.isDrawdownViolation && (
                                  <Typography 
                                    variant="caption" 
                                    sx={{ 
                                      color: 'error.main',
                                      fontSize: '0.75rem',
                                      fontWeight: 700,
                                      textTransform: 'uppercase'
                                    }}
                                  >
                                    VIOLATED
                                  </Typography>
                                )}
                              </Box>
                            </AnimatedPulse>
                          )}
                        </StyledCalendarDay>
                      </CalendarCell>
                    );
                  })}
                  
                  <WeeklyPnL
                    date={weekStart}
                    trades={trades}
                    monthStart={startOfMonth(currentDate)}
                    weekIndex={index}
                    currentMonth={currentDate.getMonth()}
                    accountBalance={accountBalance}
                    weeklyTarget={weeklyTarget}
                    sx={{ display: { xs: 'none', sm: 'flex' } }}
                  />
                 
                </React.Fragment>
              );
            })}
          </Box>
          
          {/* Weekly stats for mobile */}
          <Box sx={{ 
            display: { xs: 'flex', sm: 'none' },
            flexDirection: 'column',
            gap: 1,
            mt: 2
          }}>
            {eachWeekOfInterval(
              {
                start: startOfMonth(currentDate),
                end: endOfMonth(currentDate)
              },
              { weekStartsOn: 0 }
            ).map((weekStart, index) => (
              <WeeklyPnL
                key={weekStart.toISOString()}
                date={weekStart}
                trades={trades}
                monthStart={startOfMonth(currentDate)}
                weekIndex={index}
                currentMonth={currentDate.getMonth()}
                accountBalance={accountBalance}
                weeklyTarget={weeklyTarget}
              />
            ))}
          </Box>
        </Box>
      </Box>

      <DayDialog
        open={!!selectedDate}
        onClose={() => setSelectedDate(null)}
        date={selectedDate || new Date()}
        trades={selectedDate ? trades.filter(trade => isSameDay(new Date(trade.date), selectedDate)) : []}
        onAddTrade={handleAddTrade}
        onEditTrade={handleEditTrade}
        onDeleteTrade={handleDeleteTrade}
        onDateChange={handleDateSelect}
        accountBalance={accountBalance}
        onAccountBalanceChange={onAccountBalanceChange}
        allTrades={trades}
      />

      <SelectDateDialog
        open={isMonthSelectorOpen}
        onClose={() => setIsMonthSelectorOpen(false)}
        onDateSelect={handleMonthSelect}
        initialDate={selectedDate || undefined}
        trades={trades}
        accountBalance={accountBalance}
        monthlyTarget={monthlyTarget}
        yearlyTarget={yearlyTarget}
      />
    </Box>
  );
};

export default TradeCalendar; 