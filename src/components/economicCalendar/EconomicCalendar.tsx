/**
 * Economic Calendar Component
 * Main component for displaying economic events
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Divider,
  Chip,
  IconButton,
  Tooltip,
  Button,
  useTheme
} from '@mui/material';
import {
  CalendarToday as CalendarIcon,
  TrendingUp as TrendingUpIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { 
  EconomicEvent, 
  EconomicCalendarProps,
  EconomicCalendarFilters,
  DEFAULT_FILTERS
} from '../../types/economicCalendar';
import { economicCalendarService } from '../../services/economicCalendarService';
import EconomicEventCard from './EconomicEventCard';
import EconomicCalendarFiltersComponent from './EconomicCalendarFilters';

const EconomicCalendar: React.FC<EconomicCalendarProps> = ({
  filters: initialFilters,
  onEventClick,
  onFiltersChange,
  onRefresh,
  compact = false,
  maxHeight = 600
}) => {
  const theme = useTheme();
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<EconomicCalendarFilters>({
    ...DEFAULT_FILTERS,
    ...initialFilters
  });

  // Set up real-time subscription when filters change
  useEffect(() => {
    setLoading(true);
    setError(null);

    // Set up real-time subscription to database
    const unsubscribe = economicCalendarService.subscribeToEvents(
      filters.dateRange,
      (fetchedEvents) => {
        console.log(`📊 Received ${fetchedEvents.length} events from real-time subscription`);

        // Validate the fetched events
        if (Array.isArray(fetchedEvents)) {
          setEvents(fetchedEvents);
        } else {
          console.warn('Invalid events data received:', fetchedEvents);
          setEvents([]);
          setError('Invalid data format received from database.');
        }

        setLoading(false);
        setRefreshing(false);
      },
      {
        currencies: filters.currencies,
        impacts: filters.impacts
      }
    );

    // Cleanup subscription on unmount or filter change
    return () => {
      unsubscribe();
    };
  }, [filters.dateRange, filters.currencies, filters.impacts]);

  const fetchEvents = async (forceRefresh: boolean = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Fetch fresh data from database
      const fetchedEvents = await economicCalendarService.fetchEvents(
        filters.dateRange,
        {
          currencies: filters.currencies,
          impacts: filters.impacts
        }
      );

      // Validate the fetched events
      if (Array.isArray(fetchedEvents)) {
        setEvents(fetchedEvents);
      } else {
        console.warn('Invalid events data received:', fetchedEvents);
        setEvents([]);
        setError('Invalid data format received from database.');
      }
    } catch (err) {
      console.error('Error fetching economic events:', err);
      setError('Failed to load economic calendar data. Please try again.');
      setEvents([]); // Set empty array on error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    if (onRefresh) {
      await onRefresh();
    } else {
      await fetchEvents(true);
    }
  };

  // Filter events based on current filters
  const filteredEvents = useMemo(() => {
    let filtered = events;

    // Filter by currencies
    if (filters.currencies.length > 0 && !filters.currencies.includes('ALL')) {
      filtered = filtered.filter(event => 
        filters.currencies.includes(event.currency)
      );
    }

    // Filter by impact levels
    if (filters.impacts.length > 0) {
      filtered = filtered.filter(event => 
        filters.impacts.includes(event.impact)
      );
    }

    // Filter by search term
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(event =>
        event.event.toLowerCase().includes(searchLower) ||
        event.currency.toLowerCase().includes(searchLower)
      );
    }

    // Filter past events if needed
    if (!filters.showPastEvents) {
      const now = new Date();
      filtered = filtered.filter(event => new Date(event.time) >= now);
    }

    // Sort by time
    return filtered.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }, [events, filters]);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const grouped = filteredEvents.reduce((acc, event) => {
      const date = event.date;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(event);
      return acc;
    }, {} as Record<string, EconomicEvent[]>);

    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredEvents]);

  const handleFiltersChange = (newFilters: EconomicCalendarFilters) => {
    setFilters(newFilters);
    if (onFiltersChange) {
      onFiltersChange(newFilters);
    }
  };

  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (dateString === today.toISOString().split('T')[0]) {
      return 'Today';
    } else if (dateString === tomorrow.toISOString().split('T')[0]) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      });
    }
  };

  const getUpcomingHighImpactCount = () => {
    const now = new Date();
    const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    return filteredEvents.filter(event => {
      const eventTime = new Date(event.time);
      return eventTime >= now && 
             eventTime <= next24Hours && 
             event.impact === 'High';
    }).length;
  };

  if (loading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight={200}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert
        severity="error"
        action={
          <Button
            variant="outlined"
            size="small"
            onClick={() => fetchEvents(true)}
            startIcon={<RefreshIcon />}
            disabled={loading || refreshing}
          >
            {refreshing ? 'Retrying...' : 'Retry'}
          </Button>
        }
        sx={{ mb: 2 }}
      >
        <Typography variant="subtitle2" gutterBottom>
          Failed to load economic calendar
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {error}
        </Typography>
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        <CalendarIcon color="primary" />
        <Typography variant="h6" component="h2">
          Economic Calendar
        </Typography>

        {/* Event count badge */}
        <Chip
          label={`${filteredEvents.length} events`}
          size="small"
          variant="outlined"
          color="primary"
        />

        {/* High impact warning */}
        {getUpcomingHighImpactCount() > 0 && (
          <Chip
            icon={<TrendingUpIcon />}
            label={`${getUpcomingHighImpactCount()} high impact in 24h`}
            color="warning"
            size="small"
            sx={{
              backgroundColor: 'warning.main',
              color: 'warning.contrastText',
              fontWeight: 600
            }}
          />
        )}

        <Box sx={{ flexGrow: 1 }} />

        {/* Loading indicator */}
        {(loading || refreshing) && (
          <Box display="flex" alignItems="center" gap={1}>
            <CircularProgress size={16} />
            <Typography variant="caption" color="text.secondary">
              {refreshing ? 'Refreshing...' : 'Loading...'}
            </Typography>
          </Box>
        )}

        {/* Refresh button */}
        <Tooltip title="Refresh calendar data">
          <IconButton
            onClick={handleRefresh}
            disabled={loading || refreshing}
            size="small"
            sx={{
              color: 'primary.main',
              '&:hover': {
                backgroundColor: 'primary.main',
                color: 'primary.contrastText'
              }
            }}
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Filters */}
      <EconomicCalendarFiltersComponent
        filters={filters}
        onFiltersChange={handleFiltersChange}
        compact={compact}
      />

      {/* Events List */}
      <Box 
        sx={{ 
          maxHeight,
          overflowY: 'auto',
          mt: compact ? 0 : 2
        }}
      >
        {eventsByDate.length === 0 ? (
          <Box textAlign="center" py={4}>
            <Typography color="text.secondary">
              No events found for the selected criteria
            </Typography>
          </Box>
        ) : (
          eventsByDate.map(([date, dayEvents]) => (
            <Box key={date} mb={3}>
              {/* Date Header */}
              <Box 
                display="flex" 
                alignItems="center" 
                gap={1} 
                mb={1.5}
                sx={{
                  position: 'sticky',
                  top: 0,
                  backgroundColor: 'background.paper',
                  zIndex: 1,
                  py: 1
                }}
              >
                <Typography 
                  variant="subtitle1" 
                  fontWeight={600}
                  color="primary"
                >
                  {formatDateHeader(date)}
                </Typography>
                <Chip 
                  label={`${dayEvents.length} events`}
                  size="small"
                  variant="outlined"
                />
                <Divider sx={{ flexGrow: 1 }} />
              </Box>

              {/* Events for this date */}
              {dayEvents.map((event) => (
                <EconomicEventCard
                  key={event.id}
                  event={event}
                  compact={compact}
                  onClick={onEventClick}
                />
              ))}
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
};

export default EconomicCalendar;
