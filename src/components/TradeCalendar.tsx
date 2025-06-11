import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { FC } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,

  Stack,
  useTheme,
  alpha,
  Tooltip,
  SxProps,
  Theme,
  AppBar,
  Toolbar,
  Avatar,
  Snackbar,
  Alert,
  Badge,
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Today,
  ArrowBack,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  Google as GoogleIcon,
  Logout as LogoutIcon,
  FilterAlt,
  Clear,
  PushPin as PinIcon,
  Info as InfoIcon,
  LocalOffer as TagIcon,
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
import { formatCurrency } from '../utils/formatters';
import CalendarNote from './CalendarNote';
import { Trade } from '../types/trade';
import DayDialog from './trades/DayDialog';
import SelectDateDialog from './SelectDateDialog';

import TagFilterDialog from './TagFilterDialog';
import TagFilterDrawer from './TagFilterDrawer';
import TagManagementDialog from './TagManagementDialog';
import TagManagementDrawer from './TagManagementDrawer';
import TargetBadge from './TargetBadge';
import { CalendarCell, WeekdayHeader } from './CalendarGrid';

import {
  StyledCalendarDay,
  DayStatus,
  AnimatedPulse,
  DayNumber,
  TradeAmount,
  TradeCount,

} from './StyledComponents';
import { useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import ImageZoomDialog, { ImageZoomProp } from './ImageZoomDialog';
import AppHeader from './common/AppHeader';
import { NewTradeForm, TradeImage } from './trades/TradeForm';
import DayNotesDialog from './DayNotesDialog';
import { Calendar } from '../types/calendar';
import MonthlyStats from './MonthlyStats';
import AccountStats from './AccountStats';
import DayNoteCard from './DayNoteCard';
import TradeFormDialog, { createEditTradeData } from './trades/TradeFormDialog';
import ConfirmationDialog from './common/ConfirmationDialog';
import PinnedTradesDrawer from './PinnedTradesDrawer';

import { DynamicRiskSettings, calculateEffectiveMaxDailyDrawdown, calculatePercentageOfCurrentValue } from '../utils/dynamicRiskUtils';

import MonthlyStatisticsSection from './MonthlyStatisticsSection';
import FloatingMonthNavigation from './FloatingMonthNavigation';

interface TradeCalendarProps {
  trades: Trade[];
  accountBalance: number;
  maxDailyDrawdown: number;
  weeklyTarget?: number;
  monthlyTarget?: number;
  yearlyTarget?: number;
  dynamicRiskSettings: DynamicRiskSettings;
  requiredTagGroups?: string[];
  allTags?: string[]; // Add allTags prop to receive calendar.tags
  onAddTrade?: (trade: Trade) => Promise<void>;
  onEditTrade?: (trade: Trade) => Promise<void>;
  onUpdateTradeProperty?: (tradeId: string, updateCallback: (trade: Trade) => Trade, createIfNotExists?: (tradeId: string) => Trade) => Promise<Trade | undefined>;
  onUpdateCalendarProperty?: (calendarId: string, updateCallback: (calendar: Calendar) => Calendar) => Promise<void>;

  onImageUpload?: (tradeId: string, image: TradeImage, add: boolean) => Promise<void>;
  onDeleteTrade?: (tradeId: string) => Promise<void>;
  onAccountBalanceChange: (balance: number) => void;
  onTagUpdated?: (oldTag: string, newTag: string) => void;
  onImportTrades?: (trades: Trade[]) => void;
  calendarName?: string,
  calendarNote?: string;
  calendarDayNotes?: Map<string, string>;
  // Score settings
  scoreSettings?: import('../types/score').ScoreSettings;
  onClearMonthTrades: (month: number, year: number) => void;
  onToggleTheme: () => void;
  mode: 'light' | 'dark';
  // Pre-calculated statistics
  totalPnL?: number;
  // Dynamic risk toggle
  onToggleDynamicRisk?: (useActualAmounts: boolean) => void;
  // Loading state
  isLoadingTrades?: boolean;
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





const WeeklyPnL: React.FC<WeeklyPnLProps> = ({ date, trades, monthStart, weekIndex, currentMonth, accountBalance, weeklyTarget, sx }) => {
  const weekStart = startOfWeek(date, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(date, { weekStartsOn: 0 });

  const weekTrades = trades.filter(trade =>
    isSameWeek(new Date(trade.date), weekStart, { weekStartsOn: 0 }) &&
    new Date(trade.date).getMonth() === currentMonth
  );

  const totalPnL = weekTrades.reduce((sum, trade) => sum + trade.amount, 0);
  // For weekly target progress, use original account balance (targets are based on original balance)
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



export const createNewTradeData = (): NewTradeForm => ({
  id: uuidv4()!!,
  name: '',
  amount: '',
  type: 'win',
  entry: '',
  date: null,
  exit: '',
  tags: [],
  riskToReward: '',
  partialsTaken: false,
  session: '',
  notes: '',
  pendingImages: [],
  uploadedImages: [],
});

const calculateDayStats = (
  dayTrades: Trade[],
  accountBalance: number,
  maxDailyDrawdown: number,
  dynamicRiskSettings?: DynamicRiskSettings,
  allTrades?: Trade[]
): DayStats => {
  // Calculate net amount for the day
  const netAmount = dayTrades.reduce((sum, trade) => sum + trade.amount, 0);

  // Calculate percentage loss/gain relative to current total value (account balance + cumulative profit)
  const percentage = allTrades
    ? calculatePercentageOfCurrentValue(netAmount, accountBalance, allTrades).toFixed(1)
    : accountBalance > 0 ? ((netAmount / accountBalance) * 100).toFixed(1) : '0';

  let status: DayStatus = 'neutral';
  if (dayTrades.length > 0) {
    status = netAmount > 0 ? 'win' : netAmount < 0 ? 'loss' : dayTrades.find(trade => trade.type === 'breakeven') ? 'breakeven' : 'neutral';
  }

  // Calculate effective max daily drawdown based on dynamic risk settings
  let effectiveMaxDailyDrawdown = maxDailyDrawdown;

  if (dynamicRiskSettings && allTrades) {
    effectiveMaxDailyDrawdown = calculateEffectiveMaxDailyDrawdown(
      maxDailyDrawdown,
      allTrades,
      dynamicRiskSettings
    );
  }

  // Check for drawdown violation - if the loss percentage exceeds effectiveMaxDailyDrawdown
  const percentageValue = parseFloat(percentage);
  const isDrawdownViolation = status === 'loss' && Math.abs(percentageValue) > effectiveMaxDailyDrawdown;

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
  onOpenDrawer: () => void;
}

const TagFilter: React.FC<TagFilterProps> = ({ allTags, selectedTags, onTagsChange, onOpenDrawer }) => {
  const theme = useTheme();

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
          onClick={onOpenDrawer}
          sx={{
            borderColor: selectedTags.length > 0 ? 'primary.main' : 'divider',
            color: selectedTags.length > 0 ? 'primary.main' : 'text.secondary',
            display: 'flex',
            alignItems: 'center',
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
    dynamicRiskSettings,
    requiredTagGroups,
    allTags: propAllTags, // Receive calendar.tags from parent
    onAddTrade,
    onTagUpdated,
    onUpdateTradeProperty,
    onUpdateCalendarProperty,
    onAccountBalanceChange,
    onImportTrades,
    calendarName,
    calendarNote,
    calendarDayNotes,
    // Score settings
    scoreSettings,
    onClearMonthTrades,
    onToggleTheme,
    mode,
    // Pre-calculated statistics
    totalPnL,
    // Dynamic risk toggle
    onToggleDynamicRisk,
    // Loading state
    isLoadingTrades = false
  } = props;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDayNotesDialogOpen, setIsDayNotesDialogOpen] = useState<string | null>(null);
  const [isMonthSelectorOpen, setIsMonthSelectorOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTrade, setNewTrade] = useState<NewTradeForm | null>(null);
  const [showAddForm, setShowAddForm] = useState<{ open: boolean, date: Date, editTrade?: Trade | null, createTempTrade?: boolean, showDayDialogWhenDone: boolean } | null>(null);
  const [zoomedImages, setZoomedImagesState] = useState<ImageZoomProp | null>(null);
  const [tradesToDelete, setTradesToDelete] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingTradeIds, setDeletingTradeIds] = useState<string[]>([]);
  const [deleteError, setDeleteError] = useState<string | null>(null);


  // Custom function to handle setting zoomed image and related state
  const setZoomedImage = useCallback((url: string, allImages?: string[], initialIndex?: number) => {
    setZoomedImagesState({ selectetdImageIndex: initialIndex || 0, allImages: allImages || [url] });

  }, []);

  const [isTagManagementDialogOpen, setIsTagManagementDialogOpen] = useState(false);
  const [isTagFilterDrawerOpen, setIsTagFilterDrawerOpen] = useState(false);
  const [isTagManagementDrawerOpen, setIsTagManagementDrawerOpen] = useState(false);
  const [isDynamicRiskToggled, setIsDynamicRiskToggled] = useState(true); // Default to true (using actual amounts)
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'warning' | 'error'>('warning');
  const [showFloatingMonthNav, setShowFloatingMonthNav] = useState(false);
  const [pinnedTradesDrawerOpen, setPinnedTradesDrawerOpen] = useState(false);

  const theme = useTheme();
  const navigate = useNavigate();
  const { calendarId } = useParams();

  const { user, signInWithGoogle, signOut } = useAuth();



  // Scroll detection for floating month navigation
  useEffect(() => {
    const handleScroll = () => {
      // Find the score section element
      const scoreSection = document.querySelector('[data-testid="score-section"]');
      if (scoreSection) {
        const rect = scoreSection.getBoundingClientRect();
        // Show floating nav when score section is visible (top of element is in viewport)
        setShowFloatingMonthNav(rect.top <= window.innerHeight && rect.bottom >= 0);
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Check initial state

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);



  // Use calendar.tags from props, fallback to extracting from trades if not available
  const allTags = useMemo(() => {
    if (propAllTags && propAllTags.length > 0) {
      return propAllTags;
    }

    // Fallback: extract from trades (for backwards compatibility)
    const tagSet = new Set<string>();
    trades.forEach(trade => {
      if (trade.tags) {
        trade.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [propAllTags, trades]);

  // Filter trades based on selected tags
  const filteredTrades = useMemo(() => {
    if (selectedTags.length === 0) {
      return trades; // No filtering if no tags selected
    }

    return trades.filter(trade =>
      trade.tags?.some(tag => selectedTags.includes(tag))
    );
  }, [trades, selectedTags]);


  const tradesForSelectedDay = useMemo(() => {
    if (!selectedDate) {
      return [];
    }
    return filteredTrades.filter(trade => isSameDay(new Date(trade.date), selectedDate));
  }, [selectedDate, filteredTrades]);



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
  const hasPinnedTrades = useMemo(() => {
    const pinnedTrades = trades.filter(trade => trade.isPinned);
    return pinnedTrades.length;
  }, [trades]);

  // Handle single trade deletion
  const handleDeleteClick = (tradeId: string) => {
    setTradesToDelete([tradeId]);
    setIsDeleteDialogOpen(true);
    setDeleteError(null);
  };

  // Handle multiple trade deletion
  const handleDeleteMultipleTrades = (tradeIds: string[]) => {
    setTradesToDelete(tradeIds);
    setIsDeleteDialogOpen(true);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (tradesToDelete.length === 0) return;

    setIsDeleteDialogOpen(false);
    setDeleteError(null);

    // Add all trades to deleting list immediately for UI feedback
    setDeletingTradeIds(prev => [...prev, ...tradesToDelete]);

    try {
      // Delete trades in parallel for better performance
      const deletePromises = tradesToDelete.map(async (tradeId) => {
        if (onUpdateTradeProperty) {
          return await onUpdateTradeProperty(tradeId, (trade) => ({ ...trade, isDeleted: true }));
        }
        return Promise.resolve();
      });

      await Promise.all(deletePromises);

      // Show success message
      const successMessage = tradesToDelete.length === 1
        ? 'Trade deleted successfully.'
        : `Successfully deleted ${tradesToDelete.length} trades.`;

      showSnackbar(successMessage, 'success');
    } catch (error) {
      console.error('Error deleting trades:', error);
      const errorMessage = tradesToDelete.length === 1
        ? 'Failed to delete trade. Please try again.'
        : `Failed to delete some trades. Please try again.`;

      setDeleteError(errorMessage);
      showSnackbar(errorMessage, 'error');
    } finally {
      // Remove all trades from deleting list
      setDeletingTradeIds(prev => prev.filter(id => !tradesToDelete.includes(id)));
      setTradesToDelete([]);
    }
  };

  const handleCancelDelete = () => {
    setIsDeleteDialogOpen(false);
    setTradesToDelete([]);
    setDeleteError(null);
  };


  const handleDayClick = (date: Date) => {
    // Prevent adding new trades when app is loading all trades
    if (isLoadingTrades) {
      console.log('Cannot add trade while trades are loading');
      showSnackbar('Cannot add trade while trades are loading. Please wait...', 'warning');
      return;
    }

    if (!isDynamicRiskToggled) {
      // Reset to use actual amounts set to false before adding any trade
      setIsDynamicRiskToggled(true);
      if (onToggleDynamicRisk) {
        onToggleDynamicRisk(true);
      }
      return;
    }
    const trades = filteredTrades.filter(trade => isSameDay(new Date(trade.date), date));
    if (trades.length == 0) {
      setNewTrade(createNewTradeData);
      setShowAddForm({ open: true, date: date, showDayDialogWhenDone: true });
    }
    else {
      setSelectedDate(date);
    }
  };
  const handleDayChange = (date: Date) => {
    setSelectedDate(date);
  };


  const handleAddTrade = onAddTrade ? async (trade: Trade) => {
    await onAddTrade(trade);
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


  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  // Utility function to show snackbar messages
  const showSnackbar = (message: string, severity: 'success' | 'warning' | 'error' = 'warning') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  // Retry failed deletion
  const retryDeletion = async () => {
    if (deleteError && tradesToDelete.length > 0) {
      setDeleteError(null);
      await handleConfirmDelete();
    }
  };



  return (
    <Box>
      {/* Floating Month Navigation */}
      <FloatingMonthNavigation
        currentDate={currentDate}
        isVisible={showFloatingMonthNav}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onMonthClick={handleMonthClick}
      />

      <AppHeader
        onToggleTheme={onToggleTheme}
        mode={mode}
        title={calendarName || 'Calendar'}
        showBackButton={true}
        backButtonPath="/"
      />
      <Toolbar />

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
          <CalendarNote
            calendarNote={calendarNote || ''}
            calendarId={calendarId!!}
            onUpdateCalendarProperty={onUpdateCalendarProperty}
          />

          <Box sx={{
            display: 'flex',
            gap: 2,
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'center',
            alignItems: 'stretch',
            width: '100%'
          }}>
            <Box sx={{ flex: 1, maxWidth: '600px' }}>
              <AccountStats
                balance={accountBalance}
                totalProfit={totalProfit}
                onChange={onAccountBalanceChange}
                trades={filteredTrades}

                riskPerTrade={dynamicRiskSettings?.riskPerTrade}
                dynamicRiskSettings={dynamicRiskSettings}
                onToggleDynamicRisk={(useActualAmounts) => {
                  // Update local state first
                  setIsDynamicRiskToggled(useActualAmounts);
                  if (onToggleDynamicRisk) {
                    onToggleDynamicRisk(useActualAmounts);
                  }
                }}
                isDynamicRiskToggled={isDynamicRiskToggled}
              />
            </Box>

            {/* Day Note Card - Shows notes or empty state */}
            <Box sx={{ flex: 1, maxWidth: '600px' }}>
              <DayNoteCard
                calendarNotes={calendarDayNotes || new Map()}
                setIsDayNotesDialogOpen={setIsDayNotesDialogOpen}
              />
            </Box>

          </Box>
          <MonthlyStats
            trades={filteredTrades}
            accountBalance={accountBalance}
            onImportTrades={onImportTrades}
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
                  minWidth: { xs: '100%', sm: 'auto' },
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                Today
              </Button>
              <Button
                startIcon={<PinIcon />}
                onClick={() => setPinnedTradesDrawerOpen(true)}
                variant="outlined"
                size="small"
                sx={{
                  minWidth: { xs: '100%', sm: 'auto' },
                  display: 'flex',
                  alignItems: 'center',
                  ...(hasPinnedTrades > 0 ? {
                    // Active state - like Today button when active
                    borderColor: 'primary.main',
                    color: 'primary.main',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: alpha(theme.palette.primary.main, 0.08)
                    }
                  } : {
                    // Inactive state - like other buttons
                    borderColor: 'divider',
                    color: 'text.secondary',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: alpha(theme.palette.primary.main, 0.08)
                    }
                  })
                }}
              >
                Pinned Trades
              </Button>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TagFilter
                  allTags={allTags}
                  selectedTags={selectedTags}
                  onTagsChange={handleTagsChange}
                  onOpenDrawer={() => setIsTagFilterDrawerOpen(true)}
                />
                <Tooltip title="Manage tags and required tag groups">
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<TagIcon />}
                    onClick={() => setIsTagManagementDrawerOpen(true)}
                    sx={{
                      borderColor: 'divider',
                      color: 'text.secondary',
                      display: 'flex',
                      alignItems: 'center',
                      '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: alpha(theme.palette.primary.main, 0.08)
                      }
                    }}
                  >
                    Manage Tags
                  </Button>
                </Tooltip>
              </Box>
            </Stack>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(7, 1fr)', sm: 'repeat(8, 1fr)' },
              gap: 0.5,
              mb: 0.5
            }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Week'].map((day, index) => {
                // Check if this day has notes
                const hasNotes = index < 7 && calendarDayNotes && calendarDayNotes.has(day) && calendarDayNotes.get(day)?.trim() !== '';

                return (
                  <WeekdayHeader
                    key={day}
                    onClick={() => {
                      if (index < 7) { // Don't open notes dialog for 'Week' header
                        setIsDayNotesDialogOpen(day);
                      }
                    }}
                    sx={{
                      display: index === 7 ? { xs: 'none', sm: 'flex' } : 'flex',
                      cursor: index < 7 ? 'pointer' : 'default',
                      position: 'relative',
                      justifyContent: 'center',
                      alignItems: 'center',
                      '&:hover': index < 7 ? {
                        color: 'primary.main',
                        bgcolor: theme => alpha(theme.palette.primary.main, 0.08)
                      } : {}
                    }}
                  >
                    {day}
                    {hasNotes && (
                      <Tooltip
                        title="This day has notes. Click to view or edit."
                        placement="top"
                        arrow
                      >
                        <Box
                          sx={{
                            position: 'absolute',
                            right: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1rem'
                          }}
                        >
                          <InfoIcon fontSize="inherit" />
                        </Box>
                      </Tooltip>
                    )}
                  </WeekdayHeader>
                );
              })}
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
                      const dayStats = calculateDayStats(
                        dayTrades,
                        accountBalance,
                        maxDailyDrawdown,
                        dynamicRiskSettings,
                        filteredTrades
                      );
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
                                    : dayStats.status === 'breakeven'
                                      ? alpha(theme.palette.primary.main, 0.1)
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

          {/*Current Monthly Statistics Section */}
          <MonthlyStatisticsSection
            trades={filteredTrades}
            selectedDate={currentDate}
            accountBalance={accountBalance}
            maxDailyDrawdown={maxDailyDrawdown}
            monthlyTarget={monthlyTarget}
            calendarId={calendarId!!}
            scoreSettings={scoreSettings}
            onUpdateCalendarProperty={onUpdateCalendarProperty}
            dynamicRiskSettings={dynamicRiskSettings}
            allTags={allTags}
            onEditTrade={(trade) => {
              // Use the same edit handler as in DayDialog
              if (props.onUpdateTradeProperty) {
                setNewTrade(() => (createEditTradeData(trade)));
                setShowAddForm({ open: true, date: new Date(trade.date), editTrade: trade, createTempTrade: false, showDayDialogWhenDone: false });
              }
            }}
            onDeleteTrade={(tradeId) => {
              // Use the same delete handler as in DayDialog
              handleDeleteClick(tradeId);
            }}
            onDeleteMultipleTrades={handleDeleteMultipleTrades}
            onZoomImage={(imageUrl, allImages, initialIndex) => {
              setZoomedImage(imageUrl, allImages, initialIndex);
            }}
          />
        </Box>

        <DayDialog
          open={!!selectedDate && !showAddForm?.open}
          onClose={() => {
            setSelectedDate(null);
          }}
          showAddForm={(trade) => {
            if (trade !== null) {
              setNewTrade(() => (createEditTradeData(trade!!)));
            }
            setShowAddForm({ open: true, date: selectedDate!!, editTrade: trade, createTempTrade: trade === null, showDayDialogWhenDone: true });
          }}
          date={selectedDate || new Date()}
          trades={selectedDate ? tradesForSelectedDay : []}
          onUpdateTradeProperty={onUpdateTradeProperty}
          onDeleteTrade={handleDeleteClick}
          onDeleteMultipleTrades={handleDeleteMultipleTrades}
          calendarId={calendarId!!}
          onDateChange={handleDayChange}
          setZoomedImage={setZoomedImage}
          accountBalance={accountBalance}
          allTrades={trades} /* Pass all trades for tag suggestions */
          deletingTradeIds={deletingTradeIds}

        />


        <TradeFormDialog
          open={!!showAddForm?.date && showAddForm?.open || false}
          onClose={() => {
            setSelectedDate(null);
            setShowAddForm(null);
            if (newTrade != null && newTrade.pendingImages) {
              // Release object URLs to avoid memory leaks
              newTrade.pendingImages.forEach(image => {
                URL.revokeObjectURL(image.preview);
              });
              setNewTrade(null);
            }
          }}
          onCancel={() => {
            if (showAddForm?.showDayDialogWhenDone) {
              setSelectedDate(null);
              setSelectedDate(showAddForm?.date!!); // show the day dialog
            }
            setShowAddForm(null);
          }}
          showForm={{ open: showAddForm?.open || false, editTrade: showAddForm?.editTrade || null, createTempTrade: showAddForm?.createTempTrade || false }}
          date={showAddForm?.date || new Date()}
          trades={showAddForm?.date ? tradesForSelectedDay : []}
          onAddTrade={handleAddTrade}
          onTagUpdated={onTagUpdated}
          newMainTrade={newTrade}
          setNewMainTrade={prev => setNewTrade(prev(newTrade!!))}
          onUpdateTradeProperty={onUpdateTradeProperty}
          calendarId={calendarId!!}
          setZoomedImage={setZoomedImage}
          accountBalance={accountBalance}
          onAccountBalanceChange={onAccountBalanceChange}
          allTrades={trades}
          tags={allTags}
          dynamicRiskSettings={dynamicRiskSettings}
          requiredTagGroups={requiredTagGroups}
        />

        {/* Day Notes Dialog */}
        {isDayNotesDialogOpen && (
          <DayNotesDialog
            open={!!isDayNotesDialogOpen}
            onClose={() => {
              setIsDayNotesDialogOpen(null);
            }}
            notes={calendarDayNotes && isDayNotesDialogOpen ? (calendarDayNotes.get(isDayNotesDialogOpen) || '') : ''}
            day={isDayNotesDialogOpen}
            calendarId={calendarId!!}
            onUpdateCalendarProperty={onUpdateCalendarProperty}
          />
        )}


        {/* Image Zoom Dialog */}
        {zoomedImages && <ImageZoomDialog
          open={!!zoomedImages}
          onClose={() => setZoomedImagesState(null)}
          imageProp={zoomedImages}
        />}

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




        {/* Drawers */}
        <TagFilterDrawer
          open={isTagFilterDrawerOpen}
          onClose={() => setIsTagFilterDrawerOpen(false)}
          allTags={allTags}
          selectedTags={selectedTags}
          onTagsChange={handleTagsChange}
        />

        <TagManagementDrawer
          open={isTagManagementDrawerOpen}
          onClose={() => setIsTagManagementDrawerOpen(false)}
          allTags={allTags}
          calendarId={calendarId!!}
          onTagUpdated={onTagUpdated}
          requiredTagGroups={requiredTagGroups}
          onUpdateCalendarProperty={onUpdateCalendarProperty}
        />

        {/* Snackbar for notifications */}
        <TagManagementDialog
          open={isTagManagementDialogOpen}
          onClose={() => setIsTagManagementDialogOpen(false)}
          allTags={allTags}
          calendarId={calendarId!!}
          onTagUpdated={onTagUpdated}
          requiredTagGroups={requiredTagGroups}
          onUpdateCalendarProperty={onUpdateCalendarProperty}
        />

        {/* Confirmation Delete Dialog */}
        <ConfirmationDialog
          open={isDeleteDialogOpen}
          title={tradesToDelete.length === 1 ? "Delete Trade" : `Delete ${tradesToDelete.length} Trades`}
          message={
            tradesToDelete.length === 1
              ? "Are you sure you want to delete this trade? This action cannot be undone."
              : `Are you sure you want to delete ${tradesToDelete.length} trades? This action cannot be undone.`
          }
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
          confirmColor="error"
          isSubmitting={deletingTradeIds.some(id => tradesToDelete.includes(id))}
        />

        <Snackbar
          open={snackbarOpen}
          autoHideDuration={snackbarSeverity === 'success' ? 3000 : deleteError ? 6000 : 4000}
          onClose={handleSnackbarClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={handleSnackbarClose}
            severity={snackbarSeverity}
            variant="filled"
            sx={{ width: '100%' }}
            action={
              deleteError && tradesToDelete.length > 0 ? (
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => {
                    handleSnackbarClose();
                    retryDeletion();
                  }}
                  sx={{ color: 'inherit' }}
                >
                  Retry
                </Button>
              ) : undefined
            }
          >
            {snackbarMessage}
          </Alert>
        </Snackbar>



        {/* Pinned Trades Drawer */}
        <PinnedTradesDrawer
          open={pinnedTradesDrawerOpen}
          onClose={() => setPinnedTradesDrawerOpen(false)}
          trades={trades}
          onTradeClick={(trade) => {
            // Close drawer and open the trade in expanded view
            setPinnedTradesDrawerOpen(false);
            setSelectedDate(new Date(trade.date));
          }}
        />
      </Box>
    </Box>
  );
};

export default TradeCalendar;
