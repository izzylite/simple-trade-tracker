/**
 * Economic Calendar Drawer Component
 * Redesigned to match search drawer style with day/week/month pagination
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Collapse,
  FormControl,
  FormLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Switch,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Divider,
  TextField,
  Avatar,
  Stack,
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
  Check as CheckIcon,
  Notifications as NotificationsIcon,
  NotificationsOff as NotificationsOffIcon
} from '@mui/icons-material';
import { format, addDays, addWeeks, addMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay, isToday, isTomorrow, parseISO } from 'date-fns';
import {
  EconomicCalendarDrawerProps,
  EconomicEvent,
  Currency,
  ImpactLevel
} from '../../types/economicCalendar';
import { Calendar } from '../../types/calendar';
import { Trade } from '../../types/trade';
import { economicCalendarService } from '../../services/economicCalendarService';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
// import { QueryDocumentSnapshot } from 'firebase/firestore'; // Removed - migrating to Supabase
import EconomicEventListItem from './EconomicEventListItem';
import EconomicCalendarFilters from './EconomicCalendarFilters';
import EconomicEventDetailDialog from './EconomicEventDetailDialog';
import Shimmer from '../Shimmer';
import { log,error, logger, warn } from '../../utils/logger';
import { cleanEventNameForPinning, isEventPinned } from '../../utils/eventNameUtils';
// View types for pagination
type ViewType = 'day' | 'week' | 'month';

// Available currencies and impacts
const CURRENCIES: Currency[] = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF','NZD'];
const IMPACTS: ImpactLevel[] = ['High', 'Medium', 'Low'];

// Interface for saved filter settings
export interface EconomicCalendarFilterSettings {
  currencies: Currency[];
  impacts: ImpactLevel[];
  viewType: ViewType;
  notificationsEnabled: boolean;
  onlyUpcomingEvents: boolean;
}

// Default filter settings
export const DEFAULT_ECONOMIC_EVENT_FILTER_SETTINGS: EconomicCalendarFilterSettings = {
  currencies: ['USD', 'EUR', 'GBP'],
  impacts: ['High', 'Medium', 'Low'],
  viewType: 'day',
  notificationsEnabled: true,
  onlyUpcomingEvents: false
};

// Helper function to get date header for month view
const getDateHeader = (date: string) => {
  const eventDate = parseISO(date);
  const today = new Date();

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

// Economic Event Shimmer Component
const EconomicEventShimmer: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      {Array.from({ length: 8 }).map((_, index) => (
        <Box key={index} sx={{ mb: 3 }}>
          {/* Event header row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Shimmer
              width={40}
              height={20}
              borderRadius={4}
              variant="default"
              intensity="medium"
              sx={{ animationDelay: `${index * 0.1}s` }}
            />
            <Shimmer
              width={60}
              height={20}
              borderRadius={4}
              variant="default"
              intensity="medium"
              sx={{ animationDelay: `${index * 0.1 + 0.1}s` }}
            />
            <Shimmer
              width={50}
              height={16}
              borderRadius={4}
              variant="default"
              intensity="low"
              sx={{ animationDelay: `${index * 0.1 + 0.2}s` }}
            />
          </Box>
          
          {/* Event title */}
          <Shimmer
            width="80%"
            height={18}
            borderRadius={4}
            variant="wave"
            intensity="medium"
            sx={{ 
              mb: 0.5,
              animationDelay: `${index * 0.1 + 0.3}s`
            }}
          />
          
          {/* Event details */}
          <Shimmer
            width="60%"
            height={14}
            borderRadius={4}
            variant="default"
            intensity="low"
            sx={{ animationDelay: `${index * 0.1 + 0.4}s` }}
          />
        </Box>
      ))}
    </Box>
  );
};

const EconomicCalendarDrawer: React.FC<EconomicCalendarDrawerProps> = ({
  open,
  onClose,
  calendar,
  trades = [],
  onUpdateCalendarProperty,
  onOpenGalleryMode,
  payload
}) => {
  const theme = useTheme();

  // Get current calendar and its settings
  const savedSettings: EconomicCalendarFilterSettings = calendar?.economic_calendar_filters || DEFAULT_ECONOMIC_EVENT_FILTER_SETTINGS;

  // State management
  const [viewType, setViewType] = useState<ViewType>(savedSettings.viewType);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinningEventId, setPinningEventId] = useState<string | null>(null);

  

  // Handle real-time event updates
  useEffect(() => {
    if (payload) {
      log(`📊 Updating event in Economic Calendar: ${payload.updatedEvents.join(', ')}`);
      const events : EconomicEvent[] = payload.allEvents || []
       
      // Find and update the specific event in the current events list
      setEvents(prevEvents => {
        if (!payload) return prevEvents;
        
        let changed = false; 
        // Replace any matching events with the updated ones
        const newEvents = prevEvents.map(event => {
          const idx = events.findIndex(e => e.id === event.id);
          if (idx >= 0) {
            changed = true;
            return { ...event, ...events[idx] };
          }
          return event;
        });
        // If no changes, return prevEvents to avoid unnecessary re-renders
        return changed ? newEvents : prevEvents;
      });
    }
  }, [payload]);

  // Pagination state
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState<number>(0); // Offset for pagination
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageSize] = useState(50); // Events per page

  // Filter state
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  // Economic event detail dialog state
  const [selectedEvent, setSelectedEvent] = useState<EconomicEvent | null>(null);
  const [eventDetailDialogOpen, setEventDetailDialogOpen] = useState(false);

  // Applied filters (used for queries) - initialized from localStorage
  const [appliedCurrencies, setAppliedCurrencies] = useState<Currency[]>(savedSettings.currencies);
  const [appliedImpacts, setAppliedImpacts] = useState<ImpactLevel[]>(savedSettings.impacts);
  const [appliedOnlyUpcoming, setAppliedOnlyUpcoming] = useState<boolean>(savedSettings.onlyUpcomingEvents);

  // Pending filters (temporary state before applying) - initialized from localStorage
  const [pendingCurrencies, setPendingCurrencies] = useState<Currency[]>(savedSettings.currencies);
  const [pendingImpacts, setPendingImpacts] = useState<ImpactLevel[]>(savedSettings.impacts);
  const [pendingOnlyUpcoming, setPendingOnlyUpcoming] = useState<boolean>(savedSettings.onlyUpcomingEvents);

  // Notification settings
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(savedSettings.notificationsEnabled);

  // Track if filters have been modified
  const [filtersModified, setFiltersModified] = useState(false);

  // Check if filters have been modified
  useEffect(() => {
    const modified =
      JSON.stringify(pendingCurrencies) !== JSON.stringify(appliedCurrencies) ||
      JSON.stringify(pendingImpacts) !== JSON.stringify(appliedImpacts) ||
      pendingOnlyUpcoming !== appliedOnlyUpcoming;
    setFiltersModified(modified);
  }, [pendingCurrencies, appliedCurrencies, pendingImpacts, appliedImpacts, pendingOnlyUpcoming, appliedOnlyUpcoming]);

  // Track if the month picker is active
  const [isMonthPickerActive, setIsMonthPickerActive] = useState(false);

  // Function to save filter settings to calendar
  const saveFilterSettings = useCallback(async (currencies: Currency[], impacts: ImpactLevel[], viewTypeToSave: ViewType, notificationsEnabledToSave: boolean, onlyUpcomingToSave: boolean) => {
    if (!calendar?.id || !onUpdateCalendarProperty) {
      warn('⚠️ Cannot save economic calendar filter settings: missing calendar or update function');
      return;
    }

    const settings: EconomicCalendarFilterSettings = {
      currencies,
      impacts,
      viewType: viewTypeToSave,
      notificationsEnabled: notificationsEnabledToSave,
      onlyUpcomingEvents: onlyUpcomingToSave
    };

    try {
      await onUpdateCalendarProperty(calendar.id, (cal) => ({
        ...cal,
        economicCalendarFilters: settings
      }));
      log('📱 Economic calendar filter settings saved to calendar:', settings);
    } catch (error) {
      logger.error('⚠️ Failed to save economic calendar filter settings:', error);
    }
  }, [calendar, onUpdateCalendarProperty]);

  // Function to handle view type changes and save settings
  const handleViewTypeChange = useCallback(async (newViewType: ViewType) => {
    setViewType(newViewType);
    setStartDate(null);
    setEndDate(null);
    setCurrentDate(new Date());
    setIsMonthPickerActive(false); // Deactivate month picker highlight when using view type buttons
    await saveFilterSettings(appliedCurrencies, appliedImpacts, newViewType, notificationsEnabled, appliedOnlyUpcoming);
  }, [appliedCurrencies, appliedImpacts, saveFilterSettings, notificationsEnabled, appliedOnlyUpcoming]);

  // Sync pending filters with applied filters on mount
  useEffect(() => {
    setPendingCurrencies(appliedCurrencies);
    setPendingImpacts(appliedImpacts);
    setPendingOnlyUpcoming(appliedOnlyUpcoming);
  }, []); // Only run on mount

  // Calculate date range based on view type and current date
  const dateRange = useMemo(() => {
    // If custom date range is explicitly set, use it
    if (startDate && endDate && startDate !== endDate) {
      log('📅 Using custom date range:', { start: startDate, end: endDate });
      return {
        start: startDate,
        end: endDate
      };
    }

    const date = currentDate;

    switch (viewType) {
      case 'day':
        const dayStart = startOfDay(date);
        const dayEnd = endOfDay(date);
        const dayResult = {
          start: format(dayStart, 'yyyy-MM-dd'),
          end: format(dayEnd, 'yyyy-MM-dd')
        };
        log('📅 Day view date range:', dayResult);
        return dayResult;

      case 'week':
        const weekStart = startOfWeek(date, { weekStartsOn: 0 }); // Sunday
        const weekEnd = endOfWeek(date, { weekStartsOn: 0 });
        const weekResult = {
          start: format(weekStart, 'yyyy-MM-dd'),
          end: format(weekEnd, 'yyyy-MM-dd')
        };
        log('📅 Week view date range:', weekResult);
        return weekResult;

      case 'month':
        const monthStart = startOfMonth(date);
        const monthEnd = endOfMonth(date);
        const monthResult = {
          start: format(monthStart, 'yyyy-MM-dd'),
          end: format(monthEnd, 'yyyy-MM-dd')
        };
        log('📅 Month view date range:', monthResult);
        return monthResult;

      default:
        const defaultResult = {
          start: format(date, 'yyyy-MM-dd'),
          end: format(date, 'yyyy-MM-dd')
        };
        log('📅 Default date range:', defaultResult);
        return defaultResult;
    }
  }, [viewType, currentDate, startDate, endDate]);

  // Fetch events when date range or filters change
  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      setError(null);
      setEvents([]); // Clear existing events
      setOffset(0); // Reset pagination

      try {
        log(`🔄 Fetching ${viewType} events for ${dateRange.start} to ${dateRange.end}`);

        const result = await economicCalendarService.fetchEventsPaginated(
          dateRange,
          { pageSize, offset: 0 },
          {
            currencies: appliedCurrencies,
            impacts: appliedImpacts,
            onlyUpcoming: appliedOnlyUpcoming
          }
        );

        setEvents(result.events);
        setHasMore(result.hasMore);
        setOffset(result.offset || pageSize);
        log(`✅ Fetched ${result.events.length} events (hasMore: ${result.hasMore})`);

      } catch (err) {
        logger.error('❌ Error fetching events:', err);
        setError('Failed to load economic events');
        setEvents([]);
        setHasMore(false);
        setOffset(0);
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      fetchEvents();
    }
  }, [dateRange, appliedCurrencies, appliedImpacts, appliedOnlyUpcoming, open, viewType, pageSize, startDate, endDate]);

   // Set up real-time subscription when filters change
  useEffect(() => {
    setLoading(true);
    setError(null);

    // Get today's events for the specified currencies
    const today = new Date();
    const dateRange =  {
      start: today.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
    }
    // Set up real-time subscription to database
    const unsubscribe = economicCalendarService.subscribeToEvents(
      dateRange,
      (fetchedEvents) => {
        log(`📊 Received ${fetchedEvents.length} events from real-time subscription`);

        // Validate the fetched events
        if (Array.isArray(fetchedEvents)) {
          setEvents(prevEvents => {
            if (!fetchedEvents) return prevEvents; 
            let changed = false; 
            // Replace any matching events with the updated ones
            const newEvents = prevEvents.map(event => {
              const idx = fetchedEvents.findIndex(e => e.id === event.id);
              if (idx >= 0) {
                changed = true;
                return { ...event, ...fetchedEvents[idx] };
              }
              return event;
            });
            // If no changes, return prevEvents to avoid unnecessary re-renders
            return changed ? newEvents : prevEvents;
          });
        } else {
          warn('Invalid events data received:', fetchedEvents);
          setEvents([]);
          setError('Invalid data format received from database.');
        }
      },
      {
        currencies: appliedCurrencies,
        impacts: appliedImpacts,
        onlyUpcoming: true
      }
    );

    // Cleanup subscription on unmount or filter change
    return () => {
      unsubscribe();
    };
  }, [dateRange, appliedCurrencies, appliedImpacts, appliedOnlyUpcoming]);

  // Load more events function
  const loadMoreEvents = async () => {
    if (!hasMore || loadingMore) return;

    setLoadingMore(true);

    try {
      log('🔄 Loading more events...');

      const result = await economicCalendarService.fetchEventsPaginated(
        dateRange,
        { pageSize, offset },
        {
          currencies: appliedCurrencies,
          impacts: appliedImpacts,
          onlyUpcoming: appliedOnlyUpcoming
        }
      );

      setEvents(prev => [...prev, ...result.events]);
      setHasMore(result.hasMore);
      setOffset(result.offset || offset + pageSize);
      log(`✅ Loaded ${result.events.length} more events (hasMore: ${result.hasMore})`);

    } catch (err) {
      logger.error('❌ Error loading more events:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Infinite scroll handler
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

    // Load more when user scrolls to 80% of the content
    if (scrollPercentage > 0.8 && hasMore && !loadingMore && !loading) {
      loadMoreEvents();
    }
  }, [hasMore, loadingMore, loading, loadMoreEvents]);

  // Navigation handlers
  const handlePrevious = () => {
    // Clear custom date range when navigating
    setStartDate(null);
    setEndDate(null);
    
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
  };

  const handleNext = () => {
    // Clear custom date range when navigating
    setStartDate(null);
    setEndDate(null);
    
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
  };

  // Filter handlers
  const handleCurrencyChange = (currency: Currency) => {
    setPendingCurrencies(prev =>
      prev.includes(currency)
        ? prev.filter(c => c !== currency)
        : [...prev, currency]
    );
  };

  const handleImpactChange = (impact: ImpactLevel) => {
    setPendingImpacts(prev =>
      prev.includes(impact)
        ? prev.filter(i => i !== impact)
        : [...prev, impact]
    );
  };

  const handleUpcomingEventsChange = (checked: boolean) => {
    setPendingOnlyUpcoming(checked);
  };

  const handleMonthChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedDate = new Date(event.target.value + '-01');
    setCurrentDate(selectedDate);
    setIsMonthPickerActive(true);
  };

  // Apply filters function
  const handleApplyFilters = async () => {
    setAppliedCurrencies(pendingCurrencies);
    setAppliedImpacts(pendingImpacts);
    setAppliedOnlyUpcoming(pendingOnlyUpcoming);
    setFiltersModified(false);
    setIsFilterExpanded(false); // Collapse filter section after applying

    // Save filter settings to calendar
    await saveFilterSettings(pendingCurrencies, pendingImpacts, viewType, notificationsEnabled, pendingOnlyUpcoming);
  };

  // Reset filters function
  const handleResetFilters = () => {
    const defaultCurrencies: Currency[] = ['USD', 'EUR', 'GBP'];
    const defaultImpacts: ImpactLevel[] = ['High', 'Medium', 'Low'];
    const defaultOnlyUpcoming = false;

    setPendingCurrencies(defaultCurrencies);
    setPendingImpacts(defaultImpacts);
    setPendingOnlyUpcoming(defaultOnlyUpcoming);
    setAppliedCurrencies(defaultCurrencies);
    setAppliedImpacts(defaultImpacts);
    setAppliedOnlyUpcoming(defaultOnlyUpcoming);
    setFiltersModified(false);
  };

  // Format display text for current period
  const getDisplayText = () => {
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
  };

  // Handle notification toggle
  const handleNotificationToggle = async (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    await saveFilterSettings(appliedCurrencies, appliedImpacts, viewType, enabled, appliedOnlyUpcoming);
  };

  // Handle pin event
  const handlePinEvent = async (eventName: string) => {
    if (!calendar?.id || !onUpdateCalendarProperty) return;

    try {
      setPinningEventId(eventName);
      await onUpdateCalendarProperty(calendar.id, (calendar: Calendar) => {
        const currentPinnedEvents = calendar.pinned_events || [];
        const cleanedEventName =  cleanEventNameForPinning(eventName);
        // Check if event is already pinned
        const eventNames = currentPinnedEvents.map(pe => pe.event);
        if (isEventPinned(cleanedEventName, eventNames)) {
          return calendar; // Already pinned, no change needed
        }
        return {
          ...calendar,
          pinnedEvents: [...currentPinnedEvents, { event: cleanedEventName }]
        };
      });
      logger.log(`📌 Successfully pinned event: ${eventName}`);
    } catch (error) {
      logger.error('Error pinning event:', error);
    } finally {
      setPinningEventId(null);
    }
  };

  // Handle unpin event
  const handleUnpinEvent = async (eventName: string) => {
    if (!calendar?.id || !onUpdateCalendarProperty) return;

    try {
      setPinningEventId(eventName);
      await onUpdateCalendarProperty(calendar.id, (calendar: Calendar) => {
        const currentPinnedEvents = calendar.pinned_events || [];
        const cleanedEventName =  cleanEventNameForPinning(eventName);
        return {
          ...calendar,
          pinnedEvents: currentPinnedEvents.filter(pinnedEvent =>
            pinnedEvent.event.toLowerCase() !== cleanedEventName.toLowerCase()
          )
        };
      });
      logger.log(`📌 Successfully unpinned event: ${eventName}`);
    } catch (error) {
      logger.error('Error unpinning event:', error);
    } finally {
      setPinningEventId(null);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        zIndex: 1300,
        '& .MuiDrawer-paper': {
          width: { xs: '100%', sm: 450 },
          maxWidth: '100vw',
          zIndex: 1300,
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
                      label={`${appliedCurrencies.length + appliedImpacts.length + (appliedOnlyUpcoming ? 1 : 0)} active`}
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
          pendingCurrencies={pendingCurrencies}
          pendingImpacts={pendingImpacts}
          pendingOnlyUpcoming={pendingOnlyUpcoming}
          filtersModified={filtersModified}
          loading={loading}
          onCurrencyChange={handleCurrencyChange}
          onImpactChange={handleImpactChange}
          onUpcomingEventsChange={handleUpcomingEventsChange}
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
              <Button variant="outlined" onClick={() => window.location.reload()}>
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
                {groupEventsByDate(events).map((dayGroup, dayIndex) => (
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
                        return (
                          <React.Fragment key={uniqueKey}>
                            <EconomicEventListItem
                              px={2.5}
                              py={1.5}
                              event={event}
                              pinnedEvents={calendar?.pinned_events?.map(pe => pe.event) || []}
                              onPinEvent={handlePinEvent}
                              onUnpinEvent={handleUnpinEvent}
                              isPinning={pinningEventId === event.event_name}
                              onClick={(event) => {
                                logger.log('Economic event clicked:', event);
                                setSelectedEvent(event);
                                setEventDetailDialogOpen(true);
                              }}
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
                      onClick={loadMoreEvents}
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
      {selectedEvent && (
        <EconomicEventDetailDialog
          open={eventDetailDialogOpen}
          onClose={() => {
            setEventDetailDialogOpen(false);
            setSelectedEvent(null);
          }}
          event={selectedEvent}
          trades={trades}
          onOpenGalleryMode={onOpenGalleryMode}
          calendarId={calendar.id}
          calendar={{ economicCalendarFilters: calendar.economic_calendar_filters }}
        />
      )}
    </Drawer>
  );
};

export default EconomicCalendarDrawer;
