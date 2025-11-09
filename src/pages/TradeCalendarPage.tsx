import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { FC } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,

  Stack,
  useTheme,
  useMediaQuery,
  alpha,
  Tooltip,
  SxProps,
  Theme,
  Toolbar,
  Snackbar,
  Alert,
  Fab,

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
  Event as EventIcon,
  SmartToy as AIIcon,
  Home as HomeIcon,
  CalendarToday as CalendarIcon,
  Image as ImageIcon,
  ExpandLess,
  ExpandMore

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
import CalendarNote from '../components/CalendarNote';
import { Trade } from '../types/trade';
import DayDialog from '../components/trades/DayDialog';
import SelectDateDialog from '../components/SelectDateDialog';

import TagFilterDialog from '../components/TagFilterDialog';
import TagManagementDialog from '../components/TagManagementDialog';
import TagManagementDrawer from '../components/TagManagementDrawer';
import SearchDrawer from '../components/SearchDrawer';
import TargetBadge from '../components/TargetBadge';
import { CalendarCell, WeekdayHeader } from '../components/CalendarGrid';

import {
  StyledCalendarDay,
  DayStatus,
  AnimatedPulse,
  DayNumber,
  TradeAmount,
  TradeCount,

} from '../components/StyledComponents';
import { useNavigate, useParams } from 'react-router-dom';

import ImageZoomDialog, { ImageZoomProp } from '../components/ImageZoomDialog';

import Breadcrumbs, { BreadcrumbItem, BreadcrumbButton } from '../components/common/Breadcrumbs';
import { NewTradeForm, TradeImage } from '../components/trades/TradeForm';
import DayNotesDialog from '../components/DayNotesDialog';
import { Calendar } from '../types/calendar';
import MonthlyStats from '../components/MonthlyStats';
import AccountStats from '../components/AccountStats';
import TradeFormDialog, { createEditTradeData } from '../components/trades/TradeFormDialog';
import ConfirmationDialog from '../components/common/ConfirmationDialog';
import PinnedTradesDrawer from '../components/PinnedTradesDrawer';
import TradeGalleryDialog from '../components/TradeGalleryDialog';
import ShareButton from '../components/sharing/ShareButton';

import { ImagePickerDialog, ImageAttribution } from '../components/heroImage';
import AIChatDrawer from '../components/aiChat/AIChatDrawer';

import { calculatePercentageOfValueAtDate, DynamicRiskSettings } from '../utils/dynamicRiskUtils';

import MonthlyStatisticsSection from '../components/MonthlyStatisticsSection';
import FloatingMonthNavigation from '../components/FloatingMonthNavigation';
import { calculateDayStats, calculateTargetProgress } from '../utils/statsUtils';
import EconomicCalendarDrawer, { DEFAULT_ECONOMIC_EVENT_FILTER_SETTINGS } from '../components/economicCalendar/EconomicCalendarDrawer';
import { useEconomicEventWatcher, useEconomicEventsUpdates } from '../hooks/useEconomicEventWatcher';
import EconomicEventNotification from '../components/notifications/EconomicEventNotification';
import { EconomicEvent } from '../types/economicCalendar';
import { useHighImpactEvents } from '../hooks/useHighImpactEvents';
import { log, logger } from '../utils/logger';
import { playNotificationSound } from '../utils/notificationSound';

interface TradeCalendarProps {
  trades: Trade[];
  accountBalance: number;
  maxDailyDrawdown: number;
  weeklyTarget?: number;
  monthly_target?: number;
  yearlyTarget?: number;
  dynamicRiskSettings: DynamicRiskSettings;
  requiredTagGroups?: string[];
  allTags?: string[]; // Add allTags prop to receive calendar.tags
  onAddTrade?: (trade: Trade) => Promise<void>;
  onEditTrade?: (trade: Trade) => Promise<void>;
  onUpdateTradeProperty?: (tradeId: string, updateCallback: (trade: Trade) => Trade, createIfNotExists?: (tradeId: string) => Trade) => Promise<Trade | undefined>;
  onUpdateCalendarProperty?: (calendarId: string, updateCallback: (calendar: Calendar) => Calendar) => Promise<Calendar | undefined>;
  onToggleTheme: () => void;
  mode: 'light' | 'dark';
  // Read-only mode for shared calendars
  isReadOnly?: boolean;

  onImageUpload?: (tradeId: string, image: TradeImage, add: boolean) => Promise<void>;
  onDeleteTrades?: (tradeIds: string[]) => Promise<void>;
  onAccountBalanceChange: (balance: number) => void;
  onTagUpdated?: (oldTag: string, newTag: string) => void;
  onImportTrades?: (trades: Trade[]) => Promise<void>;
  calendarName?: string,
  calendarNote?: string;
  heroImageUrl?: string;
  heroImageAttribution?: ImageAttribution;

  calendarDayNotes?: Map<string, string>;
  // Score settings
  scoreSettings?: import('../types/score').ScoreSettings;
  onClearMonthTrades: (month: number, year: number) => void;


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
  trade_date: Date;
  trades: Trade[];
  monthStart: Date;
  weekIndex: number;
  currentMonth: number;
  accountBalance: number;
  weeklyTarget?: number;
  sx?: SxProps<Theme>;
}





const WeeklyPnL: React.FC<WeeklyPnLProps> = ({ trade_date, trades, monthStart, weekIndex, currentMonth, accountBalance, weeklyTarget, sx }) => {
  const theme = useTheme();
  const weekStart = startOfWeek(trade_date, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(trade_date, { weekStartsOn: 0 });

  const weekTrades = trades.filter(trade =>
    isSameWeek(new Date(trade.trade_date), weekStart, { weekStartsOn: 0 }) &&
    new Date(trade.trade_date).getMonth() === currentMonth
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
  amount: 0,
  trade_type: 'win',
  entry_price: 0,
  trade_date: null,
  exit_price: 0,
  stop_loss: 0,
  take_profit: 0,
  tags: [],
  risk_to_reward: 0,
  partials_taken: false,
  session: '',
  notes: '',
  pending_images: [],
  uploaded_images: [],
  economic_events: [],
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
    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 }, flex: { xs: 1, sm: 'none' } }}>
      <Tooltip title="Filter by tags" arrow>
        <Button
          variant={selectedTags.length > 0 ? "contained" : "outlined"}
          size="small"
          startIcon={<FilterAlt sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }} />}
          onClick={onOpenDrawer}
          sx={{
            flex: 1,
            minWidth: { xs: 'auto', sm: '120px' },
            borderRadius: 2,
            fontWeight: 600,
            textTransform: 'none',
            fontSize: { xs: '0.8125rem', sm: '0.875rem' },
            py: { xs: 0.75, sm: 1 },
            px: { xs: 1.5, sm: 2 },
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
          {selectedTags.length > 0 ? `${selectedTags.length} tag${selectedTags.length > 1 ? 's' : ''}` : 'Filter'}
        </Button>
      </Tooltip>

      {selectedTags.length > 0 && (
        <Tooltip title="Clear all filters" arrow>
          <IconButton
            size="small"
            onClick={handleClearTags}
            sx={{
              bgcolor: alpha(theme.palette.error.main, 0.1),
              color: 'error.main',
              borderRadius: 2,
              p: { xs: 0.5, sm: 0.75 },
              '&:hover': {
                bgcolor: alpha(theme.palette.error.main, 0.2)
              },
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <Clear sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }} />
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
    monthly_target,
    yearlyTarget,
    dynamicRiskSettings,
    requiredTagGroups,
    allTags: propAllTags, // Receive calendar.tags from parent
    onAddTrade,
    onTagUpdated,
    onUpdateTradeProperty,
    onDeleteTrades,
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

    // Pre-calculated statistics
    totalPnL,
    // Dynamic risk toggle
    onToggleDynamicRisk,
    // Loading state
    isLoadingTrades = false,
    calendar,
    // Read-only mode
    isReadOnly = false
  } = props;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDayNotesDialogOpen, setIsDayNotesDialogOpen] = useState<string | null>(null);
  const [isMonthSelectorOpen, setIsMonthSelectorOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTrade, setNewTrade] = useState<NewTradeForm | null>(null);
  const [showAddForm, setShowAddForm] = useState<{ open: boolean, trade_date: Date, editTrade?: Trade | null, createTempTrade?: boolean, showDayDialogWhenDone: boolean } | null>(null);
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
  // Calendar note expand state (controlled via breadcrumbs)
  const [isNoteExpanded, setIsNoteExpanded] = useState(false);
  const handleToggleNoteExpand = useCallback(() => {
    setIsNoteExpanded(prev => !prev);
  }, []);

  const [isEconomicCalendarOpen, setIsEconomicCalendarOpen] = useState(false);

  // AI Chat drawer state
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);

  // Economic event notification state
  // Notification stack state (moved from App.tsx)
  const [notifications, setNotifications] = useState<EconomicEvent[]>([]);
  const [removingNotifications, setRemovingNotifications] = useState<Set<string>>(new Set());
  const [economicCalendarUpdatedEvent, setEconomicCalendarUpdatedEvent] = useState<{ updatedEvents: EconomicEvent[], allEvents: EconomicEvent[] } | null>(null);
  const breadcrumbButtons: BreadcrumbButton[] = [ 
    {
      key: 'expand',
      icon: isNoteExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />,
      onClick: handleToggleNoteExpand,
      tooltip: isNoteExpanded ? 'Hide description' : 'Show description'
    },
    ...((onUpdateCalendarProperty && !isReadOnly) ? [{
      key: 'image',
      icon: <ImageIcon fontSize="small" />,
      onClick: () => setIsImagePickerOpen(true),
      tooltip: heroImageUrl ? 'Change cover image' : 'Add cover image'
    }] : [])
  ];

  const breadcrumbRightContent = (!isReadOnly && calendar && onUpdateCalendarProperty) ? (
    <ShareButton type="calendar"  item={calendar} onUpdateItemProperty={onUpdateCalendarProperty} size="small" />
  ) : null;


  const theme = useTheme();
  const { calendarId } = useParams();

  // Breadcrumb items
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Home', path: '/', icon: <HomeIcon sx={{ fontSize: 18 }} /> },
    { label: 'Calendars', path: '/calendars', icon: <CalendarIcon sx={{ fontSize: 18 }} /> },
    { label: calendarName || 'Calendar', path: `/calendar/${calendarId}` }
  ];

  // Use optimized hook for high-impact economic events
  const { highImpactEventDates: monthlyHighImpactEvents } = useHighImpactEvents({
    currentDate,
    calendarId,
    currencies: calendar?.economic_calendar_filters?.currencies,
    enabled: !!calendar?.economic_calendar_filters
  });

  // Economic event watcher for real-time updates
  const { watchingStatus } = useEconomicEventWatcher({
    calendarId,
    economic_calendar_filters: calendar?.economic_calendar_filters,
    isActive: true // Always active when TradeCalendar is mounted
  });


  // Listen for multiple economic event updates (same release time)
  useEconomicEventsUpdates((updatedEvents, allEvents, updatedCalendarId) => {
    if (updatedCalendarId === calendarId) {
      log(`📊 ${updatedEvents.length} economic events were updated simultaneously for this calendar`);

      // Check if notifications are enabled before showing them
      const notificationsEnabled = calendar?.economic_calendar_filters?.notificationsEnabled ?? true;

      // 1. Show notification sliders for each event (leveraging stacking behavior) - only if enabled
      if (notificationsEnabled) {
        log(`🔔 Notifications enabled - showing ${updatedEvents.length} event notification(s)`);
        updatedEvents.forEach(event => {
          addNotification(event);
        });
      } else {
        log(`🔕 Notifications disabled - skipping ${updatedEvents.length} event notification(s)`);
      }

      // 2. Pass events to Economic Calendar Drawer if it's open (always update drawer regardless of notification setting)
      if (isEconomicCalendarOpen) {
        // For multiple events, we'll pass the first event but include all events in the events array
        setEconomicCalendarUpdatedEvent({
          updatedEvents, // Primary events for display
          allEvents // All updated events
        });
        // Clear the updated event after a short delay to prevent re-triggering
        setTimeout(() => {
          setEconomicCalendarUpdatedEvent(null);
        }, 1000);
      }
    }
  });


  // Add a notification (call this when you want to show a new notification)
  const addNotification = (event: EconomicEvent) => {
    // Play notification sound
    playNotificationSound().catch(error => {
      logger.warn('Failed to play notification sound:', error);
    });

    setNotifications((prev) => {
      // If we already have 3 notifications, mark the oldest one for removal
      if (prev.length >= 3) {
        const oldestNotification = prev[0];
        setRemovingNotifications(prevRemoving => {
          const newSet = new Set(prevRemoving);
          newSet.add(oldestNotification.id);
          return newSet;
        });
        // Remove the oldest notification after animation delay
        setTimeout(() => {
          setNotifications(current => current.filter(n => n.id !== oldestNotification.id));
          setRemovingNotifications(current => {
            const newSet = new Set(current);
            newSet.delete(oldestNotification.id);
            return newSet;
          });
        }, 300);
      }
      return [...prev, event];
    });
  };

  // Close notification handler
  const handleCloseNotification = (id: string) => {
    setRemovingNotifications(prev => {
      const newSet = new Set(prev);
      newSet.add(id);
      return newSet;
    });
    setTimeout(() => {
      setNotifications((prev) => prev.filter(n => n.id !== id));
      setRemovingNotifications(current => {
        const newSet = new Set(current);
        newSet.delete(id);
        return newSet;
      });
    }, 300);
  };



  // Hero image handlers
  const handleHeroImageChange = async (imageUrl: string | null, attribution?: ImageAttribution) => {
    try {
      if (!onUpdateCalendarProperty) {
        throw new Error('onUpdateCalendarProperty is undefined');
      }

      await onUpdateCalendarProperty(calendarId!!, (calendar) => {
        const updatedCalendar = {
          ...calendar,
          hero_image_url: imageUrl || undefined,
          hero_image_attribution: imageUrl ? attribution : undefined
        };

        // For removal, we need to explicitly mark fields for deletion
        if (!imageUrl) {
          (updatedCalendar as any)._deleteHeroImage = true;
        }

        return updatedCalendar;
      });
    } catch (error) {
      logger.error('Error saving hero image:', error);
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

  // AI Chat toggle handler
  const handleToggleAIChat = useCallback(() => {
    setIsAIChatOpen(true);
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
    return filteredTrades.filter(trade => isSameDay(new Date(trade.trade_date), selectedDate));
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
    const pinnedTrades = trades.filter(trade => trade.is_pinned);
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
      // Use the new onDeleteTrades callback to actually delete trades from database
      if (onDeleteTrades) {
        await onDeleteTrades(tradesToDelete);
      }

      // Show success message
      const successMessage = tradesToDelete.length === 1
        ? 'Trade deleted successfully.'
        : `Successfully deleted ${tradesToDelete.length} trades.`;

      showSnackbar(successMessage, 'success');
    } catch (error) {
      logger.error('Error deleting trades:', error);
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


  const handleDayClick = (trade_date: Date) => {
    // In read-only mode, only allow viewing existing trades
    if (isReadOnly) {
      const trades = filteredTrades.filter(trade => isSameDay(new Date(trade.trade_date), trade_date));
      if (trades.length > 0) {
        setSelectedDate(trade_date);
      }
      return;
    }

    // Prevent adding new trades when app is loading all trades
    if (isLoadingTrades) {
      log('Cannot add trade while trades are loading');
      showSnackbar('Cannot add trade while trades are loading. Please wait...', 'warning');
      return;
    }
    if (trade_date > new Date()) {
      log('Cannot add trade in the future');
      showSnackbar('Cannot add trade in the future. Please select a valid date.', 'warning');
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
    const trades = filteredTrades.filter(trade => isSameDay(new Date(trade.trade_date), trade_date));
    if (trades.length === 0) {
      setNewTrade(createNewTradeData);
      setShowAddForm({ open: true, trade_date: trade_date, showDayDialogWhenDone: true });
    }
    else {
      setSelectedDate(trade_date);
    }
  };
  const handleDayChange = (trade_date: Date) => {
    setSelectedDate(trade_date);
  };


  const handleAddTrade = onAddTrade ? async (trade: Trade) => {
    await onAddTrade(trade);
  } : undefined;




  const handleMonthClick = () => {
    setIsMonthSelectorOpen(true);
  };

  const handleMonthSelect = (trade_date: Date) => {
    setCurrentDate(trade_date);
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
      isSameMonth(new Date(trade.trade_date), currentDate)
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
        isVisible={showFloatingMonthNav && !isNoteExpanded}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onMonthClick={handleMonthClick}
        onTodayClick={handleTodayClick}
      />



      {/* Breadcrumbs */}
      <Breadcrumbs items={breadcrumbItems} buttons={breadcrumbButtons} rightContent={breadcrumbRightContent} />

      <CalendarNote
        calendarNote={calendarNote || ''}
        calendarId={calendarId!!}
        title={calendarName}
        onUpdateCalendarProperty={isReadOnly ? undefined : onUpdateCalendarProperty}
        heroImageUrl={heroImageUrl}
        heroImageAttribution={heroImageAttribution}
        onOpenImagePicker={isReadOnly ? undefined : handleOpenImagePicker}
        onRemoveHeroImage={isReadOnly ? undefined : handleRemoveHeroImage}
        trades={trades}
        onOpenGalleryMode={openGalleryMode}
        calendarDayNotes={calendarDayNotes || new Map()}
        setIsDayNotesDialogOpen={isReadOnly ? undefined : setIsDayNotesDialogOpen}
        calendar={calendar}
        showImageButton={false}
        showShareButton={false}
        showExpandToggle={false}
        expanded={isNoteExpanded}
        onToggleExpand={handleToggleNoteExpand}
        isReadOnly={isReadOnly}
      />

      {/* Main Content Container */}
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: { xs: 2, sm: 2.5, md: 3 },
        p: { xs: 1.5, sm: 2, md: 3 },
        mt: { xs: 0.5, sm: 1 }
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
                risk_per_trade={dynamicRiskSettings?.risk_per_trade}
                dynamicRiskSettings={dynamicRiskSettings}
                onToggleDynamicRisk={(useActualAmounts) => {
                  setIsDynamicRiskToggled(useActualAmounts);
                  if (onToggleDynamicRisk) {
                    onToggleDynamicRisk(useActualAmounts);
                  }
                }}
                isDynamicRiskToggled={isDynamicRiskToggled}
                isReadOnly={isReadOnly}
              />
            </Box>

            <Box sx={{ flex: 1, height: '100%' }}>

              <MonthlyStats
                trades={filteredTrades}
                accountBalance={accountBalance}
                onImportTrades={onImportTrades}
                currentDate={currentDate}
                monthlyTarget={monthly_target}
                onClearMonthTrades={onClearMonthTrades}
                isReadOnly={isReadOnly}
              />

            </Box>


          </Box>


          {/* Calendar Navigation Header */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: { xs: 1.5, sm: 2, md: 3 },
            flexDirection: { xs: 'column', lg: 'row' },
            gap: { xs: 1.5, sm: 2, lg: 1 }
          }}>
            {/* Month Navigation with Enhanced Styling */}
            <Box
              data-testid="month-nav-section"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: { xs: 1, sm: 1.5, md: 2 },
                order: { xs: 1, lg: 0 }
              }}
            >
              <IconButton
                onClick={handlePrevMonth}
                size="small"
                sx={{
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: 'primary.main',
                  p: { xs: 0.75, sm: 1 },
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.2),
                    transform: 'scale(1.05)'
                  },
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                <ChevronLeft sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }} />
              </IconButton>

              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  cursor: 'pointer',
                  minWidth: { xs: '180px', sm: '220px', md: '250px' },
                  textAlign: 'center',
                  fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.8rem', lg: '2rem' },
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
                size="small"
                sx={{
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: 'primary.main',
                  p: { xs: 0.75, sm: 1 },
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.2),
                    transform: 'scale(1.05)'
                  },
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                <ChevronRight sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }} />
              </IconButton>
            </Box>
            {/* Enhanced Action Buttons */}
            <Box sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: 1, sm: 1.5, md: 2 },
              flexWrap: 'wrap',
              order: { xs: 0, lg: 1 },
              width: { xs: '100%', lg: 'auto' }
            }}>
              {/* Primary Actions Group */}
              <Box sx={{
                display: 'flex',
                gap: { xs: 0.75, sm: 1 },
                flexWrap: 'wrap',
                width: { xs: '100%', sm: 'auto' }
              }}>
                <Button
                  startIcon={<Today sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }} />}
                  onClick={handleTodayClick}
                  variant="contained"
                  size="small"
                  sx={{
                    flex: { xs: 1, sm: 'none' },
                    minWidth: { xs: 'auto', sm: '100px' },
                    borderRadius: 2,
                    fontWeight: 600,
                    textTransform: 'none',
                    fontSize: { xs: '0.8125rem', sm: '0.875rem' },
                    py: { xs: 0.75, sm: 1 },
                    px: { xs: 1.5, sm: 2 },
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
                    isSameMonth(new Date(trade.trade_date), currentDate)
                  );
                  return monthTrades.length > 0;
                })() && (
                    <Tooltip title="View all trades for this month in gallery mode" arrow>
                      <Button
                        startIcon={<GalleryIcon sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }} />}
                        onClick={handleMonthlyGalleryMode}
                        variant="outlined"
                        size="small"
                        sx={{
                          flex: { xs: 1, sm: 'none' },
                          minWidth: { xs: 'auto', sm: '120px' },
                          borderRadius: 2,
                          fontWeight: 600,
                          textTransform: 'none',
                          fontSize: { xs: '0.8125rem', sm: '0.875rem' },
                          py: { xs: 0.75, sm: 1 },
                          px: { xs: 1.5, sm: 2 },
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
                        Gallery
                      </Button>
                    </Tooltip>
                  )}
              </Box>

              {/* Secondary Actions Group */}
              <Box sx={{
                display: 'flex',
                gap: { xs: 0.75, sm: 1 },
                flexWrap: 'wrap',
                width: { xs: '100%', sm: 'auto' }
              }}>
                <Button
                  startIcon={<PinIcon sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }} />}
                  onClick={() => setPinnedTradesDrawerOpen(true)}
                  variant={hasPinnedTrades > 0 ? "contained" : "outlined"}
                  size="small"
                  sx={{
                    flex: { xs: 1, sm: 'none' },
                    minWidth: { xs: 'auto', sm: '100px' },
                    borderRadius: 2,
                    fontWeight: 600,
                    textTransform: 'none',
                    fontSize: { xs: '0.8125rem', sm: '0.875rem' },
                    py: { xs: 0.75, sm: 1 },
                    px: { xs: 1.5, sm: 2 },
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
                  Pinned
                </Button>

                <TagFilter
                  allTags={allTags}
                  selectedTags={selectedTags}
                  onTagsChange={handleTagsChange}
                  onOpenDrawer={() => setIsSearchDrawerOpen(true)}
                />

                {!isReadOnly && (
                  <Tooltip title="Manage tags and required tag groups" arrow>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<TagIcon sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }} />}
                      onClick={() => setIsTagManagementDrawerOpen(true)}
                      sx={{
                        flex: { xs: 1, sm: 'none' },
                        minWidth: { xs: 'auto', sm: '120px' },
                        borderRadius: 2,
                        fontWeight: 600,
                        textTransform: 'none',
                        fontSize: { xs: '0.8125rem', sm: '0.875rem' },
                        py: { xs: 0.75, sm: 1 },
                        px: { xs: 1.5, sm: 2 },
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
                      Tags
                    </Button>
                  </Tooltip>
                )}
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
                      if (index < 7 && !isReadOnly) {
                        setIsDayNotesDialogOpen(day);
                      }
                    }}
                    sx={{
                      display: index === 7 ? { xs: 'none', sm: 'flex' } : 'flex',
                      cursor: index < 7 && !isReadOnly ? 'pointer' : 'default',
                      position: 'relative',
                      justifyContent: 'center',
                      alignItems: 'center',
                      p: { xs: 1, md: 1.5 },
                      fontWeight: 600,
                      fontSize: { xs: '0.875rem', md: '1rem' },
                      color: 'text.secondary',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': index < 7 && !isReadOnly ? {
                        color: 'primary.main'
                      } : {}
                    }}
                  >
                    {day}
                    {hasNotes && (
                      <Tooltip
                        title={isReadOnly ? "This day has notes." : "This day has notes. Click to view or edit."}
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
              minHeight: { xs: 'auto', md: '400px' }
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
                      const dayTrades = filteredTrades.filter(trade => isSameDay(new Date(trade.trade_date), day));
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

                      // Check if this day has high-impact economic events
                      const dayDateString = format(day, 'yyyy-MM-dd');
                      const hasHighImpactEvents = monthlyHighImpactEvents.get(dayDateString) || false;

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

                            {/* Red dot indicator for high-impact economic events */}
                            {hasHighImpactEvents && (
                              <Box
                                sx={{
                                  position: 'absolute',
                                  top: 4,
                                  right: 4,
                                  width: 8,
                                  height: 8,
                                  m: 1,
                                  borderRadius: '50%',
                                  bgcolor: 'error.main',
                                  border: `2px solid ${alpha(theme.palette.background.paper, 0.8)}`,
                                  boxShadow: `0 0 0 1px ${alpha(theme.palette.error.main, 0.3)}`
                                }}
                              />

                            )}

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
                      trade_date={weekStart}
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

            {/* Weekly stats for mobile - HIDDEN to save space */}
            {/* Mobile users can view weekly stats in the monthly statistics section below */}
          </Box>


          {/*Current Monthly Statistics Section */}
          <MonthlyStatisticsSection
            trades={filteredTrades}
            selectedDate={currentDate}
            accountBalance={accountBalance}
            maxDailyDrawdown={maxDailyDrawdown}
            monthly_target={monthly_target}
            calendarId={calendarId!!}
            scoreSettings={scoreSettings}
            onUpdateTradeProperty={isReadOnly ? undefined : onUpdateTradeProperty}
            onUpdateCalendarProperty={isReadOnly ? undefined : onUpdateCalendarProperty}
            dynamicRiskSettings={dynamicRiskSettings}
            allTags={allTags}
            onEditTrade={isReadOnly ? undefined : (trade) => {
              // Use the same edit handler as in DayDialog
              if (props.onUpdateTradeProperty) {
                setNewTrade(() => (createEditTradeData(trade)));
                setShowAddForm({ open: true, trade_date: new Date(trade.trade_date), editTrade: trade, createTempTrade: false, showDayDialogWhenDone: false });
              }
            }}
            onDeleteTrade={isReadOnly ? undefined : (tradeId) => {
              // Use the same delete handler as in DayDialog
              handleDeleteClick(tradeId);
            }}
            onDeleteMultipleTrades={isReadOnly ? undefined : handleDeleteMultipleTrades}
            onZoomImage={(imageUrl, allImages, initialIndex) => {
              setZoomedImage(imageUrl, allImages, initialIndex);
            }}
            onOpenGalleryMode={openGalleryMode}
            economicFilter={(_calendarId) => calendar?.economic_calendar_filters || DEFAULT_ECONOMIC_EVENT_FILTER_SETTINGS}
          />


        </Box>

        <DayDialog
          open={!!selectedDate && !showAddForm?.open}
          onClose={() => {
            setSelectedDate(null);
          }}
          showAddForm={isReadOnly ? () => { } : (trade) => {
            if (trade !== null) {
              setNewTrade(() => (createEditTradeData(trade!!)));
            }
            setShowAddForm({ open: true, trade_date: selectedDate!!, editTrade: trade, createTempTrade: trade === null, showDayDialogWhenDone: true });
          }}
          date={selectedDate || new Date()}
          trades={selectedDate ? tradesForSelectedDay : []}
          onUpdateTradeProperty={isReadOnly ? undefined : onUpdateTradeProperty}
          onDeleteTrade={isReadOnly ? () => { } : handleDeleteClick}
          onDeleteMultipleTrades={isReadOnly ? undefined : handleDeleteMultipleTrades}
          calendarId={calendarId!!}
          onDateChange={handleDayChange}
          setZoomedImage={setZoomedImage}
          account_balance={accountBalance}
          allTrades={trades} /* Pass all trades for tag suggestions */
          deletingTradeIds={deletingTradeIds}
          onOpenGalleryMode={openGalleryMode}
          calendar={calendar}
          isReadOnly={isReadOnly}
        />


        {!isReadOnly && (
          <TradeFormDialog
            open={(!!showAddForm?.trade_date && showAddForm?.open) || false}
            onClose={() => {
              setSelectedDate(null);
              setShowAddForm(null);
              if (newTrade != null && newTrade.pending_images) {
                // Release object URLs to avoid memory leaks
                newTrade.pending_images.forEach(image => {
                  URL.revokeObjectURL(image.preview);
                });
                setNewTrade(null);
              }
            }}
            onCancel={() => {
              if (showAddForm?.showDayDialogWhenDone) {
                setSelectedDate(null);
                setSelectedDate(showAddForm?.trade_date!!); // show the day dialog
              }
              setShowAddForm(null);
            }}
            showForm={{ open: showAddForm?.open || false, editTrade: showAddForm?.editTrade || null, createTempTrade: showAddForm?.createTempTrade || false }}
            trade_date={showAddForm?.trade_date || new Date()}
            trades={showAddForm?.trade_date ? tradesForSelectedDay : []}
            onAddTrade={handleAddTrade}
            onTagUpdated={onTagUpdated}
            newMainTrade={newTrade}
            setNewMainTrade={prev => setNewTrade(prev(newTrade!!))}
            onUpdateTradeProperty={onUpdateTradeProperty}
            onDeleteTrades={onDeleteTrades}
            calendar_id={calendarId!!}
            setZoomedImage={setZoomedImage}
            account_balance={accountBalance}
            onAccountBalanceChange={onAccountBalanceChange}
            allTrades={trades}
            tags={allTags}
            dynamicRiskSettings={dynamicRiskSettings}
            requiredTagGroups={requiredTagGroups}
            onOpenGalleryMode={openGalleryMode}
          />
        )}

        {/* Day Notes Dialog */}
        {isDayNotesDialogOpen && !isReadOnly && (
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
          monthlyTarget={monthly_target}
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
          isReadOnly={isReadOnly}
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



        {/* AI Chat FAB - Hidden in read-only mode */}
        {!isReadOnly && (
          <Tooltip title="AI Trading Assistant" placement="left">
            <Fab
              color="secondary"
              aria-label="open ai chat"
              onClick={handleToggleAIChat}
              size="medium"
              sx={{
                position: 'fixed',
                bottom: { xs: 80, sm: 96 },
                right: { xs: 16, sm: 24 },
                zIndex: 1200,
                width: { xs: 48, sm: 56 },
                height: { xs: 48, sm: 56 }
              }}
            >
              <AIIcon sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }} />
            </Fab>
          </Tooltip>
        )}

        {/* Economic Calendar FAB - Hidden in read-only mode */}
        {!isReadOnly && (
          <Tooltip title="Economic Calendar" placement="left">
            <Fab
              color="primary"
              aria-label="open economic calendar"
              onClick={handleToggleEconomicCalendar}
              size="medium"
              sx={{
                position: 'fixed',
                bottom: { xs: 16, sm: 24 },
                right: { xs: 16, sm: 24 },
                zIndex: 1200,
                width: { xs: 48, sm: 56 },
                height: { xs: 48, sm: 56 }
              }}
            >
              <EventIcon sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }} />
            </Fab>
          </Tooltip>
        )}


        {/* Search & Filter Drawer */}
        {calendar && (
          <SearchDrawer
            open={isSearchDrawerOpen}
            onClose={() => setIsSearchDrawerOpen(false)}
            calendarId={calendar.id}
            allTags={allTags}
            selectedTags={selectedTags}
            onTagsChange={handleTagsChange}
            onTradeClick={(trade) => {
              // Close search drawer and open the trade in gallery mode
              setIsSearchDrawerOpen(false);
              openGalleryMode(trades, trade.id, "Search Results");
            }}
          />
        )}

        {/* Pinned Trades Drawer */}
        <PinnedTradesDrawer
          open={pinnedTradesDrawerOpen}
          onClose={() => setPinnedTradesDrawerOpen(false)}
          trades={trades}
          calendar={calendar}
          onTradeClick={(trade, allTrades, title) => {
            // Close drawer and open the trade in gallery mode
            setPinnedTradesDrawerOpen(false);
            openGalleryMode(allTrades, trade.id, title);
          }}
          onUpdateCalendarProperty={onUpdateCalendarProperty}
          onUpdateTradeProperty={isReadOnly ? undefined : onUpdateTradeProperty}
          onEditTrade={isReadOnly ? undefined : (trade) => {
            // Use the same edit handler as in DayDialog
            if (props.onUpdateTradeProperty) {
              setNewTrade(() => (createEditTradeData(trade)));
              setShowAddForm({ open: true, trade_date: new Date(trade.trade_date), editTrade: trade, createTempTrade: false, showDayDialogWhenDone: false });
            }
          }}
          onDeleteTrade={isReadOnly ? undefined : handleDeleteClick}
          onDeleteMultipleTrades={isReadOnly ? undefined : handleDeleteMultipleTrades}
          onZoomImage={setZoomedImage}
          onOpenGalleryMode={openGalleryMode}
          isReadOnly={isReadOnly}
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
        trades={trades}
        onUpdateCalendarProperty={onUpdateCalendarProperty}
        onOpenGalleryMode={openGalleryMode}
        payload={economicCalendarUpdatedEvent}
        onUpdateTradeProperty={isReadOnly ? undefined : onUpdateTradeProperty}
        onEditTrade={isReadOnly ? undefined : (trade) => {
          // Use the same edit handler as in DayDialog
          if (props.onUpdateTradeProperty) {
            setNewTrade(() => (createEditTradeData(trade)));
            setShowAddForm({ open: true, trade_date: new Date(trade.trade_date), editTrade: trade, createTempTrade: false, showDayDialogWhenDone: false });
          }
        }}
        onDeleteTrade={isReadOnly ? undefined : handleDeleteClick}
        onDeleteMultipleTrades={isReadOnly ? undefined : handleDeleteMultipleTrades}
        onZoomImage={setZoomedImage}
        isReadOnly={isReadOnly}
      />

      {/* AI Chat Drawer */}
      <AIChatDrawer
        open={isAIChatOpen}
        onClose={() => setIsAIChatOpen(false)}
        trades={trades}
        calendar={calendar!}
        onOpenGalleryMode={openGalleryMode}
        onUpdateTradeProperty={isReadOnly ? undefined : onUpdateTradeProperty}
        onEditTrade={isReadOnly ? undefined : (trade) => {
          // Use the same edit handler as in DayDialog
          if (props.onUpdateTradeProperty) {
            setNewTrade(() => (createEditTradeData(trade)));
            setShowAddForm({ open: true, trade_date: new Date(trade.trade_date), editTrade: trade, createTempTrade: false, showDayDialogWhenDone: false });
          }
        }}
        onDeleteTrade={isReadOnly ? undefined : handleDeleteClick}
        onDeleteMultipleTrades={isReadOnly ? undefined : handleDeleteMultipleTrades}
        onZoomImage={setZoomedImage}
        onUpdateCalendarProperty={onUpdateCalendarProperty}
        isReadOnly={isReadOnly}
      />


      {/* Notification stack container (bottom left, global) */}
      <Box
        sx={{
          position: 'fixed',
          bottom: { xs: 16, sm: 24 },
          left: { xs: 8, sm: 12 },
          right: { xs: 8, sm: 'auto' },
          zIndex: 1400,
          display: 'flex',
          flexDirection: 'column',
          gap: { xs: 1.5, sm: 2 },
          pointerEvents: 'none',
          maxWidth: { xs: 'calc(100% - 16px)', sm: '400px' }
        }}
      >
        {notifications.map(event => (
          <EconomicEventNotification
            key={event.id}
            event={event}
            onClose={() => handleCloseNotification(event.id)}
            autoHideDuration={30000}
            isRemoving={removingNotifications.has(event.id)}
          />
        ))}
      </Box>
    </Box>
  );
};

export default TradeCalendar;
