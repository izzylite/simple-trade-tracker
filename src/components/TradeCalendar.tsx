import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { FC } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Dialog,
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
  Close as CloseIcon,
  Security as SecurityIcon,
  Info as InfoIcon,
  Edit as EditIcon,
  EventNote as EventNoteIcon,
  NoteAdd as NoteAddIcon,
  Add as AddIcon
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
import PerformanceCharts from './PerformanceCharts';
import TagFilterDialog from './TagFilterDialog';
import TargetBadge from './TargetBadge';
import { CalendarCell, WeekdayHeader } from './CalendarGrid';

import {
  StyledCalendarDay,
  DayStatus,
  AnimatedPulse,
  DayNumber,
  TradeAmount,
  TradeCount,
  DialogTitleStyled,
  DialogContentStyled,
} from './StyledComponents';
import { useNavigate, useParams } from 'react-router-dom';
import { dialogProps } from '../styles/dialogStyles';
import { scrollbarStyles } from '../styles/scrollbarStyles';
import { useAuth } from '../contexts/AuthContext';
import ImageZoomDialog, { ImageZoomProp } from './ImageZoomDialog';
import { NewTradeForm, TradeImage } from './trades/TradeForm';
import DayNotesDialog from './DayNotesDialog';
import { Calendar } from '../types/calendar';
import MonthlyStats from './MonthlyStats';
import AccountStats from './AccountStats';
import DayNoteCard from './DayNoteCard';

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
  onAddTrade?: (trade: Trade) => Promise<void>;
  onEditTrade?: (trade: Trade) => Promise<void>;
  onUpdateTradeProperty?: (tradeId: string, updateCallback: (trade: Trade) => Trade, createIfNotExists?: (tradeId: string) => Trade) => Promise<Trade | undefined>;
  onUpdateCalendarProperty?: (calendarId: string, updateCallback: (calendar: Calendar) => Calendar ) => Promise<void>;

  onImageUpload?: (tradeId: string, image: TradeImage, add: boolean) => Promise<void>;
  onDeleteTrade?: (tradeId: string) => Promise<void>;
  onAccountBalanceChange: (balance: number) => void;
  onTagUpdated?: (oldTag: string, newTag: string) => void;
  onImportTrades?: (trades: Trade[]) => void;
  calendarName?: string,
  calendarNote?: string;
  calendarDayNotes?: Map<string, string>;
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
  trades: Trade[],
  accountBalance: number,
  maxDailyDrawdown: number,
  dynamicRiskEnabled?: boolean,
  increasedRiskPercentage?: number,
  profitThresholdPercentage?: number,
  totalPnL?: number
): DayStats => {
  // Calculate net amount for the day
  const netAmount = trades.reduce((sum, trade) => sum + trade.amount, 0);

  // Calculate percentage loss/gain relative to account balance
  const percentage = accountBalance > 0 ? ((netAmount / accountBalance) * 100).toFixed(1) : '0';

  let status: DayStatus = 'neutral';
  if (trades.length > 0) {
    status = netAmount > 0 ? 'win' : netAmount < 0 ? 'loss' : trades.find(trade => trade.type === 'breakeven') ? 'breakeven' : 'neutral';
  }

  // Calculate effective max daily drawdown based on dynamic risk settings
  let effectiveMaxDailyDrawdown = maxDailyDrawdown;

  if (dynamicRiskEnabled &&
      increasedRiskPercentage &&
      profitThresholdPercentage &&
      totalPnL !== undefined &&
      accountBalance > 0) {
    // Calculate profit percentage based on account balance + totalPnL
    const profitPercentage = (totalPnL / accountBalance) * 100;

    // If profit threshold is met, adjust the max daily drawdown proportionally
    if (profitPercentage >= profitThresholdPercentage) {
      // Adjust drawdown limit proportionally to the risk increase
      const riskRatio = increasedRiskPercentage / (maxDailyDrawdown / 2); // Assuming riskPerTrade is half of maxDailyDrawdown
      effectiveMaxDailyDrawdown = maxDailyDrawdown * riskRatio;
    }
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
    onTagUpdated,
    onUpdateTradeProperty,
    onUpdateCalendarProperty,
    onAccountBalanceChange,
    onImportTrades,
    calendarName,
    calendarNote,
    calendarDayNotes,
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
  const [zoomedImages, setZoomedImagesState] = useState<ImageZoomProp | null>(null);




  // Custom function to handle setting zoomed image and related state
  const setZoomedImage = useCallback((url: string, allImages?: string[], initialIndex?: number) => {
    setZoomedImagesState({ selectetdImageIndex: initialIndex || 0, allImages: allImages || [url] });

  }, []);
  const [isPerformanceDialogOpen, setIsPerformanceDialogOpen] = useState(false);
  const [isDynamicRiskToggled, setIsDynamicRiskToggled] = useState(true); // Default to true (using actual amounts)
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

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

  const handleDayClick = (date: Date) => {
    // Prevent adding new trades when app is loading all trades
    if (isLoadingTrades) {
      console.log('Cannot add trade while trades are loading');
      setSnackbarMessage('Cannot add trade while trades are loading. Please wait...');
      setSnackbarOpen(true);
      return;
    }

    if(!isDynamicRiskToggled){
      // Reset to use actual amounts set to false before adding any trade
      setIsDynamicRiskToggled(true);
      if (onToggleDynamicRisk) {
        onToggleDynamicRisk(true);
      }
      return;
    }
    const trades = filteredTrades.filter(trade => isSameDay(new Date(trade.date), date));
    if(trades.length==0){
      setNewTrade(createNewTradeData)
    }
    setSelectedDate(date);
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

  return (
    <Box>
      <AppBar
        position="fixed"
        color="transparent"
        elevation={0.7}
        sx={{
          backdropFilter: 'blur(8px)',
          backgroundColor: alpha(mode === 'light' ? '#ffffff' : theme.palette.background.default, 0.9),
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
            alignItems: 'center',
            width: '100%'
          }}>
            <Box sx={{ flex: 1, maxWidth: '600px' }}>
              <AccountStats
                balance={accountBalance}
                totalProfit={totalProfit}
                onChange={onAccountBalanceChange}
                trades={filteredTrades}
                onPerformanceClick={() => setIsPerformanceDialogOpen(true)}
                riskPerTrade={riskPerTrade}
                dynamicRiskEnabled={dynamicRiskEnabled}
                increasedRiskPercentage={increasedRiskPercentage}
                profitThresholdPercentage={profitThresholdPercentage}
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
            <DayNoteCard
              calendarNotes={calendarDayNotes || new Map()}
              setIsDayNotesDialogOpen={setIsDayNotesDialogOpen}
            />

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
                        dynamicRiskEnabled,
                        increasedRiskPercentage,
                        profitThresholdPercentage,
                        totalProfit
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
        </Box>

        <DayDialog
          open={!!selectedDate}
          onClose={() => {
            setSelectedDate(null);
            if (newTrade != null && newTrade.pendingImages) {
              // Release object URLs to avoid memory leaks
              newTrade.pendingImages.forEach(image => {
                URL.revokeObjectURL(image.preview);
              });
              setNewTrade(null);
            }
          }}
          showForm={newTrade!=null}
          date={selectedDate || new Date()}
          trades={selectedDate ? tradesForSelectedDay : []}
          onAddTrade={handleAddTrade}
          onTagUpdated={onTagUpdated}
          newMainTrade={newTrade}
          setNewMainTrade={prev => setNewTrade(prev(newTrade!!))}
          onUpdateTradeProperty={onUpdateTradeProperty}
          calendarId={calendarId!!}
          onDateChange={handleDayChange}
          setZoomedImage={setZoomedImage}
          accountBalance={accountBalance}
          onAccountBalanceChange={onAccountBalanceChange}
          allTrades={trades} /* Pass all trades for tag suggestions */
          riskPerTrade={riskPerTrade}
          dynamicRiskEnabled={dynamicRiskEnabled}
          increasedRiskPercentage={increasedRiskPercentage}
          profitThresholdPercentage={profitThresholdPercentage}
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

        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={4000}
          onClose={handleSnackbarClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={handleSnackbarClose}
            severity="warning"
            variant="filled"
            sx={{ width: '100%' }}
          >
            {snackbarMessage}
          </Alert>
        </Snackbar>
      </Box>
    </Box>
  );
};

export default TradeCalendar;