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
export function simpleTradeData(trades: Trade[]): Omit<Trade, 'images' | 'is_deleted' | 'is_temporary' | 'is_pinned' | 'share_link' | 'is_shared' | 'shared_at' | 'share_id'>[] {
  return trades.map(trade => ({
    id: trade.id,
    calendar_id: trade.calendar_id,
    user_id: trade.user_id,
    name: trade.name,
    trade_date: trade.trade_date,
    session: trade.session,
    trade_type: trade.trade_type,
    amount: trade.amount,
    tags: trade.tags,
    entry_price: trade.entry_price,
    exit_price: trade.exit_price,
    risk_to_reward: trade.risk_to_reward,
    partials_taken: trade.partials_taken,
    economic_events: trade.economic_events,
    notes: trade.notes,
    created_at: trade.created_at,
    updated_at: trade.updated_at
  }));
}

/**
 * Calculate win rate from trades
 */
export function calculateWinRate(trades: Trade[]): number {
  if (trades.length === 0) return 0;
  const wins = trades.filter(trade => trade.trade_type === 'win').length;
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
    const date = new Date(trade.trade_date);
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
      total_pnl: groupTrades.reduce((sum, trade) => sum + trade.amount, 0),
      win_rate: calculateWinRate(groupTrades)
    };
  });

  return summary;
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
