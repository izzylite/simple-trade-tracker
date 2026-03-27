/**
 * useCurrentTime Hook
 * Provides a shared current time context that updates at configurable intervals.
 * This prevents multiple components from each running their own timers.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseCurrentTimeOptions {
  /** Update interval in milliseconds for normal mode (default: 60000 = 1 minute) */
  normalInterval?: number;
  /** Update interval in milliseconds for imminent mode (default: 1000 = 1 second) */
  imminentInterval?: number;
  /** Whether to enable imminent mode (faster updates) */
  isImminent?: boolean;
  /** Whether the timer is enabled */
  enabled?: boolean;
}

/**
 * Hook that provides the current time with configurable update intervals.
 * Useful for countdown timers and time-based displays.
 */
export function useCurrentTime(options: UseCurrentTimeOptions = {}) {
  const {
    normalInterval = 60000,
    imminentInterval = 1000,
    isImminent = false,
    enabled = true,
  } = options;

  const [currentTime, setCurrentTime] = useState(() => new Date());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up interval
  const clearCurrentInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Set up interval based on mode
  useEffect(() => {
    if (!enabled) {
      clearCurrentInterval();
      return;
    }

    const interval = isImminent ? imminentInterval : normalInterval;

    // Immediately refresh so countdown isn't stale until the first tick
    setCurrentTime(new Date());

    clearCurrentInterval();
    intervalRef.current = setInterval(() => {
      setCurrentTime(new Date());
    }, interval);

    return clearCurrentInterval;
  }, [enabled, isImminent, normalInterval, imminentInterval, clearCurrentInterval]);

  // Force refresh function
  const refresh = useCallback(() => {
    setCurrentTime(new Date());
  }, []);

  return {
    currentTime,
    refresh,
  };
}

/**
 * Shared time provider for economic calendar events.
 * Automatically detects imminent events and switches to 1-second updates.
 *
 * Uses a separate 30-second imminence check so the countdown interval
 * doesn't depend on a stale useMemo. Once any event is within 60 minutes
 * the timer switches from 60s to 1s updates.
 */
export function useEventCountdownTime(
  events: Array<{ time_utc: string }>,
  enabled: boolean = true
) {
  const [hasImminent, setHasImminent] = useState(() => checkImminence(events));
  const eventsRef = useRef(events);
  eventsRef.current = events;

  // Re-check imminence every 30 seconds so we catch events entering the
  // 60-minute window without waiting for the events array to change.
  useEffect(() => {
    if (!enabled) return;

    const check = () => setHasImminent(checkImminence(eventsRef.current));
    check(); // run immediately on mount / events change
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [enabled, events]);

  return useCurrentTime({
    normalInterval: 60000,
    imminentInterval: 1000,
    isImminent: hasImminent,
    enabled,
  });
}

/** Check if any event is within 60 minutes from now */
function checkImminence(events: Array<{ time_utc: string }>): boolean {
  const now = Date.now();
  return events.some(e => {
    const diff = new Date(e.time_utc).getTime() - now;
    return diff > 0 && diff <= 60 * 60 * 1000;
  });
}

export default useCurrentTime;
