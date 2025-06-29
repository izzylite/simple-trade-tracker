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
  Fab,
  colors,

} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Today,

  FilterAlt,
  Clear,
  PushPin as PinIcon,
  Info as InfoIcon,
  LocalOffer as TagIcon,
  Search as SearchIcon,
  ViewCarousel as GalleryIcon,
  Article as NewsIcon,

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
import TagManagementDialog from './TagManagementDialog';
import TagManagementDrawer from './TagManagementDrawer';
import SearchDrawer from './SearchDrawer';
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

import ImageZoomDialog, { ImageZoomProp } from './ImageZoomDialog';
import AppHeader from './common/AppHeader';
import { NewTradeForm, TradeImage } from './trades/TradeForm';
import DayNotesDialog from './DayNotesDialog';
import { Calendar } from '../types/calendar';
import MonthlyStats from './MonthlyStats';
import AccountStats from './AccountStats';
import TradeFormDialog, { createEditTradeData } from './trades/TradeFormDialog';
import ConfirmationDialog from './common/ConfirmationDialog';
import PinnedTradesDrawer from './PinnedTradesDrawer';
import TradeGalleryDialog from './TradeGalleryDialog';
import { ImagePickerDialog, ImageAttribution } from './heroImage';

import { calculatePercentageOfValueAtDate, DynamicRiskSettings } from '../utils/dynamicRiskUtils';

import MonthlyStatisticsSection from './MonthlyStatisticsSection';
import FloatingMonthNavigation from './FloatingMonthNavigation';
import { calculateDayStats, calculateTargetProgress } from '../utils/statsUtils';
import { EconomicCalendarDrawer } from './economicCalendar';
import { useEconomicEventWatcher, useEconomicEventUpdates } from '../hooks/useEconomicEventWatcher';
import EconomicEventNotification from './notifications/EconomicEventNotification';
import { EconomicEvent } from '../types/economicCalendar';

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
  heroImageUrl?: string;
  heroImageAttribution?: ImageAttribution;

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
  // Calendar data for economic events filtering
  calendar?: Calendar
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
  const theme = useTheme();
  const weekStart = startOfWeek(date, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(date, { weekStartsOn: 0 });

  const weekTrades = trades.filter(trade =>
    isSameWeek(new Date(trade.date), weekStart, { weekStartsOn: 0 }) &&
    new Date(trade.date).getMonth() === currentMonth
  );


  // Calculate net amount for the week
  const netAmount = weekTrades.reduce((sum, trade) => sum + trade.amount, 0);

  // Calculate percentage loss/gain relative to account value at start of week (excluding current week trades)
  const percentage = trades
    ? calculatePercentageOfValueAtDate(netAmount, accountBalance, trades, weekStart).toFixed(1)
    : accountBalance > 0 ? ((netAmount / accountBalance) * 100).toFixed(1) : '0';


  // Calculate target progress using centralized function
  const targetProgressValue = weeklyTarget && weeklyTarget > 0
    ? calculateTargetProgress(weekTrades, accountBalance, weeklyTarget, weekStart, trades)
    : 0;
  const targetProgress = targetProgressValue.toFixed(0);
  const isTargetMet = weeklyTarget ? parseFloat(percentage) >= weeklyTarget : false;

  return (
    <CalendarCell sx={{
      bgcolor: 'background.paper',
      borderRadius: 1,
      border: `2px solid ${netAmount > 0
          ? alpha(theme.palette.success.main, 0.3)
          : netAmount < 0
            ? alpha(theme.palette.error.main, 0.3)
            : alpha(theme.palette.divider, 0.2)
        }`,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
      ...sx
    }}>
      <Stack spacing={0.5} sx={{ alignItems: 'center', p: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <TrendingUp sx={{
            fontSize: '1rem',
            color: netAmount > 0 ? 'success.main' : netAmount < 0 ? 'error.main' : 'text.secondary'
          }} />
          <Typography
            variant="caption"
            sx={{
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'text.primary'
            }}
          >
            Week {weekIndex + 1}
          </Typography>
        </Box>

        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            color: netAmount > 0 ? 'success.main' : netAmount < 0 ? 'error.main' : 'text.primary',
            fontSize: { xs: '0.9rem', md: '1rem' },
            textAlign: 'center'
          }}
        >
          {formatCurrency(netAmount)}
        </Typography>

        <Typography
          variant="body2"
          sx={{
            color: netAmount > 0 ? 'success.main' : netAmount < 0 ? 'error.main' : 'text.secondary',
            fontSize: '0.8rem',
            fontWeight: 600,
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
          sx={{
            fontSize: '0.75rem',
            textAlign: 'center',
            color: 'text.secondary',
            fontWeight: 500
          }}
        >
          {weekTrades.length} trade{weekTrades.length !== 1 ? 's' : ''}
        </Typography>
      </Stack>
    </CalendarCell>
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
      <Tooltip title="Filter by tags" arrow>
        <Button
          variant={selectedTags.length > 0 ? "contained" : "outlined"}
          size="medium"
          startIcon={<FilterAlt />}
          onClick={onOpenDrawer}
          sx={{
            minWidth: { xs: '120px', sm: 'auto' },
            borderRadius: 2,
            fontWeight: 600,
            textTransform: 'none',
            ...(selectedTags.length > 0 ? {
              bgcolor: alpha(theme.palette.info.main, 0.9),
              color: 'white',
              boxShadow: `0 4px 12px ${alpha(theme.palette.info.main, 0.3)}`,
              '&:hover': {
                bgcolor: theme.palette.info.main,
                boxShadow: `0 6px 16px ${alpha(theme.palette.info.main, 0.4)}`
              }
            } : {
              borderColor: alpha(theme.palette.text.secondary, 0.3),
              color: 'text.secondary',
              '&:hover': {
                borderColor: 'info.main',
                bgcolor: alpha(theme.palette.info.main, 0.1),
                color: 'info.main'
              }
            }),
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          {selectedTags.length > 0 ? `${selectedTags.length} tag${selectedTags.length > 1 ? 's' : ''}` : 'Filter Tags'}
        </Button>
      </Tooltip>

      {selectedTags.length > 0 && (
        <Tooltip title="Clear all filters" arrow>
          <IconButton
            size="medium"
            onClick={handleClearTags}
            sx={{
              bgcolor: alpha(theme.palette.error.main, 0.1),
              color: 'error.main',
              borderRadius: 2,
              '&:hover': {
                bgcolor: alpha(theme.palette.error.main, 0.2)
              },
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
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
    heroImageUrl,
    heroImageAttribution,
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
    isLoadingTrades = false, 
    calendar
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
  const [isTagManagementDrawerOpen, setIsTagManagementDrawerOpen] = useState(false);
  const [isSearchDrawerOpen, setIsSearchDrawerOpen] = useState(false);
  const [isDynamicRiskToggled, setIsDynamicRiskToggled] = useState(true); // Default to true (using actual amounts)
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'warning' | 'error'>('warning');
  const [showFloatingMonthNav, setShowFloatingMonthNav] = useState(false);
  const [pinnedTradesDrawerOpen, setPinnedTradesDrawerOpen] = useState(false);
  const [galleryMode, setGalleryMode] = useState<{
    open: boolean;
    trades: Trade[];
    initialTradeId?: string;
    title?: string;
  }>({
    open: false,
    trades: [],
    initialTradeId: undefined,
    title: undefined
  });

  // Image picker state
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);

  // Economic calendar drawer state
  const [isEconomicCalendarOpen, setIsEconomicCalendarOpen] = useState(false);

  // Economic event notification state
  const [notificationEvent, setNotificationEvent] = useState<EconomicEvent | null>(null);
  const [economicCalendarUpdatedEvent, setEconomicCalendarUpdatedEvent] = useState<{ event: EconomicEvent, events: EconomicEvent[] } | null>(null);

  const theme = useTheme();
  const { calendarId } = useParams();

  // Economic event watcher for real-time updates
  const { watchingStatus } = useEconomicEventWatcher({
    calendarId,
    economicCalendarFilters: calendar?.economicCalendarFilters,
    isActive: true // Always active when TradeCalendar is mounted
  });

  // Listen for economic event updates
  useEconomicEventUpdates((event, events, updatedCalendarId) => {
    if (updatedCalendarId === calendarId) {
      console.log(`📊 Economic event "${event.event}" was updated for this calendar`);

      // 1. Show notification slider
      setNotificationEvent(event);

      // 2. Pass event to Economic Calendar Drawer if it's open
      if (isEconomicCalendarOpen) {
        setEconomicCalendarUpdatedEvent({
          event,
          events
        });
        // Clear the updated event after a short delay to prevent re-triggering
        setTimeout(() => {
          setEconomicCalendarUpdatedEvent(null);
        }, 1000);
      }
    }
  });



  // Hero image handlers
  const handleHeroImageChange = async (imageUrl: string | null, attribution?: ImageAttribution) => {
    try {
      if (!onUpdateCalendarProperty) {
        throw new Error('onUpdateCalendarProperty is undefined');
      }

      await onUpdateCalendarProperty(calendarId!!, (calendar) => {
        const updatedCalendar = {
          ...calendar,
          heroImageUrl: imageUrl || undefined,
          heroImageAttribution: imageUrl ? attribution : undefined
        };

        // For removal, we need to explicitly mark fields for deletion
        if (!imageUrl) {
          (updatedCalendar as any)._deleteHeroImage = true;
        }

        return updatedCalendar;
      });
    } catch (error) {
      console.error('Error saving hero image:', error);
    }
  };

  const handleOpenImagePicker = () => {
    setIsImagePickerOpen(true);
  };

  const handleRemoveHeroImage = () => {
    handleHeroImageChange(null);
  };

  const handleImageSelect = async (imageUrl: string, attribution?: ImageAttribution) => {
    await handleHeroImageChange(imageUrl, attribution);
    setIsImagePickerOpen(false);
  };

  // Economic calendar toggle handler
  const handleToggleEconomicCalendar = useCallback(() => {
    setIsEconomicCalendarOpen(true);
  }, []);



  // Scroll detection for floating month navigation
  useEffect(() => {
    const handleScroll = () => {
      // Find the score section element
      const section = document.querySelector('[data-testid="month-nav-section"]');
      if (section) {
        const rect = section.getBoundingClientRect();
        // Show floating nav when section is NOT visible (top of element is NOT viewport)
        setShowFloatingMonthNav((rect.top <= window.innerHeight && rect.bottom >= 0) === false ? true : false);
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
    if (trades.length === 0) {
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

  // Gallery mode handlers
  const openGalleryMode = (trades: Trade[], initialTradeId?: string, title?: string) => {
    setGalleryMode({
      open: true,
      trades,
      initialTradeId,
      title
    });
  };

  const closeGalleryMode = () => {
    setGalleryMode({
      open: false,
      trades: [],
      initialTradeId: undefined,
      title: undefined
    });
  };

  const handleMonthlyGalleryMode = () => {
    // Filter trades to only include those from the current month
    const monthTrades = filteredTrades.filter(trade =>
      isSameMonth(new Date(trade.date), currentDate)
    );

    if (monthTrades.length > 0) {
      const monthName = format(currentDate, 'MMMM yyyy');
      const title = `${monthName} - Monthly Trades (${monthTrades.length} trades)`;
      openGalleryMode(monthTrades, monthTrades[0].id, title);
    }
  };



  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: 'custom.pageBackground',
      position: 'relative'
    }}>
      {/* Floating Month Navigation */}
      <FloatingMonthNavigation
        currentDate={currentDate}
        isVisible={showFloatingMonthNav}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onMonthClick={handleMonthClick}
        onTodayClick={handleTodayClick}
      />

      <AppHeader
        onToggleTheme={onToggleTheme}
        mode={mode}
        showBackButton={true}
        backButtonPath="/dashboard"
      />
      <Toolbar />

      <CalendarNote
        calendarNote={calendarNote || ''}
        calendarId={calendarId!!}
        title={calendarName}
        onUpdateCalendarProperty={onUpdateCalendarProperty}
        heroImageUrl={heroImageUrl}
        heroImageAttribution={heroImageAttribution}
        onOpenImagePicker={handleOpenImagePicker}
        onRemoveHeroImage={handleRemoveHeroImage}
        trades={trades}
        onOpenGalleryMode={openGalleryMode}
        calendarDayNotes={calendarDayNotes || new Map()}
        setIsDayNotesDialogOpen={setIsDayNotesDialogOpen}
      />

      {/* Main Content Container */}
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: { xs: 2, md: 3 },
        p: { xs: 2, md: 3 },
        mt: 1
      }}>

        {/* Content Wrapper with Modern Card Design */}
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: { xs: 2, md: 3 },
          maxWidth: '1400px',
          margin: '0 auto',
          width: '100%',
          position: 'relative'
        }}>

          {/* Stats Cards Section with Enhanced Layout */}
          <Box sx={{
            display: 'flex',
            gap: { xs: 2, md: 3 },
            flexDirection: { xs: 'column', lg: 'row' },
            justifyContent: 'center',
            alignItems: 'stretch',
            width: '100%'
          }}>

            <Box sx={{ flex: 1, height: '100%' }}>
              <AccountStats
                balance={accountBalance}
                totalProfit={totalProfit}
                onChange={onAccountBalanceChange}
                trades={filteredTrades}
                riskPerTrade={dynamicRiskSettings?.riskPerTrade}
                dynamicRiskSettings={dynamicRiskSettings}
                onToggleDynamicRisk={(useActualAmounts) => {
                  setIsDynamicRiskToggled(useActualAmounts);
                  if (onToggleDynamicRisk) {
                    onToggleDynamicRisk(useActualAmounts);
                  }
                }}
                isDynamicRiskToggled={isDynamicRiskToggled}
              />
            </Box>

            <Box sx={{ flex: 1, height: '100%' }}>

              <MonthlyStats
                trades={filteredTrades}
                accountBalance={accountBalance}
                onImportTrades={onImportTrades}
                currentDate={currentDate}
                monthlyTarget={monthlyTarget}
                onClearMonthTrades={onClearMonthTrades}
              />

            </Box>


          </Box>


          {/* Calendar Navigation Header */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: { xs: 2, md: 3 },
            flexDirection: { xs: 'column', lg: 'row' },
            gap: { xs: 2, lg: 1 }
          }}>
            {/* Month Navigation with Enhanced Styling */}
            <Box
              data-testid="month-nav-section"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                order: { xs: 1, lg: 0 }
              }}
            >
              <IconButton
                onClick={handlePrevMonth}
                sx={{
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: 'primary.main',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.2),
                    transform: 'scale(1.05)'
                  },
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                <ChevronLeft />
              </IconButton>

              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  cursor: 'pointer',
                  minWidth: { xs: '200px', sm: '250px' },
                  textAlign: 'center',
                  fontSize: { xs: '1.5rem', sm: '1.8rem', md: '2rem' },
                  letterSpacing: '-0.5px',
                  color: 'text.primary',
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    transform: 'scale(1.02)',
                    filter: 'brightness(1.1)'
                  }
                }}
                onClick={handleMonthClick}
              >
                {format(currentDate, 'MMMM yyyy')}
              </Typography>

              <IconButton
                onClick={handleNextMonth}
                sx={{
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: 'primary.main',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.2),
                    transform: 'scale(1.05)'
                  },
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                <ChevronRight />
              </IconButton>
            </Box>
            {/* Enhanced Action Buttons */}
            <Box sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: 1.5, sm: 2 },
              flexWrap: 'wrap',
              order: { xs: 0, lg: 1 }
            }}>
              {/* Primary Actions Group */}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  startIcon={<Today />}
                  onClick={handleTodayClick}
                  variant="contained"
                  size="medium"
                  sx={{
                    minWidth: { xs: '120px', sm: 'auto' },
                    borderRadius: 2,
                    fontWeight: 600,
                    textTransform: 'none',
                    boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
                    '&:hover': {
                      transform: 'translateY(-1px)',
                      boxShadow: `0 6px 16px ${alpha(theme.palette.primary.main, 0.4)}`
                    },
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                >
                  Today
                </Button>

                {(() => {
                  const monthTrades = filteredTrades.filter(trade =>
                    isSameMonth(new Date(trade.date), currentDate)
                  );
                  return monthTrades.length > 0;
                })() && (
                    <Tooltip title="View all trades for this month in gallery mode" arrow>
                      <Button
                        startIcon={<GalleryIcon />}
                        onClick={handleMonthlyGalleryMode}
                        variant="outlined"
                        size="medium"
                        sx={{
                          minWidth: { xs: '140px', sm: 'auto' },
                          borderRadius: 2,
                          fontWeight: 600,
                          textTransform: 'none',
                          borderColor: alpha(theme.palette.primary.main, 0.3),
                          color: 'primary.main',
                          '&:hover': {
                            borderColor: 'primary.main',
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            transform: 'translateY(-1px)',
                            boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.2)}`
                          },
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                      >
                        Gallery View
                      </Button>
                    </Tooltip>
                  )}
              </Box>

              {/* Secondary Actions Group */}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  startIcon={<PinIcon />}
                  onClick={() => setPinnedTradesDrawerOpen(true)}
                  variant={hasPinnedTrades > 0 ? "contained" : "outlined"}
                  size="medium"
                  sx={{
                    minWidth: { xs: '140px', sm: 'auto' },
                    borderRadius: 2,
                    fontWeight: 600,
                    textTransform: 'none',
                    ...(hasPinnedTrades > 0 ? {
                      bgcolor: alpha(theme.palette.secondary.main, 0.9),
                      color: 'white',
                      boxShadow: `0 4px 12px ${alpha(theme.palette.secondary.main, 0.3)}`,
                      '&:hover': {
                        bgcolor: theme.palette.secondary.main,
                        transform: 'translateY(-1px)',
                        boxShadow: `0 6px 16px ${alpha(theme.palette.secondary.main, 0.4)}`
                      }
                    } : {
                      borderColor: alpha(theme.palette.text.secondary, 0.3),
                      color: 'text.secondary',
                      '&:hover': {
                        borderColor: 'secondary.main',
                        bgcolor: alpha(theme.palette.secondary.main, 0.1),
                        color: 'secondary.main',
                        transform: 'translateY(-1px)'
                      }
                    }),
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                >
                  Pinned Trades
                </Button>

                <TagFilter
                  allTags={allTags}
                  selectedTags={selectedTags}
                  onTagsChange={handleTagsChange}
                  onOpenDrawer={() => setIsSearchDrawerOpen(true)}
                />

                <Tooltip title="Manage tags and required tag groups" arrow>
                  <Button
                    variant="outlined"
                    size="medium"
                    startIcon={<TagIcon />}
                    onClick={() => setIsTagManagementDrawerOpen(true)}
                    sx={{
                      minWidth: { xs: '140px', sm: 'auto' },
                      borderRadius: 2,
                      fontWeight: 600,
                      textTransform: 'none',
                      borderColor: alpha(theme.palette.text.secondary, 0.3),
                      color: 'text.secondary',
                      '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: 'primary.main',
                        transform: 'translateY(-1px)'
                      },
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  >
                    Manage Tags
                  </Button>
                </Tooltip>
              </Box>
            </Box>
          </Box>

          {/* Calendar Grid Container */}
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: { xs: 1, md: 2 }
          }}>
            {/* Enhanced Weekday Headers */}
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(7, 1fr)', sm: 'repeat(8, 1fr)' },
              gap: { xs: 1, md: 1.5 },
              mb: { xs: 1, md: 2 }
            }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Week'].map((day, index) => {
                const hasNotes = index < 7 && calendarDayNotes && calendarDayNotes.has(day) && calendarDayNotes.get(day)?.trim() !== '';

                return (
                  <WeekdayHeader
                    key={day}
                    onClick={() => {
                      if (index < 7) {
                        setIsDayNotesDialogOpen(day);
                      }
                    }}
                    sx={{
                      display: index === 7 ? { xs: 'none', sm: 'flex' } : 'flex',
                      cursor: index < 7 ? 'pointer' : 'default',
                      position: 'relative',
                      justifyContent: 'center',
                      alignItems: 'center',
                      p: { xs: 1, md: 1.5 },
                      fontWeight: 600,
                      fontSize: { xs: '0.875rem', md: '1rem' },
                      color: 'text.secondary',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': index < 7 ? {
                        color: 'primary.main'
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
                            fontSize: '1rem',
                            color: 'secondary.main'
                          }}
                        >
                          <InfoIcon fontSize="inherit" sx={{
                            color: theme.palette.info.main
                          }} />
                        </Box>
                      </Tooltip>
                    )}
                  </WeekdayHeader>
                );
              })}
            </Box>
            {/* Enhanced Calendar Grid */}
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(7, 1fr)', sm: 'repeat(8, 1fr)' },
              gap: { xs: 1, md: 1.5 },
              minHeight: '400px'
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
                        filteredTrades,
                        day
                      );
                      const isCurrentMonth = isSameMonth(day, currentDate);
                      const isCurrentDay = isToday(day);

                      return (
                        <CalendarCell key={day.toISOString()}>
                          <StyledCalendarDay
                            onClick={() => handleDayClick(day)}
                            $isCurrentMonth={isCurrentMonth}
                            $isCurrentDay={isCurrentDay}
                            $dayStatus={dayStats.status}

                          >
                            <DayNumber $isCurrentMonth={isCurrentMonth}>
                              {format(day, 'd')}
                            </DayNumber>
                            {dayTrades.length > 0 && (
                              //  <AnimatedPulse>

                              // </AnimatedPulse>
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
            onUpdateTradeProperty={onUpdateTradeProperty}
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
            onOpenGalleryMode={openGalleryMode}
            calendar={calendar}
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
          onOpenGalleryMode={openGalleryMode}
          calendar={calendar}
        />


        <TradeFormDialog
          open={(!!showAddForm?.date && showAddForm?.open) || false}
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
          onOpenGalleryMode={openGalleryMode}
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
            trades={trades}
            onOpenGalleryMode={openGalleryMode}
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
          onOpenGalleryMode={openGalleryMode}
        />




        {/* Drawers */}

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



        {/* Economic Calendar FAB */}
        <Tooltip title="Economic Calendar" placement="left">
          <Fab
            color="primary"
            aria-label="open economic calendar"
            onClick={handleToggleEconomicCalendar}
            sx={{
              position: 'fixed',
              bottom: 96,
              right: 24,
              zIndex: 1200
            }}
          >
            <NewsIcon />
          </Fab>
        </Tooltip>

        {/* Search & Filter FAB */}
        <Fab
          color="primary"
          aria-label="search and filter trades"
          onClick={() => setIsSearchDrawerOpen(true)}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1200
          }}
        >
          <SearchIcon />
        </Fab>

        {/* Search & Filter Drawer */}
        <SearchDrawer
          open={isSearchDrawerOpen}
          onClose={() => setIsSearchDrawerOpen(false)}
          trades={trades}
          allTags={allTags}
          selectedTags={selectedTags}
          onTagsChange={handleTagsChange}
          onTradeClick={(trade) => {
            // Close search drawer and open the trade in gallery mode
            setIsSearchDrawerOpen(false);
            openGalleryMode(trades, trade.id, "Search Results");
          }}
        />

        {/* Pinned Trades Drawer */}
        <PinnedTradesDrawer
          open={pinnedTradesDrawerOpen}
          onClose={() => setPinnedTradesDrawerOpen(false)}
          trades={trades}
          onTradeClick={(trade) => {
            // Close drawer and open the trade in gallery mode
            setPinnedTradesDrawerOpen(false);
            const pinnedTrades = trades.filter(t => t.isPinned);
            openGalleryMode(pinnedTrades, trade.id, "Pinned Trades");
          }}
        />

        {/* Trade Gallery Dialog */}
        <TradeGalleryDialog
          open={galleryMode.open}
          onClose={closeGalleryMode}
          trades={galleryMode.trades}
          initialTradeId={galleryMode.initialTradeId}
          onUpdateTradeProperty={onUpdateTradeProperty}
          setZoomedImage={setZoomedImage}
          title={galleryMode.title}
          calendarId={calendarId}
          onOpenGalleryMode={openGalleryMode}
          calendar={calendar}
        />



        {/* Image Picker Dialog */}
        <ImagePickerDialog
          open={isImagePickerOpen}
          onClose={() => setIsImagePickerOpen(false)}
          onImageSelect={handleImageSelect}
          title="Choose a cover image for your calendar"
        />

      </Box>

      {/* Economic Calendar Drawer */}
      <EconomicCalendarDrawer
        open={isEconomicCalendarOpen}
        onClose={() => setIsEconomicCalendarOpen(false)}
        calendar={calendar!}
        onUpdateCalendarProperty={onUpdateCalendarProperty}
        updatedEvent={economicCalendarUpdatedEvent}
      />

      {/* Economic Event Notification */}
      <EconomicEventNotification
        event={notificationEvent}
        onClose={() => setNotificationEvent(null)}
        autoHideDuration={6000} // 6 seconds
      />
    </Box>
  );
};

export default TradeCalendar;
