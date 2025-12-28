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
  Fade,

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
  Event as EventIcon,
  SmartToy as AIIcon,
  Home as HomeIcon,
  CalendarToday as CalendarIcon,
  Notes as NotesIcon,
  Edit as EditIcon

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
import { Calendar } from '../types/calendar';
import MonthlyStats from '../components/MonthlyStats';
import AccountStats from '../components/AccountStats';
import TradeFormDialog, { createEditTradeData } from '../components/trades/TradeFormDialog';
import CalendarFormDialog, { CalendarFormData } from '../components/CalendarFormDialog';
import ConfirmationDialog from '../components/common/ConfirmationDialog';
import PinnedTradesDrawer from '../components/PinnedTradesDrawer';
import TradeGalleryDialog from '../components/TradeGalleryDialog';
import ShareButton from '../components/sharing/ShareButton';

import AIChatDrawer from '../components/aiChat/AIChatDrawer';
import NotesDrawer from '../components/notes/NotesDrawer';
import { StackedNotesWidget } from '../components/reminderNotes';

import { calculatePercentageOfValueAtDate, DynamicRiskSettings } from '../utils/dynamicRiskUtils';
import AnimatedBackground from '../components/common/AnimatedBackground';
import { Z_INDEX } from '../styles/zIndex';

import FloatingMonthNavigation from '../components/FloatingMonthNavigation';
import { calculateDayStats, calculateTargetProgress } from '../utils/statsUtils';
import { calculateSessionStats } from '../utils/chartDataUtils';
import EconomicCalendarDrawer, { DEFAULT_ECONOMIC_EVENT_FILTER_SETTINGS } from '../components/economicCalendar/EconomicCalendarDrawer';
import { useEconomicEventWatcher, useEconomicEventsUpdates } from '../hooks/useEconomicEventWatcher';
import { TradeOperationsProps } from '../types/tradeOperations';
import EconomicEventNotification from '../components/notifications/EconomicEventNotification';
import { EconomicEvent } from '../types/economicCalendar';
import { useHighImpactEvents } from '../hooks/useHighImpactEvents';
import { log, logger } from '../utils/logger';
import { playNotificationSound } from '../utils/notificationSound';
import { useCalendarTrades } from '../hooks/useCalendarTrades';
import { SessionPerformanceAnalysis, TradesListDialog } from '../components/charts';

interface TradeCalendarProps {
  // Trade CRUD operations now handled internally via useCalendarTrades hook
  // All calendar data is now passed via the calendar object
  // All handlers are now internal - no external callbacks needed

  calendar: Calendar;
  setLoading: (loading: boolean, loadingAction?: "loading" | "importing" | "exporting") => void
  onToggleTheme: () => void;
  mode: 'light' | 'dark';
  // Read-only mode for shared calendars
  isReadOnly?: boolean;
}



interface WeeklyPnLProps {
  trade_date: Date;
  weekIndex: number;
  weeklyTarget?: number;
  sx?: SxProps<Theme>;
  // Pre-calculated stats
  weekStats: {
    weekTrades: Trade[];
    netAmount: number;
    percentage: string;
    targetProgressValue: number;
  };
}





const WeeklyPnL: React.FC<WeeklyPnLProps> = React.memo(({ trade_date, weekIndex, weeklyTarget, sx, weekStats }) => {
  const theme = useTheme();

  // Use pre-calculated stats
  const { weekTrades, netAmount, percentage, targetProgressValue } = weekStats;

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

        <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
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
        </Stack>

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
});



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

const TagFilter = React.memo<TagFilterProps>(({ allTags, selectedTags, onTagsChange, onOpenDrawer }) => {
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
          {selectedTags.length > 0 ? `${selectedTags.length} tag${selectedTags.length > 1 ? 's' : ''}` : 'Search & Filter'}
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
});

interface CalendarDayCellProps {
  day: Date;
  dayTrades: Trade[];
  currentDate: Date;
  monthlyHighImpactEvents: Map<string, boolean>;
  onDayClick: (day: Date) => void;
  isMdDown: boolean;
  // Pre-calculated stats
  dayStats: ReturnType<typeof calculateDayStats>;
}

const CalendarDayCell = React.memo(({
  day,
  dayTrades,
  currentDate,
  monthlyHighImpactEvents,
  onDayClick,
  isMdDown,
  dayStats
}: CalendarDayCellProps) => {
  const theme = useTheme();

  const isCurrentMonth = isSameMonth(day, currentDate);
  const isCurrentDay = isToday(day);
  const dayDateString = format(day, 'yyyy-MM-dd');
  const hasHighImpactEvents = monthlyHighImpactEvents.get(dayDateString) || false;

  return (
    <CalendarCell>
      <StyledCalendarDay
        onClick={() => onDayClick(day)}
        $isCurrentMonth={isCurrentMonth}
        $isCurrentDay={isCurrentDay}
        $dayStatus={dayStats.status}
      >
        <DayNumber $isCurrentMonth={isCurrentMonth}>
          {format(day, 'd')}
        </DayNumber>

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
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.5
          }}>
            {!isMdDown && (
              <TradeAmount $dayStatus={dayStats.status}>
                {formatCurrency(Math.abs(dayStats.netAmount))}
              </TradeAmount>
            )}
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
});

export const TradeCalendar: FC<TradeCalendarProps> = (props): React.ReactElement => {
  const {
    calendar: selectedCalendar,
    setLoading,
    onToggleTheme,
    mode,
    isReadOnly = false
  } = props;



  const { calendarId: calendarIdFromParams } = useParams();
  // Use calendarId from URL params, or fall back to calendar prop ID (for shared calendars)
  const calendarId = calendarIdFromParams || selectedCalendar?.id;

  // Fetch trades using custom hook - this now handles all trade CRUD operations
  const {
    trades,
    calendar: hookCalendar,
    isLoading: isLoadingTrades,
    addTrade: handleAddTrade,
    deleteTrades: handleDeleteTrades,
    handleUpdateTradeProperty,
    onTagUpdated: handleTagUpdated,
    handleToggleDynamicRisk,
    handleImportTrades: hookHandleImportTrades,
    handleAccountBalanceChange,
    handleClearMonthTrades,
    handleUpdateCalendarProperty,
    notification,
    clearNotification,
    isTradeUpdating,
    loadMonthTrades,
    loadVisibleRangeTrades,
  } = useCalendarTrades({
    calendarId,
    selectedCalendar,
    setLoading,
    enableRealtime: !isReadOnly // Disable real-time for read-only mode
  });

  // Show notifications from useCalendarTrades hook
  useEffect(() => {
    if (notification) {
      showSnackbar(notification.message, notification.type === 'success' ? 'success' : 'error');
      clearNotification();
    }
  }, [notification, clearNotification]);

  // Use hook calendar if available, otherwise fall back to selectedCalendar
  const calendar = hookCalendar || selectedCalendar;

  // Extract calendar fields for easier access

  const accountBalance = calendar.account_balance;
  const maxDailyDrawdown = calendar.max_daily_drawdown;
  const weeklyTarget = calendar.weekly_target;
  const monthly_target = calendar.monthly_target;
  const yearlyTarget = calendar.yearly_target;
  const requiredTagGroups = calendar.required_tag_groups;
  const calendarName = calendar.name;
  const heroImageUrl = calendar.hero_image_url;
  const heroImageAttribution = calendar.hero_image_attribution;
  const scoreSettings = calendar.score_settings;
  const totalPnL = calendar.total_pnl;

  const dynamicRiskSettings: DynamicRiskSettings = useMemo(() => ({
    account_balance: calendar.account_balance,
    risk_per_trade: calendar.risk_per_trade,
    dynamic_risk_enabled: calendar.dynamic_risk_enabled,
    increased_risk_percentage: calendar.increased_risk_percentage,
    profit_threshold_percentage: calendar.profit_threshold_percentage
  }), [
    calendar.account_balance,
    calendar.risk_per_trade,
    calendar.dynamic_risk_enabled,
    calendar.increased_risk_percentage,
    calendar.profit_threshold_percentage
  ]);




  // Wrapper for import trades handler to pass setLoading
  const handleImportTrades = useCallback(async (importedTrades: Partial<Trade>[]) => {
    try {
      await hookHandleImportTrades(importedTrades);
    } catch (error) {
      console.error('Error importing trades:', error);
      throw error;
    }
  }, [hookHandleImportTrades]);

  // Wrapper for update calendar property to match the expected signature
  // The hook version doesn't need calendarId since it uses the calendar from hook state
  const onUpdateCalendarProperty = useCallback(async (
    _calendarId: string,
    updateCallback: (calendar: Calendar) => Calendar
  ): Promise<Calendar | undefined> => {
    return await handleUpdateCalendarProperty(updateCallback);
  }, [handleUpdateCalendarProperty]);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isMonthSelectorOpen, setIsMonthSelectorOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTrade, setNewTrade] = useState<NewTradeForm | null>(null);
  const [showAddForm, setShowAddForm] = useState<{ open: boolean, trade_date: Date, editTrade?: Trade | null, createTempTrade?: boolean, showDayDialogWhenDone: boolean } | null>(null);
  const [zoomedImages, setZoomedImagesState] = useState<ImageZoomProp | null>(null);
  const [tradesToDelete, setTradesToDelete] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingTradeIds, setDeletingTradeIds] = useState<string[]>([]);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Session statistics dialog state - stores trade IDs, trades computed via useMemo
  const [sessionTradesDialog, setSessionTradesDialog] = useState<{
    open: boolean;
    tradeIds: string[];
    title: string;
    expandedTradeId: string | null;
  }>({
    open: false,
    tradeIds: [],
    title: '',
    expandedTradeId: null
  });

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
    aiOnlyMode?: boolean;
    fetchYear?: number;
  }>({
    open: false,
    trades: [],
    initialTradeId: undefined,
    title: undefined,
    aiOnlyMode: false,
    fetchYear: undefined
  });

  // Calendar edit dialog state
  const [isCalendarEditOpen, setIsCalendarEditOpen] = useState(false);
  const [isCalendarEditSubmitting, setIsCalendarEditSubmitting] = useState(false);

  // Economic calendar drawer state
  const [isEconomicCalendarOpen, setIsEconomicCalendarOpen] = useState(false);

  // AI Chat drawer state
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);

  // Notes drawer state
  const [isNotesDrawerOpen, setIsNotesDrawerOpen] = useState(false);

  // Economic event notification state
  // Notification stack state (moved from App.tsx)
  const [notifications, setNotifications] = useState<EconomicEvent[]>([]);
  const [removingNotifications, setRemovingNotifications] = useState<Set<string>>(new Set());
  const [economicCalendarUpdatedEvent, setEconomicCalendarUpdatedEvent] = useState<{ updatedEvents: EconomicEvent[], allEvents: EconomicEvent[] } | null>(null);


  const breadcrumbButtons = useMemo<BreadcrumbButton[]>(() => [
    ...((!isReadOnly) ? [{
      key: 'edit',
      icon: <EditIcon fontSize="small" />,
      onClick: () => setIsCalendarEditOpen(true),
      tooltip: 'Edit calendar settings'
    }] : [])
  ], [isReadOnly]);

  const breadcrumbRightContent = (!isReadOnly && calendar && onUpdateCalendarProperty) ? (
    <ShareButton type="calendar" item={calendar} onUpdateItemProperty={onUpdateCalendarProperty} size="small" />
  ) : null;


  const theme = useTheme();
  const isMdDown = useMediaQuery(theme.breakpoints.down('md'));

  // Breadcrumb items
  const breadcrumbItems = useMemo<BreadcrumbItem[]>(() => [
    { label: 'Home', path: '/', icon: <HomeIcon sx={{ fontSize: 18 }} /> },
    { label: 'Calendars', path: '/dashboard', icon: <CalendarIcon sx={{ fontSize: 18 }} /> },
    { label: calendarName || 'Calendar', path: `/calendar/${calendarId}` }
  ], [calendarName, calendarId]);

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

  // Load trades for visible calendar range when month changes
  // This ensures overflow days from adjacent months show their trades
  useEffect(() => {
    if (!calendarId) return;

    // Calculate the visible date range in the calendar grid
    // Includes overflow days from previous/next months
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const visibleStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
    const visibleEnd = endOfWeek(monthEnd, { weekStartsOn: 0 }); // Saturday

    loadVisibleRangeTrades(visibleStart, visibleEnd);
  }, [currentDate, calendarId, loadVisibleRangeTrades]);

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



  // Calendar edit handler
  const handleCalendarEditSubmit = async (formData: CalendarFormData) => {
    if (!onUpdateCalendarProperty || !calendarId) return;

    setIsCalendarEditSubmitting(true);
    try {
      await onUpdateCalendarProperty(calendarId, (cal) => ({
        ...cal,
        name: formData.name,
        account_balance: formData.account_balance,
        max_daily_drawdown: formData.max_daily_drawdown,
        weekly_target: formData.weekly_target,
        monthly_target: formData.monthly_target,
        yearly_target: formData.yearly_target,
        risk_per_trade: formData.risk_per_trade,
        dynamic_risk_enabled: formData.dynamic_risk_enabled,
        increased_risk_percentage: formData.increased_risk_percentage,
        profit_threshold_percentage: formData.profit_threshold_percentage,
        hero_image_url: formData.hero_image_url,
        hero_image_attribution: formData.hero_image_attribution,
      }));
      setIsCalendarEditOpen(false);
      showSnackbar('Calendar updated successfully', 'success');
    } catch (error) {
      logger.error('Error updating calendar:', error);
      showSnackbar('Failed to update calendar', 'error');
    } finally {
      setIsCalendarEditSubmitting(false);
    }
  };

  // Economic calendar toggle handler
  const handleToggleEconomicCalendar = useCallback(() => {
    setIsEconomicCalendarOpen(true);
  }, []);

  // AI Chat toggle handler
  const handleToggleAIChat = useCallback(() => {
    setIsAIChatOpen(true);
  }, []);

  // Scroll detection for floating month navigation with throttling
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          // Find the score section element
          const section = document.querySelector('[data-testid="month-nav-section"]');
          if (section) {
            const rect = section.getBoundingClientRect();
            // Show floating nav when section is NOT visible
            setShowFloatingMonthNav(!(rect.top <= window.innerHeight && rect.bottom >= 0));
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check initial state

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);



  // Use calendar.tags,
  const allTags = useMemo(() => {
    return calendar.tags || [];
  }, [calendar.tags, trades]);

  // Filter trades based on selected tags
  const filteredTrades = useMemo(() => {
    if (selectedTags.length === 0) {
      return trades; // No filtering if no tags selected
    }

    return trades.filter(trade =>
      trade.tags?.some(tag => selectedTags.includes(tag))
    );
  }, [trades, selectedTags]);


  // Optimize trade lookup by pre-grouping trades by date
  // This changes the complexity from O(Days * Trades) to O(Trades) + O(Days)
  const tradesByDay = useMemo(() => {
    const map = new Map<string, Trade[]>();
    filteredTrades.forEach(trade => {
      const dateKey = format(new Date(trade.trade_date), 'yyyy-MM-dd');
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)?.push(trade);
    });
    return map;
  }, [filteredTrades]);

  const tradesForSelectedDay = useMemo(() => {
    if (!selectedDate) {
      return [];
    }
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return tradesByDay.get(dateKey) || [];
  }, [selectedDate, tradesByDay]);

  // Compute session dialog trades from IDs - ensures trades update when underlying data changes
  const sessionDialogTrades = useMemo(() => {
    if (!sessionTradesDialog.tradeIds.length) return [];
    return sessionTradesDialog.tradeIds
      .map(id => filteredTrades.find(t => t.id === id))
      .filter((t): t is Trade => t !== undefined);
  }, [sessionTradesDialog.tradeIds, filteredTrades]);

  // Calculate total profit based on filtered trades or use pre-calculated value
  const totalProfit = useMemo(() => {
    // If no tag filtering is applied and pre-calculated totalPnL is available, use it
    if (selectedTags.length === 0 && totalPnL !== undefined) {
      return totalPnL;
    }
    // Otherwise calculate from filtered trades
    return filteredTrades.length > 0 ? filteredTrades.reduce((sum, trade) => sum + trade.amount, 0) : 0;
  }, [filteredTrades, selectedTags, totalPnL]);


  // Pre-calculate day statistics for all visible days in the calendar grid
  // Includes overflow days from adjacent months to show complete statistics
  const dayStatsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calculateDayStats>>();

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const visibleStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
    const visibleEnd = endOfWeek(monthEnd, { weekStartsOn: 0 }); // Saturday
    const days = eachDayOfInterval({ start: visibleStart, end: visibleEnd });

    days.forEach(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      const dayTrades = tradesByDay.get(dayKey) || [];

      const dayStats = calculateDayStats(
        dayTrades,
        accountBalance,
        maxDailyDrawdown || 0,
        dynamicRiskSettings,
        filteredTrades,
        day
      );

      map.set(dayKey, dayStats);
    });

    return map;
  }, [currentDate, tradesByDay, accountBalance, maxDailyDrawdown, dynamicRiskSettings, filteredTrades]);

  // Pre-calculate weekly statistics for all visible weeks in the calendar grid
  // Includes weeks with overflow days from adjacent months
  const weeklyStatsMap = useMemo(() => {
    const map = new Map<string, {
      weekTrades: Trade[];
      netAmount: number;
      percentage: string;
      targetProgressValue: number;
    }>();

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const visibleStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
    const visibleEnd = endOfWeek(monthEnd, { weekStartsOn: 0 }); // Saturday
    const weeks = eachWeekOfInterval({ start: visibleStart, end: visibleEnd }, { weekStartsOn: 0 });

    weeks.forEach(weekStart => {
      const weekKey = format(weekStart, 'yyyy-MM-dd');

      // Filter trades for this week (include all trades, not just current month)
      const weekTrades = filteredTrades.filter(trade =>
        isSameWeek(new Date(trade.trade_date), weekStart, { weekStartsOn: 0 })
      );

      // Calculate net amount for the week
      const netAmount = weekTrades.reduce((sum, trade) => sum + trade.amount, 0);

      // Calculate percentage - use the centralized function
      const percentage = filteredTrades
        ? calculatePercentageOfValueAtDate(netAmount, accountBalance, filteredTrades, weekStart).toFixed(1)
        : accountBalance > 0 ? ((netAmount / accountBalance) * 100).toFixed(1) : '0';

      // Calculate target progress
      const targetProgressValue = weeklyTarget && weeklyTarget > 0
        ? calculateTargetProgress(weekTrades, accountBalance, weeklyTarget, weekStart, filteredTrades)
        : 0;

      map.set(weekKey, {
        weekTrades,
        netAmount,
        percentage,
        targetProgressValue
      });
    });

    return map;
  }, [currentDate, filteredTrades, accountBalance, weeklyTarget]);

  // Calculate session statistics for the monthly statistics section
  const sessionStats = useMemo(() => {
    return calculateSessionStats(filteredTrades, currentDate, 'month', accountBalance);
  }, [filteredTrades, currentDate, accountBalance]);

  const handlePrevMonth = () => {
    setCurrentDate(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => addMonths(prev, 1));
  };

  const handleTodayClick = () => {
    setCurrentDate(new Date());
  };


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
      // Delete trades using the hook handler
      await handleDeleteTrades(tradesToDelete);

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


  const handleDayClick = useCallback((trade_date: Date) => {
    // In read-only mode, only allow viewing existing trades
    if (isReadOnly) {
      const dateKey = format(trade_date, 'yyyy-MM-dd');
      const trades = tradesByDay.get(dateKey) || [];
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
      handleToggleDynamicRisk(true);
      return;
    }

    const dateKey = format(trade_date, 'yyyy-MM-dd');
    const trades = tradesByDay.get(dateKey) || [];

    if (trades.length === 0) {
      setNewTrade(createNewTradeData);
      setShowAddForm({ open: true, trade_date: trade_date, showDayDialogWhenDone: true });
    }
    else {
      setSelectedDate(trade_date);
    }
  }, [isReadOnly, tradesByDay, isLoadingTrades, isDynamicRiskToggled, handleToggleDynamicRisk]);
  const handleDayChange = (trade_date: Date) => {
    setSelectedDate(trade_date);
  };





  const handleMonthClick = () => {
    // Open month selector - year_stats are already synced via realtime
    setIsMonthSelectorOpen(true);
  };

  const handleMonthSelect = (trade_date: Date) => {
    // Setting currentDate will trigger useEffect to load visible calendar range
    // This includes overflow days from adjacent months
    setCurrentDate(trade_date);
    // Note: Dialog closes itself after this completes
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
  const openGalleryMode = (trades: Trade[], initialTradeId?: string, title?: string, fetchYear?: number) => {
    setGalleryMode({
      open: true,
      trades,
      initialTradeId,
      title,
      aiOnlyMode: false,
      fetchYear
    });
  };

  // Open gallery in AI-only mode (hides Trade tab, shows only Assistant)
  const openGalleryModeAI = (trades: Trade[], tradeId: string, title?: string) => {
    setGalleryMode({
      open: true,
      trades,
      initialTradeId: tradeId,
      title,
      aiOnlyMode: true
    });
  };

  const closeGalleryMode = () => {
    setGalleryMode({
      open: false,
      trades: [],
      initialTradeId: undefined,
      title: undefined,
      aiOnlyMode: false,
      fetchYear: undefined
    });
  };

  // Handler for editing a trade - used across multiple components
  const handleEditTrade = useCallback((trade: Trade) => {
    setNewTrade(() => (createEditTradeData(trade)));
    setShowAddForm({
      open: true,
      trade_date: new Date(trade.trade_date),
      editTrade: trade,
      createTempTrade: false,
      showDayDialogWhenDone: false
    });
  }, []);

  // Create a unified tradeOperations object for all trade-related operations
  const tradeOperations: TradeOperationsProps = useMemo(() => ({
    onUpdateTradeProperty: isReadOnly ? undefined : handleUpdateTradeProperty,
    onEditTrade: isReadOnly ? undefined : handleEditTrade,
    onDeleteTrade: isReadOnly ? undefined : handleDeleteClick,
    onDeleteMultipleTrades: isReadOnly ? undefined : handleDeleteMultipleTrades,
    onZoomImage: setZoomedImage,
    onOpenGalleryMode: openGalleryMode,
    onOpenAIChat: isReadOnly ? undefined : (trade) => openGalleryModeAI(trades, trade.id, trade.name),
    onUpdateCalendarProperty: isReadOnly ? undefined : onUpdateCalendarProperty,
    isTradeUpdating,
    deletingTradeIds,
    calendarId: calendarId || undefined,
    calendar,
    isReadOnly,
    economicFilter: (_calendarId) => calendar?.economic_calendar_filters || DEFAULT_ECONOMIC_EVENT_FILTER_SETTINGS
  }), [
    isReadOnly,
    handleUpdateTradeProperty,
    handleEditTrade,
    handleDeleteClick,
    handleDeleteMultipleTrades,
    setZoomedImage,
    openGalleryMode,
    openGalleryModeAI,
    trades,
    onUpdateCalendarProperty,
    isTradeUpdating,
    deletingTradeIds,
    calendarId,
    calendar
  ]);

  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: 'custom.pageBackground',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <AnimatedBackground />
      {/* Floating Month Navigation */}
      <FloatingMonthNavigation
        currentDate={currentDate}
        isVisible={showFloatingMonthNav}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onMonthClick={handleMonthClick}
        onTodayClick={handleTodayClick}
      />

      {/* Hero Image Banner */}
      {heroImageUrl && (
        <Box
          sx={{
            position: 'relative',
            height: { xs: 140, sm: 180, md: 220 },
            overflow: 'hidden',
            borderRadius: 0,
          }}
        >
          {/* Hero image layer */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url(${heroImageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              zIndex: 0,
            }}
          />

          {/* Gradient overlay */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: (theme: Theme) =>
                `linear-gradient(180deg, ${alpha(theme.palette.common.black, 0.25)} 0%, ${alpha(theme.palette.common.black, 0.8)} 100%)`,
              zIndex: 2,
            }}
          />

          {/* Attribution */}
          <Fade in={!!heroImageAttribution} timeout={300}>
            <Box
              sx={{
                position: 'absolute',
                bottom: { xs: 6, sm: 8 },
                right: { xs: 8, sm: 12 },
                zIndex: 3,
                px: 1,
                py: 0.5,
                borderRadius: 0.75,
                bgcolor: (theme: Theme) => alpha(theme.palette.common.black, 0.7),
                color: 'common.white',
              }}
            >
              <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                Photo by {heroImageAttribution?.photographer} on Unsplash
              </Typography>
            </Box>
          </Fade>
        </Box>
      )}

      {/* Breadcrumbs */}
      <Breadcrumbs items={breadcrumbItems} buttons={breadcrumbButtons} rightContent={breadcrumbRightContent} />




      {/* Stacked Notes Widget - hidden in read-only mode */}
      {calendarId && !isReadOnly && <StackedNotesWidget calendarId={calendarId} />}

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
                trades={filteredTrades}
                risk_per_trade={dynamicRiskSettings?.risk_per_trade}
                dynamicRiskSettings={dynamicRiskSettings}
                onToggleDynamicRisk={(useActualAmounts) => {
                  setIsDynamicRiskToggled(useActualAmounts);
                  handleToggleDynamicRisk(useActualAmounts);
                }}
                isDynamicRiskToggled={isDynamicRiskToggled}
                isReadOnly={isReadOnly}
              />
            </Box>

            <Box sx={{ flex: 1, height: '100%' }}>

              <MonthlyStats
                trades={filteredTrades}
                accountBalance={accountBalance}
                onImportTrades={handleImportTrades}
                onDeleteTrade={handleDeleteClick}
                currentDate={currentDate}
                monthlyTarget={monthly_target}
                onClearMonthTrades={handleClearMonthTrades}
                isReadOnly={isReadOnly}
                onOpenGalleryMode={openGalleryMode}
                calendarId={calendarId!!}
                scoreSettings={scoreSettings}
                dynamicRiskSettings={dynamicRiskSettings}
                onUpdateTradeProperty={handleUpdateTradeProperty}
                onUpdateCalendarProperty={onUpdateCalendarProperty}
                onEditTrade={handleEditTrade}
                economicFilter={(_calendarId) => calendar?.economic_calendar_filters || DEFAULT_ECONOMIC_EVENT_FILTER_SETTINGS}
                maxDailyDrawdown={maxDailyDrawdown}
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
                {/* Only show Today button when not viewing current month */}
                {!isSameMonth(currentDate, new Date()) && (
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
                )}

                {/* Notes Button - Moved from FAB */} 
                  <Tooltip title="Notes for this calendar" arrow>
                    <Button
                      startIcon={<NotesIcon sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }} />}
                      onClick={() => setIsNotesDrawerOpen(true)}
                      variant="outlined"
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
                        borderColor: alpha(theme.palette.text.secondary, 0.3),
                        color: 'text.secondary',
                        '&:hover': {
                          borderColor: 'info.main',
                          bgcolor: alpha(theme.palette.info.main, 0.1),
                          color: 'info.main',
                          transform: 'translateY(-1px)'
                        },
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                    >
                      Notes
                    </Button>
                  </Tooltip>
               

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
                  variant={"outlined"}
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
                    ...({
                      borderColor: alpha(theme.palette.text.secondary, 0.3),
                      color: 'text.secondary',
                      '&:hover': {
                        borderColor: 'info.main',
                        bgcolor: alpha(theme.palette.info.main, 0.1),
                        color: 'info.main',
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

                <Tooltip title={isReadOnly ? "View tags and definitions" : "Manage tags and required tag groups"} arrow>
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
                        borderColor: 'info.main',
                        bgcolor: alpha(theme.palette.info.main, 0.1),
                        color: 'info.main',
                        transform: 'translateY(-1px)'
                      },
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  >
                    Tags
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
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Week'].map((day, index) => (
                <WeekdayHeader
                  key={day}
                  sx={{
                    display: index === 7 ? { xs: 'none', sm: 'flex' } : 'flex',
                    cursor: 'default',
                    position: 'relative',
                    justifyContent: 'center',
                    alignItems: 'center',
                    p: { xs: 1, md: 1.5 },
                    fontWeight: 600,
                    fontSize: { xs: '0.875rem', md: '1rem' },
                    color: 'text.secondary',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  {day}
                </WeekdayHeader>
              ))}
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
                      const dateKey = format(day, 'yyyy-MM-dd');
                      const dayTrades = tradesByDay.get(dateKey) || [];

                      const dayStats = dayStatsMap.get(dateKey) ?? {
                        netAmount: 0,
                        percentage: '0',
                        status: 'none' as DayStatus,
                        isDrawdownViolation: false
                      };

                      return (
                        <CalendarDayCell
                          key={day.toISOString()}
                          day={day}
                          dayTrades={dayTrades}
                          currentDate={currentDate}
                          monthlyHighImpactEvents={monthlyHighImpactEvents}
                          onDayClick={handleDayClick}
                          isMdDown={isMdDown}
                          dayStats={dayStats}
                        />
                      );
                    })}

                    <WeeklyPnL
                      trade_date={weekStart}
                      weekIndex={index}
                      weeklyTarget={weeklyTarget}
                      sx={{ display: { xs: 'none', sm: 'flex' } }}
                      weekStats={weeklyStatsMap.get(format(weekStart, 'yyyy-MM-dd')) ?? {
                        weekTrades: [],
                        netAmount: 0,
                        percentage: '0',
                        targetProgressValue: 0
                      }}
                    />

                  </React.Fragment>
                );
              })}
            </Box>

            {/* Weekly stats for mobile - HIDDEN to save space */}
            {/* Mobile users can view weekly stats in the monthly statistics section below */}
          </Box>


          {/*Current Monthly Statistics Section */}
          {/* Session Performance - Only shown on desktop */}
          {!isMdDown && (
            <SessionPerformanceAnalysis
              sessionStats={sessionStats}
              trades={filteredTrades}
              selectedDate={currentDate}
              timePeriod="month"
              setMultipleTradesDialog={setSessionTradesDialog}
            />
          )}

          {/* Session Trades List Dialog - conditionally rendered to prevent unnecessary effects */}
          {sessionTradesDialog.open && (
            <TradesListDialog
              open={sessionTradesDialog.open}
              onClose={() => setSessionTradesDialog(prev => ({ ...prev, open: false }))}
              trades={sessionDialogTrades}
              title={sessionTradesDialog.title}
              expandedTradeId={sessionTradesDialog.expandedTradeId}
              onTradeExpand={(tradeId) =>
                setSessionTradesDialog(prev => ({
                  ...prev,
                  expandedTradeId: prev.expandedTradeId === tradeId ? null : tradeId
                }))
              }
              account_balance={accountBalance}
              tradeOperations={tradeOperations}
            />
          )}


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
          onDateChange={handleDayChange}
          account_balance={accountBalance}
          tradeOperations={tradeOperations}
          onOpenAIChatMode={isReadOnly ? undefined : openGalleryModeAI}
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
            onAddTrade={handleAddTrade}
            newMainTrade={newTrade}
            setNewMainTrade={prev => setNewTrade(prev(newTrade!!))}
            onTagUpdated={handleTagUpdated}
            onUpdateTradeProperty={handleUpdateTradeProperty}
            onDeleteTrades={handleDeleteTrades}
            setZoomedImage={setZoomedImage}
            account_balance={accountBalance}
            onAccountBalanceChange={handleAccountBalanceChange}
            calendar={calendar}
            tags={allTags}
            dynamicRiskSettings={dynamicRiskSettings}
            requiredTagGroups={requiredTagGroups}
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
          accountBalance={accountBalance}
          monthlyTarget={monthly_target}
          yearlyTarget={yearlyTarget}
          yearStats={calendar?.year_stats || {}}
          onOpenGalleryMode={openGalleryMode}
        />




        {/* Drawers */}

        <TagManagementDrawer
          open={isTagManagementDrawerOpen}
          onClose={() => setIsTagManagementDrawerOpen(false)}
          allTags={allTags}
          calendarId={calendarId!!}
          onTagUpdated={handleTagUpdated}
          requiredTagGroups={requiredTagGroups}
          onUpdateCalendarProperty={onUpdateCalendarProperty}
          isReadOnly={isReadOnly}
          calendarOwnerId={calendar?.user_id}
        />

        {/* Snackbar for notifications */}
        <TagManagementDialog
          open={isTagManagementDialogOpen}
          onClose={() => setIsTagManagementDialogOpen(false)}
          allTags={allTags}
          calendarId={calendarId!!}
          onTagUpdated={handleTagUpdated}
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
          sx={{ zIndex: Z_INDEX.SNACKBAR }}
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
        {calendar && calendarId && (
          <SearchDrawer
            open={isSearchDrawerOpen}
            onClose={() => setIsSearchDrawerOpen(false)}
            calendarId={calendarId}
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
          calendarId={calendarId}
          onTradeClick={(trade, allTrades, title) => {
            // Close drawer and open the trade in gallery mode
            setPinnedTradesDrawerOpen(false);
            openGalleryMode(allTrades, trade.id, title);
          }}
          tradeOperations={tradeOperations}
        />

        {/* Trade Gallery Dialog */}
        <TradeGalleryDialog
          open={galleryMode.open}
          onClose={closeGalleryMode}
          trades={galleryMode.trades}
          initialTradeId={galleryMode.initialTradeId}
          setZoomedImage={setZoomedImage}
          title={galleryMode.title}
          calendarId={calendarId}
          calendar={calendar}
          aiOnlyMode={galleryMode.aiOnlyMode}
          isReadOnly={isReadOnly}
          fetchYear={galleryMode.fetchYear}
          tradeOperations={tradeOperations}
        />



        {/* Calendar Edit Dialog */}
        <CalendarFormDialog
          open={isCalendarEditOpen}
          onClose={() => setIsCalendarEditOpen(false)}
          onSubmit={handleCalendarEditSubmit}
          initialData={calendar}
          isSubmitting={isCalendarEditSubmitting}
          mode="edit"
          title="Edit Calendar"
          submitButtonText="Save"
        />

      </Box>

      {/* Economic Calendar Drawer */}
      <EconomicCalendarDrawer
        open={isEconomicCalendarOpen}
        onClose={() => setIsEconomicCalendarOpen(false)}
        calendar={calendar!}
        payload={economicCalendarUpdatedEvent}
        isReadOnly={isReadOnly}
        tradeOperations={tradeOperations}
      />

      {/* AI Chat Drawer */}
      <AIChatDrawer
        open={isAIChatOpen}
        onClose={() => setIsAIChatOpen(false)}
        trades={trades}
        calendar={calendar!}
        isReadOnly={isReadOnly}
        tradeOperations={tradeOperations}
      />

      {/* Notes Drawer */}
      <NotesDrawer
        open={isNotesDrawerOpen}
        onClose={() => setIsNotesDrawerOpen(false)}
        calendarId={calendarId}
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
