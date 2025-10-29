/**
 * Hook for managing economic event watching in TradeCalendar
 */

import { useEffect, useCallback, useRef } from 'react';
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
      log(`🔍 Starting economic event watching for calendar: ${calendarId}`);
      economicEventWatcher.startWatching(calendarId, economic_calendar_filters);
    }
  }, [calendarId, economic_calendar_filters, isActive]);

  const stopWatching = useCallback(() => {
    if (calendarId) {
      log(`🛑 Stopping economic event watching for calendar: ${calendarId}`);
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
      callback(e.detail.events, e.detail.allEvents, e.detail.calendar_id);
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
      callback(e.detail.error, e.detail.calendar_id);
    };

    window.addEventListener('economicEventWatcherError', handleError as EventListener);
    
    return () => {
      window.removeEventListener('economicEventWatcherError', handleError as EventListener);
    };
  }, [callback]);
};
