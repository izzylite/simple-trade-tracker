/**
 * Similar trades search functionality for AI trading analysis
 */

import { Trade } from '../../../types/trade';
import { Calendar } from '../../../types/calendar';
import { logger } from '../../../utils/logger';
import { vectorSearchService } from '../vectorSearchService';
import { FindSimilarTradesParams, TradingAnalysisResult } from './types';
import { handleCacheKeyResult, simpleTradeData } from './utils';

/**
 * Find trades similar to given criteria using vector search
 */
export async function findSimilarTrades(
  trades: Trade[],
  calendar: Calendar | null,
  userId: string,
  maxContextTrades: number,
  params: FindSimilarTradesParams
): Promise<TradingAnalysisResult> {
  try {
    logger.log('AI requested similar trades search with query:', params.query);

    if (!calendar) {
      return {
        success: false,
        error: 'Calendar not available for vector search'
      };
    }

    const similarTrades = await vectorSearchService.searchSimilarTrades(
      params.query,
      userId,
      calendar.id,
      {
        maxResults: params.limit || maxContextTrades,
        similarityThreshold: 0.3
      }
    );

    // Get the actual trade objects
    const tradeIds = similarTrades.map(st => st.tradeId);
    const actualTrades = trades.filter(trade => tradeIds.includes(trade.id));

    logger.log(`Found ${actualTrades.length} actual trades from vector search results`);

    const resultData = {
      trades: simpleTradeData(actualTrades),
      searchResults: similarTrades,
      count: actualTrades.length,
      query: params.query
    };

    return handleCacheKeyResult('findSimilarTrades', resultData, params.returnCacheKey, resultData.trades);

  } catch (error) {
    logger.error('Error in findSimilarTrades:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
