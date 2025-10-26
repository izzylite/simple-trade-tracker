// @ts-nocheck
/**
 * Similar trades search functionality for AI trading analysis
 *
 * NOTE: Vector search functionality has been removed.
 * This file is kept for reference but is not used in production.
 */

import { Trade } from '../../../types/dualWrite';
import { Calendar } from '../../../types/dualWrite';
import { logger } from '../../../utils/logger';
// import { vectorSearchService } from '../vectorSearchService';
import { FindSimilarTradesParams, TradingAnalysisResult } from './types';
import { handleCacheKeyResult } from './utils';
import { filterTradeFields } from './dataConversion';

/* eslint-disable */
// @ts-nocheck

/**
 * Find trades similar to given criteria using vector search
 */
export async function findSimilarTrades(
  trades: Trade[],
  calendar: Calendar | null,
  userId: string,
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
        maxResults: params.limit,
        similarityThreshold: 0.3
      }
    );

    // Get the actual trade objects
    const tradeIds = similarTrades.map(st => st.tradeId);
    const actualTrades = trades.filter(trade => tradeIds.includes(trade.id));

    logger.log(`Found ${actualTrades.length} actual trades from vector search results`);

    // Apply field filtering based on request
    const tradesData = filterTradeFields(actualTrades, params.fields, false);

    const resultData = {
      trades: tradesData,
      searchResults: similarTrades,
      count: actualTrades.length,
      query: params.query,
      includedFields: params.fields || ['default']
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
