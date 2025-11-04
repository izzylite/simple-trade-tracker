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


/**
 * Get calendar statistics from calendar object
 * Returns CalendarStats with snake_case properties matching database schema
 */
export const getCalendarStats = (calendar: Calendar): CalendarStats => {
  return {
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
    pnl_performance: calendar.pnl_performance || 0
  };
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
 * Create a new calendar
 */
export const createCalendar = async (
  userId: string,
  calendar: Omit<Calendar, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<string> => {
  try {
    const result = await calendarRepository.create({
      ...calendar,
      user_id: userId
    });
    if (!result.success || !result.data) {
      throw new Error('Failed to create calendar');
    }
    return result.data.id;
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
): Promise<void> => {
  try {
    await calendarRepository.update(calendarId, updates);
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
    const newCalendarId = await createCalendar(userId, {
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
        await addTrade(newCalendarId, {
          ...tradeData,
          calendar_id: newCalendarId
        });
      }
    }

    const newCalendar = await getCalendar(newCalendarId);
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
): Promise<CalendarStats> => {
  try {
    // Create the trade
    await tradeRepository.create({
      ...trade,
      calendar_id: calendarId
    });

    // Get calendar with auto-calculated stats from database
    const calendar = await getCalendar(calendarId);
    if (!calendar) {
      throw new Error('Calendar not found');
    }

    // Stats are automatically calculated by Supabase triggers
    const stats = getCalendarStats(calendar);

    return stats;
  } catch (error) {
    logger.error('Error adding trade:', error);
    throw error;
  }
};

/**
 * Update a trade
 */
export const updateTrade = async (
  calendarId: string,
  tradeId: string,
  cachedTrades: Trade[] = [],
  updateCallback: (trade: Trade) => Trade
): Promise<[CalendarStats, Trade[]] | undefined> => {
  try {
    // Get the trade
    const trade = await getTrade(calendarId, tradeId);
    if (!trade) {
      logger.error('Trade not found');
      return undefined;
    }

    // Apply updates
    const updatedTrade = updateCallback(trade);

    // Update in database
    await tradeRepository.update(tradeId, updatedTrade);

    // Get updated trades list
    const allTrades = cachedTrades.length > 0 ?
      cachedTrades.map(t => t.id === tradeId ? updatedTrade : t) :
      await getAllTrades(calendarId);

    // Get calendar with auto-calculated stats from database
    const calendar = await getCalendar(calendarId);
    if (!calendar) {
      throw new Error('Calendar not found');
    }

    // Stats are automatically calculated by Supabase triggers
    const stats = getCalendarStats(calendar);

    return [stats, allTrades];
  } catch (error) {
    logger.error('Error updating trade:', error);
    throw error;
  }
};

/**
 * Delete a trade
 */
export const deleteTrade = async (
  calendarId: string,
  tradeId: string
): Promise<CalendarStats> => {
  try {
    // Delete the trade
    await tradeRepository.delete(tradeId);

    // Get calendar with auto-calculated stats from database
    const calendar = await getCalendar(calendarId);
    if (!calendar) {
      throw new Error('Calendar not found');
    }

    // Stats are automatically calculated by Supabase triggers
    const stats = getCalendarStats(calendar);

    return stats;
  } catch (error) {
    logger.error('Error deleting trade:', error);
    throw error;
  }
};


// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Clear all trades for a specific month
 */
export const clearMonthTrades = async (
  calendarId: string,
  year: number,
  month: number
): Promise<void> => {
  try {
    const allTrades = await getAllTrades(calendarId);
    const tradesToDelete = allTrades.filter(trade => {
      const tradeDate = new Date(trade.trade_date);
      return tradeDate.getFullYear() === year && tradeDate.getMonth() === month;
    });

    // Delete trades
    for (const trade of tradesToDelete) {
      await tradeRepository.delete(trade.id);
    }

    // Stats are not stored, they are calculated on-demand when needed
    // No need to recalculate here
  } catch (error) {
    logger.error('Error clearing month trades:', error);
    throw error;
  }
};

/**
 * Import trades into a calendar
 */
export const importTrades = async (
  calendarId: string,
  trades: Trade[]
): Promise<void> => {
  try {
    // Create all trades
    // Note: Economic events are automatically fetched by TradeRepository.createInSupabase()
    for (const trade of trades) {
      // Normalize pair tags to lowercase format (pair:<PAIR>)
      // This ensures getRelevantCurrenciesFromTags() can extract currencies
      let tags = trade.tags || [];

      // Check if any tag looks like a pair tag and normalize it
      tags = tags.map(tag => {
        // Match tags like "Pair:EURUSD", "pair:EURUSD", "PAIR:EURUSD"
        const pairMatch = tag.match(/^pair:(.+)$/i);
        if (pairMatch) {
          return `pair:${pairMatch[1]}`;  // Normalize to lowercase "pair:"
        }
        return tag;
      });

      // Also check if (trade as any).pair exists (in case it's passed as a property)
      const pairValue = (trade as any).pair;
      if (pairValue) {
        const pairTag = `pair:${pairValue}`;
        if (!tags.some(t => t.toLowerCase() === pairTag.toLowerCase())) {
          tags = [...tags, pairTag];
          logger.log(`📌 Added pair tag "${pairTag}" for imported trade`);
        }
      }

      // Create the trade with normalized tags
      // TradeRepository will automatically fetch economic events based on these tags
      await tradeRepository.create({
        ...trade,
        calendar_id: calendarId,
        tags
      });
    }

    // Stats are not stored, they are calculated on-demand when needed
  } catch (error) {
    logger.error('Error importing trades:', error);
    throw error;
  }
};

/**
 * Update a tag across all trades in a calendar
 */
export const updateTag = async (
  calendarId: string,
  oldTag: string,
  newTag: string
): Promise<{ success: boolean; tradesUpdated: number }> => {
  try {
    const allTrades = await getAllTrades(calendarId);
    const tradesToUpdate = allTrades.filter(trade =>
      trade.tags && trade.tags.includes(oldTag)
    );

    for (const trade of tradesToUpdate) {
      const updatedTags = trade.tags!.map(tag => tag === oldTag ? newTag : tag);
      await tradeRepository.update(trade.id, { tags: updatedTags });
    }

    return { success: true, tradesUpdated: tradesToUpdate.length };
  } catch (error) {
    logger.error('Error updating tag:', error);
    throw error;
  }
};

/**
 * Generate a unique image ID
 */
export const generateImageId = (): string => {
  return `${Date.now()}_${Math.random().toString(36).substring(7)}`;
};

/**
 * Upload trade image
 * Note: Use uploadTradeImage from supabaseStorageService directly
 * This is a re-export for backward compatibility
 */
export { uploadTradeImage } from './supabaseStorageService';

/**
 * Update calendar with callback (for complex updates)
 */
export const onUpdateCalendar = async (
  calendarId: string,
  updateCallback: (calendar: Calendar) => Partial<Calendar>
): Promise<void> => {
  try {
    const calendar = await getCalendar(calendarId);
    if (!calendar) {
      throw new Error('Calendar not found');
    }

    const updates = updateCallback(calendar);
    await updateCalendar(calendarId, updates);
  } catch (error) {
    logger.error('Error updating calendar with callback:', error);
    throw error;
  }
};
