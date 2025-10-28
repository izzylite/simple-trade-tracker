/**
 * Custom hook for fetching and caching high-impact economic events
 * Optimized to prevent excessive Firebase queries
 */

import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { economicCalendarService } from '../services/economicCalendarService';
import { Currency, ImpactLevel } from '../types/economicCalendar';
import { DEFAULT_ECONOMIC_EVENT_FILTER_SETTINGS } from '../components/economicCalendar/EconomicCalendarDrawer';
import { error as logError, log, warn } from '../utils/logger';

interface UseHighImpactEventsProps {
  currentDate: Date;
  calendarId?: string;
  currencies?: Currency[];
  enabled?: boolean;
}

interface UseHighImpactEventsReturn {
  highImpactEventDates: Map<string, boolean>;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

// Cache configuration
const CACHE_PREFIX = 'highImpactEvents';

// Smart cache duration based on month type
const getCacheDuration = (targetDate: Date): number => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const targetMonth = targetDate.getMonth();
  const targetYear = targetDate.getFullYear();

  // Previous months: Cache indefinitely (events don't change)
  if (targetYear < currentYear || (targetYear === currentYear && targetMonth < currentMonth)) {
    return Number.MAX_SAFE_INTEGER; // Effectively permanent
  }

  // Current month: Refresh weekly starting on Sunday
  if (targetYear === currentYear && targetMonth === currentMonth) {
    return 7 * 24 * 60 * 60 * 1000; // 7 days
  }

  // Future months: Refresh daily (events might be updated/added)
  return 24 * 60 * 60 * 1000; // 1 day
};

// Get next Sunday for current month cache expiry
const getNextSundayExpiry = (): number => {
  const now = new Date();
  const daysUntilSunday = (7 - now.getDay()) % 7;
  const nextSunday = new Date(now);
  nextSunday.setDate(now.getDate() + (daysUntilSunday === 0 ? 7 : daysUntilSunday));
  nextSunday.setHours(0, 0, 0, 0); // Start of Sunday
  return nextSunday.getTime();
};

export const useHighImpactEvents = ({
  currentDate,
  calendarId,
  currencies = DEFAULT_ECONOMIC_EVENT_FILTER_SETTINGS.currencies,
  enabled = true
}: UseHighImpactEventsProps): UseHighImpactEventsReturn => {
  const [highImpactEventDates, setHighImpactEventDates] = useState<Map<string, boolean>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  // Memoize currencies array to prevent unnecessary re-renders
  const currenciesKey = currencies.join(',');

  useEffect(() => {
    if (!enabled || !calendarId) return;

    // Clean up old cache entries periodically (once per session)
    const cleanupKey = 'highImpactEvents_lastCleanup';
    const lastCleanup = localStorage.getItem(cleanupKey);
    const now = Date.now();
    const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

    if (!lastCleanup || now - parseInt(lastCleanup) > CLEANUP_INTERVAL) {
      cleanupExpiredCache();
      localStorage.setItem(cleanupKey, now.toString());
    }

    // Clean up old currency cache when currencies change
    if (calendarId) {
      clearOldCurrencyCache(calendarId, currencies);
    }

    const fetchHighImpactEvents = async () => {
      const monthKey = format(currentDate, 'yyyy-MM');
      const currenciesHash = currencies.sort().join('-'); // Sort to ensure consistent hash
      const cacheKey = `${CACHE_PREFIX}_${monthKey}_${calendarId}_${currenciesHash}`;
      const cacheExpiryKey = `${cacheKey}_expiry`;
      const cacheMetaKey = `${cacheKey}_meta`;
      
      // Check cache first with smart expiry logic
      const cachedData = localStorage.getItem(cacheKey);
      const cacheExpiry = localStorage.getItem(cacheExpiryKey);
      const cacheMeta = localStorage.getItem(cacheMetaKey);
      const now = Date.now();

      // Determine cache strategy based on month type
      const cacheDuration = getCacheDuration(currentDate);
      const isPreviousMonth = currentDate < new Date(new Date().getFullYear(), new Date().getMonth(), 1);

      if (cachedData && cacheExpiry && now < parseInt(cacheExpiry)) {
        const cacheAge = now - (cacheMeta ? JSON.parse(cacheMeta).lastUpdated || 0 : 0);
        const cacheAgeHours = Math.round(cacheAge / (1000 * 60 * 60));
        const currenciesInfo = currencies.join(', ');

        log(`📋 Using cached high-impact events for ${monthKey} [${currenciesInfo}] (${cacheAgeHours}h old, ${isPreviousMonth ? 'permanent' : 'expires ' + new Date(parseInt(cacheExpiry)).toLocaleString()})`);

        try {
          const eventDatesMap = new Map<string, boolean>(JSON.parse(cachedData));
          const meta = cacheMeta ? JSON.parse(cacheMeta) : {};

          setHighImpactEventDates(eventDatesMap);
          setLastUpdated(meta.lastUpdated || now);
          setError(null);
          return;
        } catch (parseError) {
          warn('Failed to parse cached data, fetching fresh data');
        }
      }

      setIsLoading(true);
      setError(null);

      try {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const dateRange = {
          start: format(monthStart, 'yyyy-MM-dd'),
          end: format(monthEnd, 'yyyy-MM-dd')
        };

        log(`🔄 Fetching fresh high-impact events for ${monthKey} [${currencies.join(', ')}]`);
        
        // Fetch only high-impact events for the month
        const events = await economicCalendarService.fetchEvents(dateRange, {
          currencies,
          impacts: ['High'] as ImpactLevel[], // Only high-impact events for red dots
          onlyUpcoming: false // Include all events for the month, not just upcoming
        });

        // Create a map of dates that have high-impact events
        const eventDatesMap = new Map<string, boolean>();
        events.forEach(event => {
          eventDatesMap.set(event.event_date, true);
        });

        setHighImpactEventDates(eventDatesMap);
        setLastUpdated(now);

        // Cache the results with smart expiry
        const cacheData = JSON.stringify(Array.from(eventDatesMap.entries()));
        const metaData = JSON.stringify({
          lastUpdated: now,
          eventCount: events.length,
          currencies: currencies.join(','),
          monthType: isPreviousMonth ? 'previous' : (currentDate.getMonth() === new Date().getMonth() ? 'current' : 'future')
        });

        // Calculate expiry time based on month type
        let expiryTime: number;
        if (isPreviousMonth) {
          // Previous months: Cache for 1 year (effectively permanent)
          expiryTime = now + (365 * 24 * 60 * 60 * 1000);
        } else if (currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear()) {
          // Current month: Cache until next Sunday
          expiryTime = getNextSundayExpiry();
        } else {
          // Future months: Cache for 1 day
          expiryTime = now + (24 * 60 * 60 * 1000);
        }

        localStorage.setItem(cacheKey, cacheData);
        localStorage.setItem(cacheExpiryKey, expiryTime.toString());
        localStorage.setItem(cacheMetaKey, metaData);

        const cacheTypeMsg = isPreviousMonth ? 'permanently' :
          (currentDate.getMonth() === new Date().getMonth() ? 'until next Sunday' : 'for 1 day');
        log(`📍 Found ${events.length} high-impact events for ${monthKey} [${currencies.join(', ')}] (cached ${cacheTypeMsg})`);
        
      } catch (fetchError) {
        logError('❌ Error fetching high-impact events:', fetchError);
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to fetch events');

        // If fetch fails, try to use expired cache as fallback
        if (cachedData) {
          log(`🔄 Using expired cache as fallback for ${monthKey}`);
          try {
            const eventDatesMap = new Map<string, boolean>(JSON.parse(cachedData));
            setHighImpactEventDates(eventDatesMap);
            setError('Using cached data (may be outdated)');
          } catch (parseError) {
            logError('Failed to parse fallback cache data');
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchHighImpactEvents();
  }, [currentDate, calendarId, currenciesKey, enabled]);

  return {
    highImpactEventDates,
    isLoading,
    error,
    lastUpdated
  };
};

/**
 * Utility function to clear cache for specific calendar or all calendars
 * Can also clear cache for specific currencies
 */
export const clearHighImpactEventsCache = (calendarId?: string, currencies?: string[]) => {
  const keys = Object.keys(localStorage);
  const keysToRemove = keys.filter(key => {
    if (!key.startsWith(CACHE_PREFIX)) return false;

    if (calendarId) {
      if (!key.includes(`_${calendarId}_`)) return false;
    }

    if (currencies) {
      const currenciesHash = currencies.sort().join('-');
      if (!key.includes(`_${currenciesHash}`)) return false;
    }

    return true;
  });

  keysToRemove.forEach(key => localStorage.removeItem(key));
  log(`🗑️ Cleared ${keysToRemove.length} cached high-impact event entries`);
};

/**
 * Clear cache entries for old currency combinations when currencies change
 */
export const clearOldCurrencyCache = (calendarId: string, newCurrencies: string[]) => {
  const keys = Object.keys(localStorage);
  const newCurrenciesHash = newCurrencies.sort().join('-');

  const keysToRemove = keys.filter(key => {
    if (!key.startsWith(CACHE_PREFIX)) return false;
    if (!key.includes(`_${calendarId}_`)) return false;
    if (key.includes(`_${newCurrenciesHash}`)) return false; // Keep current currency cache

    return true; // Remove old currency combinations
  });

  keysToRemove.forEach(key => localStorage.removeItem(key));
  if (keysToRemove.length > 0) {
    log(`🧹 Cleared ${keysToRemove.length} old currency cache entries for calendar ${calendarId}`);
  }
};

/**
 * Utility function to get cache info for debugging
 */
export const getHighImpactEventsCacheInfo = (calendarId?: string) => {
  const keys = Object.keys(localStorage);
  const cacheKeys = keys.filter(key => {
    if (!key.startsWith(CACHE_PREFIX)) return false;
    if (calendarId) {
      return key.includes(`_${calendarId}_`);
    }
    return true;
  });

  const now = Date.now();

  return cacheKeys.map(key => {
    const data = localStorage.getItem(key);
    let cacheInfo: any = {
      key,
      size: data ? data.length : 0
    };

    if (key.includes('_expiry')) {
      const expiryTime = parseInt(data || '0');
      const isExpired = now > expiryTime;
      const isPermanent = expiryTime > now + (300 * 24 * 60 * 60 * 1000); // > 300 days

      cacheInfo.isExpired = isExpired;
      cacheInfo.isPermanent = isPermanent;
      cacheInfo.expiresAt = isPermanent ? 'Never' : new Date(expiryTime).toLocaleString();
    } else if (key.includes('_meta')) {
      try {
        const meta = JSON.parse(data || '{}');
        cacheInfo.eventCount = meta.eventCount;
        cacheInfo.monthType = meta.monthType;
        cacheInfo.lastUpdated = new Date(meta.lastUpdated).toLocaleString();
      } catch (e) {
        // Ignore parse errors
      }
    }

    return cacheInfo;
  });
};

/**
 * Get cache strategy explanation for a given date
 */
export const getCacheStrategyInfo = (targetDate: Date) => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const targetMonth = targetDate.getMonth();
  const targetYear = targetDate.getFullYear();

  if (targetYear < currentYear || (targetYear === currentYear && targetMonth < currentMonth)) {
    return {
      type: 'previous',
      description: 'Previous month - cached permanently (events never change)',
      refreshStrategy: 'Never refreshes automatically'
    };
  }

  if (targetYear === currentYear && targetMonth === currentMonth) {
    return {
      type: 'current',
      description: 'Current month - refreshes weekly on Sunday',
      refreshStrategy: 'Refreshes every Sunday to catch new events'
    };
  }

  return {
    type: 'future',
    description: 'Future month - refreshes daily',
    refreshStrategy: 'Refreshes daily as events may be added/updated'
  };
};

/**
 * Internal function to clean up expired cache entries
 * Respects permanent cache for previous months
 */
const cleanupExpiredCache = () => {
  const keys = Object.keys(localStorage);
  const now = Date.now();
  let cleanedCount = 0;
  let skippedPermanent = 0;

  keys.forEach(key => {
    if (!key.startsWith(CACHE_PREFIX)) return;

    // Check if it's an expiry key
    if (key.includes('_expiry')) {
      const expiryTime = localStorage.getItem(key);
      if (expiryTime) {
        const expiry = parseInt(expiryTime);

        // Skip cleanup for very long expiry times (previous months)
        const oneYearFromNow = now + (365 * 24 * 60 * 60 * 1000);
        if (expiry > oneYearFromNow) {
          skippedPermanent++;
          return;
        }

        // Clean up truly expired entries
        if (now > expiry) {
          const baseKey = key.replace('_expiry', '');
          localStorage.removeItem(key);
          localStorage.removeItem(baseKey);
          localStorage.removeItem(`${baseKey}_meta`);
          cleanedCount++;
        }
      }
    }
  });

  if (cleanedCount > 0 || skippedPermanent > 0) {
    log(`🧹 Cleaned up ${cleanedCount} expired cache entries, preserved ${skippedPermanent} permanent entries`);
  }
};
