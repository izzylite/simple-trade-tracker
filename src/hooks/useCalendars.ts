/**
 * useCalendars Hook
 *
 * Hook for fetching and managing calendars with SWR.
 * Automatically refetches data when browser tab regains focus,
 * solving the Chrome Energy Saver tab freezing issue.
 */

import useSWR from 'swr';
import * as calendarService from '../services/calendarService';
import type { Calendar } from '../types/dualWrite';
import type { CalendarWithUIState } from '../types/calendar';

interface UseCalendarsOptions {
  /**
   * Interval in milliseconds to automatically refetch data.
   * Set to 0 to disable automatic revalidation.
   * @default 0
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
 * Custom hook to fetch calendars for a user with automatic focus revalidation
 */
export function useCalendars(
  userId: string | undefined,
  options: UseCalendarsOptions = {}
) {
  const {
    refreshInterval = 0,
    revalidateOnFocus = true,
  } = options;

  const { data, error, isLoading, mutate } = useSWR(
    // Only fetch if userId is defined
    userId ? ['calendars', userId] : null,
    // Fetcher function
    async () => {
      if (!userId) return null;
      const calendars = await calendarService.getUserCalendars(userId);
      // Convert Calendar[] to CalendarWithUIState[]
      return calendars.map((cal): CalendarWithUIState => ({
        ...cal,
        cachedTrades: [],
        loadedYears: []
      }));
    },
    {
      // Automatically refetch when tab regains focus (solves Chrome freezing)
      revalidateOnFocus,
      // Prevent duplicate requests within 2 seconds
      dedupingInterval: 2000,
      // Optional: auto-refresh interval
      refreshInterval,
      // Don't retry on error (let user manually refresh)
      shouldRetryOnError: false,
      // Keep previous data while revalidating to prevent empty arrays
      keepPreviousData: true,
    }
  );

  return {
    calendars: data ?? undefined, // Return undefined instead of empty array to prevent unnecessary renders
    isLoading,
    error,
    /**
     * Manually refresh calendars data
     */
    refresh: mutate,
  };
}
