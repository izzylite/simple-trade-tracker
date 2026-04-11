/**
 * useEconomicEvents Hook
 * Optimized data fetching for economic calendar events with stable callbacks
 * and efficient real-time updates.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { EconomicEvent, Currency, ImpactLevel } from '../types/economicCalendar';
import { economicCalendarService } from '../services/economicCalendarService';
import { logger } from '../utils/logger';
import { supabase } from '../config/supabase';

export type ViewType = 'day' | 'week' | 'month';

interface DateRange {
  start: string;
  end: string;
}

interface UseEconomicEventsOptions {
  viewType: ViewType;
  currentDate: Date;
  currencies: Currency[];
  impacts: ImpactLevel[];
  onlyUpcoming: boolean;
  pageSize?: number;
  enabled?: boolean;
  customDateRange?: { start: string | null; end: string | null };
}

interface UseEconomicEventsResult {
  events: EconomicEvent[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  dateRange: DateRange;
  loadMore: () => void;
  refresh: () => void;
  updateEvent: (eventId: string, updates: Partial<EconomicEvent>) => void;
}

/**
 * Calculate date range based on view type and current date
 */
function calculateDateRange(
  viewType: ViewType,
  currentDate: Date,
  customRange?: { start: string | null; end: string | null }
): DateRange {
  // Use custom range if both dates are provided
  if (customRange?.start && customRange?.end && customRange.start !== customRange.end) {
    return { start: customRange.start, end: customRange.end };
  }

  switch (viewType) {
    case 'day':
      return {
        start: format(startOfDay(currentDate), 'yyyy-MM-dd'),
        end: format(endOfDay(currentDate), 'yyyy-MM-dd'),
      };
    case 'week':
      return {
        start: format(startOfWeek(currentDate, { weekStartsOn: 0 }), 'yyyy-MM-dd'),
        end: format(endOfWeek(currentDate, { weekStartsOn: 0 }), 'yyyy-MM-dd'),
      };
    case 'month':
      return {
        start: format(startOfMonth(currentDate), 'yyyy-MM-dd'),
        end: format(endOfMonth(currentDate), 'yyyy-MM-dd'),
      };
    default:
      return {
        start: format(currentDate, 'yyyy-MM-dd'),
        end: format(currentDate, 'yyyy-MM-dd'),
      };
  }
}

/**
 * Hook for fetching and managing economic calendar events with optimized
 * real-time updates and pagination.
 */
export function useEconomicEvents(options: UseEconomicEventsOptions): UseEconomicEventsResult {
  const {
    viewType,
    currentDate,
    currencies,
    impacts,
    onlyUpcoming,
    pageSize = 50,
    enabled = true,
    customDateRange,
  } = options;

  // State
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasCompletedFetch, setHasCompletedFetch] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  // Refs for stable callbacks and caching
  const fetchingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastFetchedParamsRef = useRef<string | null>(null);

  // Memoize date range to prevent unnecessary recalculations
  const dateRange = useMemo(
    () => calculateDateRange(viewType, currentDate, customDateRange),
    [viewType, currentDate, customDateRange?.start, customDateRange?.end]
  );

  // Memoize filter params to detect actual changes
  const filterParams = useMemo(
    () => ({
      currencies: [...currencies].sort().join(','),
      impacts: [...impacts].sort().join(','),
      onlyUpcoming,
    }),
    [currencies, impacts, onlyUpcoming]
  );

  /**
   * Fetch events with abort support
   */
  const fetchEvents = useCallback(
    async (isLoadMore = false) => {
      if (!enabled || fetchingRef.current) return;

      // Abort previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // Capture controller locally so each invocation checks its own abort
      // status in the finally block, not the (potentially replaced) shared ref.
      const controller = new AbortController();
      abortControllerRef.current = controller;

      fetchingRef.current = true;
      const currentOffset = isLoadMore ? offset : 0;

      if (!isLoadMore) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      try {
        const result = await economicCalendarService.fetchEventsPaginated(
          dateRange,
          { pageSize, offset: currentOffset },
          {
            currencies,
            impacts,
            onlyUpcoming,
          }
        );

        if (controller.signal.aborted) {
          return;
        }

        if (isLoadMore) {
          setEvents(prev => [...prev, ...result.events]);
        } else {
          setEvents(result.events);
        }

        setHasMore(result.hasMore);
        setOffset(result.offset || currentOffset + pageSize);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        logger.error('Error fetching economic events:', err);
        if (!isLoadMore) {
          setError('Failed to load economic events');
          setEvents([]);
        }
      } finally {
        fetchingRef.current = false;
        setLoading(false);
        setLoadingMore(false);
        if (!controller.signal.aborted) {
          setHasCompletedFetch(true);
        }
      }
    },
    [enabled, dateRange, currencies, impacts, onlyUpcoming, pageSize, offset]
  );

  /**
   * Load more events
   */
  const loadMore = useCallback(() => {
    if (hasMore && !loadingMore && !loading) {
      fetchEvents(true);
    }
  }, [hasMore, loadingMore, loading, fetchEvents]);

  /**
   * Manual refresh
   */
  const refresh = useCallback(() => {
    setOffset(0);
    fetchEvents(false);
  }, [fetchEvents]);

  /**
   * Update a single event in the list (for real-time updates)
   */
  const updateEvent = useCallback((eventId: string, updates: Partial<EconomicEvent>) => {
    setEvents(prev => {
      const index = prev.findIndex(e => e.id === eventId);
      if (index === -1) return prev;

      const newEvents = [...prev];
      newEvents[index] = { ...newEvents[index], ...updates };
      return newEvents;
    });
  }, []);

  // Fetch on mount and when filters/date change (but NOT just when drawer opens)
  useEffect(() => {
    if (!enabled) return;

    // Create a unique key for current params
    const currentParamsKey = `${dateRange.start}|${dateRange.end}|${filterParams.currencies}|${filterParams.impacts}|${filterParams.onlyUpcoming}`;

    // Skip if we already have data for these exact params
    if (lastFetchedParamsRef.current === currentParamsKey) {
      return;
    }

    // Reset so shimmer shows until the upcoming fetch completes.
    setHasCompletedFetch(false);

    lastFetchedParamsRef.current = currentParamsKey;

    setOffset(0);
    fetchEvents(false);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // Reset both guards so that if this effect re-runs (StrictMode
      // double-invoke or real remount) the re-run effect can call fetchEvents.
      // Without this, lastFetchedParamsRef blocks the params-cache guard and
      // fetchingRef blocks the in-flight guard, leaving hasCompletedFetch
      // permanently false and the shimmer stuck loading forever.
      lastFetchedParamsRef.current = null;
      fetchingRef.current = false;
    };
    // Only re-fetch when these specific values change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, dateRange.start, dateRange.end, filterParams.currencies, filterParams.impacts, filterParams.onlyUpcoming]);

  // Direct postgres_changes subscription (bypasses useRealtimeSubscription)
  const dateRangeStartRef = useRef(dateRange.start);
  const dateRangeEndRef = useRef(dateRange.end);
  const updateEventRef = useRef(updateEvent);
  // Unique channel name per hook instance to prevent conflicts between multiple panels
  const channelIdRef = useRef(`economic-events-pg-${Math.random().toString(36).slice(2, 8)}`);
  dateRangeStartRef.current = dateRange.start;
  dateRangeEndRef.current = dateRange.end;
  updateEventRef.current = updateEvent;

  useEffect(() => {
    if (!enabled) return;

    const channelName = channelIdRef.current;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'economic_events' },
        (payload: any) => {
          if (payload.new) {
            const updatedEvent = payload.new as EconomicEvent;
            const eventDate = updatedEvent.event_date;
            const start = dateRangeStartRef.current;
            const end = dateRangeEndRef.current;

            if (eventDate >= start && eventDate <= end) {
              updateEventRef.current(updatedEvent.id, updatedEvent);
            }
          }
        }
      )
      .subscribe((status: string) => {
        logger.log(`Economic events channel (${channelName}): ${status}`);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled]);

  // Prevents "No events found" flash on fresh mount or when enabled transitions false→true.
  const awaitingFirstFetch = enabled && !hasCompletedFetch;

  return {
    events,
    loading: loading || awaitingFirstFetch,
    loadingMore,
    error,
    hasMore,
    dateRange,
    loadMore,
    refresh,
    updateEvent,
  };
}

export default useEconomicEvents;
