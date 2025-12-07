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
 * Provides time updates optimized for event countdowns.
 */
export function useEventCountdownTime(hasImminentEvents: boolean, enabled: boolean = true) {
  return useCurrentTime({
    normalInterval: 60000, // 1 minute for normal events
    imminentInterval: 1000, // 1 second for imminent events
    isImminent: hasImminentEvents,
    enabled,
  });
}

export default useCurrentTime;
