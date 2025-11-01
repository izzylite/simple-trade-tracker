/**
 * Economic Event Repository
 * Handles all database operations for economic calendar events
 */

import { supabase } from '../../../config/supabase';
import { supabaseAuthService } from '../../supabaseAuthService';

import { AbstractBaseRepository, RepositoryResult } from './BaseRepository';
import { EconomicEvent, Currency, ImpactLevel } from '../../../types/economicCalendar';
import { handleSupabaseError } from '../../../utils/supabaseErrorHandler';
import { logger } from '../../../utils/logger';

/**
 * Pagination options for fetching events
 */
export interface PaginationOptions {
  pageSize?: number;
  offset?: number;
}

/**
 * Paginated result for economic events
 */
export interface PaginatedResult {
  events: EconomicEvent[];
  hasMore: boolean;
  totalCount?: number;
  offset?: number;
}

/**
 * Filter options for economic events
 */
export interface EconomicEventFilters {
  currencies?: Currency[];
  impacts?: ImpactLevel[];
  onlyUpcoming?: boolean;
}

/**
 * Economic Event entity for database operations
 * Note: EconomicEvent doesn't extend BaseEntity as it has different structure
 */
export class EconomicEventRepository {
  private readonly DEFAULT_PAGE_SIZE = 50;

  /**
   * Transform database row to EconomicEvent
   */
  private transformToEvent(row: any): EconomicEvent {
    return {
      id: row.id,
      external_id: row.external_id, // Include external_id for event matching
      event_name: row.event_name || row.title || row.event || '',
      country: row.country || '',
      event_date: row.event_date || row.trade_date,
      event_time: row.event_time || row.time || '',
      time_utc: row.time_utc || row.timeUtc || '',
      impact: row.impact as ImpactLevel,
      actual_result_type: row.actual_result_type || row.actualResultType || '',
      forecast_value: row.forecast_value || row.forecast || '',
      previous_value: row.previous_value || row.previous || '',
      actual_value: row.actual_value || row.actual || '',
      currency: row.currency as Currency,
      flag_code: row.flag_code || row.flagCode || '',
      flag_url: row.flag_url || row.flagUrl || '',
      is_all_day: row.is_all_day || row.isAllDay || false,
      unix_timestamp: row.unix_timestamp || row.unixTimestamp
    };
  }

  /**
   * Fetch events with pagination
   */
  async fetchEventsPaginated(
    dateRange: { start: string | Date; end: string | Date },
    options: PaginationOptions = {},
    filters?: EconomicEventFilters
  ): Promise<RepositoryResult<PaginatedResult>> {
    // Ensure session is valid (handles tab background expiry)
    await supabaseAuthService.ensureValidSession();

    const pageSize = options?.pageSize || this.DEFAULT_PAGE_SIZE;
    const offset = options?.offset || 0;

    try {
      logger.log(`🔄 Fetching events from database (offset: ${offset}, pageSize: ${pageSize}):`, dateRange, filters);

      // Convert dates to ISO strings
      const startDate = typeof dateRange.start === 'string' ? dateRange.start : dateRange.start.toISOString().split('T')[0];
      const endDate = typeof dateRange.end === 'string' ? dateRange.end : dateRange.end.toISOString().split('T')[0];

      // Build Supabase query
      let query = supabase
        .from('economic_events')
        .select('*', { count: 'exact' })
        .gte('event_date', startDate)
        .lte('event_date', endDate)
        .order('event_date', { ascending: true })
        .order('time_utc', { ascending: true })
        .range(offset, offset + pageSize - 1);

      // Apply currency filter
      if (filters?.currencies && filters.currencies.length > 0) {
        query = query.in('currency', filters.currencies);
      }

      // Apply impact filter
      if (filters?.impacts && filters.impacts.length > 0) {
        query = query.in('impact', filters.impacts);
      }

      // Apply upcoming events filter (events in the future)
      if (filters?.onlyUpcoming) {
        const now = new Date().toISOString();
        query = query.gte('time_utc', now);
      }

      const { data, count, error } = await query;

      if (error) {
        throw error;
      }

      // Transform data to EconomicEvent format
      const events: EconomicEvent[] = (data || []).map(row => this.transformToEvent(row));

      const hasMore = (count || 0) > offset + pageSize;

      return {
        success: true,
        data: {
          events,
          hasMore,
          totalCount: count || 0,
          offset: offset + pageSize
        },
        timestamp: new Date()
      };
    } catch (error: any) {
      const supabaseError = handleSupabaseError(
        error,
        `Fetching events for ${dateRange.start} to ${dateRange.end}`,
        'fetchEventsPaginated'
      );

      logger.error('Failed to fetch events:', supabaseError);

      return {
        success: false,
        error: supabaseError,
        operation: 'fetchEventsPaginated',
        timestamp: new Date()
      };
    }
  }

  /**
   * Fetch all events in a date range (without pagination)
   */
  async fetchEvents(
    dateRange: { start: string | Date; end: string | Date },
    filters?: EconomicEventFilters
  ): Promise<RepositoryResult<EconomicEvent[]>> {
    try {
      // Ensure session is valid before fetching
      await supabaseAuthService.ensureValidSession();

      logger.log('🔄 Fetching all events from database:', dateRange, filters);

      // Use paginated method with large page size
      const result = await this.fetchEventsPaginated(dateRange, { pageSize: 1000 }, filters);

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error,
          operation: 'fetchEvents',
          timestamp: new Date()
        };
      }

      return {
        success: true,
        data: result.data.events,
        timestamp: new Date()
      };
    } catch (error: any) {
      const supabaseError = handleSupabaseError(
        error,
        `Fetching all events for ${dateRange.start} to ${dateRange.end}`,
        'fetchEvents'
      );

      return {
        success: false,
        error: supabaseError,
        operation: 'fetchEvents',
        timestamp: new Date()
      };
    }
  }

  /**
   * Get a specific event by ID
   */
  async findById(eventId: string): Promise<RepositoryResult<EconomicEvent | null>> {
    try {
      // Ensure session is valid before fetching by ID
      await supabaseAuthService.ensureValidSession();

      logger.log(`Fetching economic event by ID: ${eventId}`);

      const { data, error } = await supabase
        .from('economic_events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        return {
          success: true,
          data: null,
          timestamp: new Date()
        };
      }

      const event = this.transformToEvent(data);

      return {
        success: true,
        data: event,
        timestamp: new Date()
      };
    } catch (error: any) {
      const supabaseError = handleSupabaseError(
        error,
        `Fetching event with ID: ${eventId}`,
        'findById'
      );

      return {
        success: false,
        error: supabaseError,
        operation: 'findById',
        timestamp: new Date()
      };
    }
  }

  /**
   * Search events by query string
   */
  async searchEvents(query: string): Promise<RepositoryResult<EconomicEvent[]>> {
    try {
      // Ensure session is valid before searching
      await supabaseAuthService.ensureValidSession();

      const { data, error } = await supabase
        .from('economic_events')
        .select('*')
        .ilike('event_name', `%${query}%`)
        .order('event_date', { ascending: false })
        .limit(50);

      if (error) {
        throw error;
      }

      const events = (data || []).map(row => this.transformToEvent(row));

      return {
        success: true,
        data: events,
        timestamp: new Date()
      };
    } catch (error: any) {
      const supabaseError = handleSupabaseError(
        error,
        `Searching events with query: ${query}`,
        'searchEvents'
      );

      return {
        success: false,
        error: supabaseError,
        operation: 'searchEvents',
        timestamp: new Date()
      };
    }
  }
}

// Export singleton instance
export const economicEventRepository = new EconomicEventRepository();

