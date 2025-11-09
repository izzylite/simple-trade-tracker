/**
 * useUpcomingEconomicEvents Hook
 *
 * Hook for fetching today's upcoming economic events with SWR.
 * Specifically designed for the HomePage to show unreleased events.
 * Automatically refetches data when browser tab regains focus.
 */

import useSWR from 'swr';
import { format } from 'date-fns';
import { economicCalendarService } from '../services/economicCalendarService';
import type { EconomicEvent } from '../types/economicCalendar';
import { logger } from '../utils/logger';

interface UseUpcomingEconomicEventsOptions {
  /**
   * Impact levels to filter by
   * @default ['High', 'Medium']
   */
  impacts?: ('High' | 'Medium' | 'Low')[];

  /**
   * Interval in milliseconds to automatically refetch data.
   * Set to 0 to disable automatic revalidation.
   * @default 300000 (5 minutes)
   */
  refreshInterval?: number;

  /**
   * Whether to revalidate when the browser tab regains focus.
   * This solves the Chrome tab freezing issue.
   * @default true
   */
  revalidateOnFocus?: boolean;
}

/**
 * Custom hook to fetch today's upcoming economic events with automatic focus revalidation
 */
export function useUpcomingEconomicEvents(
  options: UseUpcomingEconomicEventsOptions = {}
) {
  const {
    impacts = ['High', 'Medium'],
    refreshInterval = 300000, // 5 minutes
    revalidateOnFocus = true,
  } = options;

  const { data, error, isLoading, mutate } = useSWR(
    // Cache key includes impacts to refetch when filter changes
    ['upcomingEconomicEvents', impacts.join(',')],
    // Fetcher function
    async () => {
      try {
        const now = new Date();
        const today = format(now, 'yyyy-MM-dd');

        const events = await economicCalendarService.fetchEvents(
          {
            start: today,
            end: today
          },
          {
            impacts
          }
        );

        // Filter to show only unreleased events (future events that haven't happened yet)
        const currentTime = now.getTime();
        const upcomingEvents = events.filter(event =>
          new Date(event.time_utc).getTime() > currentTime
        );

        // Sort in ascending order (soonest unreleased event first)
        const sortedEvents = upcomingEvents.sort((a, b) =>
          new Date(a.time_utc).getTime() - new Date(b.time_utc).getTime()
        );

        return sortedEvents;
      } catch (err) {
        logger.error('Error fetching upcoming economic events:', err);
        throw err;
      }
    },
    {
      // Automatically refetch when tab regains focus (solves Chrome freezing)
      revalidateOnFocus,
      // Prevent duplicate requests within 2 seconds
      dedupingInterval: 2000,
      // Auto-refresh every 5 minutes to get latest events
      refreshInterval,
      // Don't retry on error (let user manually refresh)
      shouldRetryOnError: false,
      // Keep previous data while revalidating to prevent empty arrays
      keepPreviousData: true,
    }
  );

  return {
    economicEvents: data ?? undefined,
    isLoading,
    error,
    /**
     * Manually refresh economic events data
     */
    refresh: mutate,
  };
}

