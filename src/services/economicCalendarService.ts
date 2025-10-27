/**
 * Economic Calendar Service (Supabase)
 * Reads economic calendar data from Supabase database with efficient queries
 */

import {
  EconomicEvent,
  Currency,
  ImpactLevel
} from '../types/economicCalendar';
import { supabase } from '../config/supabase';
import { log, error, logger } from '../utils/logger';
import { EconomicEventRepository } from './repository/repositories/EconomicEventRepository';

/* eslint-disable */

const economicEventRepository = new EconomicEventRepository();

interface PaginationOptions {
  pageSize?: number;
  offset?: number;
}

interface PaginatedResult {
  events: EconomicEvent[];
  hasMore: boolean;
  offset?: number;
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

      const result = await economicEventRepository.fetchEvents(dateRange, filters);

      if (!result.success || !result.data) {
        logger.error('❌ Error fetching economic events from database:', result.error);
        return [];
      }

      logger.log(`✅ Successfully fetched ${result.data.length} economic events from database`);

      // Notify subscribers
      this.notifySubscribers(result.data);

      return result.data;
    } catch (error) {
      logger.error('❌ Error fetching economic events from database:', error);
      return [];
    }
  }


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
      const offset = options?.offset || 0;
      logger.log(`🔄 Fetching paginated economic calendar data (page size: ${pageSize}, offset: ${offset}):`, dateRange, filters);

      const result = await economicEventRepository.fetchEventsPaginated(
        dateRange,
        { pageSize, offset },
        filters
      );

      if (!result.success || !result.data) {
        logger.error('❌ Error fetching paginated economic events:', result.error);
        return {
          events: [],
          hasMore: false,
          offset: 0,
          totalCount: 0
        };
      }

      logger.log(`✅ Successfully fetched ${result.data.events.length} paginated events (hasMore: ${result.data.hasMore})`);

      return result.data;
    } catch (error) {
      logger.error('❌ Error fetching paginated economic events:', error);
      return {
        events: [],
        hasMore: false,
        offset: 0,
        totalCount: 0
      };
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
    logger.log('📡 Setting up real-time subscription for economic events');

    // Set up Supabase real-time subscription
    const channel = supabase
      .channel('economic-events-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'economic_events',
          filter: `event_date=gte.${dateRange.start},event_date=lte.${dateRange.end}`
        },
        async (payload) => {
          log(`🔄 Real-time update received:`, payload);

          // Fetch fresh data when changes occur
          const events = await this.fetchEvents(dateRange, filters);
          callback(events);
        }
      )
      .subscribe();

    // Return unsubscribe function
    return () => {
      supabase.removeChannel(channel);
    };
  }

  /**
   * Get a specific economic event by ID
   */
  async getEventById(eventId: string): Promise<EconomicEvent | null> {
    try {
      logger.log(`Fetching economic event by ID: ${eventId}`);

      const result = await economicEventRepository.findById(eventId);

      if (!result.success || !result.data) {
        logger.log(`No economic event found with ID: ${eventId}`);
        return null;
      }

      logger.log(`Successfully fetched economic event: ${result.data.event}`);
      return result.data;

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
