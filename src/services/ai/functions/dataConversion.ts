/**
 * Data conversion functions for AI trading analysis
 */

import { Trade } from '../../../types/trade';
import { logger } from '../../../utils/logger';
import { 
  ExtractTradeIdsParams, 
  ConvertTradeIdsToCardsParams, 
  ConvertTradeIdsToDataParams, 
  TradingAnalysisResult 
} from './types';
import { handleCacheKeyResult, simpleTradeData, calculateWinRate } from './utils';

/**
 * Filter trade fields based on requested fields
 */
export function filterTradeFields(trades: Trade[], fields?: string[], includeImages?: boolean): any[] {
  if (!fields || fields.includes('all')) {
    return includeImages ? trades : simpleTradeData(trades);
  }

  return trades.map(trade => {
    const filteredTrade: any = {};

    fields.forEach(field => {
      switch (field) {
        case 'id':
          filteredTrade.id = trade.id;
          break;
        case 'name':
          filteredTrade.name = trade.name;
          break;
        case 'date':
          filteredTrade.date = trade.date;
          break;
        case 'type':
          filteredTrade.type = trade.type;
          break;
        case 'amount':
          filteredTrade.amount = trade.amount;
          break;
        case 'entry':
          filteredTrade.entry = trade.entry;
          break;
        case 'exit':
          filteredTrade.exit = trade.exit;
          break;
        case 'riskToReward':
          filteredTrade.riskToReward = trade.riskToReward;
          break;
        case 'session':
          filteredTrade.session = trade.session;
          break;
        case 'tags':
          filteredTrade.tags = trade.tags;
          break;
        case 'notes':
          filteredTrade.notes = trade.notes;
          break;
        case 'partialsTaken':
          filteredTrade.partialsTaken = trade.partialsTaken;
          break;
        case 'economicEvents':
          filteredTrade.economicEvents = trade.economicEvents;
          break;
        case 'images':
          if (includeImages) {
            filteredTrade.images = trade.images;
          }
          break;
      }
    });

    return filteredTrade;
  });
}

/**
 * Filter economic event fields based on requested fields
 */
export function filterEconomicEventFields(events: any[], fields?: string[]): any[] {
  if (!fields || fields.includes('all')) {
    return events;
  }

  return events.map(event => {
    const filteredEvent: any = {};

    fields.forEach(field => {
      switch (field) {
        case 'id':
          filteredEvent.id = event.id;
          break;
        case 'currency':
          filteredEvent.currency = event.currency;
          break;
        case 'event':
          filteredEvent.event = event.event;
          break;
        case 'impact':
          filteredEvent.impact = event.impact;
          break;
        case 'timeUtc':
          filteredEvent.timeUtc = event.timeUtc;
          break;
        case 'date':
          filteredEvent.date = event.date;
          break;
        case 'flagCode':
          filteredEvent.flagCode = event.flagCode;
          break;
        case 'time':
          filteredEvent.time = event.time;
          break;
        case 'actual':
          filteredEvent.actual = event.actual;
          break;
        case 'forecast':
          filteredEvent.forecast = event.forecast;
          break;
        case 'previous':
          filteredEvent.previous = event.previous;
          break;
      }
    });

    return filteredEvent;
  });
}

/**
 * Extract trade IDs from trade objects or trade data
 */
export async function extractTradeIds(params: ExtractTradeIdsParams): Promise<TradingAnalysisResult> {
  try {
    logger.log('AI requested trade ID extraction from trades:', params.trades?.length || 0);

    if (!params.trades || !Array.isArray(params.trades)) {
      return {
        success: false,
        error: 'Invalid trades parameter. Expected an array of trade objects.'
      };
    }

    if (params.trades.length === 0) {
      return {
        success: true,
        data: {
          tradeIds: [],
          count: 0,
          message: 'No trades provided to extract IDs from.'
        }
      };
    }

    // Extract trade IDs from various possible formats
    const tradeIds: string[] = [];
    const invalidTrades: any[] = [];

    params.trades.forEach((trade, index) => {
      let tradeId: string | null = null;

      // Try different possible ID field names
      if (typeof trade === 'object' && trade !== null) {
        // Standard trade object with 'id' field
        if (trade.id && typeof trade.id === 'string') {
          tradeId = trade.id;
        }
        // Alternative field names
        else if (trade.tradeId && typeof trade.tradeId === 'string') {
          tradeId = trade.tradeId;
        }
        else if (trade.trade_id && typeof trade.trade_id === 'string') {
          tradeId = trade.trade_id;
        }
        // If it's just a string, assume it's the ID
        else if (typeof trade === 'string') {
          tradeId = trade;
        }
      }
      // If the trade itself is a string, assume it's the ID
      else if (typeof trade === 'string') {
        tradeId = trade;
      }

      if (tradeId) {
        tradeIds.push(tradeId);
      } else {
        invalidTrades.push({ index, trade });
      }
    });

    // Remove duplicates
    const uniqueTradeIds = Array.from(new Set(tradeIds));

    logger.log(`Extracted ${uniqueTradeIds.length} unique trade IDs from ${params.trades.length} trades`);

    const data = {
      tradeIds: uniqueTradeIds,
      count: uniqueTradeIds.length,
      totalProcessed: params.trades.length,
      duplicatesRemoved: tradeIds.length - uniqueTradeIds.length,
      invalidTrades: invalidTrades.length,
      ...(invalidTrades.length > 0 && {
        invalidTradesDetails: invalidTrades.slice(0, 5) // Show first 5 invalid trades for debugging
      })
    };

    // Handle cache key logic
    return handleCacheKeyResult('extractTradeIds', data, params.returnCacheKey, uniqueTradeIds);

  } catch (error) {
    logger.error('Error in extractTradeIds:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Convert trade IDs to simple JSON format for aiResponseParser.ts to handle
 */
export async function convertTradeIdsToCards(
  trades: Trade[],
  params: ConvertTradeIdsToCardsParams
): Promise<TradingAnalysisResult> {
  try {
    logger.log('AI requested trade IDs to cards conversion:', params.tradeIds?.length || 0);

    if (!params.tradeIds || !Array.isArray(params.tradeIds)) {
      return {
        success: false,
        error: 'Invalid tradeIds parameter. Expected an array of trade ID strings.'
      };
    }

    if (params.tradeIds.length === 0) {
      return {
        success: true,
        data: {
          tradeCards: [],
          title: 'No Trades',
          message: 'No trade IDs provided to convert to cards.'
        }
      };
    }

    // Find trades matching the provided IDs to validate they exist
    const matchingTrades = trades.filter(trade =>
      params.tradeIds.includes(trade.id)
    );

    if (matchingTrades.length === 0) {
      return {
        success: true,
        data: {
          tradeCards: [],
          title: 'No Matching Trades',
          message: 'No trades found matching the provided trade IDs.',
          requestedIds: params.tradeIds.length
        }
      };
    }

    // Sort trade IDs if requested (based on the actual trade data)
    let sortedTradeIds = [...params.tradeIds];
    if (params.sortBy && matchingTrades.length > 0) {
      // Create a map of trade ID to trade for sorting
      const tradeMap = new Map(matchingTrades.map(trade => [trade.id, trade]));

      sortedTradeIds = params.tradeIds
        .filter(id => tradeMap.has(id)) // Only include IDs that have matching trades
        .sort((idA, idB) => {
          const tradeA = tradeMap.get(idA)!;
          const tradeB = tradeMap.get(idB)!;
          let comparison = 0;

          switch (params.sortBy) {
            case 'date':
              comparison = new Date(tradeA.date).getTime() - new Date(tradeB.date).getTime();
              break;
            case 'amount':
              comparison = tradeA.amount - tradeB.amount;
              break;
            case 'name':
              comparison = (tradeA.name || '').localeCompare(tradeB.name || '');
              break;
            default:
              comparison = 0;
          }

          return params.sortOrder === 'desc' ? -comparison : comparison;
        });
    } else {
      // Filter to only include IDs that have matching trades
      sortedTradeIds = params.tradeIds.filter(id =>
        matchingTrades.some(trade => trade.id === id)
      );
    }

    // Generate title based on parameters
    let title = 'Trade Cards';
    if (params.sortBy) {
      const sortLabel = params.sortBy === 'date' ? 'Date' :
        params.sortBy === 'amount' ? 'P&L' : 'Name';
      const orderLabel = params.sortOrder === 'desc' ? 'Descending' : 'Ascending';
      title = `Trades (${sortLabel} ${orderLabel})`;
    }

    logger.log(`Prepared ${sortedTradeIds.length} trade IDs for card display`);

    // Return simple JSON format that aiResponseParser.ts expects
    const resultData = {
      tradeCards: sortedTradeIds,
      title: title,
      count: sortedTradeIds.length,
      requestedIds: params.tradeIds.length,
      foundTrades: matchingTrades.length,
      notFoundIds: params.tradeIds.filter(id =>
        !matchingTrades.some(trade => trade.id === id)
      ),
      sorting: {
        sortBy: params.sortBy || 'none',
        sortOrder: params.sortOrder || 'asc'
      }
    };

    // Use the sorted trade IDs as examples
    return handleCacheKeyResult('convertTradeIdsToCards', resultData, params.returnCacheKey, sortedTradeIds);

  } catch (error) {
    logger.error('Error in convertTradeIdsToCards:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Convert trade IDs to full trade data for analysis
 */
export async function convertTradeIdsToData(
  trades: Trade[],
  params: ConvertTradeIdsToDataParams
): Promise<TradingAnalysisResult> {
  try {
    logger.log('AI requested trade IDs to data conversion:', params.tradeIds?.length || 0, 'fields:', params.fields);

    if (!params.tradeIds || !Array.isArray(params.tradeIds)) {
      return {
        success: false,
        error: 'Invalid tradeIds parameter. Expected an array of trade ID strings.'
      };
    }

    if (params.tradeIds.length === 0) {
      return {
        success: true,
        data: {
          trades: [],
          count: 0,
          message: 'No trade IDs provided to convert to data.'
        }
      };
    }

    // Find trades matching the provided IDs
    const matchingTrades = trades.filter(trade =>
      params.tradeIds.includes(trade.id)
    );

    if (matchingTrades.length === 0) {
      return {
        success: true,
        data: {
          trades: [],
          count: 0,
          message: 'No trades found matching the provided trade IDs.',
          requestedIds: params.tradeIds.length,
          notFoundIds: params.tradeIds
        }
      };
    }

    // Filter fields based on request
    const tradesData = filterTradeFields(matchingTrades, params.fields, params.includeImages);

    const notFoundIds = params.tradeIds.filter(id =>
      !matchingTrades.some(trade => trade.id === id)
    );

    logger.log(`Converted ${matchingTrades.length} trade IDs to filtered trade data`);

    const resultData = {
      trades: tradesData,
      count: matchingTrades.length,
      requestedIds: params.tradeIds.length,
      foundTrades: matchingTrades.length,
      notFoundIds: notFoundIds,
      totalPnl: matchingTrades.reduce((sum, trade) => sum + trade.amount, 0),
      winRate: calculateWinRate(matchingTrades),
      includedFields: params.fields || ['all'],
      includesImages: params.includeImages || false
    };

    return handleCacheKeyResult('convertTradeIdsToData', resultData, params.returnCacheKey, tradesData);

  } catch (error) {
    logger.error('Error in convertTradeIdsToData:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
