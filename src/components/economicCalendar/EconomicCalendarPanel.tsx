import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  useTheme,
  alpha,
  Chip,
  Button,
  ButtonGroup,
  Paper,
  Tooltip
} from '@mui/material';
import {
  CalendarToday as CalendarIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  FilterAlt as FilterIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  DateRange as WeekIcon,
  CalendarMonth as MonthIcon,
  Event as EventIcon,
  Notifications as NotificationsIcon,
  NotificationsOff as NotificationsOffIcon
} from '@mui/icons-material';
import {
  format, addDays, addWeeks, addMonths,
  startOfWeek, endOfWeek
} from 'date-fns';
import { EconomicEvent } from '../../types/economicCalendar';
import { Calendar } from '../../types/calendar';
import { TradeOperationsProps } from '../../types/tradeOperations';
import { getSessionForTimestamp } from '../../utils/sessionTimeUtils';
import { logger } from '../../utils/logger';
import { useEconomicEvents, ViewType } from '../../hooks/useEconomicEvents';
import { useEventPinning } from '../../hooks/useEventPinning';
import { useEconomicCalendarFilters } from '../../hooks/useEconomicCalendarFilters';
import { useEventCountdownTime } from '../../hooks/useCurrentTime';
import EconomicCalendarFilters from './EconomicCalendarFilters';
import EconomicEventDetailDialog from './EconomicEventDetailDialog';
import EconomicCalendarEventList from './EconomicCalendarEventList';

// Group events by date
const groupEventsByDate = (events: EconomicEvent[]) => {
  const grouped: { [key: string]: EconomicEvent[] } = {};
  events.forEach(event => {
    if (!grouped[event.event_date]) grouped[event.event_date] = [];
    grouped[event.event_date].push(event);
  });
  return Object.keys(grouped).sort().map(date => ({
    date,
    events: grouped[date].sort((a, b) => a.time_utc.localeCompare(b.time_utc))
  }));
};

export interface EconomicCalendarPanelProps {
  calendar: Calendar;
  payload?: { updatedEvents: EconomicEvent[]; allEvents: EconomicEvent[] } | null;
  tradeOperations: TradeOperationsProps;
  isReadOnly?: boolean;
  initialDate?: Date;
  onCollapse?: () => void;
  enabled?: boolean;
  showHeader?: boolean;
}

const EconomicCalendarPanel: React.FC<EconomicCalendarPanelProps> = ({
  calendar,
  payload,
  tradeOperations,
  isReadOnly = false,
  initialDate,
  onCollapse,
  enabled = true,
  showHeader = true,
}) => {
  const { onUpdateCalendarProperty } = tradeOperations;
  const theme = useTheme();

  const [currentDate, setCurrentDate] = useState(initialDate || new Date());
  const [customDateRange, setCustomDateRange] = useState<{ start: string | null; end: string | null }>({
    start: null, end: null,
  });
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [isMonthPickerActive, setIsMonthPickerActive] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EconomicEvent | null>(null);
  const [eventDetailDialogOpen, setEventDetailDialogOpen] = useState(false);
  const [isViewingSpecificDate, setIsViewingSpecificDate] = useState(!!initialDate);

  const { pinningEventId, handlePinEvent, handleUnpinEvent } = useEventPinning({
    calendar, onUpdateCalendarProperty,
  });

  const {
    appliedFilters, pendingFilters, viewType, notificationsEnabled, filtersModified,
    toggleCurrency, toggleImpact, setOnlyUpcoming, setViewType, setNotificationsEnabled,
    applyFilters, resetFilters,
  } = useEconomicCalendarFilters({ calendar, onUpdateCalendarProperty });

  const effectiveCurrentDate = (enabled && initialDate) ? initialDate : currentDate;
  const effectiveIsViewingSpecificDate = !!(enabled && initialDate) || isViewingSpecificDate;

  const {
    events, loading, loadingMore, error, hasMore, loadMore, refresh,
  } = useEconomicEvents({
    viewType,
    currentDate: effectiveCurrentDate,
    currencies: appliedFilters.currencies,
    impacts: appliedFilters.impacts,
    onlyUpcoming: effectiveIsViewingSpecificDate ? false : appliedFilters.onlyUpcoming,
    enabled,
    customDateRange,
  });

  const initialDateTimestamp = initialDate?.getTime();
  useEffect(() => {
    if (enabled && initialDate) {
      setCurrentDate(initialDate);
      setIsMonthPickerActive(false);
      setIsViewingSpecificDate(true);
    } else if (!enabled) {
      setIsViewingSpecificDate(false);
    }
  }, [enabled, initialDateTimestamp]); // eslint-disable-line react-hooks/exhaustive-deps

  const { currentTime } = useEventCountdownTime(events, enabled);

  const [eventTradeCountMap, setEventTradeCountMap] = useState<Map<string, number>>(new Map());

  const mergedEvents = useMemo(() => {
    if (!payload || payload.updatedEvents.length === 0) return events;
    const updatedEventsMap = new Map(payload.updatedEvents.map(e => [e.id, e]));
    return events.map(e => updatedEventsMap.get(e.id) || e);
  }, [events, payload]);

  const groupedEvents = useMemo(() => groupEventsByDate(mergedEvents), [mergedEvents]);

  useEffect(() => {
    const fetchTradeCounts = async () => {
      if (!calendar?.id || mergedEvents.length === 0) {
        setEventTradeCountMap(new Map());
        return;
      }
      try {
        const calendarServiceModule = await import('../../services/calendarService');
        const counts = await calendarServiceModule.getTradeRepository().fetchTradeCountsByEvents(
          calendar.id,
          mergedEvents.map(event => ({
            id: event.id,
            event_name: event.event_name,
            currency: event.currency,
            impact: event.impact,
            session: event.is_all_day ? undefined : getSessionForTimestamp(event.time_utc) ?? undefined,
          }))
        );
        setEventTradeCountMap(counts);
      } catch (err) {
        logger.error('Error fetching trade counts:', err);
        setEventTradeCountMap(new Map());
      }
    };
    fetchTradeCounts();
  }, [mergedEvents, calendar?.id]);

  const handleViewTypeChange = useCallback((newViewType: ViewType) => {
    setViewType(newViewType);
    setCustomDateRange({ start: null, end: null });
    setCurrentDate(new Date());
    setIsMonthPickerActive(false);
    setIsViewingSpecificDate(false);
  }, [setViewType]);

  const handlePrevious = useCallback(() => {
    setCustomDateRange({ start: null, end: null });
    setIsViewingSpecificDate(false);
    switch (viewType) {
      case 'day': setCurrentDate(prev => addDays(prev, -1)); break;
      case 'week': setCurrentDate(prev => addWeeks(prev, -1)); break;
      case 'month': setCurrentDate(prev => addMonths(prev, -1)); break;
    }
  }, [viewType]);

  const handleNext = useCallback(() => {
    setCustomDateRange({ start: null, end: null });
    setIsViewingSpecificDate(false);
    switch (viewType) {
      case 'day': setCurrentDate(prev => addDays(prev, 1)); break;
      case 'week': setCurrentDate(prev => addWeeks(prev, 1)); break;
      case 'month': setCurrentDate(prev => addMonths(prev, 1)); break;
    }
  }, [viewType]);

  const handleMonthChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentDate(new Date(event.target.value + '-01'));
    setIsViewingSpecificDate(false);
    setIsMonthPickerActive(true);
  }, []);

  const handleApplyFilters = useCallback(async () => {
    await applyFilters();
    setIsFilterExpanded(false);
  }, [applyFilters]);

  const handleResetFilters = useCallback(() => resetFilters(), [resetFilters]);

  const handleNotificationToggle = useCallback(async (value: boolean) => {
    await setNotificationsEnabled(value);
  }, [setNotificationsEnabled]);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    if (scrollHeight <= clientHeight) return;
    if ((scrollTop + clientHeight) / scrollHeight > 0.8 && scrollTop > 0 && hasMore && !loadingMore && !loading) {
      loadMore();
    }
  }, [hasMore, loadingMore, loading, loadMore]);

  const getDisplayText = useCallback(() => {
    switch (viewType) {
      case 'day': return format(effectiveCurrentDate, 'EEEE, MMMM d, yyyy');
      case 'week': {
        const weekStart = startOfWeek(effectiveCurrentDate, { weekStartsOn: 0 });
        const weekEnd = endOfWeek(effectiveCurrentDate, { weekStartsOn: 0 });
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
      }
      case 'month': return format(effectiveCurrentDate, 'MMMM yyyy');
      default: return '';
    }
  }, [viewType, effectiveCurrentDate]);

  const handleEventClick = useCallback((event: EconomicEvent) => {
    logger.log('Economic event clicked:', event);
    setSelectedEvent(event);
    setEventDetailDialogOpen(true);
  }, []);

  const handleDialogClose = useCallback(() => {
    setEventDetailDialogOpen(false);
    setSelectedEvent(null);
  }, []);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header — hidden in inline panel mode, shown in drawer mode */}
      {showHeader && <Box sx={{
        p: 3,
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        display: 'flex', alignItems: 'center', gap: 2,
        bgcolor: 'background.paper',
      }}>
        <Box sx={{
          p: 1.5, borderRadius: 2,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <CalendarIcon sx={{ color: 'primary.main', fontSize: 22 }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>Economic Calendar</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
            Economic events and indicators
          </Typography>
        </Box>
        <IconButton onClick={onCollapse} size="small">
          <ChevronRightIcon />
        </IconButton>
      </Box>}

      {/* View Controls */}
      <Box sx={{
        p: 3,
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        bgcolor: 'background.paper',
      }}>
        <Box sx={{ mb: 2 }}>
          <ButtonGroup variant="outlined" size="small" fullWidth>
            <Button
              startIcon={<EventIcon />}
              onClick={() => handleViewTypeChange('day')}
              variant={!isMonthPickerActive && viewType === 'day' ? 'contained' : 'outlined'}
              sx={{ flex: 1, whiteSpace: 'nowrap' }}
            >Today</Button>
            <Button
              startIcon={<WeekIcon />}
              onClick={() => handleViewTypeChange('week')}
              variant={!isMonthPickerActive && viewType === 'week' ? 'contained' : 'outlined'}
              sx={{ flex: 1, whiteSpace: 'nowrap' }}
            >This Week</Button>
            <Button
              startIcon={<MonthIcon />}
              onClick={() => handleViewTypeChange('month')}
              variant={!isMonthPickerActive && viewType === 'month' ? 'contained' : 'outlined'}
              sx={{ flex: 1, whiteSpace: 'nowrap' }}
            >This Month</Button>
          </ButtonGroup>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <IconButton onClick={handlePrevious} size="small"><ChevronLeftIcon /></IconButton>
          <Box sx={{ flex: 1, textAlign: 'center' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{getDisplayText()}</Typography>
          </Box>
          <IconButton onClick={handleNext} size="small"><ChevronRightIcon /></IconButton>
        </Box>

        <Paper
          elevation={0}
          onClick={() => setIsFilterExpanded(!isFilterExpanded)}
          sx={{
            p: 2, borderRadius: 2, cursor: 'pointer',
            background: alpha(theme.palette.primary.main, 0.05),
            border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              background: alpha(theme.palette.primary.main, 0.08),
              borderColor: alpha(theme.palette.primary.main, 0.2),
              transform: 'translateY(-1px)',
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{
                p: 1, borderRadius: 1.5,
                background: alpha(theme.palette.primary.main, 0.1),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <FilterIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.main', mb: 0.5 }}>
                  Filters
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label={`${appliedFilters.currencies.length + appliedFilters.impacts.length + (appliedFilters.onlyUpcoming ? 1 : 0)} active`}
                    size="small"
                    color={filtersModified ? 'warning' : 'primary'}
                    variant={filtersModified ? 'filled' : 'outlined'}
                    sx={{ height: 20, fontSize: '0.75rem', '& .MuiChip-label': { px: 1 } }}
                  />
                  {filtersModified && (
                    <Chip
                      label="Modified" size="small" color="warning" variant="outlined"
                      sx={{ fontSize: '0.75rem', height: 20, '& .MuiChip-label': { px: 1 } }}
                    />
                  )}
                </Box>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip title={notificationsEnabled ? 'Disable event notifications' : 'Enable event notifications'} placement="top">
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); handleNotificationToggle(!notificationsEnabled); }}
                  sx={{
                    color: notificationsEnabled ? 'primary.main' : 'text.disabled',
                    '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.1), transform: 'scale(1.1)' },
                    transition: 'all 0.2s ease-in-out',
                  }}
                >
                  {notificationsEnabled ? <NotificationsIcon /> : <NotificationsOffIcon />}
                </IconButton>
              </Tooltip>
              <IconButton
                size="small"
                sx={{
                  color: 'primary.main',
                  '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.1), transform: 'scale(1.1)' },
                  transition: 'all 0.2s ease-in-out',
                }}
              >
                {isFilterExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
          </Box>
        </Paper>
      </Box>

      {/* Filters */}
      <EconomicCalendarFilters
        isExpanded={isFilterExpanded}
        currentDate={currentDate}
        pendingCurrencies={pendingFilters.currencies}
        pendingImpacts={pendingFilters.impacts}
        pendingOnlyUpcoming={pendingFilters.onlyUpcoming}
        filtersModified={filtersModified}
        loading={loading}
        onCurrencyChange={toggleCurrency}
        onImpactChange={toggleImpact}
        onUpcomingEventsChange={setOnlyUpcoming}
        onMonthChange={handleMonthChange}
        onApplyFilters={handleApplyFilters}
        onResetFilters={handleResetFilters}
      />

      {/* Event List */}
      <EconomicCalendarEventList
        loading={loading}
        error={error}
        events={mergedEvents}
        groupedEvents={groupedEvents}
        hasMore={hasMore}
        loadingMore={loadingMore}
        pinnedEvents={calendar?.pinned_events || []}
        pinningEventId={pinningEventId}
        eventTradeCountMap={eventTradeCountMap}
        currentTime={currentTime}
        onPinEvent={handlePinEvent}
        onUnpinEvent={handleUnpinEvent}
        onEventClick={handleEventClick}
        onLoadMore={loadMore}
        onRefresh={refresh}
        onScroll={handleScroll}
      />

      {/* Footer */}
      {!isFilterExpanded && (
        <Box sx={{ p: 2, borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`, bgcolor: 'background.paper' }}>
          {mergedEvents.length > 0 && (
            <Typography variant="caption" color="text.secondary" align="center" display="block" sx={{ mb: 0.5 }}>
              Showing {mergedEvents.length} events{hasMore ? ' (more available)' : ''}
            </Typography>
          )}
        </Box>
      )}

      {/* Event Detail Dialog */}
      {selectedEvent && calendar && (
        <EconomicEventDetailDialog
          open={eventDetailDialogOpen}
          onClose={handleDialogClose}
          event={selectedEvent}
          calendarId={calendar.id}
          tradeOperations={tradeOperations}
          isReadOnly={isReadOnly}
        />
      )}
    </Box>
  );
};

export default EconomicCalendarPanel;
