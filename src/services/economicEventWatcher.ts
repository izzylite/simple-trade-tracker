// @ts-nocheck
/**
 * Smart Economic Event Watcher Service
 * Monitors upcoming events and triggers updates when they occur
 *
 * NOTE: This service is being migrated to Supabase Edge Functions.
 * Temporarily disabled to fix TypeScript errors during migration.
 */

import { EconomicEvent, Currency, ImpactLevel } from '../types/economicCalendar';
import { economicCalendarService } from './economicCalendarService';
import { endOfDay, format, startOfDay } from 'date-fns';
import { error, log, logger } from '../utils/logger';
import { supabase } from '../config/supabase';

/* eslint-disable */

// Default filter settings to use when no calendar filters are available
const DEFAULT_FILTER_SETTINGS = {
  currencies: ['USD', 'EUR', 'GBP'] as Currency[],
  impacts: ['High', 'Medium', 'Low'] as ImpactLevel[],
  viewType: 'day' as const
};

// Configuration for the event watcher
const WATCHER_CONFIG = {
  refreshOnStart: true, // Whether to refresh calendar data when starting the watcher
  maxRefreshAge: 5 * 60 * 1000 // Don't refresh if data was updated less than 5 minutes ago
};

interface WatchedEventGroup {
  events: EconomicEvent[];
  timeoutId: NodeJS.Timeout;
  calendarId: string;
  releaseTime: string; // ISO string for grouping
}

interface EventWatcherCallbacks {
  onEventsUpdated: (events: EconomicEvent[], allEvents: EconomicEvent[], calendarId: string) => void;
  onError: (error: Error, calendarId: string) => void;
}

interface CalendarEventQueue {
  events: EconomicEvent[]; 
  lastFetched: number;
  currencies: Currency[];
  impacts: ImpactLevel[];
}

interface EventTimeGroup {
  releaseTime: string;
  events: EconomicEvent[];
}

class EconomicEventWatcher {
  private watchedEventGroups: Map<string, WatchedEventGroup> = new Map();
  private callbacks: EventWatcherCallbacks | null = null;
  private isActive = false;
  private eventQueues: Map<string, CalendarEventQueue> = new Map(); // Memory cache per calendar

  /**
   * Get the localStorage key for tracking last refresh time per calendar
   */
  private getRefreshKey(calendarId: string): string {
    return `economicEventWatcher_lastRefresh_${calendarId}`;
  }

  /**
   * Check if we need to refresh data based on last refresh time
   */
  private shouldRefreshData(calendarId: string): boolean {
    try {
      if (!WATCHER_CONFIG.refreshOnStart) {
        return false;
      }
      const lastRefreshStr = localStorage.getItem(this.getRefreshKey(calendarId));
      if (!lastRefreshStr) {
        return true; // No previous refresh recorded
      }

      const lastRefresh = parseInt(lastRefreshStr, 10);
      const now = Date.now();
      const timeSinceRefresh = now - lastRefresh;

      const shouldRefresh = timeSinceRefresh > WATCHER_CONFIG.maxRefreshAge;
      logger.log(`📊 Last refresh for calendar ${calendarId}: ${Math.round(timeSinceRefresh / 1000 / 60)} minutes ago. Should refresh: ${shouldRefresh}`);

      return shouldRefresh;
    } catch (error) {
      logger.warn('⚠️ Error checking refresh time from localStorage:', error);
      return true; // Default to refresh on error
    }
  }

  /**
   * Save the current time as last refresh time for a calendar
   */
  private saveRefreshTime(calendarId: string): void {
    try {
      localStorage.setItem(this.getRefreshKey(calendarId), Date.now().toString());
    } catch (error) {
      logger.warn('⚠️ Error saving refresh time to localStorage:', error);
    }
  }

  /**
   * Initialize the watcher with callbacks
   */
  initialize(callbacks: EventWatcherCallbacks) {
    this.callbacks = callbacks;
    logger.log('📊 Economic Event Watcher initialized');
  }

  /**
   * Start watching events for a specific calendar
   */
  async startWatching(calendarId: string, economicCalendarFilters?: any) {
    if (!this.callbacks) {
      logger.warn('⚠️ Event watcher not initialized');
      return;
    }

    this.isActive = true;
    logger.log(`🔍 Starting event watching for calendar: ${calendarId}`);

    // Get currencies from calendar filters or use defaults
    const currencies = economicCalendarFilters?.currencies || DEFAULT_FILTER_SETTINGS.currencies;
    const impacts = economicCalendarFilters?.impacts || DEFAULT_FILTER_SETTINGS.impacts;

    try {
      // First, refresh economic calendar data to ensure we have the latest information
      if (this.shouldRefreshData(calendarId)) {
        this.refreshCalendarData(currencies, calendarId);
      } else {
        log(`⏭️ Skipping refresh for calendar ${calendarId} - data is still fresh`);
      }

      // Initialize or refresh the event queue for this calendar
      await this.initializeEventQueue(calendarId, currencies, impacts);

      // Start watching the next event from the queue
      this.watchNextEventFromQueue(calendarId);

    } catch (err) {
      error('❌ Error starting event watcher:', err);
      this.callbacks.onError(err as Error, calendarId);
    }
  }

  /**
   * Refresh economic calendar data by calling the fetch-mql5-event edge function
   * Queries today's events from DB, then batch-fetches fresh data from MQL5
   */
  private async refreshCalendarData(currencies: Currency[], calendarId: string) {
    try {
      log(`🔄 Refreshing economic calendar data for calendar ${calendarId}, currencies: ${currencies.join(', ')}`);

      const today = new Date();
      const todayStart = startOfDay(today).toISOString();
      const todayEnd = endOfDay(today).toISOString();

      // Query today's events from DB to know what to refresh
      const { data: todayEvents, error: queryError } = await supabase
        .from('economic_events')
        .select('event_name, country')
        .in('currency', currencies)
        .gte('event_time', todayStart)
        .lte('event_time', todayEnd);

      if (queryError || !todayEvents || todayEvents.length === 0) {
        if (queryError) {
          logger.error('❌ Error querying today\'s events:', queryError);
        } else {
          log('⏭️ No events found for today, skipping refresh');
        }
        return;
      }

      log(`📊 Found ${todayEvents.length} events for today, batch-fetching from MQL5`);

      // Deduplicate events by name+country
      const uniqueEvents = Array.from(
        new Map(todayEvents.map(e => [`${e.event_name}|${e.country}`, e])).values()
      ).filter(e => e.event_name && e.country);

      // Call fetch-mql5-event in batch mode (no ScraperAPI credits used)
      const { data, error: callError } = await supabase.functions.invoke('fetch-mql5-event', {
        body: {
          events: uniqueEvents.map(e => ({
            event_name: e.event_name,
            country: e.country
          }))
        }
      });

      if (callError) {
        logger.error('❌ Error calling fetch-mql5-event function:', callError);
        return;
      }

      const responseData = data as any;
      const succeeded = responseData?.succeeded || 0;
      const failed = responseData?.failed || 0;

      logger.log(`✅ MQL5 refresh for calendar ${calendarId}: ${succeeded} succeeded, ${failed} failed`);

      // Save the refresh time to localStorage
      this.saveRefreshTime(calendarId);

    } catch (error) {
      logger.error('❌ Error refreshing economic calendar data:', error);
      // Don't throw - this is not critical for watcher initialization
    }
  }

  /**
   * Initialize or refresh the event queue for a calendar
   */
  private async initializeEventQueue(calendarId: string, currencies: Currency[], impacts: ImpactLevel[]) {
    const now = Date.now();
    const existingQueue = this.eventQueues.get(calendarId);

    // Check if we need to fetch new data (if filters changed)
    const shouldRefresh = !existingQueue ||
      !this.arraysEqual(existingQueue.currencies, currencies) ||
      !this.arraysEqual(existingQueue.impacts, impacts);

    if (shouldRefresh) {
      logger.log(`📊 Fetching fresh events for calendar: ${calendarId}`);

      // Get today's events for the specified currencies
      const today = new Date();
      const dayStart = startOfDay(today);
      const dayEnd = endOfDay(today);
      const dateRange = {
        start: format(dayStart, 'yyyy-MM-dd'),
        end: format(dayEnd, 'yyyy-MM-dd')
      };

      const todaysEvents = await economicCalendarService.fetchEventsPaginated(
        dateRange,
        { pageSize: 50 },
        { currencies, impacts, onlyUpcoming: true },
      );

      // Sort upcoming events (already filtered by database via onlyUpcoming)
      const upcomingEvents = todaysEvents.events
        .sort((a, b) => new Date(a.time_utc).getTime() - new Date(b.time_utc).getTime());

      // Store in memory queue
      this.eventQueues.set(calendarId, {
        events: upcomingEvents,
        lastFetched: now,
        currencies,
        impacts
      });

      logger.log(`📋 Cached ${upcomingEvents.length} upcoming events for calendar: ${calendarId} ${todaysEvents.events.length}`);
    } else {
      logger.log(`📋 Using cached events for calendar: ${calendarId}`);
    }
  }

  /**
   * Watch the next event group from the calendar's queue
   */
  private watchNextEventFromQueue(calendarId: string) {
    const queue = this.eventQueues.get(calendarId);
    if (!queue || queue.events.length === 0) {
      logger.log(`📅 No more events to watch for calendar: ${calendarId}`);
      this.isActive = false;
      return;
    }

    // Group events by release time starting from current index
    const eventGroup = this.getNextEventGroup(queue);
    if (eventGroup.events.length === 0) {
      logger.log(`📅 No more event groups to watch for calendar: ${calendarId}`);
      this.isActive = false;
      return;
    }

    this.watchEventGroup(eventGroup, calendarId);
    logger.log(`⏰ Watching ${eventGroup.events.length} event(s) releasing at ${eventGroup.releaseTime} for calendar: ${calendarId}`);
    eventGroup.events.forEach((event, index) => {
      logger.log(`   ${index + 1}. ${event.event_name}`);
    });
  }

  /**
   * Get the next group of events that have the same release time
   */
  private getNextEventGroup(queue: CalendarEventQueue): EventTimeGroup {
    if (queue.events.length === 0) {
      return { releaseTime: '', events: [] };
    }

    const firstEvent = queue.events[0]
    const releaseTime = firstEvent.time_utc;

    return {
      releaseTime, // Collect all events with the same release time
      events: queue.events.filter((e) => e.time_utc === releaseTime)
    };
  }

  /**
   * Helper method to compare arrays
   */
  private arraysEqual<T>(a: T[], b: T[]): boolean {
    return a.length === b.length && a.every((val, i) => val === b[i]);
  }

  /**
   * Stop watching events for a specific calendar
   */
  stopWatching(calendarId: string) {
    const watchKey = `${calendarId}`;
    const watched = this.watchedEventGroups.get(watchKey);

    if (watched) {
      clearTimeout(watched.timeoutId);
      this.watchedEventGroups.delete(watchKey);
    }

    // Clear the event queue for this calendar
    this.eventQueues.delete(calendarId);

    // If no more events being watched, deactivate
    if (this.watchedEventGroups.size === 0) {
      this.isActive = false;
    }
  }

  /**
   * Stop all watching
   */
  stopAllWatching() {
    this.watchedEventGroups.forEach((watched) => {
      clearTimeout(watched.timeoutId);
    });
    this.watchedEventGroups.clear();
    this.eventQueues.clear(); // Clear all event queues
    this.isActive = false;
    logger.log('🛑 Stopped all event watching');
  }

  /**
   * Clear refresh cache for a specific calendar (forces refresh on next start)
   */
  clearRefreshCache(calendarId: string) {
    try {
      localStorage.removeItem(this.getRefreshKey(calendarId));
      logger.log(`🗑️ Cleared refresh cache for calendar: ${calendarId}`);
    } catch (error) {
      logger.warn('⚠️ Error clearing refresh cache:', error);
    }
  }

  /**
   * Clear all refresh caches (forces refresh for all calendars)
   */
  clearAllRefreshCaches() {
    try {
      // Find all keys that match our pattern
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('economicEventWatcher_lastRefresh_')) {
          keysToRemove.push(key);
        }
      }

      // Remove all matching keys
      keysToRemove.forEach(key => localStorage.removeItem(key));
      logger.log(`🗑️ Cleared ${keysToRemove.length} refresh cache entries`);
    } catch (error) {
      logger.warn('⚠️ Error clearing all refresh caches:', error);
    }
  }



  /**
   * Watch a group of events that have the same release time
   */
  private watchEventGroup(eventGroup: EventTimeGroup, calendarId: string) {
    const releaseTime = new Date(eventGroup.releaseTime);
    const now = new Date();
    const timeUntilRelease = releaseTime.getTime() - now.getTime();

    if (timeUntilRelease <= 0) {
      // Events have already been released, trigger update immediately
      this.triggerEventGroupUpdate(eventGroup.events, calendarId);
      return;
    }

    const watchKey = `${calendarId}`;

    // Clear any existing timeout for this calendar
    const existing = this.watchedEventGroups.get(watchKey);
    if (existing) {
      clearTimeout(existing.timeoutId);
    }

    // Set new timeout for the entire group
    const timeoutId = setTimeout(() => {
      this.triggerEventGroupUpdate(eventGroup.events, calendarId);
    }, timeUntilRelease);

    this.watchedEventGroups.set(watchKey, {
      events: eventGroup.events,
      timeoutId,
      calendarId,
      releaseTime: eventGroup.releaseTime
    });

    logger.log(`⏰ Event group (${eventGroup.events.length} events) will be updated in ${Math.round(timeUntilRelease / 1000 / 60)} minutes`);
  }



  /**
   * Trigger an update for a group of events with the same release time
   * Uses fetch-mql5-event batch mode for efficient fetching
   */
  private async triggerEventGroupUpdate(events: EconomicEvent[], calendarId: string) {
    if (!this.callbacks || events.length === 0) return;

    try {
      logger.log(`🔄 Triggering batch update for ${events.length} event(s) releasing at the same time`);

      // Build the batch request payload
      const batchEvents = events.map((event) => {
        const country = event.country || this.currencyToCountry(event.currency);
        return {
          event_name: event.event_name,
          country: country || 'Unknown',
          originalEvent: event, // Keep reference for later
        };
      }).filter((e) => e.country !== 'Unknown');

      // Warn about events without country mapping
      const unmappedCount = events.length - batchEvents.length;
      if (unmappedCount > 0) {
        logger.warn(`⚠️ Could not determine country for ${unmappedCount} event(s)`);
      }

      const updatedEvents: EconomicEvent[] = [];

      if (batchEvents.length > 0) {
        // Call fetch-mql5-event with batch payload
        const { data, error: callError } = await supabase.functions.invoke('fetch-mql5-event', {
          body: {
            events: batchEvents.map(({ event_name, country }) => ({ event_name, country }))
          }
        });

        if (callError) {
          logger.error('❌ Error fetching batch events:', callError);
          // Fall back to original events
          updatedEvents.push(...events);
        } else {
          // Process batch results
          const responseData = data as any;
          const results = responseData?.results || [];

          logger.log(`📊 Batch fetch complete: ${responseData?.succeeded || 0} succeeded, ${responseData?.failed || 0} failed`);

          // Map results back to original events
          for (const batchEvent of batchEvents) {
            const result = results.find(
              (r: any) => r.event_name === batchEvent.event_name && r.country === batchEvent.country
            );

            if (result?.success && result.data) {
              const fetchedData = result.data;

              // Update the event with fresh data
              const eventToNotify: EconomicEvent = {
                ...batchEvent.originalEvent,
                actual_value: fetchedData.actual_value || batchEvent.originalEvent.actual_value,
                forecast_value: fetchedData.forecast_value || batchEvent.originalEvent.forecast_value,
                previous_value: fetchedData.previous_value || batchEvent.originalEvent.previous_value,
                impact: fetchedData.impact || batchEvent.originalEvent.impact,
                actual_result_type: fetchedData.actual_result_type ?? batchEvent.originalEvent.actual_result_type,
              };

              updatedEvents.push(eventToNotify);

              // Log the update
              const cached = fetchedData.cached ? ' (cached)' : ' (fresh from MQL5)';
              logger.log(`📊 Event "${batchEvent.event_name}"${cached}:`);
              logger.log(`   Actual: ${batchEvent.originalEvent.actual_value} → ${fetchedData.actual_value}`);
            } else {
              // Use original event if fetch failed
              logger.warn(`⚠️ Failed to fetch "${batchEvent.event_name}": ${result?.error || 'Unknown error'}`);
              updatedEvents.push(batchEvent.originalEvent);
            }
          }
        }
      }

      // Add unmapped events as-is
      const unmappedEvents = events.filter(
        (e) => !e.country && !this.currencyToCountry(e.currency)
      );
      updatedEvents.push(...unmappedEvents);

      // Remove the events from the queue
      const queue = this.eventQueues.get(calendarId);
      if (queue) {
        const eventIds = events.map((e) => e.id);
        queue.events = queue.events.filter((e) => !eventIds.includes(e.id)) || [];
      }

      // Notify with updated events
      this.callbacks.onEventsUpdated(updatedEvents, updatedEvents, calendarId);

      // Remove this event group from watching
      this.watchedEventGroups.delete(calendarId);

      // Continue watching if still active
      if (this.isActive) {
        // Wait a bit before watching next event group
        setTimeout(() => {
          this.continueWatching(calendarId);
        }, 5000);
      }

    } catch (err) {
      error('❌ Error updating event group:', err);
      this.callbacks.onError(err as Error, calendarId);
    }
  }

  /**
   * Map currency code to country name for MQL5 lookups
   */
  private currencyToCountry(currency: string): string | null {
    const currencyCountryMap: Record<string, string> = {
      'USD': 'United States',
      'EUR': 'Euro Area',
      'GBP': 'United Kingdom',
      'JPY': 'Japan',
      'CHF': 'Switzerland',
      'CAD': 'Canada',
      'AUD': 'Australia',
      'NZD': 'New Zealand',
      'CNY': 'China',
      'CNH': 'China',
      'HKD': 'Hong Kong',
      'SGD': 'Singapore',
      'INR': 'India',
      'KRW': 'South Korea',
      'MXN': 'Mexico',
      'BRL': 'Brazil',
      'ZAR': 'South Africa',
      'TRY': 'Turkey',
      'RUB': 'Russia',
      'SEK': 'Sweden',
      'NOK': 'Norway',
      'DKK': 'Denmark',
      'PLN': 'Poland',
    };
    return currencyCountryMap[currency] || null;
  }


  /**
   * Continue watching the next upcoming event from the queue
   */
  private async continueWatching(calendarId: string) {
    if (!this.callbacks) return;

    log(`🔄 Continuing to watch next event for calendar: ${calendarId}`);

    try {
      const queue = this.eventQueues.get(calendarId);
      if (!queue) {
        logger.log(`📅 No event queue found for calendar: ${calendarId}`);
        return;
      }

      // Note: Don't increment currentIndex here - getNextEventGroup already advanced it
      // to skip all events in the processed group

      // Check if we have more events in the queue
      if (queue.events.length > 0) {
        // Watch the next event from the existing queue
        this.watchNextEventFromQueue(calendarId);
      } else {
        // Queue exhausted, try to refresh and get more events
        logger.log(`📋 Event queue exhausted for calendar: ${calendarId}, refreshing...`);
        await this.initializeEventQueue(calendarId, queue.currencies, queue.impacts);

        // Reset index and try again
        const refreshedQueue = this.eventQueues.get(calendarId);
        if (refreshedQueue && refreshedQueue.events.length > 0) {
         
          this.watchNextEventFromQueue(calendarId);
        } else {
          logger.log('📅 No more upcoming events found for today');
          this.isActive = false;
        }
      }

    } catch (err) {
      error('❌ Error continuing event watching:', err);
      this.callbacks.onError(err as Error, calendarId);
    }
  }

  /**
   * Get current watching status
   */
  getWatchingStatus() {
    const queueStatus = Array.from(this.eventQueues.entries()).map(([calendarId, queue]) => {
      // Get refresh information for this calendar
      const lastRefreshStr = localStorage.getItem(this.getRefreshKey(calendarId));
      const lastRefresh = lastRefreshStr ? parseInt(lastRefreshStr, 10) : null;
      const timeSinceRefresh = lastRefresh ? Date.now() - lastRefresh : null;

      return {
        calendarId,
        totalEvents: queue.events.length, 
        lastFetched: new Date(queue.lastFetched).toISOString(),
        lastRefresh: lastRefresh ? new Date(lastRefresh).toISOString() : null,
        minutesSinceRefresh: timeSinceRefresh ? Math.round(timeSinceRefresh / 1000 / 60) : null,
        needsRefresh: lastRefresh ? (timeSinceRefresh! > WATCHER_CONFIG.maxRefreshAge) : true
      };
    });

    return {
      isActive: this.isActive,
      watchedEventsCount: this.watchedEventGroups.size,
      watchedEventGroups: Array.from(this.watchedEventGroups.values()).map(w => ({
        eventCount: w.events.length,
        events: w.events.map(e => e.event_name),
        releaseTime: w.releaseTime,
        calendarId: w.calendarId
      })),
      eventQueues: queueStatus,
      config: WATCHER_CONFIG
    };
  }
}

// Export singleton instance
export const economicEventWatcher = new EconomicEventWatcher();
