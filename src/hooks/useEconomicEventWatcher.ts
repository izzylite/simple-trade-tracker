/**
 * Hook for managing economic event watching in TradeCalendar
 */

import { useEffect, useCallback, useRef, useMemo } from 'react';
import { economicEventWatcher } from '../services/economicEventWatcher';
import { EconomicEvent } from '../types/economicCalendar';
import { error, log } from '../utils/logger';

interface UseEconomicEventWatcherProps {
  calendarId?: string;
  economic_calendar_filters?: {
    currencies: string[];
    impacts: string[];
    viewType: 'day' | 'week' | 'month';
  };
  isActive?: boolean; // Whether the calendar is currently active/visible
}

interface UseEconomicEventWatcherReturn {
  startWatching: () => void;
  stopWatching: () => void;
  watchingStatus: {
    isActive: boolean;
    watchedEventsCount: number;
  };
}

export const useEconomicEventWatcher = ({
  calendarId,
  economic_calendar_filters,
  isActive = true
}: UseEconomicEventWatcherProps): UseEconomicEventWatcherReturn => {
  const isInitialized = useRef(false);

  // Memoize filters to prevent unnecessary re-renders when only stats change
  // Only recreate when actual filter values change, not object reference
  const stableFilters = useMemo(() => {
    if (!economic_calendar_filters) return undefined;
    return {
      currencies: economic_calendar_filters.currencies,
      impacts: economic_calendar_filters.impacts,
      viewType: economic_calendar_filters.viewType
    };
  }, [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    economic_calendar_filters?.currencies?.join(','),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    economic_calendar_filters?.impacts?.join(','),
    economic_calendar_filters?.viewType
  ]);

  // Initialize the watcher once
  useEffect(() => {
    if (!isInitialized.current) {
      economicEventWatcher.initialize({
        onEventsUpdated: (events: EconomicEvent[], allEvents: EconomicEvent[], calendarId: string) => {
          log(`📊 ${events.length} events updated simultaneously for calendar ${calendarId}`);

          // Dispatch multiple events update
          window.dispatchEvent(new CustomEvent('economicEventsUpdated', {
            detail: { events, allEvents, calendarId }
          }));
        },
        onError: (err: Error, calendarId: string) => {
          error(`❌ Economic event watcher error for calendar ${calendarId}:`, err);

          // You could show a toast notification or handle the error as needed
          window.dispatchEvent(new CustomEvent('economicEventWatcherError', {
            detail: { error: err.message, calendarId }
          }));
        }
      });
      isInitialized.current = true;
    }
  }, []);

  const startWatching = useCallback(() => {
    if (calendarId && isActive) {
      economicEventWatcher.startWatching(calendarId, stableFilters);
    }
  }, [calendarId, stableFilters, isActive]);

  const stopWatching = useCallback(() => {
    if (calendarId) { 
      economicEventWatcher.stopWatching(calendarId);
    }
  }, [calendarId]);

  // Auto-start watching when calendar becomes active
  useEffect(() => {
    if (isActive && calendarId) {
      startWatching();
    } else {
      stopWatching();
    }

    // Cleanup on unmount
    return () => {
      stopWatching();
    };
  }, [isActive, calendarId, startWatching, stopWatching]);

  // Get current watching status
  const watchingStatus = economicEventWatcher.getWatchingStatus();

  return {
    startWatching,
    stopWatching,
    watchingStatus: {
      isActive: watchingStatus.isActive,
      watchedEventsCount: watchingStatus.watchedEventsCount
    }
  };
};
 
// Custom hook for listening to multiple economic event updates (same release time)
export const useEconomicEventsUpdates = (callback: (events: EconomicEvent[], allEvents: EconomicEvent[], calendarId: string) => void) => {
  useEffect(() => {
    const handleEventsUpdate = (e: CustomEvent) => {
      callback(e.detail.events, e.detail.allEvents, e.detail.calendarId);
    };

    window.addEventListener('economicEventsUpdated', handleEventsUpdate as EventListener);

    return () => {
      window.removeEventListener('economicEventsUpdated', handleEventsUpdate as EventListener);
    };
  }, [callback]);
};

// Custom hook for listening to watcher errors
export const useEconomicEventWatcherErrors = (callback: (error: string, calendarId: string) => void) => {
  useEffect(() => {
    const handleError = (e: CustomEvent) => {
      callback(e.detail.error, e.detail.calendarId);
    };

    window.addEventListener('economicEventWatcherError', handleError as EventListener);
    
    return () => {
      window.removeEventListener('economicEventWatcherError', handleError as EventListener);
    };
  }, [callback]);
};
