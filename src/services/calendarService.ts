/**
 * Calendar Service - Supabase Repository Pattern
 * High-level business logic for calendar and trade operations
 * Uses CalendarRepository and TradeRepository for data access
 * All types use snake_case to match dualWrite.ts and Supabase schema
 */

import { Calendar, Trade } from '../types/dualWrite';
import { logger } from '../utils/logger';

// Import repositories
import { CalendarRepository } from './repository/repositories/CalendarRepository';
import { TradeRepository } from './repository/repositories/TradeRepository';

// Create repository instances
const calendarRepository = new CalendarRepository();
const tradeRepository = new TradeRepository();

// =====================================================
// TYPES AND INTERFACES
// =====================================================

/**
 * Calendar statistics interface (camelCase for UI compatibility)
 * Note: This is a UI-facing interface, not stored in database
 */
export interface CalendarStats {
  win_rate: number;
  profit_factor: number;
  max_drawdown: number;
  target_progress: number;
  pnl_performance: number;
  total_trades: number;
  win_count: number;
  loss_count: number;
  total_pnl: number;
  drawdown_start_date: Date | null;
  drawdown_end_date: Date | null;
  drawdown_recovery_needed: number;
  drawdown_duration: number;
  avg_win: number;
  avg_loss: number;
  current_balance: number;
  initial_balance: number;
  growth_percentage: number;
  weekly_pnl?: number;
  monthly_pnl?: number;
  yearly_pnl?: number;
  weekly_pnl_percentage?: number;
  monthly_pnl_percentage?: number;
  yearly_pnl_percentage?: number;
  weekly_progress?: number;
  monthly_progress?: number;
  yearly_progress?: number;
}

// =====================================================
// STATISTICS CALCULATION
// =====================================================
// NOTE: Calendar statistics are now automatically calculated by Supabase
// via database triggers (see migration 005_auto_calculate_calendar_stats.sql)
// The calculateCalendarStats function has been removed - stats are read directly from the calendar object

// Cache for memoized calendar stats
const statsCache = new Map<string, CalendarStats>();

/**
 * Get calendar statistics from calendar object
 * Returns CalendarStats with snake_case properties matching database schema
 * Results are cached based on calendar ID and updated_at timestamp
 */
export const getCalendarStats = (calendar: Calendar): CalendarStats => {
  // Check cache using calendar ID and updated_at as key
  const cacheKey = `${calendar.id}:${calendar.updated_at?.toString() || 'no-timestamp'}`;

  if (statsCache.has(cacheKey)) {
    return statsCache.get(cacheKey)!;
  }

  // Compute stats
  const stats: CalendarStats = {
    total_pnl: calendar.total_pnl || 0,
    win_rate: calendar.win_rate || 0,
    total_trades: calendar.total_trades || 0,
    growth_percentage: calendar.pnl_performance || 0,
    avg_win: calendar.avg_win || 0,
    avg_loss: calendar.avg_loss || 0,
    profit_factor: calendar.profit_factor || 0,
    max_drawdown: calendar.max_drawdown || 0,
    drawdown_recovery_needed: calendar.drawdown_recovery_needed || 0,
    drawdown_duration: calendar.drawdown_duration || 0,
    drawdown_start_date: calendar.drawdown_start_date || null,
    drawdown_end_date: calendar.drawdown_end_date || null,
    weekly_progress: calendar.weekly_progress || 0,
    monthly_progress: calendar.monthly_progress || 0,
    yearly_progress: calendar.target_progress || 0,
    current_balance: calendar.current_balance || calendar.account_balance || 0,
    initial_balance: calendar.account_balance || 0,
    win_count: calendar.win_count || 0,
    loss_count: calendar.loss_count || 0,
    target_progress: calendar.target_progress || 0,
    pnl_performance: calendar.pnl_performance || 0,
    weekly_pnl: calendar.weekly_pnl || 0,
    monthly_pnl: calendar.monthly_pnl || 0,
    yearly_pnl: calendar.yearly_pnl || 0,
    weekly_pnl_percentage: calendar.weekly_pnl_percentage || 0,
    monthly_pnl_percentage: calendar.monthly_pnl_percentage || 0,
    yearly_pnl_percentage: calendar.yearly_pnl_percentage || 0
  };

  // Store in cache
  statsCache.set(cacheKey, stats);

  return stats;
};

// =====================================================
// CALENDAR CRUD OPERATIONS
// =====================================================

/**
 * Get a single calendar by ID
 */
export const getCalendar = async (calendarId: string): Promise<Calendar | null> => {
  try {
    return await calendarRepository.findById(calendarId);
  } catch (error) {
    logger.error('Error getting calendar:', error);
    return null;
  }
};

/**
 * Get all calendars for a user (excluding deleted ones)
 */
export const getUserCalendars = async (userId: string): Promise<Calendar[]> => {
  try {
    const calendars = await calendarRepository.findByUserId(userId);
    // Filter out deleted calendars
    return calendars.filter(cal => !cal.deleted_at);
  } catch (error) {
    logger.error('Error getting user calendars:', error);
    return [];
  }
};

/**
 * Get all trash (soft-deleted) calendars for a user
 */
export const getTrashCalendars = async (userId: string): Promise<Calendar[]> => {
  try {
    const calendars = await calendarRepository.findTrashByUserId(userId);
    return calendars;
  } catch (error) {
    logger.error('Error getting trash calendars:', error);
    return [];
  }
};

/**
 * Restore a calendar from trash
 */
export const restoreCalendar = async (calendarId: string): Promise<Calendar> => {
  try {
    const calendar = await calendarRepository.restoreFromTrash(calendarId);
    logger.log('Calendar restored:', calendarId);
    return calendar;
  } catch (error) {
    logger.error('Error restoring calendar:', error);
    throw error;
  }
};

/**
 * Permanently delete a calendar
 */
export const permanentlyDeleteCalendar = async (calendarId: string): Promise<boolean> => {
  try {
    await calendarRepository.permanentlyDelete(calendarId);
    logger.log('Calendar permanently deleted:', calendarId);
    return true;
  } catch (error) {
    logger.error('Error permanently deleting calendar:', error);
    throw error;
  }
};

/**
 * Create a new calendar
 */
export const createCalendar = async (
  userId: string,
  calendar: Omit<Calendar, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<Calendar> => {
  try {
    const result = await calendarRepository.create({
      ...calendar,
      user_id: userId
    });
    if (!result.success || !result.data) {
      throw new Error('Failed to create calendar');
    }
    return result.data;
  } catch (error) {
    logger.error('Error creating calendar:', error);
    throw error;
  }
};

/**
 * Update an existing calendar
 */
export const updateCalendar = async (
  calendarId: string,
  updates: Partial<Calendar>
): Promise<Calendar> => {
  try {
    const result = await calendarRepository.update(calendarId, updates);
    return result.data!;
  } catch (error) {
    logger.error('Error updating calendar:', error);
    throw error;
  }
};

/**
 * Delete a calendar (soft delete - move to trash)
 */
export const deleteCalendar = async (calendarId: string, userId: string): Promise<void> => {
  try {
    // Import moveCalendarToTrash to avoid circular dependency
    const { moveCalendarToTrash } = await import('./trashService');
    await moveCalendarToTrash(calendarId, userId);
  } catch (error) {
    logger.error('Error deleting calendar:', error);
    throw error;
  }
};

/**
 * Duplicate an existing calendar
 */
export const duplicateCalendar = async (
  userId: string,
  sourceCalendarId: string,
  newName: string,
  includeContent: boolean = false
): Promise<Calendar> => {
  try {
    // Get the source calendar
    const sourceCalendar = await getCalendar(sourceCalendarId);
    if (!sourceCalendar) {
      throw new Error('Source calendar not found');
    }

    // Create new calendar with same settings
    const data : Calendar = await createCalendar(userId, {
      name: newName,
      account_balance: sourceCalendar.account_balance,
      max_daily_drawdown: sourceCalendar.max_daily_drawdown,
      weekly_target: sourceCalendar.weekly_target,
      monthly_target: sourceCalendar.monthly_target,
      yearly_target: sourceCalendar.yearly_target,
      risk_per_trade: sourceCalendar.risk_per_trade,
      dynamic_risk_enabled: sourceCalendar.dynamic_risk_enabled,
      increased_risk_percentage: sourceCalendar.increased_risk_percentage,
      profit_threshold_percentage: sourceCalendar.profit_threshold_percentage,
      required_tag_groups: sourceCalendar.required_tag_groups,
      score_settings: sourceCalendar.score_settings,
      economic_calendar_filters: sourceCalendar.economic_calendar_filters,
      duplicated_calendar: true,
      source_calendar_id: sourceCalendarId
    });

    // If includeContent, copy trades
    if (includeContent) {
      const trades = await getAllTrades(sourceCalendarId);
      for (const trade of trades) {
        // Omit id, created_at, updated_at as they will be auto-generated
        const { id, created_at, updated_at, ...tradeData } = trade;
        await addTrade(data.id, {
          ...tradeData,
          calendar_id: data.id
        });
      }
    }

    const newCalendar = await getCalendar(data.id);
    if (!newCalendar) {
      throw new Error('Failed to retrieve duplicated calendar');
    }

    return newCalendar;
  } catch (error) {
    logger.error('Error duplicating calendar:', error);
    throw error;
  }
};

// =====================================================
// CALENDAR LINKING (ONE-WAY TRADE SYNC)
// =====================================================

/**
 * Link a calendar to another calendar for one-way trade sync
 * Trades created in sourceCalendarId will be automatically copied to targetCalendarId
 */
export const linkCalendar = async (
  sourceCalendarId: string,
  targetCalendarId: string
): Promise<void> => {
  try {
    if (sourceCalendarId === targetCalendarId) {
      throw new Error('Cannot link a calendar to itself');
    }

    await calendarRepository.update(sourceCalendarId, {
      linked_to_calendar_id: targetCalendarId
    });

    logger.log('Calendar linked successfully', { sourceCalendarId, targetCalendarId });
  } catch (error) {
    logger.error('Error linking calendar:', error);
    throw error;
  }
};

/**
 * Unlink a calendar (remove one-way trade sync)
 */
export const unlinkCalendar = async (calendarId: string): Promise<void> => {
  try {
    await calendarRepository.update(calendarId, {
      linked_to_calendar_id: null
    });

    logger.log('Calendar unlinked successfully', { calendarId });
  } catch (error) {
    logger.error('Error unlinking calendar:', error);
    throw error;
  }
};

/**
 * Get the linked calendar for a given calendar (if any)
 */
export const getLinkedCalendar = async (calendarId: string): Promise<Calendar | null> => {
  try {
    const calendar = await getCalendar(calendarId);
    if (!calendar?.linked_to_calendar_id) {
      return null;
    }

    return await getCalendar(calendar.linked_to_calendar_id);
  } catch (error) {
    logger.error('Error getting linked calendar:', error);
    return null;
  }
};

// =====================================================
// TRADE CRUD OPERATIONS
// =====================================================

/**
 * Get all trades for a calendar
 */
export const getAllTrades = async (calendarId: string): Promise<Trade[]> => {
  try {
    return await tradeRepository.findByCalendarId(calendarId);
  } catch (error) {
    logger.error('Error getting all trades:', error);
    return [];
  }
};

/**
 * Get a specific trade by ID
 */
export const getTrade = async (calendarId: string, tradeId: string): Promise<Trade | null> => {
  try {
    const trade = await tradeRepository.findById(tradeId);
    if (trade && trade.calendar_id === calendarId) {
      return trade;
    }
    return null;
  } catch (error) {
    logger.error('Error getting trade:', error);
    return null;
  }
};

/**
 * Add a trade to a calendar
 */
export const addTrade = async (
  calendarId: string,
  trade: Omit<Trade, 'id' | 'created_at' | 'updated_at'>
): Promise<Trade> => {
  try {
    // Create the trade
   const result = await tradeRepository.create({
      ...trade,
      calendar_id: calendarId
    });
 
    return result.data!;
  } catch (error) {
    logger.error('Error adding trade:', error);
    throw error;
  }
};

/**
 * Update a trade
 */
export const updateTrade = async ( 
  trade: Trade,
  updateCallback: (trade: Trade) => Trade
): Promise<Trade | null> => {
  try { 
    // Apply updates
    const updatedTrade = updateCallback(trade);
    // Update in database
    await tradeRepository.update(trade.id, updatedTrade);
    return updatedTrade;
  } catch (error) {
    logger.error('Error updating trade:', error);
    throw error;
  }
};

/**
 * Delete a trade
 */
export const deleteTrade = async ( 
  tradeId: string
): Promise<void> => {
  try {
    // Delete the trade
    await tradeRepository.delete(tradeId);
   
  } catch (error) {
    logger.error('Error deleting trade:', error);
    throw error;
  }
};


// =====================================================
// UTILITY FUNCTIONS
// =====================================================
 

/**
 * Import trades into a calendar
 */
export const importTrades = async (
  calendarId: string,
  existingTrade: Trade[],
  importedTrades: Partial<Trade>[]
): Promise<Trade[]> => {
  try {
    if (importedTrades.length === 0) {
      logger.log('No trades to import');
      return [];
    }

    logger.log(`📥 Importing ${importedTrades.length} trades...`);

    // Step 1: Delete all existing trades for this calendar using bulk delete
    const deleteResult = await tradeRepository.bulkDelete(existingTrade);

    if (!deleteResult.success) {
      throw new Error(deleteResult.error?.message || 'Failed to delete existing trades');
    }

    // Step 2: Import new trades using bulk create
    logger.log(`📤 Creating ${importedTrades.length} new trades...`);
    const result = await tradeRepository.bulkCreate(calendarId, importedTrades);

    if (!result.success) {
      throw new Error(result.error?.message || 'Bulk import failed');
    }

    logger.log(`✅ Successfully imported ${result.data?.length || 0} trades`);

    return result.data || [];
  } catch (error) {
    logger.error('Error importing trades:', error);
    throw error;
  }
};
 

export const getTradeRepository = () => {
  return tradeRepository;
};

 
/**
 * Generate a unique image ID
 * @param file - Optional file to extract extension from
 * @returns A unique ID with file extension if file is provided
 */
export const generateImageId = (file?: File): string => {
  const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;

  if (file) {
    // Extract extension from file name or type
    const extension = file.name.split('.').pop()?.toLowerCase() ||
                      file.type.split('/').pop() ||
                      'jpg';
    return `${uniqueId}.${extension}`;
  }

  return uniqueId;
};

/**
 * Upload trade image
 * Note: Use uploadTradeImage from supabaseStorageService directly
 * This is a re-export for backward compatibility
 */
export { uploadTradeImage } from './supabaseStorageService';
 
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
 * await calculateCalendarStats(calendarId);
 *
 * // Calculate stats with hypothetical trades (returns stats, does NOT update database)
 * const updatedTrades = trades.map(t => ({ ...t, amount: newAmount }));
 * const stats = await calculateCalendarStats(calendarId, updatedTrades);
 * console.log(stats.total_pnl, stats.win_rate);
 * ```
 */
export const calculateCalendarStats = async (
  calendarId: string,
  trades?: Trade[]
): Promise<any> => {
  return calendarRepository.calculateStats(calendarId, trades);
};
