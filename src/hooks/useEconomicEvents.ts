/**
 * useEconomicEvents Hook
 *
 * Hook for fetching and managing economic events with SWR.
 * Automatically refetches data when browser tab regains focus,
 * solving the Chrome Energy Saver tab freezing issue.
 */

import useSWR from 'swr';
import { economicCalendarService } from '../services/economicCalendarService';
import type { Currency, ImpactLevel } from '../types/economicCalendar';

interface DateRange {
  start: string;
  end: string;
}

interface PaginationOptions {
  pageSize: number;
  offset: number;
}

interface FilterOptions {
  currencies: Currency[];
  impacts: ImpactLevel[];
  onlyUpcoming: boolean;
}

interface UseEconomicEventsOptions {
  dateRange: DateRange;
  pagination: PaginationOptions;
  filters: FilterOptions;
  enabled?: boolean;
  revalidateOnFocus?: boolean;
}

/**
 * Custom hook to fetch economic events with automatic focus revalidation
 */
export function useEconomicEvents(options: UseEconomicEventsOptions) {
  const {
    dateRange,
    pagination,
    filters,
    enabled = true,
    revalidateOnFocus = true,
  } = options;

  // Create a stable key from the options
  const key = enabled
    ? [
        'economic-events',
        dateRange.start,
        dateRange.end,
        pagination.offset,
        pagination.pageSize,
        JSON.stringify(filters),
      ]
    : null;

  const { data, error, isLoading, mutate } = useSWR(
    key,
    async () => {
      return await economicCalendarService.fetchEventsPaginated(
        dateRange,
        pagination,
        filters
      );
    },
    {
      // Automatically refetch when tab regains focus (solves Chrome freezing)
      revalidateOnFocus,
      // Prevent duplicate requests within 2 seconds
      dedupingInterval: 2000,
      // Don't retry on error (let user manually refresh)
      shouldRetryOnError: false,
      // Keep previous data while revalidating
      keepPreviousData: true,
    }
  );

  return {
    events: data?.events || [],
    hasMore: data?.hasMore || false,
    isLoading,
    error,
    /**
     * Manually refresh events data
     */
    refresh: mutate,
  };
}
