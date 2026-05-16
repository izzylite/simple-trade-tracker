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
export type { Calendar };

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

  /**
   * Window in ms during which duplicate fetches are coalesced. Calendars
   * rarely change between focus events; bump high to avoid hammering the
   * API on every tab switch. Mutations call `mutate()` directly so writes
   * are not delayed by this dedup.
   * @default 60000
   */
  dedupingInterval?: number;
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
    dedupingInterval = 60_000,
  } = options;

  const { data, error, isLoading, mutate } = useSWR(
    // Only fetch if userId is defined
    userId ? ['calendars', userId] : null,
    // Fetcher function
    async () => {
      if (!userId) return null;
      const calendars = await calendarService.getUserCalendars(userId);
      // Return calendars directly
      return calendars;
    },
    {
      // Automatically refetch when tab regains focus (solves Chrome freezing)
      revalidateOnFocus,
      // Coalesce duplicate fetches across consumers + focus events.
      dedupingInterval,
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

/**
 * Custom hook to fetch trash (soft-deleted) calendars for a user
 */
export function useTrashCalendars(
  userId: string | undefined,
  options: UseCalendarsOptions = {}
) {
  const {
    refreshInterval = 0,
    revalidateOnFocus = true,
    dedupingInterval = 60_000,
  } = options;

  const { data, error, isLoading, mutate } = useSWR(
    // Only fetch if userId is defined
    userId ? ['trash-calendars', userId] : null,
    // Fetcher function
    async () => {
      if (!userId) return null;
      const calendars = await calendarService.getTrashCalendars(userId);
      return calendars;
    },
    {
      revalidateOnFocus,
      dedupingInterval,
      refreshInterval,
      shouldRetryOnError: false,
      keepPreviousData: true,
    }
  );

  return {
    trashCalendars: data ?? [],
    isLoading,
    error,
    refresh: mutate,
  };
}
