import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { FC } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Divider,
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
  Fade,
  LinearProgress,
  Badge,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
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
  Home as HomeIcon,
  Notes as NotesIcon,
  Edit as EditIcon,
  Flag as TargetIcon,
  EventNote as GamePlanIcon,
  HelpOutline as HelpOutlineIcon,
  Insights as InsightsIcon,
  MoreVert as MoreVertIcon,
  FileUpload as FileUploadIcon,
  FileDownload as FileDownloadIcon,
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
import { formatCurrency, formatCount } from '../utils/formatters';
import { Trade } from '../types/trade';
import DayDialog from '../components/trades/DayDialog';
import SelectDateDialog from '../components/SelectDateDialog';

import TagFilterDialog from '../components/TagFilterDialog';
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

import PageActionBar from '../components/common/PageActionBar';
import { Calendar } from '../types/calendar';
import { CalendarRepository } from '../services/repository/repositories/CalendarRepository';
import CalendarFormDialog, { CalendarFormData } from '../components/CalendarFormDialog';
import PinnedTradesDrawer from '../components/PinnedTradesDrawer';
import ShareButton from '../components/sharing/ShareButton';
import { exportTrades } from '../utils/tradeExportImport';
import { ImportMappingDialog } from '../components/import/ImportMappingDialog';

import { useAIChat } from '../contexts/AIChatContext';
import NoteEditorDialog from '../components/notes/NoteEditorDialog';
import CalendarNotesPanel from '../components/notes/CalendarNotesPanel';
import UnifiedDrawer from '../components/common/UnifiedDrawer';
import {
  StackedNotesWidget,
  StickyReminderCards,
  useReminderNotes,
} from '../components/reminderNotes';
import NotesBottomSheet from '../components/reminderNotes/NotesBottomSheet';
import * as notesService from '../services/notesService';
import * as calendarService from '../services/calendarService';
import { Note, DayAbbreviation } from '../types/note';

import { DynamicRiskSettings } from '../utils/dynamicRiskUtils';
import { Z_INDEX } from '../styles/zIndex';

import FloatingMonthNavigation from '../components/FloatingMonthNavigation';
import { calculateDayStats, calculateTargetProgress } from '../utils/statsUtils';
import { DEFAULT_FILTER_SETTINGS as DEFAULT_ECONOMIC_EVENT_FILTER_SETTINGS } from '../hooks/useEconomicCalendarFilters';
import EconomicEventsView from '../components/economicCalendar/EconomicEventsView';
import { useEconomicEventsUpdates } from '../hooks/useEconomicEventWatcher';
import { TradeOperationsProps } from '../types/tradeOperations';
import { EconomicEvent } from '../types/economicCalendar';
import { useHighImpactEvents } from '../hooks/useHighImpactEvents';
import { log, logger } from '../utils/logger';
import { useTradesContext } from '../contexts/TradesContext';
import { useTradeOperations } from '../contexts/TradeOperationsContext';
import { useTradeViewer } from '../contexts/TradeViewerContext';
import { useUserPinnedEvents } from '../contexts/UserPinnedEventsContext';
import {
  SidePanelProvider,
  useSidePanel,
  SidePanelView,
  DayTradesView,
  EconomicCalendarView,
  AIAnalysisView,
} from '../contexts/SidePanelContext';
import { usePanelMutexSlot } from '../contexts/PanelMutexContext';
import SidePanel from '../components/sidePanel/SidePanel';
import AIChatContent from '../components/sidePanel/content/AIChatContent';
import SearchContent from '../components/sidePanel/content/SearchContent';
import PinnedContent from '../components/sidePanel/content/PinnedContent';
import TagManagementContent from '../components/sidePanel/content/TagManagementContent';
import DayTradesContent from '../components/sidePanel/content/DayTradesContent';
import StatsContent from '../components/sidePanel/content/StatsContent';
import StatsDrawer from '../components/StatsDrawer';

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
  /** Dispatches to the app-level SidePanelProvider (outside this page's local
   *  one). Used for panels migrated to the global registry. */
  openGlobalPanel?: (view: SidePanelView) => void;
}

/**
 * Module-level caches that survive route remounts so Home → Performance →
 * Home doesn't repeat work. Realtime / write paths invalidate as needed.
 */
const gamePlanNotesCache = new Map<string, Map<string, Note>>();
const pnlBeforeMonthCache = new Map<string, number>();

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
  accountBalance: number;
  onWeekClick?: (weekStart: Date) => void;
  hasNote?: boolean;
}

const WeeklyPnL: React.FC<WeeklyPnLProps> = React.memo(({
  trade_date, weekIndex, weeklyTarget, sx, weekStats, accountBalance,
  onWeekClick, hasNote,
}) => {
  const theme = useTheme();

  // Use pre-calculated stats
  const { weekTrades, netAmount, percentage, targetProgressValue } = weekStats;

  const targetProgress = targetProgressValue.toFixed(0);
  const isTargetMet = weeklyTarget ? parseFloat(percentage) >= weeklyTarget : false;
  const isCurrentWeek = isSameWeek(trade_date, new Date(), { weekStartsOn: 0 });

  const weeklyTargetAmount = weeklyTarget ? (accountBalance * weeklyTarget) / 100 : 0;
  const remainingAmount = Math.max(0, weeklyTargetAmount - netAmount);
  const cappedProgress = Math.min(Math.max(targetProgressValue, 0), 100);

  const tooltipContent = isCurrentWeek && weeklyTarget ? (
    <Box sx={{ p: 1, minWidth: 220 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'info.light' }}>
          Weekly Target
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'white' }}>
          {weeklyTarget}% (${weeklyTargetAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })})
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <Box sx={{ flex: 1 }}>
          <LinearProgress
            variant="determinate"
            value={cappedProgress}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: alpha(theme.palette.common.white, 0.1),
              '& .MuiLinearProgress-bar': {
                borderRadius: 3,
                bgcolor: isTargetMet ? 'success.light' : 'info.main'
              }
            }}
          />
        </Box>
        <Typography variant="caption" sx={{ fontWeight: 700, color: isTargetMet ? 'success.light' : 'info.light' }}>
          {targetProgress}%
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Remaining:
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'white' }}>
          ${remainingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Typography>
      </Box>
    </Box>
  ) : '';

  const isDark = theme.palette.mode === 'dark';
  const winBg = isDark ? 'rgba(34,197,94,0.12)' : 'rgba(22,163,74,0.08)';
  const lossBg = isDark ? 'rgba(239,68,68,0.10)' : 'rgba(220,38,38,0.08)';
  const cellBg = netAmount > 0 ? winBg : netAmount < 0 ? lossBg : 'background.paper';

  const content = (
    <CalendarCell
      onClick={() => onWeekClick?.(trade_date)}
      sx={{
        bgcolor: cellBg,
        borderRadius: 1,
        cursor: onWeekClick ? 'pointer' : 'default',
        border: `1px solid ${theme.palette.divider}`,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        '&:hover': onWeekClick ? {
          borderColor: theme.palette.info.main,
        } : {},
        ...sx
      }}
    >
      <Stack spacing={0.5} sx={{ alignItems: 'center', p: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {hasNote && (
            <NotesIcon sx={{ fontSize: '0.85rem', color: 'info.main' }} />
          )}
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
              tooltipText={isCurrentWeek ? '' : `${isTargetMet ? 'Weekly target achieved' : 'Progress towards weekly target'}: ${targetProgress}%`}
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
          {formatCount(weekTrades.length)} trade{weekTrades.length !== 1 ? 's' : ''}
        </Typography>
      </Stack>
    </CalendarCell>
  );

  if (isCurrentWeek && weeklyTarget) {
    return (
      <Tooltip title={tooltipContent} arrow placement="left">
        {content}
      </Tooltip>
    );
  }

  return content;
});


// TagFilter component for filtering trades by tags
interface TagFilterProps {
  allTags: string[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  onOpenDrawer: () => void;
  isActive?: boolean;
}

const TagFilter = React.memo<TagFilterProps>(({ allTags, selectedTags, onTagsChange, onOpenDrawer, isActive = false }) => {
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
              borderColor: isActive ? 'info.main' : alpha(theme.palette.text.secondary, 0.3),
              color: isActive ? 'info.main' : 'text.secondary',
              bgcolor: isActive ? alpha(theme.palette.info.main, 0.1) : 'transparent',
              '&:hover': {
                borderColor: 'info.main',
                bgcolor: alpha(theme.palette.info.main, 0.1),
                color: 'info.main'
              }
            }),
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          {selectedTags.length > 0 ? `${formatCount(selectedTags.length)} tag${selectedTags.length > 1 ? 's' : ''}` : 'Filter'}
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
              border: `2px solid ${theme.palette.background.paper}`,
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
              {formatCount(dayTrades.length)} trade{dayTrades.length !== 1 ? 's' : ''}
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

const TradeCalendarInner: FC<TradeCalendarProps> = (props): React.ReactElement => {
  const {
    calendar: selectedCalendar,
    setLoading,
    onToggleTheme,
    mode,
    isReadOnly = false,
    openGlobalPanel,
  } = props;



  const { calendarId: calendarIdFromParams } = useParams();
  // Use calendarId from URL params, or fall back to calendar prop ID (for shared calendars)
  const calendarId = calendarIdFromParams || selectedCalendar?.id;

  // Pinned events live on the user (replaces per-calendar pin storage).
  const { pins: userPinnedEvents } = useUserPinnedEvents();

  // Trades + CRUD ops come from the app-level TradesContext (single
  // useCalendarTrades subscription shared across routes). The hook keys on
  // the active calendarId and disables realtime for shared/read-only
  // calendars in the provider itself.
  const { hook: tradesHook } = useTradesContext();
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
    handleUpdateCalendarProperty,
    notification,
    clearNotification,
    isTradeUpdating,
    loadMonthTrades,
    loadVisibleRangeTrades,
  } = tradesHook;

  const globalTradeOps = useTradeOperations();
  const tradeViewer = useTradeViewer();

  // Prevent outer page scroll — this page uses a fixed-height flex layout
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

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
  const [isTagManagementDrawerOpen, setIsTagManagementDrawerOpen] = useState(false);
  const [isSearchDrawerOpen, setIsSearchDrawerOpen] = useState(false);
  const [isDynamicRiskToggled, setIsDynamicRiskToggled] = useState(true); // Default to true (using actual amounts)
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'warning' | 'error'>('warning');

  // Snackbar utility — defined early so hooks below can depend on it.
  const showSnackbar = useCallback(
    (message: string, severity: 'success' | 'warning' | 'error' = 'warning') => {
      setSnackbarMessage(message);
      setSnackbarSeverity(severity);
      setSnackbarOpen(true);
    },
    []
  );
  const [showFloatingMonthNav, setShowFloatingMonthNav] = useState(false);
  const [pinnedTradesDrawerOpen, setPinnedTradesDrawerOpen] = useState(false);

  // Calendar edit dialog state
  const [isCalendarEditOpen, setIsCalendarEditOpen] = useState(false);

  const [isCalendarEditSubmitting, setIsCalendarEditSubmitting] = useState(false);

  // Economic calendar drawer state (<lg only — panel handles lg+)
  const [isEconomicCalendarOpen, setIsEconomicCalendarOpen] = useState(false);

  // Sticky reminder dismissed IDs (session-only — resets on reload)
  const [dismissedReminderIds, setDismissedReminderIds] = useState<Set<string>>(new Set());
  const {
    notes: reminderNotes,
    fullDayName: reminderDayName,
    updateNote: updateReminderNote,
    removeNote: removeReminderNote,
  } = useReminderNotes(calendarId || '');
  const handleDismissReminder = useCallback((noteId: string) => {
    setDismissedReminderIds(prev => new Set(prev).add(noteId));
  }, []);

  // AI Chat drawer — dispatched through global AIChatContext. The drawer
  // itself mounts once at App level (GlobalAIChat) along with the global
  // FAB (GlobalAIChatFab); this page just opens it for in-trade actions.
  const globalAIChat = useAIChat();

  // Notes drawer state
  const [isNotesDrawerOpen, setIsNotesDrawerOpen] = useState(false);

  // Header overflow menu (Import / Export) state
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<null | HTMLElement>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);

  // Stats drawer state (<lg fallback for 'stats' panel)
  const [isStatsDrawerOpen, setIsStatsDrawerOpen] = useState(false);


  // Week note state
  const [weekNoteKeys, setWeekNoteKeys] = useState<Set<string>>(new Set());
  const [weekNoteDialog, setWeekNoteDialog] = useState<{
    open: boolean;
    weekKey: string;
    note: Note | null;
  } | null>(null);

  // Game plan quick-create state
  const [gamePlanDialog, setGamePlanDialog] = useState<{
    day: DayAbbreviation;
    existingNote: Note | null;
  } | null>(null);
  const [gamePlanNotes, setGamePlanNotes] = useState<Map<string, Note>>(
    () => calendarId ? gamePlanNotesCache.get(calendarId) ?? new Map() : new Map()
  );

  // Drawer-update payload still lives here (page-local). Notification stack
  // state moved to EventNotificationsProvider at App level.
  const [economicCalendarUpdatedEvent, setEconomicCalendarUpdatedEvent] = useState<{ updatedEvents: EconomicEvent[], allEvents: EconomicEvent[] } | null>(null);

  const theme = useTheme();
  const isMdDown = useMediaQuery(theme.breakpoints.down('md'));
  const isLgUp = useMediaQuery(theme.breakpoints.up('lg'));
  const navigate = useNavigate();

  // Side panel context (provided by SidePanelProvider wrapper)
  const {
    currentView,
    isOpen: isPanelOpen,
    pushPanel,
    replacePanel,
    resetPanel,
    setOpen: setPanelOpen,
  } = useSidePanel();

  // ── Panel mutex ─────────────────────────────────────────────────────────
  // Register this page's local panel as a mutex slot. The mutex broadcasts
  // opens across all three surfaces (global SidePanel, CalendarsList panel,
  // and this one) — only one can be open at a time.
  const closeLocalPanel = useCallback(() => {
    setPanelOpen(false);
  }, [setPanelOpen]);
  usePanelMutexSlot('page-side-panel', isPanelOpen, closeLocalPanel);

  // Ref for main content scroll container (used by floating nav scroll detection)
  const mainContentRef = useRef<HTMLDivElement>(null);

  // Responsive handoff: panel ↔ drawers on breakpoint change
  const prevIsLgUp = useRef(isLgUp);
  useEffect(() => {
    if (prevIsLgUp.current === isLgUp) return;

    const closeAllDrawers = () => {
      setIsNotesDrawerOpen(false);
      setIsSearchDrawerOpen(false);
      setPinnedTradesDrawerOpen(false);
      setIsTagManagementDrawerOpen(false);
      setIsEconomicCalendarOpen(false);
      setIsStatsDrawerOpen(false);
      setSelectedDate(null);
    };

    if (prevIsLgUp.current && !isLgUp && isPanelOpen) {
      // lg+ → <lg: close all drawers first, then open matching one
      closeAllDrawers();
      switch (currentView.id) {
        case 'notes':
          setIsNotesDrawerOpen(true);
          break;
        case 'search':
          setIsSearchDrawerOpen(true);
          break;
        case 'pinned':
          setPinnedTradesDrawerOpen(true);
          break;
        case 'tags':
          setIsTagManagementDrawerOpen(true);
          break;
        case 'economic-calendar':
          setIsEconomicCalendarOpen(true);
          break;
        case 'stats':
          setIsStatsDrawerOpen(true);
          break;
        case 'day-trades': {
          const dayView = currentView as DayTradesView;
          setSelectedDate(dayView.date);
          break;
        }
      }
    } else if (!prevIsLgUp.current && isLgUp) {
      // <lg → lg+: hand off open drawer to panel; then close all drawers
      if (isStatsDrawerOpen) {
        replacePanel({ id: 'stats' });
        setPanelOpen(true);
      }
      closeAllDrawers();
    }

    prevIsLgUp.current = isLgUp;
  }, [isLgUp]);

  // Use optimized hook for high-impact economic events
  const { highImpactEventDates: monthlyHighImpactEvents } = useHighImpactEvents({
    currentDate,
    calendarId,
    currencies: calendar?.economic_calendar_filters?.currencies,
    enabled: !!calendar?.economic_calendar_filters
  });

  // Economic event watcher + notification firing now live at App level
  // (EventNotificationsProvider). This page just listens for updates to
  // refresh the still-page-local drawer (see useEconomicEventsUpdates below).

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

  // Page-local drawer still consumes event updates to refresh its content.
  // Notification firing moved to EventNotificationsProvider (App level).
  useEconomicEventsUpdates((updatedEvents, allEvents, updatedCalendarId) => {
    if (updatedCalendarId !== calendarId) return;
    if (!isEconomicCalendarOpen) return;
    log(`📊 ${updatedEvents.length} economic events updated — refreshing drawer payload`);
    setEconomicCalendarUpdatedEvent({ updatedEvents, allEvents });
    setTimeout(() => setEconomicCalendarUpdatedEvent(null), 1000);
  });


  // Calendar edit handler
  const handleCalendarEditSubmit = async (formData: CalendarFormData) => {
    if (!onUpdateCalendarProperty || !calendarId) return;

    setIsCalendarEditSubmitting(true);
    try {
      await onUpdateCalendarProperty(calendarId, (cal) => ({ ...cal, ...formData }));
      setIsCalendarEditOpen(false);
      showSnackbar('Calendar updated successfully', 'success');
    } catch (error) {
      logger.error('Error updating calendar:', error);
      showSnackbar('Failed to update calendar', 'error');
    } finally {
      setIsCalendarEditSubmitting(false);
    }
  };

  // Generic panel/drawer toggle — reused by Notes, Events, Pinned, Filter, Tags
  const togglePanel = useCallback((
    panelId: SidePanelView['id'],
    toggleDrawer: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    if (isLgUp) {
      if (isPanelOpen && currentView.id === panelId) {
        setPanelOpen(false);
      } else {
        replacePanel({ id: panelId } as SidePanelView);
        setPanelOpen(true);
      }
    } else {
      toggleDrawer(prev => !prev);
    }
  }, [isLgUp, isPanelOpen, currentView, setPanelOpen, replacePanel]);

  const handleToggleEconomicCalendar = useCallback(
    () => togglePanel('economic-calendar', setIsEconomicCalendarOpen),
    [togglePanel]
  );

  // Scroll detection for floating month navigation with throttling
  // Listens on the main content container (not window) since content
  // scrolls inside a flex layout, not the page body.
  useEffect(() => {
    const container = mainContentRef.current;
    if (!container) return;

    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const section = document.querySelector('[data-testid="month-nav-section"]');
          if (section) {
            const rect = section.getBoundingClientRect();
            setShowFloatingMonthNav(!(rect.top <= window.innerHeight && rect.bottom >= 0));
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => container.removeEventListener('scroll', handleScroll);
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

  // Calculate total profit based on filtered trades or use pre-calculated value
  const totalProfit = useMemo(() => {
    // If no tag filtering is applied and pre-calculated totalPnL is available, use it
    if (selectedTags.length === 0 && totalPnL !== undefined) {
      return totalPnL;
    }
    // Otherwise calculate from filtered trades
    return filteredTrades.length > 0 ? filteredTrades.reduce((sum, trade) => sum + trade.amount, 0) : 0;
  }, [filteredTrades, selectedTags, totalPnL]);


  // Fetch cumulative PnL before the viewed month for accurate start-of-month value.
  // Always uses unfiltered data (tag filtering is a view concern, not an account value concern).
  // Past-month results are cached at module scope (`pnlBeforeMonthCache`) so a
  // route remount doesn't refetch for months that don't change.
  const [pnlBeforeMonth, setPnlBeforeMonth] = useState<number>(() => {
    if (!calendarId) return 0;
    const monthKey = format(startOfMonth(currentDate), 'yyyy-MM');
    return pnlBeforeMonthCache.get(`${calendarId}|${monthKey}`) ?? 0;
  });
  const [isPnlLoading, setIsPnlLoading] = useState(false);
  useEffect(() => {
    if (!calendarId) return;
    let cancelled = false;
    const monthStart = startOfMonth(currentDate);
    const monthKey = format(monthStart, 'yyyy-MM');
    const cacheKey = `${calendarId}|${monthKey}`;
    const now = new Date();
    const isCurrentRealMonth = currentDate.getFullYear() === now.getFullYear()
      && currentDate.getMonth() === now.getMonth();

    if (isCurrentRealMonth && totalPnL !== undefined) {
      // For current month, derive from calendar.total_pnl (unfiltered all-time)
      const monthPnL = trades
        .filter(t => new Date(t.trade_date) >= monthStart)
        .reduce((sum, t) => sum + t.amount, 0);
      const value = totalPnL - monthPnL;
      setPnlBeforeMonth(value);
      pnlBeforeMonthCache.set(cacheKey, value);
      setIsPnlLoading(false);
    } else {
      // Past month: hydrate from cache instantly if present, then revalidate.
      const cached = pnlBeforeMonthCache.get(cacheKey);
      if (cached !== undefined) {
        setPnlBeforeMonth(cached);
        setIsPnlLoading(false);
      } else {
        setIsPnlLoading(true);
      }
      calendarService.getCumulativePnlBeforeDate(calendarId, monthStart)
        .then(val => {
          if (!cancelled) {
            setPnlBeforeMonth(val);
            pnlBeforeMonthCache.set(cacheKey, val);
            setIsPnlLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) { setPnlBeforeMonth(0); setIsPnlLoading(false); }
        });
    }
    return () => { cancelled = true; };
  }, [calendarId, currentDate, totalPnL, trades]);

  const totalAccountValue = accountBalance + pnlBeforeMonth;

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
        day,
        totalAccountValue
      );

      map.set(dayKey, dayStats);
    });

    return map;
  }, [currentDate, tradesByDay, accountBalance, maxDailyDrawdown, dynamicRiskSettings, filteredTrades, totalAccountValue]);

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

      // Calculate percentage relative to total account value
      const percentage = totalAccountValue > 0
        ? ((netAmount / totalAccountValue) * 100).toFixed(1)
        : '0';

      // Calculate target progress using total account value as baseline
      const targetProgressValue = weeklyTarget && weeklyTarget > 0
        ? calculateTargetProgress(weekTrades, totalAccountValue, weeklyTarget)
        : 0;

      map.set(weekKey, {
        weekTrades,
        netAmount,
        percentage,
        targetProgressValue
      });
    });

    return map;
  }, [currentDate, filteredTrades, totalAccountValue, weeklyTarget]);

  // Load week note keys for visual indicators
  useEffect(() => {
    if (!calendarId) return;
    notesService.getWeekNoteKeys(calendarId).then(setWeekNoteKeys);
  }, [calendarId, currentDate]);

  // Load game plan notes for day indicators and instant viewing.
  // Cached at module scope (`gamePlanNotesCache`) so navigating Home →
  // Performance → Home doesn't lose the day indicators while the fetch runs.
  useEffect(() => {
    if (!calendarId) return;
    notesService.getGamePlanNotesByDay(calendarId).then((next) => {
      setGamePlanNotes(next);
      gamePlanNotesCache.set(calendarId, next);
    });
  }, [calendarId]);

  const clearDaySelection = () => {
    setSelectedDate(null);
    if (currentView.id === 'day-trades') resetPanel();
  };

  const handlePrevMonth = () => {
    clearDaySelection();
    setCurrentDate(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    clearDaySelection();
    setCurrentDate(prev => addMonths(prev, 1));
  };

  const handleTodayClick = () => {
    clearDaySelection();
    setCurrentDate(new Date());
  };


  const handleDayClick = useCallback((trade_date: Date) => {
    // In read-only mode, only allow viewing existing trades
    if (isReadOnly) {
      const dateKey = format(trade_date, 'yyyy-MM-dd');
      const dayTrades = tradesByDay.get(dateKey) || [];
      if (dayTrades.length > 0) {
        if (isLgUp) {
          resetPanel();
          pushPanel({ id: 'day-trades', date: trade_date });
          setPanelOpen(true);
        } else {
          setSelectedDate(trade_date);
        }
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

    // On lg+, open day-trades in the side panel (reset stack first)
    if (isLgUp) {
      resetPanel();
      pushPanel({ id: 'day-trades', date: trade_date });
      setPanelOpen(true);
      return;
    }

    const dateKey = format(trade_date, 'yyyy-MM-dd');
    const trades = tradesByDay.get(dateKey) || [];

    // When weekly target is set, always show DayDialog first (shows progress section)
    // When no weekly target, go directly to add trade form for empty days
    if (trades.length === 0 && !weeklyTarget) {
      globalTradeOps.openAddDialog({
        trade_date,
        showDayDialogWhenDone: true,
        onAfterCancel: () => setSelectedDate(trade_date),
      });
    } else {
      setSelectedDate(trade_date);
    }
  }, [isReadOnly, tradesByDay, isLoadingTrades, isDynamicRiskToggled, handleToggleDynamicRisk, weeklyTarget, isLgUp, pushPanel, setPanelOpen, globalTradeOps]);

  const handleDayHeaderClick = useCallback((day: DayAbbreviation) => {
    if (isReadOnly || !calendarId) return;
    const existingNote = gamePlanNotes.get(day) ?? null;
    setGamePlanDialog({ day, existingNote });
  }, [calendarId, isReadOnly, gamePlanNotes]);

  const handleWeekClick = useCallback(async (weekStart: Date) => {
    if (isReadOnly || !calendarId) return;
    const weekKey = format(weekStart, 'yyyy-MM-dd');
    const existingNote = await notesService.getWeekNote(calendarId, weekKey);
    setWeekNoteDialog({ open: true, weekKey, note: existingNote });
  }, [calendarId, isReadOnly]);

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
    clearDaySelection();
    setCurrentDate(trade_date);
    // Note: Dialog closes itself after this completes
  };

  const handleTagsChange = (tags: string[]) => {
    setSelectedTags(tags);
  };


  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  const tradeOperations: TradeOperationsProps = useMemo(() => ({
    onUpdateTradeProperty: isReadOnly ? undefined : globalTradeOps.onUpdateTradeProperty,
    onEditTrade: isReadOnly ? undefined : globalTradeOps.onEditTrade,
    onDeleteTrade: isReadOnly ? undefined : globalTradeOps.onDeleteTrade,
    onDeleteMultipleTrades: isReadOnly ? undefined : globalTradeOps.onDeleteMultipleTrades,
    onZoomImage: tradeViewer.openImageZoom,
    onOpenGalleryMode: (trades, initialTradeId, title, fetchYear) =>
      tradeViewer.openGallery({ trades, initialTradeId, title, fetchYear }),
    onOpenAIChat: isReadOnly ? undefined : (trade) => globalAIChat.openWithTrade(trade),
    onUpdateCalendarProperty: isReadOnly ? undefined : onUpdateCalendarProperty,
    isTradeUpdating,
    deletingTradeIds: globalTradeOps.deletingTradeIds ?? [],
    calendarId: calendarId || undefined,
    calendar,
    isReadOnly,
    economicFilter: (_calendarId) => calendar?.economic_calendar_filters || DEFAULT_ECONOMIC_EVENT_FILTER_SETTINGS
  }), [
    isReadOnly,
    globalTradeOps,
    tradeViewer,
    globalAIChat,
    onUpdateCalendarProperty,
    isTradeUpdating,
    calendarId,
    calendar
  ]);

  // Helper: get trades for an arbitrary date (used by day-trades panel view)
  const getTradesForDate = useCallback((date: Date): Trade[] => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return tradesByDay.get(dateKey) || [];
  }, [tradesByDay]);

  // renderView maps a SidePanelView to its title, icon, and component
  const renderView = useCallback(
    (view: SidePanelView) => {
      switch (view.id) {
        case 'economic-calendar': {
          const ecView = view as EconomicCalendarView;
          return {
            title: 'Economic Calendar',
            icon: <EventIcon fontSize="small" />,
            component: (
              <EconomicEventsView
                calendar={calendar!}
                isReadOnly={isReadOnly}
                onUpdateCalendarProperty={onUpdateCalendarProperty}
                tradeOperations={tradeOperations}
                enabled={isPanelOpen && currentView.id === 'economic-calendar'}
                initialDate={ecView.initialDate}
                variant="compact"
              />
            ),
          };
        }
        case 'notes':
          return {
            title: 'Notes',
            icon: <NotesIcon fontSize="small" />,
            component: (
              <CalendarNotesPanel
                calendarId={calendarId}
                isReadOnly={isReadOnly}
                isActive={
                  isPanelOpen && currentView.id === 'notes'
                }
                availableTradeTags={allTags}
                pinnedEvents={userPinnedEvents}
              />
            ),
          };
        case 'search':
          return {
            title: 'Search',
            icon: <SearchIcon fontSize="small" />,
            component: (
              <SearchContent
                calendarId={calendarId!}
                allTags={allTags}
                isActive={
                  isPanelOpen && currentView.id === 'search'
                }
                selectedTags={selectedTags}
                onTagsChange={handleTagsChange}
                onTradeClick={(trade) => {
                  tradeViewer.openGallery({
                    trades,
                    initialTradeId: trade.id,
                    title: 'Search Results',
                  });
                }}
              />
            ),
          };
        case 'pinned':
          return {
            title: 'Pinned',
            icon: <PinIcon fontSize="small" />,
            component: (
              <PinnedContent
                calendarId={calendarId}
                tradeOperations={tradeOperations}
                isActive={
                  isPanelOpen && currentView.id === 'pinned'
                }
                onTradeClick={(trade, allTrades, title) => {
                  tradeViewer.openGallery({
                    trades: allTrades,
                    initialTradeId: trade.id,
                    title,
                  });
                }}
              />
            ),
          };
        case 'tags':
          return {
            title: 'Tags',
            icon: <TagIcon fontSize="small" />,
            component: (
              <TagManagementContent
                calendarId={calendarId!}
                allTags={allTags}
                onTagUpdated={handleTagUpdated}
                requiredTagGroups={requiredTagGroups}
                onUpdateCalendarProperty={
                  onUpdateCalendarProperty
                }
                isReadOnly={isReadOnly}
                calendarOwnerId={calendar?.user_id}
                isActive={
                  isPanelOpen && currentView.id === 'tags'
                }
              />
            ),
          };
        case 'ai-analysis': {
          const aiView = view as AIAnalysisView;
          return {
            title: aiView.title || 'AI Analysis',
            component: (
              <AIChatContent
                trades={aiView.trades}
                calendar={calendar!}
                isReadOnly={isReadOnly}
                tradeOperations={tradeOperations}
                isActive={
                  isPanelOpen
                  && currentView.id === 'ai-analysis'
                }
                initialTradeId={aiView.tradeId}
              />
            ),
          };
        }
        case 'stats': {
          return {
            title: 'Stats',
            icon: <InsightsIcon fontSize="small" />,
            component: (
              <StatsContent
                balance={accountBalance}
                totalProfit={totalProfit}
                trades={trades}
                filteredTrades={filteredTrades}
                riskPerTrade={dynamicRiskSettings?.risk_per_trade}
                dynamicRiskSettings={dynamicRiskSettings}
                onToggleDynamicRisk={(useActualAmounts) => {
                  setIsDynamicRiskToggled(useActualAmounts);
                  handleToggleDynamicRisk(useActualAmounts);
                }}
                isDynamicRiskToggled={isDynamicRiskToggled}
                isReadOnly={isReadOnly}
                maxDailyDrawdown={maxDailyDrawdown}
                currentDate={currentDate}
                monthlyTarget={monthly_target}
                calendarId={calendarId}
                calendar={calendar}
                pnlBeforeMonth={pnlBeforeMonth}
                isPnlLoading={isPnlLoading}
                onDeleteTrade={globalTradeOps.onDeleteTrade}
                onOpenGalleryMode={(trades, initialTradeId, title) =>
                  tradeViewer.openGallery({ trades, initialTradeId, title })
                }
                onUpdateTradeProperty={handleUpdateTradeProperty}
                onUpdateCalendarProperty={onUpdateCalendarProperty}
                onEditTrade={globalTradeOps.onEditTrade}
                economicFilter={(_calendarId) =>
                  calendar?.economic_calendar_filters ||
                  DEFAULT_ECONOMIC_EVENT_FILTER_SETTINGS
                }
              />
            ),
          };
        }
        case 'day-trades': {
          const dayView = view as DayTradesView;
          const dayTrades = getTradesForDate(dayView.date);
          const ws = startOfWeek(
            dayView.date, { weekStartsOn: 0 }
          );
          const wKey = format(ws, 'yyyy-MM-dd');
          const wTrades =
            weeklyStatsMap.get(wKey)?.weekTrades;
          return {
            title: format(dayView.date, 'MMM d, yyyy'),
            component: (
              <DayTradesContent
                date={dayView.date}
                trades={dayTrades}
                account_balance={accountBalance}
                onDateChange={(d) => {
                  pushPanel({
                    id: 'day-trades', date: d,
                  });
                }}
                showAddForm={
                  isReadOnly ? () => {} : (trade) => {
                    if (trade !== null && trade !== undefined) {
                      globalTradeOps.onEditTrade?.(trade);
                    } else {
                      globalTradeOps.openAddDialog({
                        trade_date: dayView.date,
                        showDayDialogWhenDone: false,
                      });
                    }
                  }
                }
                tradeOperations={tradeOperations}
                onOpenAIChatMode={
                  isReadOnly
                    ? undefined
                    : (t, tradeId, title) => {
                      pushPanel({
                        id: 'ai-analysis',
                        tradeId,
                        trades: t,
                        title,
                      });
                    }
                }
                weekTrades={wTrades}
                isActive={
                  isPanelOpen
                  && currentView.id === 'day-trades'
                }
                onOpenEvents={() => {
                  pushPanel({
                    id: 'economic-calendar',
                    initialDate: dayView.date,
                  });
                }}
                compact
              />
            ),
          };
        }
        default:
          return null;
      }
    },
    [
      calendar, economicCalendarUpdatedEvent, isReadOnly,
      tradeOperations, isPanelOpen, currentView, calendarId,
      allTags, selectedTags, handleTagsChange, trades,
      tradeViewer, handleTagUpdated,
      requiredTagGroups, onUpdateCalendarProperty,
      getTradesForDate, weeklyStatsMap, accountBalance,
      pushPanel, replacePanel, globalTradeOps,
    ]
  );

  // Wrap renderView to inject sticky reminder cards into every panel view
  const renderViewWithReminders = useCallback(
    (view: SidePanelView) => {
      const config = renderView(view);
      if (!config || isReadOnly) return config;
      return {
        ...config,
        stickyContent: reminderNotes.length > 0 ? (
          <StickyReminderCards
            notes={reminderNotes}
            dismissedIds={dismissedReminderIds}
            onDismiss={handleDismissReminder}
            calendar={calendar!}
            fullDayName={reminderDayName}
            onNoteSaved={updateReminderNote}
            onNoteDeleted={removeReminderNote}
          />
        ) : undefined,
      };
    },
    [renderView, reminderNotes, dismissedReminderIds,
     handleDismissReminder, isReadOnly]
  );

  const isStatsActive = isLgUp
    ? isPanelOpen && currentView.id === 'stats'
    : isStatsDrawerOpen;

  const handleHeaderFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setMoreMenuAnchor(null);
    setImportFile(file);
    setShowImportDialog(true);
    event.target.value = '';
  };

  const handleHeaderImportComplete = async (importedTrades: Partial<Trade>[]) => {
    await handleImportTrades(importedTrades);
    setShowImportDialog(false);
    setImportFile(null);
  };

  const handleHeaderExport = (fileFormat: 'xlsx' | 'csv') => {
    if (trades.length === 0) return;
    exportTrades(trades, accountBalance, fileFormat);
    setMoreMenuAnchor(null);
  };

  const breadcrumbRightContent = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>

      {!isReadOnly && (
        <Tooltip title="Edit calendar settings">
          <IconButton
            size="small"
            onClick={() => setIsCalendarEditOpen(true)}
            sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {!isReadOnly && calendar && onUpdateCalendarProperty && (
        <ShareButton
          type="calendar"
          item={calendar}
          onUpdateItemProperty={onUpdateCalendarProperty}
          size="small"
        />
      )}

      <Tooltip title="FAQs">
        <IconButton
          size="small"
          onClick={() => openGlobalPanel?.({ id: 'faq' })}
          sx={{
            color: 'text.secondary',
            '&:hover': { color: 'text.primary' },
          }}
        >
          <HelpOutlineIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <input
        type="file"
        accept=".xlsx,.csv"
        style={{ display: 'none' }}
        id="header-import-file"
        onChange={handleHeaderFileSelect}
      />
      <Tooltip title="Import / Export trades">
        <IconButton
          size="small"
          onClick={(e) => setMoreMenuAnchor(e.currentTarget)}
          sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={moreMenuAnchor}
        open={Boolean(moreMenuAnchor)}
        onClose={() => setMoreMenuAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {!isReadOnly && (
          <MenuItem onClick={() => document.getElementById('header-import-file')?.click()}>
            <ListItemIcon><FileUploadIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Import Trades</ListItemText>
          </MenuItem>
        )}
        <MenuItem onClick={() => handleHeaderExport('xlsx')} disabled={trades.length === 0}>
          <ListItemIcon><FileDownloadIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Export XLSX</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleHeaderExport('csv')} disabled={trades.length === 0}>
          <ListItemIcon><FileDownloadIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Export CSV</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );

  return (
    <Box sx={{
      bgcolor: 'custom.pageBackground',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Page layout: full page content + inline economic calendar panel (lg+) */}
      <Box sx={{
        display: 'flex', flexDirection: 'row',
        height: (theme: Theme) => `calc(100vh - ${theme.spacing(8)})`,
        overflow: 'hidden',
        position: 'relative',
      }}>

      {/* Left side: hero, breadcrumbs, and main content */}
      <Box ref={mainContentRef} sx={{ flex: 1, minWidth: 0, height: '100%', overflowY: 'auto', position: 'relative' }}>

      {/* Floating Month Navigation — inside scroll container */}
      <FloatingMonthNavigation
        currentDate={currentDate}
        isVisible={showFloatingMonthNav}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onMonthClick={handleMonthClick}
        onTodayClick={handleTodayClick}
        scrollContainerRef={mainContentRef}
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

      {/* Header bar */}
      <PageActionBar
        inlineActions={
          <Button
            size="small"
            variant="outlined"
            startIcon={<InsightsIcon sx={{ fontSize: 16 }} />}
            onClick={() => togglePanel('stats', setIsStatsDrawerOpen)}
            sx={{
              textTransform: 'none',
              fontSize: '0.8125rem',
              fontWeight: 600,
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              minWidth: 0,
              color: isStatsActive ? 'primary.main' : 'text.secondary',
              borderColor: isStatsActive ? 'primary.main' : (theme: Theme) => theme.palette.divider,
              bgcolor: isStatsActive ? (theme: Theme) => alpha(theme.palette.primary.main, 0.08) : 'transparent',
              '&:hover': {
                borderColor: isStatsActive ? 'primary.dark' : 'text.primary',
                bgcolor: isStatsActive
                  ? (theme: Theme) => alpha(theme.palette.primary.main, 0.12)
                  : (theme: Theme) => theme.palette.action.hover,
              },
            }}
          >
            Stats
          </Button>
        }
        rightContent={breadcrumbRightContent}
      />




      {/* Stacked Notes Widget - hidden in read-only mode */}
      {calendarId && !isReadOnly && (
        <StackedNotesWidget
          calendarId={calendarId}
          filterIds={dismissedReminderIds}
          calendar={calendar}
        />
      )}

      {/* Main Content Container */}
      <Box sx={{
        flex: 1,
        minWidth: 0,
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
              justifyContent: 'center',
              order: { xs: 0, lg: 1 },
              width: { xs: '100%', lg: 'auto' }
            }}>
              {/* Primary Actions Group */}
              <Box sx={{
                display: 'flex',
                gap: { xs: 0.75, sm: 1 },
                flexWrap: 'wrap',
                justifyContent: 'center',
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

                {/* Notes Button */}
                <Tooltip title="Notes for this calendar" arrow>
                  <Button
                    startIcon={<NotesIcon sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }} />}
                    onClick={() => togglePanel('notes', setIsNotesDrawerOpen)}
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
                      borderColor: (isLgUp
                        ? isPanelOpen && currentView.id === 'notes'
                        : isNotesDrawerOpen
                      ) ? 'info.main' : alpha(theme.palette.text.secondary, 0.3),
                      color: (isLgUp
                        ? isPanelOpen && currentView.id === 'notes'
                        : isNotesDrawerOpen
                      ) ? 'info.main' : 'text.secondary',
                      bgcolor: (isLgUp
                        ? isPanelOpen && currentView.id === 'notes'
                        : isNotesDrawerOpen
                      ) ? alpha(theme.palette.info.main, 0.1) : 'transparent',
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

                {/* Events Button */}
                <Tooltip title="Economic Calendar" arrow>
                  <Button
                    startIcon={<EventIcon sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }} />}
                    onClick={handleToggleEconomicCalendar}
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
                      borderColor: (isLgUp
                        ? isPanelOpen && currentView.id === 'economic-calendar'
                        : isEconomicCalendarOpen
                      ) ? 'info.main' : alpha(theme.palette.text.secondary, 0.3),
                      color: (isLgUp
                        ? isPanelOpen && currentView.id === 'economic-calendar'
                        : isEconomicCalendarOpen
                      ) ? 'info.main' : 'text.secondary',
                      bgcolor: (isLgUp
                        ? isPanelOpen && currentView.id === 'economic-calendar'
                        : isEconomicCalendarOpen
                      ) ? alpha(theme.palette.info.main, 0.1) : 'transparent',
                      '&:hover': {
                        borderColor: 'info.main',
                        bgcolor: alpha(theme.palette.info.main, 0.1),
                        color: 'info.main',
                        transform: 'translateY(-1px)'
                      },
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  >
                    Events
                  </Button>
                </Tooltip>

              </Box>

              {/* Secondary Actions Group */}
              <Box sx={{
                display: 'flex',
                gap: { xs: 0.75, sm: 1 },
                flexWrap: 'wrap',
                justifyContent: 'center',
                width: { xs: '100%', sm: 'auto' }
              }}>
                <Button
                  startIcon={<PinIcon sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }} />}
                  onClick={() => togglePanel('pinned', setPinnedTradesDrawerOpen)}
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
                    borderColor: (isLgUp
                      ? isPanelOpen && currentView.id === 'pinned'
                      : pinnedTradesDrawerOpen
                    ) ? 'info.main' : alpha(theme.palette.text.secondary, 0.3),
                    color: (isLgUp
                      ? isPanelOpen && currentView.id === 'pinned'
                      : pinnedTradesDrawerOpen
                    ) ? 'info.main' : 'text.secondary',
                    bgcolor: (isLgUp
                      ? isPanelOpen && currentView.id === 'pinned'
                      : pinnedTradesDrawerOpen
                    ) ? alpha(theme.palette.info.main, 0.1) : 'transparent',
                    '&:hover': {
                      borderColor: 'info.main',
                      bgcolor: alpha(theme.palette.info.main, 0.1),
                      color: 'info.main',
                      transform: 'translateY(-1px)'
                    },
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                >
                  Pinned
                </Button>

                <TagFilter
                  allTags={allTags}
                  selectedTags={selectedTags}
                  onTagsChange={handleTagsChange}
                  onOpenDrawer={() => togglePanel('search', setIsSearchDrawerOpen)}
                  isActive={isLgUp
                    ? isPanelOpen && currentView.id === 'search'
                    : isSearchDrawerOpen
                  }
                />

                <Tooltip title={isReadOnly ? "View tags and definitions" : "Manage tags and required tag groups"} arrow>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<TagIcon sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }} />}
                    onClick={() => togglePanel('tags', setIsTagManagementDrawerOpen)}
                    sx={{
                      flex: { xs: 1, sm: 'none' },
                      minWidth: { xs: 'auto', sm: '120px' },
                      borderRadius: 2,
                      fontWeight: 600,
                      textTransform: 'none',
                      fontSize: { xs: '0.8125rem', sm: '0.875rem' },
                      py: { xs: 0.75, sm: 1 },
                      px: { xs: 1.5, sm: 2 },
                      borderColor: (isLgUp
                        ? isPanelOpen && currentView.id === 'tags'
                        : isTagManagementDrawerOpen
                      ) ? 'info.main' : alpha(theme.palette.text.secondary, 0.3),
                      color: (isLgUp
                        ? isPanelOpen && currentView.id === 'tags'
                        : isTagManagementDrawerOpen
                      ) ? 'info.main' : 'text.secondary',
                      bgcolor: (isLgUp
                        ? isPanelOpen && currentView.id === 'tags'
                        : isTagManagementDrawerOpen
                      ) ? alpha(theme.palette.info.main, 0.1) : 'transparent',
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
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Week'].map((day, index) => {
                const isDayHeader = index < 7;
                const isClickable = isDayHeader && !isReadOnly;
                const hasGamePlan = isDayHeader && gamePlanNotes.has(day);
                const isToday = isDayHeader
                  && new Date().getDay() === index;
                return (
                  <Tooltip
                    key={day}
                    title={isClickable
                      ? (hasGamePlan
                        ? `View ${day} Game Plan`
                        : `Create ${day} Game Plan`)
                      : ''}
                    arrow
                    disableHoverListener={!isClickable}
                  >
                    <WeekdayHeader
                      onClick={isClickable ? () => {
                        handleDayHeaderClick(day as DayAbbreviation);
                      } : undefined}
                      sx={{
                        display: index === 7
                          ? { xs: 'none', sm: 'flex' } : 'flex',
                        cursor: isClickable ? 'pointer' : 'default',
                        position: 'relative',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 0.5,
                        p: { xs: 1, md: 1.5 },
                        fontWeight: 600,
                        fontSize: { xs: '0.875rem', md: '1rem' },
                        color: isToday ? 'primary.main' : 'text.secondary',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        ...(isToday && {
                          border: 2,
                          borderColor: 'primary.main',
                        }),
                        ...(isClickable && {
                          '&:hover': {
                            color: 'primary.main',
                            bgcolor: (t: Theme) =>
                              alpha(t.palette.primary.main, 0.08),
                          },
                        }),
                      }}
                    >
                      {day}
                      {hasGamePlan && (
                        <GamePlanIcon
                          sx={{
                            fontSize: '0.85rem',
                            color: 'inherit',
                          }}
                        />
                      )}
                    </WeekdayHeader>
                  </Tooltip>
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
                      accountBalance={totalAccountValue}
                      onWeekClick={handleWeekClick}
                      hasNote={weekNoteKeys.has(format(weekStart, 'yyyy-MM-dd'))}
                    />

                  </React.Fragment>
                );
              })}
            </Box>

            {/* Weekly stats for mobile - HIDDEN to save space */}
            {/* Mobile users can view weekly stats in the monthly statistics section below */}
          </Box>


        </Box>

      </Box>{/* end main content container */}

      </Box>{/* end left side content */}

      {/* Side Panel — lg+ only, replaces inline economic calendar */}
      {isLgUp && (
        <SidePanel renderView={renderViewWithReminders} />
      )}

      {isLgUp && !isPanelOpen && (
        <IconButton
          onClick={() => setPanelOpen(true)}
          sx={{
            position: 'absolute',
            right: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            bgcolor: 'background.paper',
            border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
            borderRight: 'none',
            borderRadius: '8px 0 0 8px',
            '&:hover': { bgcolor: 'action.hover' },
          }}
          aria-label="Expand panel"
        >
          <ChevronLeft fontSize="small" />
        </IconButton>
      )}

      </Box>{/* end page layout flex row */}

        {!isLgUp && (
          <DayDialog
            open={!!selectedDate && !globalTradeOps.formDialog.open}
            onClose={() => {
              setSelectedDate(null);
            }}
            showAddForm={isReadOnly ? () => { } : (trade) => {
              if (trade !== null && trade !== undefined) {
                globalTradeOps.onEditTrade?.(trade);
              } else {
                globalTradeOps.openAddDialog({
                  trade_date: selectedDate!!,
                  showDayDialogWhenDone: true,
                });
              }
            }}
            date={selectedDate || new Date()}
            trades={selectedDate ? tradesForSelectedDay : []}
            onDateChange={handleDayChange}
            account_balance={accountBalance}
            tradeOperations={tradeOperations}
            onOpenAIChatMode={
              isReadOnly
                ? undefined
                : (trades, tradeId, title) =>
                  tradeViewer.openGallery({
                    trades,
                    initialTradeId: tradeId,
                    title,
                    aiOnlyMode: true,
                  })
            }
            weekTrades={selectedDate
              ? weeklyStatsMap.get(format(startOfWeek(selectedDate, { weekStartsOn: 0 }), 'yyyy-MM-dd'))?.weekTrades
              : undefined
            }
          />
        )}


        <SelectDateDialog
          open={isMonthSelectorOpen}
          onClose={() => setIsMonthSelectorOpen(false)}
          onDateSelect={handleMonthSelect}
          initialDate={selectedDate || undefined}
          accountBalance={accountBalance}
          monthlyTarget={monthly_target}
          yearlyTarget={yearlyTarget}
          yearStats={calendar?.year_stats || {}}
          onOpenGalleryMode={(trades, initialTradeId, title, fetchYear) =>
            tradeViewer.openGallery({ trades, initialTradeId, title, fetchYear })
          }
        />




        {/* Drawers — only render on <lg (lg+ uses SidePanel) */}

        {!isLgUp && (
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
        )}

        <Snackbar
          open={snackbarOpen}
          autoHideDuration={snackbarSeverity === 'success' ? 3000 : 4000}
          onClose={handleSnackbarClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          sx={{ zIndex: Z_INDEX.SNACKBAR }}
        >
          <Alert
            onClose={handleSnackbarClose}
            severity={snackbarSeverity}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {snackbarMessage}
          </Alert>
        </Snackbar>




        {/* Search & Filter Drawer — <lg only */}
        {!isLgUp && calendar && calendarId && (
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
              tradeViewer.openGallery({
                trades,
                initialTradeId: trade.id,
                title: 'Search Results',
              });
            }}
          />
        )}

        {/* Pinned Trades Drawer — <lg only */}
        {!isLgUp && (
          <PinnedTradesDrawer
            open={pinnedTradesDrawerOpen}
            onClose={() => setPinnedTradesDrawerOpen(false)}
            calendarId={calendarId}
            onTradeClick={(trade, allTrades, title) => {
              // Close drawer and open the trade in gallery mode
              setPinnedTradesDrawerOpen(false);
              tradeViewer.openGallery({
                trades: allTrades,
                initialTradeId: trade.id,
                title,
              });
            }}
            tradeOperations={tradeOperations}
          />
        )}

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

        {/* Header Import Trades Dialog */}
        <ImportMappingDialog
          open={showImportDialog}
          onClose={() => {
            setShowImportDialog(false);
            setImportFile(null);
          }}
          onImport={handleHeaderImportComplete}
          file={importFile}
        />

      {/* Economic Calendar Drawer — only rendered on <lg (panel handles it on lg+) */}
      {!isLgUp && (
        <UnifiedDrawer
          open={isEconomicCalendarOpen}
          onClose={() => setIsEconomicCalendarOpen(false)}
          title="Economic Calendar"
          icon={<EventIcon />}
          width={{ xs: '100%', sm: 450 }}
          keepMounted
          contentSx={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        >
          <EconomicEventsView
            calendar={calendar!}
            isReadOnly={isReadOnly}
            onUpdateCalendarProperty={onUpdateCalendarProperty}
            tradeOperations={tradeOperations}
            enabled={isEconomicCalendarOpen}
            variant="compact"
          />
        </UnifiedDrawer>
      )}

      {/* AI Chat Drawer is mounted once at App level via GlobalAIChat —
          this page opens it through `globalAIChat.open()`. */}

      {/* Notes Drawer — <lg only */}
      {!isLgUp && (
        <UnifiedDrawer
          open={isNotesDrawerOpen}
          onClose={() => setIsNotesDrawerOpen(false)}
          title="Notes"
          icon={<NotesIcon />}
          width={{ xs: '100%', sm: 450 }}
          keepMounted
          contentSx={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        >
          <CalendarNotesPanel
            calendarId={calendarId}
            isActive={isNotesDrawerOpen}
            isReadOnly={isReadOnly}
            availableTradeTags={allTags}
            pinnedEvents={userPinnedEvents}
          />
        </UnifiedDrawer>
      )}

      {/* Stats Drawer — <lg only (lg+ uses SidePanel) */}
      {!isLgUp && (
        <StatsDrawer
          open={isStatsDrawerOpen}
          onClose={() => setIsStatsDrawerOpen(false)}
          balance={accountBalance}
          totalProfit={totalProfit}
          trades={trades}
          filteredTrades={filteredTrades}
          riskPerTrade={dynamicRiskSettings?.risk_per_trade}
          dynamicRiskSettings={dynamicRiskSettings}
          onToggleDynamicRisk={(useActualAmounts) => {
            setIsDynamicRiskToggled(useActualAmounts);
            handleToggleDynamicRisk(useActualAmounts);
          }}
          isDynamicRiskToggled={isDynamicRiskToggled}
          isReadOnly={isReadOnly}
          maxDailyDrawdown={maxDailyDrawdown}
          currentDate={currentDate}
          monthlyTarget={monthly_target}
          calendarId={calendarId}
          calendar={calendar}
          pnlBeforeMonth={pnlBeforeMonth}
          isPnlLoading={isPnlLoading}
          onDeleteTrade={globalTradeOps.onDeleteTrade}
          onOpenGalleryMode={(trades, initialTradeId, title) =>
            tradeViewer.openGallery({ trades, initialTradeId, title })
          }
          onUpdateTradeProperty={handleUpdateTradeProperty}
          onUpdateCalendarProperty={onUpdateCalendarProperty}
          onEditTrade={globalTradeOps.onEditTrade}
          economicFilter={(_calendarId) =>
            calendar?.economic_calendar_filters || DEFAULT_ECONOMIC_EVENT_FILTER_SETTINGS
          }
        />
      )}

      {/* Week Note Editor */}
      {weekNoteDialog && (
        <NoteEditorDialog
          open={weekNoteDialog.open}
          onClose={() => setWeekNoteDialog(null)}
          note={weekNoteDialog.note ?? undefined}
          calendarId={calendarId!}
          weekKey={weekNoteDialog.weekKey}
          availableTradeTags={allTags}
          calendarNotes={calendar.notes}
          pinnedEvents={userPinnedEvents}
          onSave={(savedNote, isCreated) => {
            if (isCreated && savedNote.week_key) {
              setWeekNoteKeys(prev => {
                const next = new Set(Array.from(prev));
                next.add(savedNote.week_key!);
                return next;
              });
            }
            setWeekNoteDialog(null);
          }}
          onDelete={() => {
            if (weekNoteDialog.weekKey) {
              setWeekNoteKeys(prev => {
                const next = new Set(prev);
                next.delete(weekNoteDialog.weekKey);
                return next;
              });
            }
            setWeekNoteDialog(null);
          }}
        />
      )}

      {/* Game Plan - View existing via BottomSheet */}
      <NotesBottomSheet
        open={!!gamePlanDialog?.existingNote}
        onClose={() => setGamePlanDialog(null)}
        notes={gamePlanDialog?.existingNote ? [gamePlanDialog.existingNote] : []}
        calendarId={calendarId!}
        fullDayName={gamePlanDialog ? {
          Sun: 'Sunday', Mon: 'Monday', Tue: 'Tuesday',
          Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday',
          Sat: 'Saturday',
        }[gamePlanDialog.day] : ''}
        availableTradeTags={allTags}
        onNoteSaved={() => {
          if (calendarId) {
            notesService.getGamePlanNotesByDay(calendarId)
              .then(setGamePlanNotes);
          }
        }}
        onNoteDeleted={() => {
          setGamePlanDialog(null);
          if (calendarId) {
            notesService.getGamePlanNotesByDay(calendarId)
              .then(setGamePlanNotes);
          }
        }}
      />

      {/* Game Plan - Create new via Editor */}
      {gamePlanDialog && !gamePlanDialog.existingNote && (
        <NoteEditorDialog
          open
          onClose={() => setGamePlanDialog(null)}
          calendarId={calendarId!}
          gamePlanDay={gamePlanDialog.day}
          availableTradeTags={allTags}
          calendarNotes={calendar.notes}
          pinnedEvents={userPinnedEvents}
          onSave={() => {
            setGamePlanDialog(null);
            if (calendarId) {
              notesService.getGamePlanNotesByDay(calendarId)
                .then(setGamePlanNotes);
            }
          }}
          onDelete={() => setGamePlanDialog(null)}
        />
      )}

    </Box>
  );
};

export const TradeCalendar: FC<TradeCalendarProps> = (props) => {
  return (
    <SidePanelProvider
      defaultView={{ id: 'economic-calendar' }}
      defaultOpen={false}
    >
      <TradeCalendarInner {...props} />
    </SidePanelProvider>
  );
};

export default TradeCalendar;
