/**
 * Search trades functionality for AI trading analysis
 */

import { Trade } from '../../../types/trade';
import { logger } from '../../../utils/logger';
import { isTradeInSession, getSessionMappings } from '../../../utils/sessionTimeUtils';
import { SearchTradesParams, TradingAnalysisResult } from './types';
import { handleCacheKeyResult, simpleTradeData, calculateWinRate, parseDateRange } from './utils';
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
        if (params.tradeType === 'win') return trade.type === 'win';
        if (params.tradeType === 'loss') return trade.type === 'loss';
        if (params.tradeType === 'breakeven') return trade.type === 'breakeven';
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
        const hasEvents = trade.economicEvents && trade.economicEvents.length > 0;
        return params.hasEconomicEvents ? hasEvents : !hasEvents;
      });
    }

    // Filter by economic event impact
    if (params.economicEventImpact && params.economicEventImpact !== 'all') {
      filteredTrades = filteredTrades.filter(trade => {
        if (!trade.economicEvents || trade.economicEvents.length === 0) return false;
        return trade.economicEvents.some(event => event.impact === params.economicEventImpact);
      });
    }

    // Filter by economic event currency
    if (params.economicEventCurrency && params.economicEventCurrency !== 'all') {
      filteredTrades = filteredTrades.filter(trade => {
        if (!trade.economicEvents || trade.economicEvents.length === 0) return false;
        return trade.economicEvents.some(event => event.currency === params.economicEventCurrency);
      });
    }

    // Filter by economic event name (partial match)
    if (params.economicEventName) {
      const searchTerm = params.economicEventName.toLowerCase();
      filteredTrades = filteredTrades.filter(trade => {
        if (!trade.economicEvents || trade.economicEvents.length === 0) return false;
        return trade.economicEvents.some(event =>
          event.name.toLowerCase().includes(searchTerm)
        );
      });
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
        const tradeDate = new Date(trade.date);
        return isTradeInSession(tradeDate, params.session!);
      });
    }

    // Filter by day of week
    if (params.dayOfWeek) {
      const targetDay = params.dayOfWeek.toLowerCase();
      filteredTrades = filteredTrades.filter(trade => {
        const tradeDate = new Date(trade.date);
        const dayName = tradeDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        return dayName === targetDay;
      });
    }

    // Filter by date range
    if (params.dateRange) {
      const now = new Date();
      let startDate: Date | null = null;

      if (params.dateRange.includes('last')) {
        const match = params.dateRange.match(/last (\d+) (day|week|month)s?/i);
        if (match) {
          const amount = parseInt(match[1]);
          const unit = match[2].toLowerCase();
          startDate = new Date(now);

          if (unit === 'day') startDate.setDate(now.getDate() - amount);
          else if (unit === 'week') startDate.setDate(now.getDate() - (amount * 7));
          else if (unit === 'month') startDate.setMonth(now.getMonth() - amount);
        }
      } else if (params.dateRange.match(/^\d{4}-\d{2}$/)) {
        // Format: 2024-01
        const [year, month] = params.dateRange.split('-').map(Number);
        startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);

        filteredTrades = filteredTrades.filter(trade => {
          const tradeDate = new Date(trade.date);
          return tradeDate >= startDate! && tradeDate <= endDate;
        });
      }

      if (startDate) {
        filteredTrades = filteredTrades.filter(trade =>
          new Date(trade.date) >= startDate!
        );
      }
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
      totalPnl: filteredTrades.reduce((sum, trade) => sum + trade.amount, 0),
      winRate: calculateWinRate(filteredTrades),
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
