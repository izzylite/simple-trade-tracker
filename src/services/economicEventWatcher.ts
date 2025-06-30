/**
 * Smart Economic Event Watcher Service
 * Monitors upcoming events and triggers updates when they occur
 */

import { EconomicEvent, Currency, ImpactLevel } from '../types/economicCalendar';
import { economicCalendarService } from './economicCalendarService';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import { endOfDay, format, startOfDay } from 'date-fns';

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
  currentIndex: number;
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
      console.log(`📊 Last refresh for calendar ${calendarId}: ${Math.round(timeSinceRefresh / 1000 / 60)} minutes ago. Should refresh: ${shouldRefresh}`);

      return shouldRefresh;
    } catch (error) {
      console.warn('⚠️ Error checking refresh time from localStorage:', error);
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
      console.warn('⚠️ Error saving refresh time to localStorage:', error);
    }
  }

  /**
   * Initialize the watcher with callbacks
   */
  initialize(callbacks: EventWatcherCallbacks) {
    this.callbacks = callbacks;
    console.log('📊 Economic Event Watcher initialized');
  }

  /**
   * Start watching events for a specific calendar
   */
  async startWatching(calendarId: string, economicCalendarFilters?: any) {
    if (!this.callbacks) {
      console.warn('⚠️ Event watcher not initialized');
      return;
    }

    this.isActive = true;
    console.log(`🔍 Starting event watching for calendar: ${calendarId}`);

    // Get currencies from calendar filters or use defaults
    const currencies = economicCalendarFilters?.currencies || DEFAULT_FILTER_SETTINGS.currencies;
    const impacts = economicCalendarFilters?.impacts || DEFAULT_FILTER_SETTINGS.impacts;

    try {
      // First, refresh economic calendar data to ensure we have the latest information
      if (this.shouldRefreshData(calendarId)) {
        this.refreshCalendarData(currencies, calendarId);
      } else {
        console.log(`⏭️ Skipping refresh for calendar ${calendarId} - data is still fresh`);
      }

      // Initialize or refresh the event queue for this calendar
      await this.initializeEventQueue(calendarId, currencies, impacts);

      // Start watching the next event from the queue
      this.watchNextEventFromQueue(calendarId);

    } catch (error) {
      console.error('❌ Error starting event watcher:', error);
      this.callbacks.onError(error as Error, calendarId);
    }
  }

  /**
   * Refresh economic calendar data by calling the cloud function
   */
  private async refreshCalendarData(currencies: Currency[], calendarId: string) {
    try {
      console.log(`🔄 Refreshing economic calendar data for calendar ${calendarId}, currencies: ${currencies.join(', ')}`);

      const today = new Date();
      const targetDate = format(today, 'yyyy-MM-dd');

      // Call cloud function to refresh today's economic calendar data
      const refreshEconomicCalendar = httpsCallable(functions, 'refreshEconomicCalendar');
      const result = await refreshEconomicCalendar({
        targetDate,
        currencies
        // No specific events - refresh all events for today
      });

      const responseData = result.data as any;
      const updatedCount = responseData?.updatedCount || 0;
      const foundEventsCount = responseData?.foundEvents?.length || 0;

      console.log(`✅ Economic calendar refreshed for calendar ${calendarId}: ${updatedCount} total events updated`);
      if (foundEventsCount > 0) {
        console.log(`📊 Found ${foundEventsCount} events with current data`);
      }

      // Save the refresh time to localStorage
      this.saveRefreshTime(calendarId);

    } catch (error) {
      console.error('❌ Error refreshing economic calendar data:', error);
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
      console.log(`📊 Fetching fresh events for calendar: ${calendarId}`);

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
        { pageSize: 100 }, // Might not actually be 100. Depending on the events for the day
        { currencies, impacts, onlyUpcoming: true },
      );

      // Filter and sort upcoming events
      const currentDate = new Date();
      const upcomingEvents = todaysEvents.events
        .filter(event => new Date(event.timeUtc) > currentDate)
        .sort((a, b) => new Date(a.timeUtc).getTime() - new Date(b.timeUtc).getTime());

      // Store in memory queue
      this.eventQueues.set(calendarId, {
        events: upcomingEvents,
        currentIndex: 0,
        lastFetched: now,
        currencies,
        impacts
      });

      console.log(`📋 Cached ${upcomingEvents.length} upcoming events for calendar: ${calendarId} ${todaysEvents.events.length}`);
    } else {
      console.log(`📋 Using cached events for calendar: ${calendarId}`);
    }
  }

  /**
   * Watch the next event group from the calendar's queue
   */
  private watchNextEventFromQueue(calendarId: string) {
    const queue = this.eventQueues.get(calendarId);
    if (!queue || queue.currentIndex >= queue.events.length) {
      console.log(`📅 No more events to watch for calendar: ${calendarId}`);
      this.isActive = false;
      return;
    }

    // Group events by release time starting from current index
    const eventGroup = this.getNextEventGroup(queue);
    if (eventGroup.events.length === 0) {
      console.log(`📅 No more event groups to watch for calendar: ${calendarId}`);
      this.isActive = false;
      return;
    }

    this.watchEventGroup(eventGroup, calendarId);
    console.log(`⏰ Watching ${eventGroup.events.length} event(s) releasing at ${eventGroup.releaseTime} for calendar: ${calendarId}`);
    eventGroup.events.forEach((event, index) => {
      console.log(`   ${index + 1}. ${event.event}`);
    });
  }

  /**
   * Get the next group of events that have the same release time
   */
  private getNextEventGroup(queue: CalendarEventQueue): EventTimeGroup {
    if (queue.currentIndex >= queue.events.length) {
      return { releaseTime: '', events: [] };
    }

    const firstEvent = queue.events[queue.currentIndex];
    const releaseTime = firstEvent.timeUtc;
    const eventsAtSameTime: EconomicEvent[] = [];

    // Collect all events with the same release time
    let index = queue.currentIndex;
    while (index < queue.events.length && queue.events[index].timeUtc === releaseTime) {
      eventsAtSameTime.push(queue.events[index]);
      index++;
    }

    // Update the queue's current index to skip all events we just collected
    queue.currentIndex = index;

    return {
      releaseTime,
      events: eventsAtSameTime
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
      console.log(`🛑 Stopped watching events for calendar: ${calendarId}`);
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
    console.log('🛑 Stopped all event watching');
  }

  /**
   * Clear refresh cache for a specific calendar (forces refresh on next start)
   */
  clearRefreshCache(calendarId: string) {
    try {
      localStorage.removeItem(this.getRefreshKey(calendarId));
      console.log(`🗑️ Cleared refresh cache for calendar: ${calendarId}`);
    } catch (error) {
      console.warn('⚠️ Error clearing refresh cache:', error);
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
      console.log(`🗑️ Cleared ${keysToRemove.length} refresh cache entries`);
    } catch (error) {
      console.warn('⚠️ Error clearing all refresh caches:', error);
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

    console.log(`⏰ Event group (${eventGroup.events.length} events) will be updated in ${Math.round(timeUntilRelease / 1000 / 60)} minutes`);
  }



  /**
   * Trigger an update for a group of events with the same release time
   */
  private async triggerEventGroupUpdate(events: EconomicEvent[], calendarId: string) {
    if (!this.callbacks || events.length === 0) return;

    try {
      console.log(`🔄 Triggering update for ${events.length} event(s) releasing at the same time`);

      // Get unique currencies from the event group
      const currencySet = new Set(events.map(e => e.currency));
      const currencies = Array.from(currencySet);
      const targetDate = events[0].date; // All events should have the same date

      // Call cloud function to refresh economic calendar data for all events
      const refreshEconomicCalendar = httpsCallable(functions, 'refreshEconomicCalendar');
      const result = await refreshEconomicCalendar({
        targetDate,
        currencies,
        events // Pass the entire events list
      });

      // Extract updated events from the cloud function result
      const responseData = result.data as any;
      const targetEvents: EconomicEvent[] = responseData?.targetEvents || [];
      const foundEvents: EconomicEvent[] = responseData?.foundEvents || [];

      console.log(`📊 Cloud function returned ${targetEvents.length} total events, ${foundEvents.length} specifically requested events`);

      // Process each event in the group
      const updatedEvents: EconomicEvent[] = [];
      for (const originalEvent of events) {
        // First try to find in foundEvents (more specific), then fall back to targetEvents
        let updatedEvent = foundEvents.find(e => e.id === originalEvent.id);
        if (!updatedEvent) {
          updatedEvent = targetEvents.find(e => e.id === originalEvent.id);
        }

        const eventToNotify: EconomicEvent = updatedEvent ? {
          ...originalEvent,
          actual: updatedEvent.actual || originalEvent.actual,
          forecast: updatedEvent.forecast || originalEvent.forecast,
          previous: updatedEvent.previous || originalEvent.previous
        } : originalEvent;

        updatedEvents.push(eventToNotify);

        // Log individual event updates
        if (updatedEvent) {
          console.log(`📊 Event "${originalEvent.event}" updated successfully:`);
          console.log(`   Actual: ${originalEvent.actual} → ${updatedEvent.actual}`);
          console.log(`   Forecast: ${originalEvent.forecast} → ${updatedEvent.forecast}`);
          console.log(`   Previous: ${originalEvent.previous} → ${updatedEvent.previous}`);
        } else {
          console.log(`⚠️ Event "${originalEvent.event}" not found in updated results, using original data`);
        }
      }

      this.callbacks.onEventsUpdated(updatedEvents, targetEvents, calendarId);

      // Remove this event group from watching
      this.watchedEventGroups.delete(calendarId);

      // Continue watching if still active
      if (this.isActive) {
        // Wait a bit for the cloud function to complete, then start watching next event group
        setTimeout(() => {
          this.continueWatching(calendarId);
        }, 5000);
      }

    } catch (error) {
      console.error('❌ Error updating event group:', error);
      this.callbacks.onError(error as Error, calendarId);
    }
  }


  /**
   * Continue watching the next upcoming event from the queue
   */
  private async continueWatching(calendarId: string) {
    if (!this.callbacks) return;

    console.log(`🔄 Continuing to watch next event for calendar: ${calendarId}`);

    try {
      const queue = this.eventQueues.get(calendarId);
      if (!queue) {
        console.log(`📅 No event queue found for calendar: ${calendarId}`);
        return;
      }

      // Move to the next event in the queue
      queue.currentIndex++;

      // Check if we have more events in the queue
      if (queue.currentIndex < queue.events.length) {
        // Watch the next event from the existing queue
        this.watchNextEventFromQueue(calendarId);
      } else {
        // Queue exhausted, try to refresh and get more events
        console.log(`📋 Event queue exhausted for calendar: ${calendarId}, refreshing...`);
        await this.initializeEventQueue(calendarId, queue.currencies, queue.impacts);

        // Reset index and try again
        const refreshedQueue = this.eventQueues.get(calendarId);
        if (refreshedQueue && refreshedQueue.events.length > 0) {
          refreshedQueue.currentIndex = 0;
          this.watchNextEventFromQueue(calendarId);
        } else {
          console.log('📅 No more upcoming events found for today');
          this.isActive = false;
        }
      }

    } catch (error) {
      console.error('❌ Error continuing event watching:', error);
      this.callbacks.onError(error as Error, calendarId);
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
        currentIndex: queue.currentIndex,
        remainingEvents: queue.events.length - queue.currentIndex,
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
        events: w.events.map(e => e.event),
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
