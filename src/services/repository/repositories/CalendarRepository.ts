/**
 * Calendar Repository
 * Handles Supabase operations for calendar entities
 */

import {
  AbstractBaseRepository,
  RepositoryConfig
} from './BaseRepository';
import { Calendar } from '../../../types/dualWrite';
import { logger } from '../../../utils/logger';

// Supabase imports
import { supabase } from '../../../config/supabase';

/**
 * Transform Supabase calendar data to Calendar type
 * Converts string dates to Date objects
 */
const transformSupabaseCalendar = (data: any): Calendar => {
  return {
    ...data,
    created_at: data.created_at ? new Date(data.created_at) : new Date(),
    updated_at: data.updated_at ? new Date(data.updated_at) : new Date(),
    deleted_at: data.deleted_at ? new Date(data.deleted_at) : undefined,
    auto_delete_at: data.auto_delete_at ? new Date(data.auto_delete_at) : undefined,
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
      const { data, error } = await supabase
        .from('calendars')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        logger.error('Error finding calendars by user ID:', error);
        return [];
      }

      return data ? data.map(item => transformSupabaseCalendar(item)) : [];
    } catch (error) {
      logger.error('Error finding calendars by user ID:', error);
      return [];
    }
  }

  async findAll(): Promise<Calendar[]> {
    try {
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
    if(!updatesWithTimestamp.dynamic_risk_enabled){
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

  protected async deleteInSupabase(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('calendars')
      .delete()
      .eq('id', id);

    if (error) {
      throw error; // Let the error handler parse this
    }

    return true;
  }

}
