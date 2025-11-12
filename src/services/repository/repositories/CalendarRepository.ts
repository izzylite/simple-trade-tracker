/**
 * Calendar Repository
 * Handles Supabase operations for calendar entities
 */

import {
  AbstractBaseRepository,
  RepositoryConfig
} from './BaseRepository';
import { Calendar, Trade } from '../../../types/dualWrite';
import { logger } from '../../../utils/logger';

// Supabase imports
import { supabase } from '../../../config/supabase';
import { supabaseAuthService } from '../../supabaseAuthService';


/**
 * Safely parse a date value, returning a valid Date or fallback
 */
const parseDate = (dateValue: any, fallback: Date = new Date()): Date => {
  if (!dateValue) return fallback;
  const parsed = new Date(dateValue);
  return isNaN(parsed.getTime()) ? fallback : parsed;
};

/**
 * Safely parse an optional date value, returning Date or undefined
 */
const parseOptionalDate = (dateValue: any): Date | undefined => {
  if (!dateValue) return undefined;
  const parsed = new Date(dateValue);
  return isNaN(parsed.getTime()) ? undefined : parsed;
};

/**
 * Transform Supabase calendar data to Calendar type
 * Converts string dates to Date objects with validation
 */
const transformSupabaseCalendar = (data: any): Calendar => {
  return {
    ...data,
    created_at: parseDate(data.created_at),
    updated_at: parseDate(data.updated_at),
    deleted_at: parseOptionalDate(data.deleted_at),
    auto_delete_at: parseOptionalDate(data.auto_delete_at),
    shared_at: parseOptionalDate(data.shared_at),
    drawdown_start_date: parseOptionalDate(data.drawdown_start_date),
    drawdown_end_date: parseOptionalDate(data.drawdown_end_date),
  } as Calendar;
};

export class CalendarRepository extends AbstractBaseRepository<Calendar> {
  constructor(config?: Partial<RepositoryConfig>) {
    super(config);
  }

  // =====================================================
  // READ OPERATIONS
  // =====================================================

  async findById(id: string): Promise<Calendar | null> {
    try {
      // Ensure session is valid before fetching calendar by ID
      await supabaseAuthService.ensureValidSession();

      const { data, error } = await supabase
        .from('calendars')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        logger.error('Error finding calendar by ID:', error);
        return null;
      }

      return data ? transformSupabaseCalendar(data) : null;
    } catch (error) {
      logger.error('Error finding calendar by ID:', error);
      return null;
    }
  }

  async findByUserId(userId: string): Promise<Calendar[]> {
    try {
      // Ensure session is valid before fetching calendars by user
      await supabaseAuthService.ensureValidSession();

      const { data, error } = await supabase
        .from('calendars')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .neq('mark_for_deletion', true)
        .order('updated_at', { ascending: false }); // Order by most recently updated first

      if (error) {
        logger.error('Error finding calendars by user ID:', error);
        return [];
      }

      return data ? data.map(item => transformSupabaseCalendar(item)) : [];
    } catch (error) {
      logger.error('Exception finding calendars by user ID:', error);
      return [];
    }
  }

  async findAll(): Promise<Calendar[]> {
    try {
      // Ensure session is valid before fetching all calendars
      await supabaseAuthService.ensureValidSession();

      const { data, error } = await supabase
        .from('calendars')
        .select('*');

      if (error) {
        logger.error('Error finding all calendars:', error);
        return [];
      }

      return data ? data.map(item => transformSupabaseCalendar(item)) : [];
    } catch (error) {
      logger.error('Error finding all calendars:', error);
      return [];
    }
  }

  // =====================================================
  // SUPABASE OPERATIONS
  // =====================================================

  protected async createInSupabase(entity: Omit<Calendar, 'id' | 'created_at' | 'updated_at'>): Promise<Calendar> {
    const now = new Date();
    const calendarWithTimestamps = {
      ...entity,
      created_at: now,
      updated_at: now
    } as Calendar;

    const { data, error } = await supabase
      .from('calendars')
      .insert(calendarWithTimestamps)
      .select()
      .single();

    if (error) {
      throw error; // Let the error handler parse this
    }

    return transformSupabaseCalendar(data);
  }

  protected async updateInSupabase(id: string, updates: Partial<Calendar>): Promise<Calendar> {
    const updatesWithTimestamp = {
      ...updates,
      updated_at: new Date()
    };
    if(updatesWithTimestamp.dynamic_risk_enabled === false){
      updatesWithTimestamp.profit_threshold_percentage = 0;
      updatesWithTimestamp.increased_risk_percentage = 0;
    }

    const { data, error } = await supabase
      .from('calendars')
      .update(updatesWithTimestamp)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error; // Let the error handler parse this
    }

    return transformSupabaseCalendar(data);
  }

  /**
   * HARD DELETE - Permanently removes calendar from database
   */
  protected async deleteInSupabase(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('calendars')
      .update({ mark_for_deletion: true, deletion_date: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      throw error; // Let the error handler parse this
    }

    return true;
  }

  /**
   * Get calendars in trash (soft deleted but not marked for deletion)
   * Returns calendars that have deleted_at set but mark_for_deletion is false/null
   */
  async findTrashByUserId(userId: string): Promise<Calendar[]> {
    try {
      // Ensure session is valid before fetching trashed calendars
      await supabaseAuthService.ensureValidSession();

      const { data, error } = await supabase
        .from('calendars')
        .select('*')
        .eq('user_id', userId)
        .not('deleted_at', 'is', null) // Has been soft deleted
        .neq('mark_for_deletion', true) // Not marked for final deletion
        .order('updated_at', { ascending: false }); // Order by most recently updated first

      if (error) {
        logger.error('Error finding trash calendars by user ID:', error);
        return [];
      }

      return data ? data.map(item => transformSupabaseCalendar(item)) : [];
    } catch (error) {
      logger.error('Error finding trash calendars by user ID:', error);
      return [];
    }
  }

  /**
   * Calculate calendar statistics with optional trades parameter
   * When trades are provided, returns calculated stats WITHOUT updating the database
   * When trades are not provided, calculates and updates stats in the database
   *
   * @param calendarId - Calendar ID to calculate stats for
   * @param trades - Optional array of trades to use for calculation
   * @returns Promise with calculated stats (when trades provided) or void (when updating database)
   *
   * @example
   * ```typescript
   * // Calculate and update stats in database (default behavior)
   * await calendarRepository.calculateStats(calendarId);
   *
   * // Calculate stats with hypothetical trades (returns stats, does NOT update database)
   * const updatedTrades = trades.map(t => ({ ...t, amount: newAmount }));
   * const stats = await calendarRepository.calculateStats(calendarId, updatedTrades);
   * console.log(stats.total_pnl, stats.win_rate);
   * ```
   */
  async calculateStats(calendarId: string, trades?: Trade[]): Promise<any> {
    try {
      // Ensure session is valid
      await supabaseAuthService.ensureValidSession();

      if (trades && trades.length > 0) {
        // Use get_calendar_stats to calculate without updating database
        logger.log(`📊 Calculating hypothetical stats for calendar ${calendarId} with ${trades.length} trades`);

        const { data, error } = await supabase.rpc('get_calendar_stats', {
          p_calendar_id: calendarId,
          p_trades: trades // Pass as array, Supabase will convert to JSONB
        });

        if (error) {
          logger.error('Error calculating calendar stats:', error);
          throw error;
        }

        logger.log(`✅ Hypothetical stats calculated for calendar ${calendarId}`, JSON.stringify(data, null, 2));
        return data;
      } else {
        // Use calculate_calendar_stats to update database
        logger.log(`📊 Calculating and updating stats for calendar ${calendarId}`);

        const { error } = await supabase.rpc('calculate_calendar_stats', {
          p_calendar_id: calendarId
        });

        if (error) {
          logger.error('Error calculating calendar stats:', error);
          throw error;
        }

        logger.log(`✅ Stats calculated and updated for calendar ${calendarId}`);
        return undefined;
      }
    } catch (error) {
      logger.error('Error calculating calendar stats:', error);
      throw error;
    }
  }

}
