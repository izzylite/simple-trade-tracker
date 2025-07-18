/**
 * Utility functions for AI trading analysis
 */

import { Trade } from '../../../types/trade';
import { isTradeInSession, getSessionMappings } from '../../../utils/sessionTimeUtils';
import { logger } from '../../../utils/logger';
import { TradingAnalysisResult } from './types';

/**
 * Handle cache key logic for function results
 */
export function handleCacheKeyResult(
  functionName: string,
  data: any,
  returnCacheKey?: boolean,
  items?: any[]
): TradingAnalysisResult {
  if (returnCacheKey === true) {
    // Store data in localStorage and return cache key with summary
    const cacheKey = `ai_function_result_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    try {
      localStorage.setItem(cacheKey, JSON.stringify({
        data: data,
        timestamp: Date.now(),
        functionName
      }));

      logger.log(`Cached result for ${functionName} with key: ${cacheKey}`);

      // Create summary based on data type
      let count = items?.length || 0;
      let summary = `Result cached for ${functionName}. Contains ${count} result${count > 1 ? "s" : ""}`;

      return {
        success: true,
        data: {
          cached: true,
          cacheKey: cacheKey,
          summary: {
            info: summary,
            count: count,
            ...(items && items.length > 0 && {
              snippet: items.slice(0, 2) // Return first 3 as examples
            })
          },
        }
      };
    } catch (error) {
      logger.error('Failed to cache function result:', error);
      // Fall back to returning full data
      return {
        success: true,
        data: data
      };
    }
  } else {
    // Return full data
    return {
      success: true,
      data: data
    };
  }
}

/**
 * Convert trades to simple data format (without images and other heavy fields)
 */
export function simpleTradeData(trades: Trade[]): Omit<Trade, 'images' | 'isDeleted' | 'isTemporary' | 'isPinned' | 'shareLink' | 'isShared' | 'sharedAt' | 'shareId'>[] {
  return trades.map(trade => ({
    id: trade.id,
    name: trade.name,
    date: trade.date,
    session: trade.session,
    type: trade.type,
    amount: trade.amount,
    tags: trade.tags,
    entry: trade.entry,
    exit: trade.exit,
    riskToReward: trade.riskToReward,
    partialsTaken: trade.partialsTaken,
    economicEvents: trade.economicEvents
  }));
}

/**
 * Calculate win rate from trades
 */
export function calculateWinRate(trades: Trade[]): number {
  if (trades.length === 0) return 0;
  const wins = trades.filter(trade => trade.type === 'win').length;
  return (wins / trades.length) * 100;
}

/**
 * Get the best performing trade
 */
export function getBestTrade(trades: Trade[]): Trade | null {
  if (trades.length === 0) return null;
  return trades.reduce((best, trade) =>
    trade.amount > best.amount ? trade : best
  );
}

/**
 * Get the worst performing trade
 */
export function getWorstTrade(trades: Trade[]): Trade | null {
  if (trades.length === 0) return null;
  return trades.reduce((worst, trade) =>
    trade.amount < worst.amount ? trade : worst
  );
}

/**
 * Group trades by time period or other criteria
 */
export function groupTradesByPeriod(trades: Trade[], groupBy: string): any {
  const groups: { [key: string]: Trade[] } = {};

  trades.forEach((trade : Trade) => {
    const date = new Date(trade.date);
    let key: string;

    switch (groupBy) {
      case 'day':
        key = date.toISOString().split('T')[0];
        break;
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
        break;
      case 'month':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
      case 'session':
        // Use explicit session field if available, otherwise fall back to DST-aware time detection
        if (trade.session) {
          // Map session names to grouping keys
          switch (trade.session) {
            case 'London':
              key = 'london';
              break;
            case 'NY AM':
            case 'NY PM':
              key = 'new-york';
              break;
            case 'Asia':
              key = 'tokyo';
              break;
            default:
              key = trade.session ? (trade.session as String).toLowerCase() : 'unknown';
          }
        } else {
          // Fallback to DST-aware session detection for trades without session field
          if (isTradeInSession(date, 'London')) key = 'london';
          else if (isTradeInSession(date, 'NY AM') || isTradeInSession(date, 'NY PM')) key = 'new-york';
          else if (isTradeInSession(date, 'Asia')) key = 'tokyo';
          else key = 'sydney'; // Fallback for any remaining times
        }
        break;
      case 'dayOfWeek':
        key = date.toLocaleDateString('en-US', { weekday: 'long' });
        break;
      default:
        key = 'all';
    }

    if (!groups[key]) groups[key] = [];
    groups[key].push(trade);
  });

  // Convert to summary format
  const summary: { [key: string]: any } = {};
  Object.keys(groups).forEach(key => {
    const groupTrades = groups[key];
    summary[key] = {
      count: groupTrades.length,
      totalPnl: groupTrades.reduce((sum, trade) => sum + trade.amount, 0),
      winRate: calculateWinRate(groupTrades)
    };
  });

  return summary;
}

/**
 * Parse date range string into start and end dates
 */
export function parseDateRange(dateRange: string): { start: Date; end: Date } | null {
  const now = new Date();

  if (dateRange.includes('last')) {
    const match = dateRange.match(/last (\d+) (day|week|month)s?/i);
    if (match) {
      const amount = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      const startDate = new Date(now);

      if (unit === 'day') startDate.setDate(now.getDate() - amount);
      else if (unit === 'week') startDate.setDate(now.getDate() - (amount * 7));
      else if (unit === 'month') startDate.setMonth(now.getMonth() - amount);

      return { start: startDate, end: now };
    }
  } else if (dateRange.match(/^\d{4}-\d{2}$/)) {
    // Format: 2024-01
    const [year, month] = dateRange.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    return { start: startDate, end: endDate };
  }

  return null;
}

/**
 * Parse date range for economic events (includes future dates)
 */
export function parseDateRangeForEvents(dateRange: string): { start: Date; end: Date } | null {
  const now = new Date();

  // Handle future date ranges
  if (dateRange.includes('next')) {
    const match = dateRange.match(/next (\d+) (day|week|month)s?/i);
    if (match) {
      const amount = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      const endDate = new Date(now);

      if (unit === 'day') endDate.setDate(now.getDate() + amount);
      else if (unit === 'week') endDate.setDate(now.getDate() + (amount * 7));
      else if (unit === 'month') endDate.setMonth(now.getMonth() + amount);

      return { start: now, end: endDate };
    }
  }

  // Handle "this week", "next week", etc.
  if (dateRange.toLowerCase().includes('this week')) {
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start of this week (Sunday)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // End of this week (Saturday)
    return { start: startOfWeek, end: endOfWeek };
  }

  if (dateRange.toLowerCase().includes('next week')) {
    const startOfNextWeek = new Date(now);
    startOfNextWeek.setDate(now.getDate() + (7 - now.getDay())); // Start of next week
    const endOfNextWeek = new Date(startOfNextWeek);
    endOfNextWeek.setDate(startOfNextWeek.getDate() + 6); // End of next week
    return { start: startOfNextWeek, end: endOfNextWeek };
  }

  // Handle "today", "tomorrow"
  if (dateRange.toLowerCase() === 'today') {
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    return { start: startOfDay, end: endOfDay };
  }

  if (dateRange.toLowerCase() === 'tomorrow') {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const startOfDay = new Date(tomorrow);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(tomorrow);
    endOfDay.setHours(23, 59, 59, 999);
    return { start: startOfDay, end: endOfDay };
  }

  // Fall back to the regular parseDateRange for past dates
  return parseDateRange(dateRange);
}

/**
 * Extract trade IDs from database query results
 */
export function extractTradeIdsFromResults(results: any[]): string[] {
  const tradeIds: string[] = [];
  // Extract trade_id from results
  for (const result of results) {
    if (result.trade_id && typeof result.trade_id === 'string') {
      tradeIds.push(result.trade_id);
    }
  }

  // Remove duplicates
  return Array.from(new Set(tradeIds));
}
