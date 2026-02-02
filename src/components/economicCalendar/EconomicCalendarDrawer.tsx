/**
 * Economic Calendar Drawer Component
 * Redesigned to match search drawer style with day/week/month pagination
 *
 * OPTIMIZED: Uses custom hooks for state management, data fetching, and shared time
 * to prevent performance issues from frequent re-renders.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  useTheme,
  alpha,
  Chip,
  Button,
  ButtonGroup,
  CircularProgress,
  Divider,
  Paper,
  Tooltip
} from '@mui/material';
import {
  Close as CloseIcon,
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
import { format, addDays, addWeeks, addMonths, startOfWeek, endOfWeek, isToday, isTomorrow, parseISO } from 'date-fns';
import {
  EconomicCalendarDrawerProps,
  EconomicEvent,
} from '../../types/economicCalendar';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import { Z_INDEX } from '../../styles/zIndex';
import EconomicEventListItem from './EconomicEventListItem';
import EconomicCalendarFilters from './EconomicCalendarFilters';
import EconomicEventDetailDialog from './EconomicEventDetailDialog';
import EconomicEventShimmer from './EconomicEventShimmer';
import { logger } from '../../utils/logger';
// Optimized hooks
import { useEconomicEvents, ViewType } from '../../hooks/useEconomicEvents';
import { useEventPinning } from '../../hooks/useEventPinning';
import { useEconomicCalendarFilters } from '../../hooks/useEconomicCalendarFilters';
import { useEventCountdownTime } from '../../hooks/useCurrentTime';

// Re-export for backwards compatibility
export type { EconomicCalendarFilterSettings } from '../../hooks/useEconomicCalendarFilters';
export { DEFAULT_FILTER_SETTINGS as DEFAULT_ECONOMIC_EVENT_FILTER_SETTINGS } from '../../hooks/useEconomicCalendarFilters';

// Helper function to get date header for month view
const getDateHeader = (date: string) => {
  const eventDate = parseISO(date);

  if (isToday(eventDate)) {
    return 'Today';
  } else if (isTomorrow(eventDate)) {
    return 'Tomorrow';
  } else {
    return format(eventDate, 'EEE, MMM d');
  }
};

// Group events by date for month view
const groupEventsByDate = (events: EconomicEvent[]) => {
  const grouped: { [key: string]: EconomicEvent[] } = {};

  events.forEach(event => {
    const date = event.event_date;
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(event);
  });

  // Sort dates
  const sortedDates = Object.keys(grouped).sort();

  return sortedDates.map(date => ({
    date,
    events: grouped[date].sort((a, b) => a.time_utc.localeCompare(b.time_utc))
  }));
};

// Check if any event is imminent (within 60 minutes)
const hasImminentEvent = (events: EconomicEvent[]): boolean => {
  const now = new Date();
  return events.some(event => {
    const eventDate = parseISO(event.time_utc);
    const diffMs = eventDate.getTime() - now.getTime();
    const diffMinutes = diffMs / (1000 * 60);
    return diffMinutes > 0 && diffMinutes <= 60;
  });
};


const EconomicCalendarDrawer: React.FC<EconomicCalendarDrawerProps> = ({
  open,
  onClose,
  calendar,
  payload,
  tradeOperations,
  isReadOnly = false,
  initialDate
}) => {
  const { onUpdateCalendarProperty } = tradeOperations;
  const theme = useTheme();

  // Local UI state
  const [currentDate, setCurrentDate] = useState(initialDate || new Date());
  const [customDateRange, setCustomDateRange] = useState<{ start: string | null; end: string | null }>({
    start: null,
    end: null,
  });
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [isMonthPickerActive, setIsMonthPickerActive] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EconomicEvent | null>(null);
  const [eventDetailDialogOpen, setEventDetailDialogOpen] = useState(false);
  // Track whether we're viewing a specific date (from DayDialog) - disables onlyUpcoming filter
  const [isViewingSpecificDate, setIsViewingSpecificDate] = useState(!!initialDate);

  // Use reusable event pinning hook
  const {
    pinningEventId,
    handlePinEvent,
    handleUnpinEvent
  } = useEventPinning({
    calendar,
    onUpdateCalendarProperty
  });

  // Use optimized filter hook
  const {
    appliedFilters,
    pendingFilters,
    viewType,
    notificationsEnabled,
    filtersModified,
    toggleCurrency,
    toggleImpact,
    setOnlyUpcoming,
    setViewType,
    setNotificationsEnabled,
    applyFilters,
    resetFilters,
  } = useEconomicCalendarFilters({
    calendar,
    onUpdateCalendarProperty,
  });

  // Compute effective values directly to avoid race condition on first open
  // When open becomes true with initialDate, we need to use initialDate immediately
  // without waiting for the useEffect state update
  const effectiveCurrentDate = (open && initialDate) ? initialDate : currentDate;
  const effectiveIsViewingSpecificDate = !!(open && initialDate) || isViewingSpecificDate;

  // Use optimized events hook
  // When viewing a specific date (from DayDialog), disable onlyUpcoming filter
  const {
    events,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    refresh,
  } = useEconomicEvents({
    viewType,
    currentDate: effectiveCurrentDate,
    currencies: appliedFilters.currencies,
    impacts: appliedFilters.impacts,
    onlyUpcoming: effectiveIsViewingSpecificDate ? false : appliedFilters.onlyUpcoming,
    enabled: open,
    customDateRange,
  });

  // Sync currentDate state with initialDate when drawer opens (for UI display and navigation)
  const initialDateTimestamp = initialDate?.getTime();
  useEffect(() => {
    if (open && initialDate) {
      setCurrentDate(initialDate);
      setIsMonthPickerActive(false);
      setIsViewingSpecificDate(true);
    } else if (!open) {
      // Reset when drawer closes
      setIsViewingSpecificDate(false);
    }
  }, [open, initialDateTimestamp]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check if any events are imminent for optimized time updates
  const hasImminent = useMemo(() => hasImminentEvent(events), [events]);

  // Use shared time hook - only updates every second when there are imminent events
  const { currentTime } = useEventCountdownTime(hasImminent, open);

  // State for trade counts
  const [eventTradeCountMap, setEventTradeCountMap] = useState<Map<string, number>>(new Map());

  // Merge events with payload updates - use updated events if available
  const mergedEvents = useMemo(() => {
    if (!payload || payload.updatedEvents.length === 0) {
      return events;
    }

    // Create a map of updated events by ID for quick lookup
    const updatedEventsMap = new Map(
      payload.updatedEvents.map(event => [event.id, event])
    );

    // Replace matching events with updated versions
    return events.map(event => {
      const updatedEvent = updatedEventsMap.get(event.id);
      return updatedEvent || event;
    });
  }, [events, payload]);

  // Group events by date - memoized to prevent recalculation
  const groupedEvents = useMemo(() => groupEventsByDate(mergedEvents), [mergedEvents]);

  // Fetch trade counts when events change
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
            impact: event.impact
          }))
        );
        setEventTradeCountMap(counts);
      } catch (error) {
        logger.error('Error fetching trade counts:', error);
        setEventTradeCountMap(new Map());
      }
    };

    fetchTradeCounts();
  }, [mergedEvents, calendar?.id]);

  // Handle view type change
  const handleViewTypeChange = useCallback((newViewType: ViewType) => {
    setViewType(newViewType);
    setCustomDateRange({ start: null, end: null });
    setCurrentDate(new Date());
    setIsMonthPickerActive(false);
    setIsViewingSpecificDate(false); // Exit specific date mode when changing view
  }, [setViewType]);

  // Navigation handlers
  const handlePrevious = useCallback(() => {
    setCustomDateRange({ start: null, end: null });
    setIsViewingSpecificDate(false); // Exit specific date mode when navigating

    switch (viewType) {
      case 'day':
        setCurrentDate(prev => addDays(prev, -1));
        break;
      case 'week':
        setCurrentDate(prev => addWeeks(prev, -1));
        break;
      case 'month':
        setCurrentDate(prev => addMonths(prev, -1));
        break;
    }
  }, [viewType]);

  const handleNext = useCallback(() => {
    setCustomDateRange({ start: null, end: null });
    setIsViewingSpecificDate(false); // Exit specific date mode when navigating

    switch (viewType) {
      case 'day':
        setCurrentDate(prev => addDays(prev, 1));
        break;
      case 'week':
        setCurrentDate(prev => addWeeks(prev, 1));
        break;
      case 'month':
        setCurrentDate(prev => addMonths(prev, 1));
        break;
    }
  }, [viewType]);

  // Handle month picker change
  const handleMonthChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedDate = new Date(event.target.value + '-01');
    setCurrentDate(selectedDate);
    setIsViewingSpecificDate(false); // Exit specific date mode when picking month
    setIsMonthPickerActive(true);
  }, []);

  // Apply filters handler
  const handleApplyFilters = useCallback(async () => {
    await applyFilters();
    setIsFilterExpanded(false);
  }, [applyFilters]);

  // Reset filters handler
  const handleResetFilters = useCallback(() => {
    resetFilters();
  }, [resetFilters]);

  // Handle notification toggle
  const handleNotificationToggle = useCallback(async (enabled: boolean) => {
    await setNotificationsEnabled(enabled);
  }, [setNotificationsEnabled]);

  // Infinite scroll handler
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;

    if (scrollHeight <= clientHeight) {
      return;
    }

    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

    if (scrollPercentage > 0.8 && scrollTop > 0 && hasMore && !loadingMore && !loading) {
      loadMore();
    }
  }, [hasMore, loadingMore, loading, loadMore]);

  // Format display text for current period
  const getDisplayText = useCallback(() => {
    switch (viewType) {
      case 'day':
        return format(currentDate, 'EEEE, MMMM d, yyyy');
      case 'week':
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
      case 'month':
        return format(currentDate, 'MMMM yyyy');
      default:
        return '';
    }
  }, [viewType, currentDate]);

  // Handle event click
  const handleEventClick = useCallback((event: EconomicEvent) => {
    logger.log('Economic event clicked:', event);
    setSelectedEvent(event);
    setEventDetailDialogOpen(true);
  }, []);

  // Handle dialog close
  const handleDialogClose = useCallback(() => {
    setEventDetailDialogOpen(false);
    setSelectedEvent(null);
  }, []);

  // Use higher z-index when opened from a dialog (when initialDate is provided)
  const drawerZIndex = initialDate ? Z_INDEX.ECONOMIC_CALENDAR_DRAWER_OVER_DIALOG : Z_INDEX.ECONOMIC_CALENDAR_DRAWER;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      sx={{
        zIndex: drawerZIndex,
        '& .MuiDrawer-paper': {
          width: { xs: '100%', sm: 450 },
          maxWidth: '100vw',
          zIndex: drawerZIndex,
          background: theme.palette.mode === 'dark'
            ? 'linear-gradient(135deg, rgba(18, 18, 18, 0.95) 0%, rgba(30, 30, 30, 0.95) 100%)'
            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.95) 100%)',
          backdropFilter: 'blur(20px)',
          borderLeft: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          boxShadow: theme.palette.mode === 'dark'
            ? '0 8px 32px rgba(0, 0, 0, 0.4)'
            : '0 8px 32px rgba(0, 0, 0, 0.12)'
        }
      }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{
          p: 3,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          background: alpha(theme.palette.background.paper, 0.8),
          backdropFilter: 'blur(10px)'
        }}>
          <Box sx={{
            p: 1.5,
            borderRadius: 2,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <CalendarIcon sx={{ color: 'primary.main', fontSize: 22 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
              Economic Calendar
            </Typography>
            <Typography variant="caption" sx={{
              color: 'text.secondary',
              fontSize: '0.75rem'
            }}>
              Economic events and indicators
            </Typography>
          </Box>
          <IconButton
            onClick={onClose}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* View Controls */}
        <Box sx={{
          p: 3,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          background: alpha(theme.palette.background.default, 0.3)
        }}>
          {/* View Type Selector */}
          <Box sx={{ mb: 2 }}>
            <ButtonGroup variant="outlined" size="small" fullWidth>
              <Button
                startIcon={<EventIcon />}
                onClick={() => handleViewTypeChange('day')}
                variant={!isMonthPickerActive && viewType === 'day' ? 'contained' : 'outlined'}
                sx={{ flex: 1 }}
              >
                Today
              </Button>
              <Button
                startIcon={<WeekIcon />}
                onClick={() => handleViewTypeChange('week')}
                variant={!isMonthPickerActive && viewType === 'week' ? 'contained' : 'outlined'}
                sx={{ flex: 1 }}
              >
                This Week
              </Button>
              <Button
                startIcon={<MonthIcon />}
                onClick={() => handleViewTypeChange('month')}
                variant={!isMonthPickerActive && viewType === 'month' ? 'contained' : 'outlined'}
                sx={{ flex: 1 }}
              >
                This Month
              </Button>
            </ButtonGroup>
          </Box>

          {/* Date Navigation */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <IconButton onClick={handlePrevious} size="small">
              <ChevronLeftIcon />
            </IconButton>
            <Box sx={{ flex: 1, textAlign: 'center' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {getDisplayText()}
              </Typography>
            </Box>
            <IconButton onClick={handleNext} size="small">
              <ChevronRightIcon />
            </IconButton>
          </Box>

          {/* Filter Toggle */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              background: alpha(theme.palette.primary.main, 0.05),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                background: alpha(theme.palette.primary.main, 0.08),
                borderColor: alpha(theme.palette.primary.main, 0.2),
                transform: 'translateY(-1px)',
              }
            }}
            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{
                  p: 1,
                  borderRadius: 1.5,
                  background: alpha(theme.palette.primary.main, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <FilterIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{
                    fontWeight: 600,
                    color: 'primary.main',
                    mb: 0.5
                  }}>
                    Filters
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={`${appliedFilters.currencies.length + appliedFilters.impacts.length + (appliedFilters.onlyUpcoming ? 1 : 0)} active`}
                      size="small"
                      color={filtersModified ? "warning" : "primary"}
                      variant={filtersModified ? "filled" : "outlined"}
                      sx={{
                        height: 20,
                        fontSize: '0.75rem',
                        '& .MuiChip-label': {
                          px: 1,
                        }
                      }}
                    />
                    {filtersModified && (
                      <Chip
                        label="Modified"
                        size="small"
                        color="warning"
                        variant="outlined"
                        sx={{
                          fontSize: '0.75rem',
                          height: 20,
                          '& .MuiChip-label': {
                            px: 1,
                          }
                        }}
                      />
                    )}
                  </Box>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {/* Notifications Toggle */}
                <Tooltip
                  title={notificationsEnabled ? "Disable event notifications" : "Enable event notifications"}
                  placement="top"
                >
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNotificationToggle(!notificationsEnabled);
                    }}
                    sx={{
                      color: notificationsEnabled ? 'primary.main' : 'text.disabled',
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.primary.main, 0.1),
                        transform: 'scale(1.1)',
                      },
                      transition: 'all 0.2s ease-in-out'
                    }}
                  >
                    {notificationsEnabled ? <NotificationsIcon /> : <NotificationsOffIcon />}
                  </IconButton>
                </Tooltip>

                {/* Expand/Collapse Toggle */}
                <IconButton
                  size="small"
                  sx={{
                    color: 'primary.main',
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.1),
                      transform: 'scale(1.1)',
                    },
                    transition: 'all 0.2s ease-in-out'
                  }}
                >
                  {isFilterExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Box>
            </Box>
          </Paper>
        </Box>

        {/* Filters Section */}
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

        {/* Content */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            ...scrollbarStyles(theme)
          }}
          onScroll={handleScroll}
        >
          {loading ? (
            <EconomicEventShimmer />
          ) : error ? (
            <Box sx={{ textAlign: 'center', py: 4, px: 3 }}>
              <CalendarIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                {error}
              </Typography>
              <Button variant="outlined" onClick={refresh}>
                Retry
              </Button>
            </Box>
          ) : events.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4, px: 3 }}>
              <CalendarIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                No events found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Try adjusting your filters or date range
              </Typography>
            </Box>
          ) : (
            <Box>
              {groupedEvents.map((dayGroup) => (
                <Box key={dayGroup.date}>
                  {/* Sticky Date Header */}
                  <Box sx={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    background: alpha(theme.palette.background.paper, 0.95),
                    backdropFilter: 'blur(10px)',
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    px: 3,
                    py: 1.5
                  }}>
                    <Typography variant="subtitle2" sx={{
                      fontWeight: 600,
                      color: 'primary.main',
                      fontSize: '0.875rem'
                    }}>
                      {getDateHeader(dayGroup.date)}
                    </Typography>
                  </Box>

                  {/* Events for this day */}
                  <Box>
                    {dayGroup.events.map((event, eventIndex) => {
                      const uniqueKey = `${event.id}-${eventIndex}`;
                      const tradeCount = eventTradeCountMap.get(event.id) || 0;
                      return (
                        <React.Fragment key={uniqueKey}>
                          <EconomicEventListItem
                            px={2.5}
                            py={1.5}
                            event={event}
                            pinnedEvents={calendar?.pinned_events || []}
                            onPinEvent={handlePinEvent}
                            onUnpinEvent={handleUnpinEvent}
                            isPinning={pinningEventId === event.id}
                            tradeCount={tradeCount}
                            currentTime={currentTime}
                            onClick={handleEventClick}
                          />
                          {eventIndex < dayGroup.events.length - 1 && <Divider sx={{ ml: 3 }} />}
                        </React.Fragment>
                      );
                    })}
                  </Box>
                </Box>
              ))}

              {/* Load More Button */}
              {hasMore && (
                <Box sx={{ p: 3 }}>
                  <Button
                    onClick={loadMore}
                    disabled={loadingMore}
                    variant="outlined"
                    fullWidth
                    startIcon={loadingMore ? <CircularProgress size={16} /> : undefined}
                    sx={{
                      borderRadius: 2,
                      py: 1.5,
                      textTransform: 'none',
                      fontWeight: 500,
                      borderColor: alpha(theme.palette.primary.main, 0.3),
                      color: 'primary.main',
                      '&:hover': {
                        borderColor: 'primary.main',
                        backgroundColor: alpha(theme.palette.primary.main, 0.04),
                      }
                    }}
                  >
                    {loadingMore ? 'Loading more events...' : `Load more events`}
                  </Button>
                </Box>
              )}

              {/* End of results indicator */}
              {!hasMore && events.length > 0 && !loading && (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    No more events to load
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </Box>

        {/* Footer */}
        {!isFilterExpanded && <Box sx={{
          p: 2,
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          background: alpha(theme.palette.background.paper, 0.8),
          backdropFilter: 'blur(10px)'
        }}>
          {/* Pagination Info */}
          {events.length > 0 && (
            <Typography variant="caption" color="text.secondary" align="center" display="block" sx={{ mb: 0.5 }}>
              Showing {events.length} events{hasMore ? ' (more available)' : ''}
            </Typography>
          )}

        </Box>}

      </Box>

      {/* Economic Event Detail Dialog */}
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
    </Drawer>
  );
};

export default EconomicCalendarDrawer;
