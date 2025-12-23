/**
 * useRecentTrades Hook
 *
 * Hook for fetching and managing recent trades with SWR.
 * Automatically refetches data when browser tab regains focus,
 * solving the Chrome Energy Saver tab freezing issue.
 */

import useSWR from 'swr';
import { TradeRepository } from '../services/repository/repositories/TradeRepository';
import type { Trade } from '../types/dualWrite';
import type { Calendar } from '../types/calendar';
import { logger } from '../utils/logger';

// Create singleton repository instance at module level
const tradeRepository = new TradeRepository();

export interface TradeWithCalendarName extends Trade {
  calendarName: string;
}

interface UseRecentTradesOptions {
  /**
   * Number of recent trades to fetch
   * @default 5
   */
  limit?: number;

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
 * Custom hook to fetch recent trades for a user with automatic focus revalidation
 */
export function useRecentTrades(
  userId: string | undefined,
  calendars: Calendar[] | undefined,
  options: UseRecentTradesOptions = {}
) {
  const {
    limit = 5,
    refreshInterval = 0,
    revalidateOnFocus = true,
  } = options;

  const { data, error, isLoading, mutate } = useSWR(
    // Only fetch if userId is defined and calendars are loaded
    userId && calendars ? ['recentTrades', userId, limit] : null,
    // Fetcher function
    async () => {
      if (!userId || !calendars) return null;

      try {
        // Fetch trades ordered by trade_date (descending) with limit
        const allTrades = await tradeRepository.findByUserId(userId, {
          limit,
          orderBy: 'trade_date',
          ascending: false
        });

        // Map trades with calendar names
        const tradesWithCalendarNames: TradeWithCalendarName[] = allTrades.map(trade => {
          const calendar = calendars.find(cal => cal.id === trade.calendar_id);
          return {
            ...trade,
            calendarName: calendar?.name || 'Unknown Calendar'
          };
        });

        return tradesWithCalendarNames;
      } catch (err) {
        logger.error('Error fetching recent trades:', err);
        throw err;
      }
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
    recentTrades: data ?? undefined,
    isLoading,
    error,
    /**
     * Manually refresh recent trades data
     */
    refresh: mutate,
  };
}

