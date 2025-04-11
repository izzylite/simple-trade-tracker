import React, { useState, useMemo, useEffect } from 'react';
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
  MenuItem,
  TextField,
  FormControl,
  Select,
  InputLabel,
  SxProps,
  Theme,
  AppBar,
  Toolbar,
  Avatar,
  Chip,
  Autocomplete
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  CalendarToday,
  FileDownload,
  FileUpload,
  TrendingUp,
  EmojiEvents,
  CalendarMonth,
  Today,
  ArrowBack,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  Google as GoogleIcon,
  Logout as LogoutIcon,
  FilterAlt,
  Clear,
  Close as CloseIcon,
  Security as SecurityIcon
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
import { getTagChipStyles, formatTagForDisplay, isGroupedTag, getTagGroup, getUniqueTagGroups, filterTagsByGroup } from '../utils/tagColors';
import DayDialog from './DayDialog';
import SelectDateDialog from './SelectDateDialog';
import PerformanceCharts from './PerformanceCharts';
import TagFilterDialog from './TagFilterDialog';
import TargetBadge from './TargetBadge';
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
  TradeCount,
  DialogTitleStyled,
  DialogContentStyled,
  DialogActionsStyled
} from './StyledComponents';
import { useNavigate, useParams } from 'react-router-dom';
import { dialogProps } from '../styles/dialogStyles';
import { scrollbarStyles } from '../styles/scrollbarStyles';
import { useAuth } from '../contexts/AuthContext';

interface TradeCalendarProps {
  trades: Trade[];
  accountBalance: number;
  maxDailyDrawdown: number;
  weeklyTarget?: number;
  monthlyTarget?: number;
  yearlyTarget?: number;
  riskPerTrade?: number;
  dynamicRiskEnabled?: boolean;
  increasedRiskPercentage?: number;
  profitThresholdPercentage?: number;
  onAddTrade?: (trade: Omit<Trade, 'id'>) => Promise<void>;
  onEditTrade?: (trade: Trade) => Promise<void>;
  onDeleteTrade?: (tradeId: string) => Promise<void>;
  onAccountBalanceChange: (balance: number) => void;
  onImportTrades?: (trades: Trade[]) => void;
  calendarName?: string;
  onClearMonthTrades: (month: number, year: number) => void;
  onToggleTheme: () => void;
  mode: 'light' | 'dark';
  // Pre-calculated statistics
  totalPnL?: number;
}

interface AccountBalanceProps {
  balance: number;
  totalProfit: number;
  onChange: (balance: number) => void;
  trades: Trade[];
  onPerformanceClick?: () => void;
  riskPerTrade?: number;
  dynamicRiskEnabled?: boolean;
  increasedRiskPercentage?: number;
  profitThresholdPercentage?: number;
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

const AccountBalance: React.FC<AccountBalanceProps> = ({
  balance,
  onChange,
  trades,
  totalProfit,
  onPerformanceClick,
  riskPerTrade,
  dynamicRiskEnabled,
  increasedRiskPercentage,
  profitThresholdPercentage
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempBalance, setTempBalance] = useState(balance.toString());
  const theme = useTheme();


  const profitPercentage = trades.length > 0 && balance > 0 ? (totalProfit / balance * 100).toFixed(2) : '0';
  const totalAccountValue = balance + totalProfit;

  // Calculate the effective risk percentage based on dynamic risk settings
  const effectiveRiskPercentage = useMemo(() => {
    if (!riskPerTrade) return undefined;

    if (dynamicRiskEnabled &&
        increasedRiskPercentage &&
        profitThresholdPercentage &&
        parseFloat(profitPercentage) >= profitThresholdPercentage) {
      return increasedRiskPercentage;
    }

    return riskPerTrade;
  }, [riskPerTrade, dynamicRiskEnabled, increasedRiskPercentage, profitThresholdPercentage, profitPercentage]);

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
    <Paper
      elevation={2}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        p: 2,
        borderRadius: 2,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 600, pl: 1 }}>
            Account Balance
          </Typography>
          <Tooltip title="View Performance Analytics">
            <IconButton
              size="small"
              onClick={onPerformanceClick}
              sx={{
                color: 'primary.main',
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.15),
                }
              }}
            >
              <TrendingUp fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
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
              width: '150px',
              '& .MuiInputBase-input': {
                py: 0.8,
                px: 1.5,
                fontSize: '1.1rem',
                fontWeight: 600,
                color: 'text.primary'
              }
            }}
            InputProps={{
              startAdornment: (
                <Typography sx={{ color: 'text.secondary', fontSize: '1.1rem', mr: 0.5, fontWeight: 600 }}>
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
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'text.primary',
              '&:hover': {
                color: 'primary.main'
              },
              display: 'flex',
              alignItems: 'center',
              gap: 0.5
            }}
          >
            <Box component="span" sx={{ fontSize: '1.1rem', color: 'text.secondary', fontWeight: 500 }}>$</Box>
            {balance.toLocaleString()}
          </Typography>
        )}
      </Box>

      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme => alpha(theme.palette.background.default, 0.5),
        p: 1.5,
        borderRadius: 1.5,
        mt: 0.5
      }}>
        <Box>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              mb: 0.5,
              fontWeight: 500
            }}
          >
            Current P&L
          </Typography>
          <Typography
            variant="h6"
            sx={{
              fontSize: '1.2rem',
              color: totalProfit > 0 ? 'success.main' : totalProfit < 0 ? 'error.main' : 'text.secondary',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5
            }}
          >
            ${trades.length > 0 ? Math.abs(totalProfit).toLocaleString() : '0'}
            <Typography
              component="span"
              sx={{
                fontSize: '0.9rem',
                color: totalProfit > 0 ? 'success.main' : totalProfit < 0 ? 'error.main' : 'text.secondary',
                fontWeight: 600
              }}
            >
              ({profitPercentage}%)
            </Typography>
          </Typography>
        </Box>

        <Box>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              mb: 0.5,
              fontWeight: 500,
              textAlign: 'right'
            }}
          >
            Total Value
          </Typography>
          <Typography
            variant="h6"
            sx={{
              fontSize: '1.2rem',
              color: totalAccountValue > balance ? 'success.main' : totalAccountValue < balance ? 'error.main' : 'text.secondary',
              fontWeight: 700
            }}
          >
            ${totalAccountValue.toLocaleString()}
          </Typography>
        </Box>
      </Box>

      {riskPerTrade && (
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          mt: 1
        }}>
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: theme => alpha(theme.palette.primary.main, 0.08),
            p: 1.5,
            borderRadius: 1.5,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SecurityIcon sx={{ fontSize: '1rem', color: 'primary.main' }} />
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  fontWeight: 500
                }}
              >
                Risk Per Trade ({effectiveRiskPercentage}%)
                {dynamicRiskEnabled && effectiveRiskPercentage !== riskPerTrade && (
                  <Box component="span" sx={{ ml: 1, color: 'success.main', fontSize: '0.75rem', fontWeight: 700 }}>
                    INCREASED
                  </Box>
                )}
              </Typography>
            </Box>
            <Typography
              variant="body1"
              sx={{
                fontWeight: 600,
                color: 'primary.main'
              }}
            >
              ${effectiveRiskPercentage ? ((totalAccountValue * effectiveRiskPercentage) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
            </Typography>
          </Box>

          {dynamicRiskEnabled && profitThresholdPercentage && increasedRiskPercentage && (
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: theme => alpha(theme.palette.background.default, 0.5),
              p: 1,
              borderRadius: 1.5,
              fontSize: '0.75rem'
            }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Dynamic Risk: {parseFloat(profitPercentage) >= profitThresholdPercentage ?
                  <Box component="span" sx={{ color: 'success.main', fontWeight: 600 }}>Active</Box> :
                  <Box component="span" sx={{ color: 'text.secondary', fontWeight: 600 }}>Inactive</Box>}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Threshold: {profitThresholdPercentage}% profit
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Paper>
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

  // Calculate monthly values from the filtered trades
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
      <Paper
        elevation={2}
        sx={{
          p: 2,
          borderRadius: 2,
          position: 'relative',
          width: '100%',
          pb: { xs: 5, sm: 2.5 },
          overflow: 'hidden'
        }}
      >
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, pl: 0.5 }}>
          Monthly Performance
        </Typography>

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
        </Box>

        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          gap: 2.5,
          mb: 2
        }}>
          {/* Monthly P&L Card */}
          <Box sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: theme => alpha(theme.palette.background.default, 0.5),
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5
          }}>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mb: 0.5
            }}>
              <TrendingUp sx={{ fontSize: '1.2rem', color: totalPnL > 0 ? 'success.main' : totalPnL < 0 ? 'error.main' : 'text.secondary' }} />
              <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                Monthly P&L
              </Typography>
            </Box>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                color: totalPnL > 0 ? 'success.main' : totalPnL < 0 ? 'error.main' : 'text.primary',
                display: 'flex',
                alignItems: 'baseline',
                gap: 0.5
              }}
            >
              {formatCurrency(totalPnL)}
              <Typography
                component="span"
                sx={{
                  fontSize: '1rem',
                  color: totalPnL > 0 ? 'success.main' : totalPnL < 0 ? 'error.main' : 'text.primary',
                  fontWeight: 600
                }}
              >
                ({growthPercentage}%)
              </Typography>
            </Typography>
            {monthlyTarget && (
              <Box sx={{ width: '100%', mt: 1.5 }}>
                <Box sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  mb: 0.5
                }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.secondary' }}>
                    Target Progress
                  </Typography>
                  <Typography variant="body2" sx={{
                    fontWeight: 600,
                    color: isTargetMet ? 'success.main' : 'primary.main'
                  }}>
                    {targetProgress}%
                  </Typography>
                </Box>
                <Box sx={{
                  width: '100%',
                  height: '8px',
                  bgcolor: theme => alpha(theme.palette.divider, 0.5),
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <Box sx={{
                    width: `${Math.max(Math.min(parseFloat(targetProgress), 100),0)}%`,
                    height: '100%',
                    bgcolor: isTargetMet ? 'success.main' : 'primary.main',
                    transition: 'width 0.3s ease'
                  }} />
                </Box>
              </Box>
            )}
          </Box>

          {/* Win Rate Card */}
          <Box sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: theme => alpha(theme.palette.background.default, 0.5),
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5
          }}>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mb: 0.5
            }}>
              <EmojiEvents sx={{ fontSize: '1.2rem', color: parseFloat(winRate) > 50 ? 'success.main' : 'text.secondary' }} />
              <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                Win Rate
              </Typography>
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: parseFloat(winRate) > 50 ? 'success.main' : 'text.primary' }}>
              {winRate}%
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.secondary', mt: 0.5 }}>
              {winCount} Wins / {lossCount} Losses
            </Typography>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              mt: 1,
              gap: 1
            }}>
              <Box sx={{
                height: '10px',
                bgcolor: 'success.main',
                borderRadius: '5px',
                flex: winCount || 1
              }} />
              <Box sx={{
                height: '10px',
                bgcolor: 'error.main',
                borderRadius: '5px',
                flex: lossCount || 1
              }} />
            </Box>
          </Box>

          {/* Total Trades Card */}
          <Box sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: theme => alpha(theme.palette.background.default, 0.5),
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5
          }}>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mb: 0.5
            }}>
              <CalendarMonth sx={{ fontSize: '1.2rem', color: 'text.secondary' }} />
              <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                Trading Activity
              </Typography>
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
              {monthTrades.length} Days
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.secondary', mt: 0.5 }}>
              {monthTrades.length > 0 ? (monthTrades.length / 30 * 100).toFixed(0) : 0}% of Month Active
            </Typography>
          </Box>
        </Box>

      </Paper>
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
            <TargetBadge
              progress={parseFloat(targetProgress)}
              isMet={isTargetMet}
              tooltipText={`${isTargetMet ? 'Weekly target achieved' : 'Progress towards weekly target'}: ${targetProgress}%`}
            />
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

// TagFilter component for filtering trades by tags
interface TagFilterProps {
  allTags: string[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
}

const TagFilter: React.FC<TagFilterProps> = ({ allTags, selectedTags, onTagsChange }) => {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const handleClearTags = () => {
    onTagsChange([]);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Tooltip title="Filter by tags">
        <Button
          variant="outlined"
          size="small"
          startIcon={<FilterAlt />}
          onClick={() => setOpen(true)}
          sx={{
            borderColor: selectedTags.length > 0 ? 'primary.main' : 'divider',
            color: selectedTags.length > 0 ? 'primary.main' : 'text.secondary',
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: alpha(theme.palette.primary.main, 0.08)
            }
          }}
        >
          {selectedTags.length > 0 ? `${selectedTags.length} tag${selectedTags.length > 1 ? 's' : ''}` : 'Filter Tags'}
        </Button>
      </Tooltip>

      {selectedTags.length > 0 && (
        <Tooltip title="Clear all filters">
          <IconButton
            size="small"
            onClick={handleClearTags}
            sx={{
              color: 'text.secondary',
              '&:hover': {
                color: 'error.main',
                bgcolor: alpha(theme.palette.error.main, 0.08)
              }
            }}
          >
            <Clear fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      <TagFilterDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Filter Trades by Tags"
        allTags={allTags}
        selectedTags={selectedTags}
        onTagsChange={onTagsChange}
      />
    </Box>
  );
};

export const TradeCalendar: FC<TradeCalendarProps> = (props): React.ReactElement => {
  const {
    trades,
    accountBalance,
    maxDailyDrawdown,
    weeklyTarget,
    monthlyTarget,
    yearlyTarget,
    riskPerTrade,
    dynamicRiskEnabled,
    increasedRiskPercentage,
    profitThresholdPercentage,
    onAddTrade,
    onEditTrade,
    onDeleteTrade,
    onAccountBalanceChange,
    onImportTrades,
    calendarName,
    onClearMonthTrades,
    onToggleTheme,
    mode,
    // Pre-calculated statistics
    totalPnL
  } = props;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isMonthSelectorOpen, setIsMonthSelectorOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedTagGroup, setSelectedTagGroup] = useState<string>('');
  const [isPerformanceDialogOpen, setIsPerformanceDialogOpen] = useState(false);
  const theme = useTheme();
  const navigate = useNavigate();
  const { calendarId } = useParams();
  const { user, signInWithGoogle, signOut } = useAuth();

  // Get all unique tags from trades
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    trades.forEach(trade => {
      if (trade.tags) {
        trade.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [trades]);

  // Filter trades based on selected tags
  const filteredTrades = useMemo(() => {
    if (selectedTags.length === 0) {
      return trades; // No filtering if no tags selected
    }

    return trades.filter(trade =>
      trade.tags?.some(tag => selectedTags.includes(tag))
    );
  }, [trades, selectedTags]);

  // Calculate total profit based on filtered trades or use pre-calculated value
  const totalProfit = useMemo(() => {
    // If no tag filtering is applied and pre-calculated totalPnL is available, use it
    if (selectedTags.length === 0 && totalPnL !== undefined) {
      return totalPnL;
    }
    // Otherwise calculate from filtered trades
    return filteredTrades.length > 0 ? filteredTrades.reduce((sum, trade) => sum + trade.amount, 0) : 0;
  }, [filteredTrades, selectedTags, totalPnL]);

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
    calculateMonthlyStats(filteredTrades, currentDate, accountBalance),
    [filteredTrades, currentDate, accountBalance]
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

  const handleAddTrade = onAddTrade ? async (trade: Omit<Trade, 'id'>) => {
    await onAddTrade(trade);
  } : undefined;

  const handleEditTrade = onEditTrade ? async (trade: Trade) => {
    await onEditTrade(trade);
  } : undefined;

  const handleDeleteTrade = onDeleteTrade ? async (tradeId: string) => {
    await onDeleteTrade(tradeId);
  } : undefined;

  const handleMonthClick = () => {
    setIsMonthSelectorOpen(true);
  };

  const handleMonthSelect = (date: Date) => {
    setCurrentDate(date);
    setIsMonthSelectorOpen(false);
  };

  const handleTagsChange = (tags: string[]) => {
    setSelectedTags(tags);
  };

  return (
    <Box>
      <AppBar
        position="fixed"
        color="transparent"
        elevation={0.7}
        sx={{
          backdropFilter: 'blur(8px)',
          backgroundColor:  alpha(mode === 'light' ? '#ffffff' : theme.palette.background.default, 0.9),
          borderBottom: `1px solid ${theme.palette.divider}`
        }}
      >
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexGrow: 1 }}>
            <IconButton
              onClick={() => navigate('/')}
              size="small"
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
            <Typography variant="h5" component="h1">
              {calendarName || 'Calendar'}
            </Typography>
          </Box>
          {user ? (
            <Stack direction="row" spacing={2} alignItems="center">
              <IconButton
                onClick={onToggleTheme}
                color="inherit"
                size="small"
                sx={{
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                  }
                }}
              >
                {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  {user.email}
                </Typography>
                <Avatar
                  src={user.photoURL || undefined}
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: theme.palette.primary.main,
                    fontSize: '0.875rem'
                  }}
                >
                  {user.email ? user.email[0].toUpperCase() : 'U'}
                </Avatar>
              </Stack>
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<LogoutIcon />}
                onClick={signOut}
                size="small"
              >
                Sign Out
              </Button>
            </Stack>
          ) : (
            <Stack direction="row" spacing={2} alignItems="center">
              <IconButton
                onClick={onToggleTheme}
                color="inherit"
                size="small"
                sx={{
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                  }
                }}
              >
                {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
              <Button
                variant="contained"
                startIcon={<GoogleIcon />}
                onClick={signInWithGoogle}
                sx={{
                  bgcolor: '#4285F4',
                  '&:hover': {
                    bgcolor: '#3367D6'
                  }
                }}
              >
                Sign in with Google
              </Button>
            </Stack>
          )}
        </Toolbar>
      </AppBar>
      <Toolbar /> {/* This empty Toolbar acts as a spacer */}

      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        p: 2,
        mt: 1
      }}>
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          maxWidth: '1200px',
          margin: '0 auto',
          width: '100%'
        }}>

          <AccountBalance
            balance={accountBalance}
            totalProfit={totalProfit}
            onChange={onAccountBalanceChange}
            trades={filteredTrades}
            onPerformanceClick={() => setIsPerformanceDialogOpen(true)}
            riskPerTrade={riskPerTrade}
            dynamicRiskEnabled={dynamicRiskEnabled}
            increasedRiskPercentage={increasedRiskPercentage}
            profitThresholdPercentage={profitThresholdPercentage}
          />
          <MonthlyStats
            trades={filteredTrades}
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
                  fontWeight: 800,
                  cursor: 'pointer',
                  width: '200px',
                  textAlign: 'center',
                  fontSize: { xs: '1.3rem', sm: '1.6rem' },
                  letterSpacing: '-0.5px',
                  color: 'text.primary',
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
            <Stack direction="row" spacing={1}>
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
              <TagFilter
                allTags={allTags}
                selectedTags={selectedTags}
                onTagsChange={handleTagsChange}
              />
            </Stack>
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
                      const dayTrades = filteredTrades.filter(trade => isSameDay(new Date(trade.date), day));
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
                      trades={filteredTrades}
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
                  trades={filteredTrades}
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
          trades={selectedDate ? filteredTrades.filter(trade => isSameDay(new Date(trade.date), selectedDate)) : []}
          onAddTrade={handleAddTrade}
          onEditTrade={handleEditTrade}
          onDeleteTrade={handleDeleteTrade}
          onDateChange={handleDateSelect}
          accountBalance={accountBalance}
          totalPnL={totalProfit}
          onAccountBalanceChange={onAccountBalanceChange}
          allTrades={trades} /* Pass all trades for tag suggestions */
          riskPerTrade={riskPerTrade}
          dynamicRiskEnabled={dynamicRiskEnabled}
          increasedRiskPercentage={increasedRiskPercentage}
          profitThresholdPercentage={profitThresholdPercentage}
        />

        <SelectDateDialog
          open={isMonthSelectorOpen}
          onClose={() => setIsMonthSelectorOpen(false)}
          onDateSelect={handleMonthSelect}
          initialDate={selectedDate || undefined}
          trades={filteredTrades}
          accountBalance={accountBalance}
          monthlyTarget={monthlyTarget}
          yearlyTarget={yearlyTarget}
        />

        {/* Performance Dialog */}
        <Dialog
          open={isPerformanceDialogOpen}
          onClose={() => setIsPerformanceDialogOpen(false)}
          maxWidth="lg"
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
          <DialogTitleStyled>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <Typography variant="h6">
                Performance Analytics
              </Typography>
            </Box>
            <IconButton onClick={() => setIsPerformanceDialogOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </DialogTitleStyled>
          <DialogContentStyled>
            <PerformanceCharts
              trades={filteredTrades}
              selectedDate={currentDate}
              accountBalance={accountBalance}
              maxDailyDrawdown={maxDailyDrawdown}
              monthlyTarget={monthlyTarget}
            />
          </DialogContentStyled>
        </Dialog>
      </Box>
    </Box>
  );
};

export default TradeCalendar;