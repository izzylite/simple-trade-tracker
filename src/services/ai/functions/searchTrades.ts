/**
 * Search trades functionality for AI trading analysis
 */

import { Trade } from '../../../types/trade';
import { logger } from '../../../utils/logger';
import { isTradeInSession, getSessionMappings } from '../../../utils/sessionTimeUtils';
import { SearchTradesParams, TradingAnalysisResult } from './types';
import { handleCacheKeyResult, simpleTradeData, calculateWinRate } from './utils';
import { filterTradeFields } from './dataConversion';

/**
 * Search for trades based on criteria
 */
export async function searchTrades(
  trades: Trade[],
  params: SearchTradesParams
): Promise<TradingAnalysisResult> {
  try {
    logger.log('AI requested trade search with params:', params);

    // Validate parameters
    if (params.limit && (params.limit < 1 || params.limit > 1000)) {
      return {
        success: false,
        error: 'Limit must be between 1 and 1000'
      };
    }

    if (params.minAmount !== undefined && params.maxAmount !== undefined && params.minAmount > params.maxAmount) {
      return {
        success: false,
        error: 'Minimum amount cannot be greater than maximum amount'
      };
    }

    let filteredTrades = [...trades];

    // Filter by trade type
    if (params.tradeType && params.tradeType !== 'all') {
      filteredTrades = filteredTrades.filter(trade => {
        if (params.tradeType === 'win') return trade.trade_type === 'win';
        if (params.tradeType === 'loss') return trade.trade_type === 'loss';
        if (params.tradeType === 'breakeven') return trade.trade_type === 'breakeven';
        return true;
      });
    }

    // Filter by amount range
    if (params.minAmount !== undefined) {
      filteredTrades = filteredTrades.filter(trade => Math.abs(trade.amount) >= params.minAmount!);
    }
    if (params.maxAmount !== undefined) {
      filteredTrades = filteredTrades.filter(trade => Math.abs(trade.amount) <= params.maxAmount!);
    }

    // Filter by tags
    if (params.tags && params.tags.length > 0) {
      filteredTrades = filteredTrades.filter(trade =>
        params.tags!.some((tag: string) => trade.tags?.includes(tag))
      );
    }

    // Filter by economic events presence
    if (params.hasEconomicEvents !== undefined) {
      filteredTrades = filteredTrades.filter(trade => {
        const hasEvents = trade.economic_events && trade.economic_events.length > 0;
        return params.hasEconomicEvents ? hasEvents : !hasEvents;
      });
    }

    // Filter by economic event impact
    if (params.economicEventImpact && params.economicEventImpact !== 'all') {
      filteredTrades = filteredTrades.filter(trade => {
        if (!trade.economic_events || trade.economic_events.length === 0) return false;
        return trade.economic_events.some(event => event.impact === params.economicEventImpact);
      });
    }

    // Filter by economic event currency
    if (params.economicEventCurrency && params.economicEventCurrency !== 'all') {
      filteredTrades = filteredTrades.filter(trade => {
        if (!trade.economic_events || trade.economic_events.length === 0) return false;
        return trade.economic_events.some(event => event.currency === params.economicEventCurrency);
      });
    }

    // Filter by economic event name (partial match)
    if (params.economicEventName) {
      const searchTerm = params.economicEventName.toLowerCase();
      filteredTrades = filteredTrades.filter(trade => {
        if (!trade.economic_events || trade.economic_events.length === 0) return false;
        return trade.economic_events.some(event =>
          event.name.toLowerCase().includes(searchTerm)
        );
      });
    }

    // Filter by economic event names (exact match for any of the provided names)
    if (params.economicNames) {
      // Validate that economicNames is an array
      if (!Array.isArray(params.economicNames)) {
        return {
          success: false,
          error: `economicNames must be an array of strings, got: ${typeof params.economicNames}. If you're trying to use a placeholder like "EXTRACT_EVENT_NAMES", use executeMultipleFunctions instead of sequential function calls.`
        };
      }

      if (params.economicNames.length > 0) {
        const eventNamesLower = params.economicNames.map(name => name.toLowerCase());
        filteredTrades = filteredTrades.filter(trade => {
          if (!trade.economic_events || trade.economic_events.length === 0) return false;
          return trade.economic_events.some(event =>
            eventNamesLower.includes(event.name.toLowerCase())
          );
        });
      }
    }

    // Filter by session
    if (params.session) {
      filteredTrades = filteredTrades.filter(trade => {
        // First check if trade has explicit session field that matches
        if (trade.session) {
          // Handle direct session name matches
          if (trade.session === params.session) {
            return true;
          }

          // Handle legacy session name mappings
          const mappedSessions = getSessionMappings(params.session!);
          if (mappedSessions.includes(trade.session)) {
            return true;
          }
        }

        // Fallback to DST-aware time-based filtering for trades without session field
        const tradeDate = new Date(trade.trade_date);
        return isTradeInSession(tradeDate, params.session!);
      });
    }

    // Filter by day of week
    if (params.dayOfWeek) {
      const targetDay = params.dayOfWeek.toLowerCase();
      filteredTrades = filteredTrades.filter(trade => {
        const tradeDate = new Date(trade.trade_date);
        const dayName = tradeDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        return dayName === targetDay;
      });
    }

    // Filter by date range
    if (params.dateRange) {
      const startDate = new Date(params.dateRange.start);
      const endDate = new Date(params.dateRange.end);

      filteredTrades = filteredTrades.filter(trade => {
        const tradeDate = new Date(trade.trade_date);
        return tradeDate >= startDate && tradeDate <= endDate;
      });
    }

    // Apply limit
    if (params.limit) {
      filteredTrades = filteredTrades.slice(0, params.limit);
    }

    // Apply field filtering based on request
    const tradesData = filterTradeFields(filteredTrades, params.fields, false);

    const resultData = {
      trades: tradesData,
      count: filteredTrades.length,
      total_pnl: filteredTrades.reduce((sum, trade) => sum + trade.amount, 0),
      win_rate: calculateWinRate(filteredTrades),
      includedFields: params.fields || ['default']
    };

    return handleCacheKeyResult('searchTrades', resultData, params.returnCacheKey, resultData.trades);

  } catch (error) {
    logger.error('Error in searchTrades:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
