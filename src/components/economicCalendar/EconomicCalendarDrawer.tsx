/**
 * Economic Calendar Drawer Component
 * Redesigned to match search drawer style with day/week/month pagination
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Divider,
  TextField,
  Avatar
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
  Check as CheckIcon
} from '@mui/icons-material';
import { format, addDays, addWeeks, addMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay, isToday, isTomorrow, differenceInMinutes, differenceInHours, parseISO, isAfter } from 'date-fns';
import {
  EconomicCalendarDrawerProps,
  EconomicEvent,
  Currency,
  ImpactLevel
} from '../../types/economicCalendar';
import { economicCalendarService } from '../../services/economicCalendarService';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import { QueryDocumentSnapshot } from 'firebase/firestore';

// View types for pagination
type ViewType = 'day' | 'week' | 'month';

// Available currencies and impacts
const CURRENCIES: Currency[] = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF'];
const IMPACTS: ImpactLevel[] = ['High', 'Medium', 'Low'];

// Shimmer loading component
const ShimmerLoader: React.FC = () => {
  const theme = useTheme();

  return (
    <Box sx={{ p: 3 }}>
      {Array.from({ length: 8 }).map((_, index) => (
        <Box key={index} sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Box
              sx={{
                width: 40,
                height: 20,
                borderRadius: 1,
                background: `linear-gradient(90deg, ${alpha(theme.palette.action.hover, 0.3)} 25%, ${alpha(theme.palette.action.hover, 0.5)} 50%, ${alpha(theme.palette.action.hover, 0.3)} 75%)`,
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
                '@keyframes shimmer': {
                  '0%': { backgroundPosition: '-200% 0' },
                  '100%': { backgroundPosition: '200% 0' }
                }
              }}
            />
            <Box
              sx={{
                width: 60,
                height: 20,
                borderRadius: 1,
                background: `linear-gradient(90deg, ${alpha(theme.palette.action.hover, 0.3)} 25%, ${alpha(theme.palette.action.hover, 0.5)} 50%, ${alpha(theme.palette.action.hover, 0.3)} 75%)`,
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
                animationDelay: '0.1s'
              }}
            />
            <Box
              sx={{
                width: 50,
                height: 16,
                borderRadius: 1,
                background: `linear-gradient(90deg, ${alpha(theme.palette.action.hover, 0.3)} 25%, ${alpha(theme.palette.action.hover, 0.5)} 50%, ${alpha(theme.palette.action.hover, 0.3)} 75%)`,
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
                animationDelay: '0.2s'
              }}
            />
          </Box>
          <Box
            sx={{
              width: '80%',
              height: 18,
              borderRadius: 1,
              background: `linear-gradient(90deg, ${alpha(theme.palette.action.hover, 0.3)} 25%, ${alpha(theme.palette.action.hover, 0.5)} 50%, ${alpha(theme.palette.action.hover, 0.3)} 75%)`,
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
              animationDelay: '0.3s',
              mb: 0.5
            }}
          />
          <Box
            sx={{
              width: '60%',
              height: 14,
              borderRadius: 1,
              background: `linear-gradient(90deg, ${alpha(theme.palette.action.hover, 0.3)} 25%, ${alpha(theme.palette.action.hover, 0.5)} 50%, ${alpha(theme.palette.action.hover, 0.3)} 75%)`,
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
              animationDelay: '0.4s'
            }}
          />
        </Box>
      ))}
    </Box>
  );
};

// Helper function to format time and countdown
const formatTimeWithCountdown = (eventTime: string, currentTime?: Date) => {
  const eventDate = parseISO(eventTime);
  const now = currentTime || new Date();
  const eventDateFormatted = format(eventDate, 'MMM d, HH:mm');

  // Check if event is in the future
  if (isAfter(eventDate, now)) {
    const totalSeconds = Math.floor((eventDate.getTime() - now.getTime()) / 1000);
    const minutesDiff = Math.floor(totalSeconds / 60);
    const hoursDiff = Math.floor(totalSeconds / 3600);
    const daysDiff = Math.floor(hoursDiff / 24);

    let countdown = '';
    let isImminent = false;

    if (minutesDiff < 60) {
      isImminent = minutesDiff <= 30; // Imminent if within 30 minutes

      if (isImminent && minutesDiff < 5) {
        // Show seconds for very imminent events (less than 5 minutes)
        const remainingMinutes = Math.floor(totalSeconds / 60);
        const remainingSeconds = totalSeconds % 60;
        countdown = remainingMinutes > 0
          ? `${remainingMinutes}m ${remainingSeconds}s`
          : `${remainingSeconds}s`;
      } else {
        countdown = `${minutesDiff} min`;
      }
    } else if (hoursDiff < 24) {
      countdown = `${hoursDiff}h`;
      isImminent = false;
    } else if (daysDiff === 1) {
      countdown = '1 day';
      isImminent = false;
    } else if (daysDiff > 1) {
      countdown = `${daysDiff} days`;
      isImminent = false;
    }

    return {
      time: eventDateFormatted,
      countdown,
      isUpcoming: true,
      isImminent,
      isPassed: false
    };
  }

  return {
    time: eventDateFormatted,
    countdown: null,
    isUpcoming: false,
    isImminent: false,
    isPassed: true
  };
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

// Helper function to get impact colors
const getImpactColor = (impact: ImpactLevel, theme: any) => {
  switch (impact) {
    case 'High':
      return theme.palette.error.main;
    case 'Medium':
      return theme.palette.warning.main;
    case 'Low':
      return theme.palette.success.main;
    default:
      return theme.palette.text.secondary;
  }
};

// Helper function to get impact background color for imminent events
const getImminentBackgroundColor = (impact: ImpactLevel, theme: any) => {
  switch (impact) {
    case 'High':
      return alpha(theme.palette.error.main, 0.1);
    case 'Medium':
      return alpha(theme.palette.warning.main, 0.1);
    case 'Low':
      return alpha(theme.palette.success.main, 0.1);
    default:
      return alpha(theme.palette.text.secondary, 0.05);
  }
};

// Group events by date for month view
const groupEventsByDate = (events: EconomicEvent[]) => {
  const grouped: { [key: string]: EconomicEvent[] } = {};

  events.forEach(event => {
    const date = event.date;
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(event);
  });

  // Sort dates
  const sortedDates = Object.keys(grouped).sort();

  return sortedDates.map(date => ({
    date,
    events: grouped[date].sort((a, b) => a.timeUtc.localeCompare(b.timeUtc))
  }));
};

const EconomicCalendarDrawer: React.FC<EconomicCalendarDrawerProps> = ({
  open,
  onClose
}) => {
  const theme = useTheme();

  // State management
  const [viewType, setViewType] = useState<ViewType>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Realtime countdown state
  const [realtimeNow, setRealtimeNow] = useState(new Date());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Pagination state
  const [hasMore, setHasMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageSize] = useState(50); // Events per page

  // Filter state
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [selectedCurrencies, setSelectedCurrencies] = useState<Currency[]>(['USD', 'EUR', 'GBP']);
  const [selectedImpacts, setSelectedImpacts] = useState<ImpactLevel[]>(['High', 'Medium', 'Low']);

  // Check if there are any imminent events that need realtime updates
  const hasImminentEvents = useMemo(() => {
    return events.some(event => {
      const timeInfo = formatTimeWithCountdown(event.timeUtc, realtimeNow);
      return timeInfo.isImminent;
    });
  }, [events, realtimeNow]);

  // Realtime countdown effect for imminent events
  useEffect(() => {
    if (open && hasImminentEvents) {
      // Update every second for imminent events
      intervalRef.current = setInterval(() => {
        setRealtimeNow(new Date());
      }, 1000);
    } else {
      // Clear interval when no imminent events or drawer is closed
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [open, hasImminentEvents]);

  // Calculate date range based on view type and current date
  const dateRange = useMemo(() => {
    // If custom date range is set, use it
    if (startDate && endDate) {
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
        return {
          start: format(dayStart, 'yyyy-MM-dd'),
          end: format(dayEnd, 'yyyy-MM-dd')
        };

      case 'week':
        const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // Monday
        const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
        return {
          start: format(weekStart, 'yyyy-MM-dd'),
          end: format(weekEnd, 'yyyy-MM-dd')
        };

      case 'month':
        const monthStart = startOfMonth(date);
        const monthEnd = endOfMonth(date);
        return {
          start: format(monthStart, 'yyyy-MM-dd'),
          end: format(monthEnd, 'yyyy-MM-dd')
        };

      default:
        return {
          start: format(date, 'yyyy-MM-dd'),
          end: format(date, 'yyyy-MM-dd')
        };
    }
  }, [viewType, currentDate, startDate, endDate]);

  // Fetch events when date range or filters change
  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      setError(null);
      setEvents([]); // Clear existing events
      setLastDoc(undefined); // Reset pagination

      try {
        console.log(`🔄 Fetching ${viewType} events for ${dateRange.start} to ${dateRange.end}`);

        const result = await economicCalendarService.fetchEventsPaginated(
          dateRange,
          { pageSize },
          {
            currencies: selectedCurrencies,
            impacts: selectedImpacts
          }
        );

        setEvents(result.events);
        setHasMore(result.hasMore);
        setLastDoc(result.lastDoc);
        console.log(`✅ Fetched ${result.events.length} events (hasMore: ${result.hasMore})`);

      } catch (err) {
        console.error('❌ Error fetching events:', err);
        setError('Failed to load economic events');
        setEvents([]);
        setHasMore(false);
        setLastDoc(undefined);
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      fetchEvents();
    }
  }, [dateRange, selectedCurrencies, selectedImpacts, open, viewType, pageSize, startDate, endDate]);

  // Load more events function
  const loadMoreEvents = async () => {
    if (!hasMore || loadingMore || !lastDoc) return;

    setLoadingMore(true);

    try {
      console.log('🔄 Loading more events...');

      const result = await economicCalendarService.fetchEventsPaginated(
        dateRange,
        { pageSize, lastDoc },
        {
          currencies: selectedCurrencies,
          impacts: selectedImpacts
        }
      );

      setEvents(prev => [...prev, ...result.events]);
      setHasMore(result.hasMore);
      setLastDoc(result.lastDoc);
      console.log(`✅ Loaded ${result.events.length} more events (hasMore: ${result.hasMore})`);

    } catch (err) {
      console.error('❌ Error loading more events:', err);
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
    setSelectedCurrencies(prev =>
      prev.includes(currency)
        ? prev.filter(c => c !== currency)
        : [...prev, currency]
    );
  };

  const handleImpactChange = (impact: ImpactLevel) => {
    setSelectedImpacts(prev =>
      prev.includes(impact)
        ? prev.filter(i => i !== impact)
        : [...prev, impact]
    );
  };

  // Format display text for current period
  const getDisplayText = () => {
    switch (viewType) {
      case 'day':
        return format(currentDate, 'EEEE, MMMM d, yyyy');
      case 'week':
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
      case 'month':
        return format(currentDate, 'MMMM yyyy');
      default:
        return '';
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
              Real-time economic events and indicators
            </Typography>
          </Box>
          <IconButton
            onClick={onClose}
            size="small"
            sx={{
              bgcolor: alpha(theme.palette.action.hover, 0.5),
              '&:hover': {
                bgcolor: alpha(theme.palette.action.hover, 0.8),
                transform: 'scale(1.05)'
              },
              transition: 'all 0.2s ease-in-out'
            }}
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
                onClick={() => setViewType('day')}
                variant={viewType === 'day' ? 'contained' : 'outlined'}
                sx={{ flex: 1 }}
              >
                Day
              </Button>
              <Button
                startIcon={<WeekIcon />}
                onClick={() => setViewType('week')}
                variant={viewType === 'week' ? 'contained' : 'outlined'}
                sx={{ flex: 1 }}
              >
                Week
              </Button>
              <Button
                startIcon={<MonthIcon />}
                onClick={() => setViewType('month')}
                variant={viewType === 'month' ? 'contained' : 'outlined'}
                sx={{ flex: 1 }}
              >
                Month
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

          {/* Date Range Picker */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <TextField
                label="Start Date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                size="small"
                sx={{ flex: 1 }}
                InputLabelProps={{
                  shrink: true,
                }}
              />
              <TextField
                label="End Date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                size="small"
                sx={{ flex: 1 }}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Box>
            <Button
              onClick={() => {
                setStartDate(format(new Date(), 'yyyy-MM-dd'));
                setEndDate(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
              }}
              size="small"
              variant="text"
              sx={{ fontSize: '0.75rem' }}
            >
              Reset to This Week
            </Button>
          </Box>

          {/* Filter Toggle */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 2,
            borderRadius: 2,
            background: alpha(theme.palette.primary.main, 0.05),
            border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
            cursor: 'pointer'
          }}
          onClick={() => setIsFilterExpanded(!isFilterExpanded)}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FilterIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                Filters
              </Typography>
              <Chip
                label={`${selectedCurrencies.length + selectedImpacts.length} active`}
                size="small"
                color="primary"
                variant="outlined"
              />
            </Box>
            <IconButton
              size="small"
              sx={{
                color: 'inherit',
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.1)
                }
              }}
            >
              {isFilterExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
        </Box>

        {/* Filters Section */}
        <Collapse in={isFilterExpanded}>
          <Box sx={{ px: 3, pb: 3 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Currency Filters */}
              <FormControl component="fieldset">
                <FormLabel component="legend" sx={{ mb: 1, fontSize: '0.875rem', fontWeight: 600 }}>
                  Currencies
                </FormLabel>
                <FormGroup row>
                  {CURRENCIES.map((currency) => (
                    <FormControlLabel
                      key={currency}
                      control={
                        <Checkbox
                          checked={selectedCurrencies.includes(currency)}
                          onChange={() => handleCurrencyChange(currency)}
                          size="small"
                        />
                      }
                      label={currency}
                      sx={{ mr: 2 }}
                    />
                  ))}
                </FormGroup>
              </FormControl>

              {/* Impact Filters */}
              <FormControl component="fieldset">
                <FormLabel component="legend" sx={{ mb: 1, fontSize: '0.875rem', fontWeight: 600 }}>
                  Impact Level
                </FormLabel>
                <FormGroup row>
                  {IMPACTS.map((impact) => (
                    <FormControlLabel
                      key={impact}
                      control={
                        <Checkbox
                          checked={selectedImpacts.includes(impact)}
                          onChange={() => handleImpactChange(impact)}
                          size="small"
                        />
                      }
                      label={impact}
                      sx={{ mr: 2 }}
                    />
                  ))}
                </FormGroup>
              </FormControl>

              {/* Filter Summary */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  {selectedCurrencies.length} currencies, {selectedImpacts.length} impact levels
                </Typography>
                <Button
                  onClick={() => {
                    setSelectedCurrencies(['USD', 'EUR', 'GBP']);
                    setSelectedImpacts(['High', 'Medium', 'Low']);
                  }}
                  size="small"
                  color="inherit"
                >
                  Reset
                </Button>
              </Box>
            </Box>
          </Box>
        </Collapse>

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
            <ShimmerLoader />
          ) : error ? (
            <Box sx={{ textAlign: 'center', py: 4, px: 3 }}>
              <CalendarIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                {error}
              </Typography>
              <Button onClick={() => window.location.reload()} variant="outlined" size="small">
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
                        fontWeight: 700,
                        color: isToday(parseISO(dayGroup.date)) ? 'primary.main' : 'text.primary'
                      }}>
                        {getDateHeader(dayGroup.date)}
                      </Typography>
                    </Box>

                    {/* Events for this date */}
                    <List sx={{ p: 0 }}>
                      {dayGroup.events.map((event, eventIndex) => {
                        const timeInfo = formatTimeWithCountdown(event.timeUtc, realtimeNow);
                        return (
                          <React.Fragment key={event.id || `${dayIndex}-${eventIndex}`}>
                            <ListItem sx={{
                              px: 2,
                              py: 1,
                              backgroundColor: timeInfo.isImminent ? getImminentBackgroundColor(event.impact, theme) : 'transparent',
                              borderLeft: timeInfo.isImminent ? `3px solid ${getImpactColor(event.impact, theme)}` : 'none',
                              '&:hover': {
                                backgroundColor: alpha(theme.palette.action.hover, 0.08)
                              },
                              borderRadius: 1,
                              mb: 0.5
                            }}>
                              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, width: '100%' }}>
                                {/* Flag as Prefix Icon */}
                                <Box sx={{ minWidth: 24, mt: 0.5, display: 'flex',flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                                   <img
                                      src={event.flagUrl}
                                      alt={event.country}
                                      style={{
                                        width: 24,
                                        height: 18,
                                        borderRadius: 3,
                                        objectFit: 'cover',
                                        border: `1px solid ${alpha(theme.palette.divider, 0.2)}`
                                      }}
                                    />

                                    {/* Currency */}
                                    <Typography variant="body2" sx={{
                                      fontWeight: 700,
                                      textAlign: 'center',
                                      fontSize: '0.875rem',
                                      color: 'text.primary',
                                      minWidth: 35
                                    }}>
                                      {event.currency}
                                    </Typography>
                                </Box>

                                {/* Content Container */}
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%', flex: 1 }}>

                                  {/* First Row: Date | Check Icon | Currency | Impact Badge */}
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%' }}>
                                    {/* Date */}
                                    <Typography variant="body2" sx={{
                                      fontWeight: 600,
                                      color: timeInfo.isUpcoming ? 'text.primary' : 'text.secondary',
                                      fontSize: '0.875rem', 
                                    }}>
                                      {timeInfo.time}
                                    </Typography>

                                    {/* Check Icon or Countdown */}
                                    <Box sx={{   display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      {timeInfo.isPassed ? (
                                        <CheckIcon sx={{
                                          color: 'success.main',
                                          fontSize: '1.2rem',
                                          mb:0.5
                                        }} />
                                      ) : timeInfo.countdown ? (
                                        <Typography variant="caption" sx={{
                                          color: 'warning.main',
                                          fontWeight: 600,
                                          fontSize: '0.75rem'
                                        }}>
                                          {timeInfo.countdown}
                                        </Typography>
                                      ) : null}
                                    </Box>

                                  

                                    {/* Spacer */}
                                    <Box sx={{ flex: 1 }} />

                                    {/* Impact Badge */}
                                    <Chip
                                      label={event.impact.toUpperCase()}
                                      size="small"
                                      sx={{
                                        height: 22,
                                        fontSize: '0.65rem',
                                        fontWeight: 700,
                                        backgroundColor: getImpactColor(event.impact, theme),
                                        color: 'white',
                                        minWidth: 45,
                                        '& .MuiChip-label': {
                                          px: 1
                                        }
                                      }}
                                    />
                                  </Box>

                                  {/* Second Row: Event Name | Previous, Forecast, Actual */}
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                                    {/* Event Name */}
                                    <Typography variant="body2" sx={{
                                      fontWeight: 500,
                                      fontSize: '0.875rem',
                                      color: 'text.primary',
                                      flex: 1
                                    }}>
                                      {event.event}
                                    </Typography>

                                    {/* Values */}
                                    {(event.actual || event.forecast || event.previous) && (
                                      <Box sx={{ display: 'flex', gap: 1.5 }}>
                                        {event.actual && (
                                          <Typography variant="caption" sx={{
                                            fontWeight: 700,
                                            fontSize: '0.75rem',
                                            color: 'text.primary'
                                          }}>
                                            A: {event.actual}
                                          </Typography>
                                        )}
                                        {event.forecast && (
                                          <Typography variant="caption" sx={{
                                            color: 'text.secondary',
                                            fontSize: '0.75rem',
                                            fontWeight: 600
                                          }}>
                                            F: {event.forecast}
                                          </Typography>
                                        )}
                                        {event.previous && (
                                          <Typography variant="caption" sx={{
                                            color: 'text.disabled',
                                            fontSize: '0.75rem',
                                            fontWeight: 600
                                          }}>
                                            P: {event.previous}
                                          </Typography>
                                        )}
                                      </Box>
                                    )}
                                  </Box>
                                </Box>
                              </Box>
                            </ListItem>
                            {eventIndex < dayGroup.events.length - 1 && <Divider sx={{ ml: 3 }} />}
                          </React.Fragment>
                        );
                      })}
                    </List>
                  </Box>
                ))}
              </Box>
           
          )}

          {/* Loading More Indicator */}
          {loadingMore && (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <CircularProgress size={24} sx={{ mb: 1 }} />
              <Typography variant="caption" color="text.secondary" display="block">
                Loading more events...
              </Typography>
            </Box>
          )}

          {/* Load More Button */}
          {hasMore && !loading && !loadingMore && (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Button
                onClick={loadMoreEvents}
                disabled={loadingMore}
                variant="outlined"
                fullWidth
                startIcon={loadingMore ? <CircularProgress size={16} /> : undefined}
                sx={{
                  borderRadius: 2,
                  py: 1.5,
                  background: alpha(theme.palette.primary.main, 0.05),
                  '&:hover': {
                    background: alpha(theme.palette.primary.main, 0.1)
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

        {/* Footer */}
        <Box sx={{
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

          <Typography variant="caption" color="text.secondary" align="center" display="block">
            Data from MyFXBook • Updates every 30 minutes
          </Typography>
          <Typography variant="caption" color="success.main" align="center" display="block" sx={{ mt: 0.5 }}>
            ✅ Database-driven • Real-time updates
          </Typography>
        </Box>
      </Box>
    </Drawer>
  );
};

export default EconomicCalendarDrawer;
