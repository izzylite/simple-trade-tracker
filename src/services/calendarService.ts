/**
 * Calendar Service - Supabase Repository Pattern
 * High-level business logic for calendar and trade operations
 * Uses CalendarRepository and TradeRepository for data access
 * All types use snake_case to match dualWrite.ts and Supabase schema
 */

import { isSameWeek, isSameMonth } from 'date-fns';
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

/**
 * Calculate calendar statistics from trades
 */
export const calculateCalendarStats = (trades: Trade[], calendar: Calendar): CalendarStats => {
  const currentDate = new Date();

  // Default values if no trades
  if (trades.length === 0) {
    return {
      win_rate: 0,
      profit_factor: 0,
      max_drawdown: 0,
      target_progress: 0,
      pnl_performance: 0,
      total_trades: 0,
      win_count: 0,
      loss_count: 0,
      total_pnl: 0,
      drawdown_start_date: null,
      drawdown_end_date: null,
      drawdown_recovery_needed: 0,
      drawdown_duration: 0,
      avg_win: 0,
      avg_loss: 0,
      current_balance: calendar.account_balance,
      initial_balance: calendar.account_balance,
      growth_percentage: 0,
      weekly_pnl: 0,
      monthly_pnl: 0,
      yearly_pnl: 0,
      weekly_pnl_percentage: 0,
      monthly_pnl_percentage: 0,
      yearly_pnl_percentage: 0,
      weekly_progress: 0,
      monthly_progress: 0,
      yearly_progress: 0
    };
  }

  // Calculate win rate
  const win_count = trades.filter(trade => trade.trade_type === 'win').length;
  const loss_count = trades.filter(trade => trade.trade_type === 'loss').length;
  const total_trades = trades.length;
  const win_rate = total_trades > 0 ? (win_count / total_trades) * 100 : 0;

  // Calculate profit factor and average win/loss
  const winningTrades = trades.filter(t => t.trade_type === 'win');
  const losingTrades = trades.filter(t => t.trade_type === 'loss');
  const grossProfit = winningTrades.reduce((sum, t) => sum + t.amount, 0);
  const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.amount, 0));
  const profit_factor = grossLoss > 0 ? grossProfit / grossLoss : win_count > 0 ? 999 : 0;

  const avg_win = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
  const avg_loss = losingTrades.length > 0 ? (grossLoss / losingTrades.length) * -1 : 0;

  // Calculate total P&L
  const total_pnl = trades.reduce((sum, trade) => sum + trade.amount, 0);

  // Calculate max drawdown and related statistics
  let runningBalance = calendar.account_balance;
  let maxBalance = runningBalance;
  let max_drawdown = 0;
  let drawdown_start_date: Date | null = null;
  let drawdown_end_date: Date | null = null;
  let currentDrawdownStart: Date | null = null;
  let currentDrawdown = 0;

  // Sort trades by date
  const sortedTrades = [...trades].sort((a, b) =>
    new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()
  );

  sortedTrades.forEach(trade => {
    runningBalance += trade.amount;
    if (runningBalance > maxBalance) {
      maxBalance = runningBalance;
      currentDrawdown = 0;
      currentDrawdownStart = null;
    } else {
      const drawdown = maxBalance > 0 ? ((maxBalance - runningBalance) / maxBalance) * 100 : 0;
      if (drawdown > currentDrawdown) {
        currentDrawdown = drawdown;
        if (!currentDrawdownStart) {
          currentDrawdownStart = new Date(trade.trade_date);
        }
      }
      if (drawdown > max_drawdown) {
        max_drawdown = drawdown;
        drawdown_start_date = currentDrawdownStart;
        drawdown_end_date = new Date(trade.trade_date);
      }
    }
  });

  // Calculate drawdown recovery needed
  const drawdown_recovery_needed = max_drawdown > 0 && runningBalance > 0 ?
    ((maxBalance - runningBalance) / runningBalance) * 100 : 0;

  // Calculate drawdown duration
  const drawdown_duration = (() => {
    if (drawdown_start_date === null || drawdown_end_date === null) {
      return 0;
    }
    const diffTime = Math.abs((drawdown_end_date as Date).getTime() - (drawdown_start_date as Date).getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  })();

  // Calculate target progress
  const yearly_target = calendar.yearly_target || 0;
  const target_progress = yearly_target > 0 ? (total_pnl / yearly_target) * 100 : 0;

  // Calculate P&L performance (percentage of account balance)
  const pnl_performance = calendar.account_balance > 0 ? (total_pnl / calendar.account_balance) * 100 : 0;

  // Current balance after all trades
  const current_balance = calendar.account_balance + total_pnl;

  // Calculate weekly P&L
  const weekly_pnl = trades
    .filter(trade => isSameWeek(new Date(trade.trade_date), currentDate))
    .reduce((sum, trade) => sum + trade.amount, 0);

  const weekly_pnl_percentage = calendar.account_balance > 0 ?
    (weekly_pnl / calendar.account_balance) * 100 : 0;

  const weekly_progress = calendar.weekly_target ?
    (weekly_pnl / calendar.weekly_target) * 100 : 0;

  // Calculate monthly P&L
  const monthly_pnl = trades
    .filter(trade => isSameMonth(new Date(trade.trade_date), currentDate))
    .reduce((sum, trade) => sum + trade.amount, 0);

  const monthly_pnl_percentage = calendar.account_balance > 0 ?
    (monthly_pnl / calendar.account_balance) * 100 : 0;

  const monthly_progress = calendar.monthly_target ?
    (monthly_pnl / calendar.monthly_target) * 100 : 0;

  // Calculate yearly P&L
  const yearly_pnl = trades
    .filter(trade => new Date(trade.trade_date).getFullYear() === currentDate.getFullYear())
    .reduce((sum, trade) => sum + trade.amount, 0);

  const yearly_pnl_percentage = calendar.account_balance > 0 ?
    (yearly_pnl / calendar.account_balance) * 100 : 0;

  const growth_percentage = calendar.account_balance > 0 ?
    (total_pnl / calendar.account_balance) * 100 : 0;

  const yearly_progress = calendar.yearly_target ?
    (yearly_pnl / calendar.yearly_target) * 100 : 0;

  return {
    win_rate,
    profit_factor,
    max_drawdown,
    target_progress,
    pnl_performance,
    total_trades,
    win_count,
    loss_count,
    total_pnl,
    drawdown_start_date,
    drawdown_end_date,
    drawdown_recovery_needed,
    drawdown_duration,
    avg_win,
    avg_loss,
    current_balance,
    initial_balance: calendar.account_balance,
    growth_percentage,
    weekly_pnl,
    monthly_pnl,
    yearly_pnl,
    weekly_pnl_percentage,
    monthly_pnl_percentage,
    yearly_pnl_percentage,
    weekly_progress,
    monthly_progress,
    yearly_progress
  };
};


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
    win_count: 0, // Not stored in calendar, calculated from trades
    loss_count: 0, // Not stored in calendar, calculated from trades
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
  trade: Omit<Trade, 'id' | 'created_at' | 'updated_at'>,
  cachedTrades: Trade[] = []
): Promise<CalendarStats> => {
  try {
    // Create the trade
    await tradeRepository.create({
      ...trade,
      calendar_id: calendarId
    });

    // Get all trades for stats calculation
    const allTrades = cachedTrades.length > 0 ? [...cachedTrades, trade as Trade] : await getAllTrades(calendarId);

    // Get calendar for stats calculation
    const calendar = await getCalendar(calendarId);
    if (!calendar) {
      throw new Error('Calendar not found');
    }

    // Calculate stats (stats are not stored, only calculated on-demand)
    const stats = calculateCalendarStats(allTrades, calendar);

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

    // Get all trades for stats calculation
    const allTrades = cachedTrades.length > 0 ?
      cachedTrades.map(t => t.id === tradeId ? updatedTrade : t) :
      await getAllTrades(calendarId);

    // Get calendar for stats calculation
    const calendar = await getCalendar(calendarId);
    if (!calendar) {
      throw new Error('Calendar not found');
    }

    // Calculate stats (stats are not stored, only calculated on-demand)
    const stats = calculateCalendarStats(allTrades, calendar);

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
  tradeId: string,
  cachedTrades: Trade[] = []
): Promise<CalendarStats> => {
  try {
    // Delete the trade
    await tradeRepository.delete(tradeId);

    // Get all trades for stats calculation
    const allTrades = cachedTrades.length > 0 ?
      cachedTrades.filter(t => t.id !== tradeId) :
      await getAllTrades(calendarId);

    // Get calendar for stats calculation
    const calendar = await getCalendar(calendarId);
    if (!calendar) {
      throw new Error('Calendar not found');
    }

    // Calculate stats (stats are not stored, only calculated on-demand)
    const stats = calculateCalendarStats(allTrades, calendar);

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
    for (const trade of trades) {
      await tradeRepository.create({
        ...trade,
        calendar_id: calendarId
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

/**
 * Get trades for a specific year (for backward compatibility)
 */
export const getYearlyTrades = async (
  calendarId: string,
  year: number
): Promise<Trade[]> => {
  try {
    const allTrades = await getAllTrades(calendarId);
    return allTrades.filter(trade =>
      new Date(trade.trade_date).getFullYear() === year
    );
  } catch (error) {
    logger.error('Error getting yearly trades:', error);
    return [];
  }
};
