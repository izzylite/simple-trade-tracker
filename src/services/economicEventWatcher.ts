/**
 * Smart Economic Event Watcher Service
 * Monitors upcoming events and triggers updates when they occur
 */

import { EconomicEvent, Currency, ImpactLevel } from '../types/economicCalendar';
import { economicCalendarService } from './economicCalendarService';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

// Default filter settings to use when no calendar filters are available
const DEFAULT_FILTER_SETTINGS = {
  currencies: ['USD', 'EUR', 'GBP'] as Currency[],
  impacts: ['High', 'Medium', 'Low'] as ImpactLevel[],
  viewType: 'day' as const
};

interface WatchedEvent {
  event: EconomicEvent;
  timeoutId: NodeJS.Timeout;
  calendarId: string;
}

interface EventWatcherCallbacks {
  onEventUpdated: (event: EconomicEvent, calendarId: string) => void;
  onError: (error: Error, calendarId: string) => void;
}

interface CalendarEventQueue {
  events: EconomicEvent[];
  currentIndex: number;
  lastFetched: number;
  currencies: Currency[];
  impacts: ImpactLevel[];
}

class EconomicEventWatcher {
  private watchedEvents: Map<string, WatchedEvent> = new Map();
  private callbacks: EventWatcherCallbacks | null = null;
  private isActive = false;
  private eventQueues: Map<string, CalendarEventQueue> = new Map(); // Memory cache per calendar

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
      const dateRange = {
        start: today.toISOString().split('T')[0],
        end: today.toISOString().split('T')[0]
      };

      const todaysEvents = await economicCalendarService.fetchEventsPaginated(
        dateRange,
        { pageSize: 100 }, // Might not actually be 100. Depending on the events for the day
        { currencies, impacts }
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

      console.log(`📋 Cached ${upcomingEvents.length} upcoming events for calendar: ${calendarId}`);
    } else {
      console.log(`📋 Using cached events for calendar: ${calendarId}`);
    }
  }

  /**
   * Watch the next event from the calendar's queue
   */
  private watchNextEventFromQueue(calendarId: string) {
    const queue = this.eventQueues.get(calendarId);
    if (!queue || queue.currentIndex >= queue.events.length) {
      console.log(`📅 No more events to watch for calendar: ${calendarId}`);
      this.isActive = false;
      return;
    }

    const nextEvent = queue.events[queue.currentIndex];
    this.watchEvent(nextEvent, calendarId);
    console.log(`⏰ Watching event ${queue.currentIndex + 1}/${queue.events.length}: ${nextEvent.event} at ${nextEvent.timeUtc}`);
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
    const watched = this.watchedEvents.get(watchKey);

    if (watched) {
      clearTimeout(watched.timeoutId);
      this.watchedEvents.delete(watchKey);
      console.log(`🛑 Stopped watching events for calendar: ${calendarId}`);
    }

    // Clear the event queue for this calendar
    this.eventQueues.delete(calendarId);

    // If no more events being watched, deactivate
    if (this.watchedEvents.size === 0) {
      this.isActive = false;
    }
  }

  /**
   * Stop all watching
   */
  stopAllWatching() {
    this.watchedEvents.forEach((watched) => {
      clearTimeout(watched.timeoutId);
    });
    this.watchedEvents.clear();
    this.eventQueues.clear(); // Clear all event queues
    this.isActive = false;
    console.log('🛑 Stopped all event watching');
  }



  /**
   * Watch a specific event and trigger update when it occurs
   */
  private watchEvent(event: EconomicEvent, calendarId: string) {
    const eventTime = new Date(event.timeUtc);
    const now = new Date();
    const timeUntilEvent = eventTime.getTime() - now.getTime();

    // Add a small buffer (30 seconds) after the event time to allow for data updates
    const timeUntilUpdate = timeUntilEvent + (30 * 1000);

    if (timeUntilUpdate <= 0) {
      // Event has already passed, trigger update immediately
      this.triggerEventUpdate(event, calendarId);
      return;
    }

    const watchKey = `${calendarId}`;
    
    // Clear any existing timeout for this calendar
    const existing = this.watchedEvents.get(watchKey);
    if (existing) {
      clearTimeout(existing.timeoutId);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       
    }

    // Set new timeout
    const timeoutId = setTimeout(() => {
      this.triggerEventUpdate(event, calendarId);
    }, timeUntilUpdate);

    this.watchedEvents.set(watchKey, {
      event,
      timeoutId,
      calendarId
    });

    console.log(`⏰ Event "${event.event}" will be updated in ${Math.round(timeUntilUpdate / 1000 / 60)} minutes`);
  }

  /**
   * Trigger an update for a specific event
   */
  private async triggerEventUpdate(event: EconomicEvent, calendarId: string) {
    if (!this.callbacks) return;

    try {
      console.log(`🔄 Triggering update for event: ${event.event}`);

      // Call cloud function to refresh economic calendar data with specific event ID
      const refreshEconomicCalendar = httpsCallable(functions, 'refreshEconomicCalendar');
      const result = await refreshEconomicCalendar({
        targetDate: event.date,
        currencies: [event.currency],
        eventId: event.id,
        eventName: event.event // Optional for logging purposes
      });

      // Extract the specific updated event from the cloud function result
      const responseData = result.data as any;
      const updatedEvent = responseData?.updatedEvent;

      // Use the updated event data if found, otherwise fall back to original
      const eventToNotify: EconomicEvent = updatedEvent ? {
        ...event,
        actual: updatedEvent.actual || event.actual,
        forecast: updatedEvent.forecast || event.forecast,
        previous: updatedEvent.previous || event.previous
      } : event;

      // Log the update details
      if (updatedEvent) {
        console.log(`📊 Event "${event.event}" updated successfully:`);
        console.log(`   Original - Actual: ${event.actual}, Forecast: ${event.forecast}, Previous: ${event.previous}`);
        console.log(`   Updated  - Actual: ${eventToNotify.actual}, Forecast: ${eventToNotify.forecast}, Previous: ${eventToNotify.previous}`);
      } else {
        console.log(`⚠️ Event "${event.event}" not found in updated results, using original data`);
      }

      // Notify that the event was updated with fresh data
      this.callbacks.onEventUpdated(eventToNotify, calendarId);

      // Remove this event from watching and find the next one
      this.watchedEvents.delete(calendarId);

      // Continue watching if still active
      if (this.isActive) {
        // Wait a bit for the cloud function to complete, then start watching next event
        setTimeout(() => {
          this.continueWatching(calendarId);
        }, 5000);
      }

    } catch (error) {
      console.error('❌ Error updating event:', error);
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
    const queueStatus = Array.from(this.eventQueues.entries()).map(([calendarId, queue]) => ({
      calendarId,
      totalEvents: queue.events.length,
      currentIndex: queue.currentIndex,
      remainingEvents: queue.events.length - queue.currentIndex,
      lastFetched: new Date(queue.lastFetched).toISOString()
    }));

    return {
      isActive: this.isActive,
      watchedEventsCount: this.watchedEvents.size,
      watchedEvents: Array.from(this.watchedEvents.values()).map(w => ({
        event: w.event.event,
        time: w.event.timeUtc,
        calendarId: w.calendarId
      })),
      eventQueues: queueStatus
    };
  }
}

// Export singleton instance
export const economicEventWatcher = new EconomicEventWatcher();
