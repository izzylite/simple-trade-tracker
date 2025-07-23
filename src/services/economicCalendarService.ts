/**
 * Economic Calendar Service (Database-Driven)
 * Reads economic calendar data directly from Firebase database with efficient queries
 */

import {
  EconomicEvent,
  Currency,
  ImpactLevel
} from '../types/economicCalendar';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
  Timestamp,
  limit,
  startAfter,
  DocumentSnapshot,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { db } from '../firebase/config';

import { log, error, logger } from '../utils/logger';

interface PaginationOptions {
  pageSize?: number;
  lastDoc?: QueryDocumentSnapshot;
}

interface PaginatedResult {
  events: EconomicEvent[];
  hasMore: boolean;
  lastDoc?: QueryDocumentSnapshot;
  totalCount?: number;
}

class EconomicCalendarServiceImpl {
  private subscribers: Array<(events: EconomicEvent[]) => void> = [];
  private readonly DEFAULT_PAGE_SIZE = 50;

  /**
   * Fetch economic events with database queries and filtering
   */
  async fetchEvents(
    dateRange: { start: string | Date; end: string | Date },
    filters?: {
      currencies?: Currency[];
      impacts?: ImpactLevel[];
      onlyUpcoming?: boolean;
    }
  ): Promise<EconomicEvent[]> {
    try {
      log('🔄 Fetching economic calendar data from database:', dateRange, filters);


      // Build Firestore query
      let eventsQuery = this.buildBaseQuery(dateRange, filters);

      // Execute query
      const querySnapshot = await getDocs(eventsQuery);
      let events: EconomicEvent[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        events.push(this.convertToEconomicEvent(data));
      });

      // Apply client-side filtering for  impacts 
      if (filters?.impacts && filters.impacts.length > 0) {
        events = events.filter(event => filters.impacts!.includes(event.impact));
      }

      logger.log(`✅ Successfully fetched ${events.length} economic events from database`);

      // Notify subscribers
      this.notifySubscribers(events);

      return events;
    } catch (error) {
      logger.error('❌ Error fetching economic events from database:', error);
      throw error;
    }
  }
  convertToEconomicEvent(data: DocumentData): EconomicEvent {
    return {
      id: data.id,
      currency: data.currency as Currency,
      event: data.event,
      impact: data.impact as ImpactLevel,
      time: data.time?.toDate?.()?.toISOString() || data.timeUtc,
      actualResultType: data.actualResultType || '',
      timeUtc: data.timeUtc,
      actual: data.actual || '',
      forecast: data.forecast || '',
      previous: data.previous || '',
      date: data.date,
      country: data.country || '',
      flagCode: data.flagCode || '',
      flagUrl: data.flagUrl || '',
      isAllDay: false,
      unixTimestamp: data.unixTimestamp
    }
  }
  private buildBaseQuery(dateRange: { start: string | Date; end: string | Date }, filters?: {
    currencies?: Currency[];
    impacts?: ImpactLevel[];
    onlyUpcoming?: boolean;
  }) {
    // Optimized base query builder for economic events
    const baseCollection = collection(db, 'economicEvents');
    const queryConstraints = [
      where(typeof dateRange.start === 'string' ? 'date' : 'time', '>=', dateRange.start),
      where(typeof dateRange.end === 'string' ? 'date' : 'time', '<=', dateRange.end),
      orderBy(typeof dateRange.end === 'string' ? 'date' : 'time'),
      orderBy(typeof dateRange.end === 'string' ? 'time' : 'date'),
    ];

    // Add currency filter if specified
    if (filters?.currencies && filters.currencies.length > 0) {
      if (filters.currencies.length === 1) {
        queryConstraints.push(where('currency', '==', filters.currencies[0]));
      }
      else {
        queryConstraints.push(where('currency', 'in', filters.currencies));
      }
    }
     // Add impact filter if specified
    if ((filters?.impacts && filters.impacts.length > 0)) {
      if (filters.impacts.length === 1) {
        queryConstraints.push(where('impact', '==', filters.impacts[0]));
      }
      else if(!filters?.currencies || filters?.currencies.length <= 1) {
        // Only apply impact filter if no currency filter is specified
        // firebase limitation
        queryConstraints.push(where('impact', 'in', filters.impacts));
      }
    }


    // Add upcoming events filter - only show events with future dates/times
    if (filters?.onlyUpcoming) {
      const now = new Date();
      queryConstraints.push(where('time', '>=', now));
    }


    // Compose and return the query
    return query(baseCollection, ...queryConstraints);
  };


  /**
   * Fetch economic events with pagination support
   */
  async fetchEventsPaginated(
    dateRange: { start: string | Date; end: string | Date },
    options?: PaginationOptions,
    filters?: {
      currencies?: Currency[];
      impacts?: ImpactLevel[];
      onlyUpcoming?: boolean;
    }
  ): Promise<PaginatedResult> {
    try {
      const pageSize = options?.pageSize || this.DEFAULT_PAGE_SIZE;
      logger.log(`🔄 Fetching paginated economic calendar data (page size: ${pageSize}):`, dateRange, filters);


      let baseQuery = this.buildBaseQuery(dateRange, filters);

      // Add pagination
      let paginatedQuery = query(baseQuery, limit(pageSize + 1)); // +1 to check if there are more

      // Add startAfter for pagination
      if (options?.lastDoc) {
        paginatedQuery = query(baseQuery, startAfter(options.lastDoc), limit(pageSize + 1));
      }

      // Execute query
      const querySnapshot = await getDocs(paginatedQuery);
      const docs = querySnapshot.docs;

      // Check if there are more results
      const hasMore = docs.length > pageSize;
      const eventsToReturn = hasMore ? docs.slice(0, pageSize) : docs;

      let events: EconomicEvent[] = [];

      eventsToReturn.forEach((doc) => {
        const data = doc.data();
        events.push(this.convertToEconomicEvent(data));
      });

      // Apply client-side filtering for impacts
      if (filters?.impacts && filters.impacts.length > 0) {
        events = events.filter(event => filters.impacts!.includes(event.impact));
      }

      const lastDoc = eventsToReturn.length > 0 ? eventsToReturn[eventsToReturn.length - 1] : undefined;

      logger.log(`✅ Successfully fetched ${events.length} paginated events (hasMore: ${hasMore})`);

      return {
        events,
        hasMore,
        lastDoc
      };
    } catch (error) {
      logger.error('❌ Error fetching paginated economic events:', error);
      throw error;
    }
  }

  /**
   * Get upcoming events within specified hours
   */
  async getUpcomingEvents(hours: number = 24): Promise<EconomicEvent[]> {
    const now = new Date();
    const end = new Date(now.getTime() + hours * 60 * 60 * 1000);

    const events = await this.fetchEvents({
      start: now.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    });

    return events.filter(event => {
      const eventTime = new Date(event.time);
      return eventTime >= now && eventTime <= end;
    });
  }

  /**
   * Get events by impact level
   */
  async getEventsByImpact(impact: ImpactLevel[]): Promise<EconomicEvent[]> {
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    return this.fetchEvents(
      { start: today, end: nextWeek },
      { impacts: impact }
    );
  }


  /**
   * Subscribe to event updates
   */
  subscribeToUpdates(callback: (events: EconomicEvent[]) => void): () => void {
    this.subscribers.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to real-time updates from database
   */
  subscribeToEvents(
    dateRange: { start: string; end: string },
    callback: (events: EconomicEvent[]) => void,
    filters?: {
      currencies?: Currency[];
      impacts?: ImpactLevel[];
      onlyUpcoming?: boolean;
    }
  ): () => void {
    logger.log('� Setting up real-time subscription for economic events');

    // Build Firestore query
    const eventsQuery = query(this.buildBaseQuery(dateRange, filters), limit(10));

    // Set up real-time listener
    const unsubscribe = onSnapshot(eventsQuery, (querySnapshot) => {
      let events: EconomicEvent[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        events.push(this.convertToEconomicEvent(data));
      });


      log(`🔄 Real-time update: ${events.length} events`);
      callback(events);
      this.notifySubscribers(events);
    }, (err) => {
      error('❌ Error in real-time subscription:', err);
    });

    return unsubscribe;
  }

  /**
   * Get a specific economic event by ID
   */
  async getEventById(eventId: string): Promise<EconomicEvent | null> {
    try {
      logger.log(`Fetching economic event by ID: ${eventId}`);
      const eventsRef = collection(db, 'economicEvents');
      const q = query(eventsRef, where('id', '==', eventId));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        logger.log(`No economic event found with ID: ${eventId}`);
        return null;
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data();

      const event: EconomicEvent = this.convertToEconomicEvent(data);
      logger.log(`Successfully fetched economic event: ${event.event}`);
      return event;

    } catch (err) {
      error('Error fetching economic event by ID:', err);
      return null;
    }
  }

  /**
   * Notify all subscribers of new events
   */
  private notifySubscribers(events: EconomicEvent[]): void {
    this.subscribers.forEach(callback => {
      try {
        callback(events);
      } catch (err) {
        error('Error notifying subscriber:', err);
      }
    });
  }
}

// Export singleton instance
export const economicCalendarService = new EconomicCalendarServiceImpl();
