/**
 * Economic Calendar Service (Supabase)
 * Reads economic calendar data from Supabase database with efficient queries
 */

import {
  EconomicEvent,
  Currency,
  ImpactLevel
} from '../types/economicCalendar';
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
      limit?: number;
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

      logger.log(`Successfully fetched economic event: ${result.data.event_name}`);
      return result.data;

    } catch (err) {
      error('Error fetching economic event by ID:', err);
      return null;
    }
  }

}

// Export singleton instance
export const economicCalendarService = new EconomicCalendarServiceImpl();
