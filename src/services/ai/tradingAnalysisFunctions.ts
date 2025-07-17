/**
 * Trading Analysis Functions
 * Functions that the AI can call to dynamically fetch and analyze trading data
 */

import { Trade } from '../../types/trade';
import { Calendar } from '../../types/calendar';
import { vectorSearchService } from './vectorSearchService';
import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';
import { isTradeInSession, getSessionMappings } from '../../utils/sessionTimeUtils';
import { economicCalendarService } from '../economicCalendarService';
import { EconomicEvent, Currency, ImpactLevel } from '../../types/economicCalendar';
import { DEFAULT_ECONOMIC_EVENT_FILTER_SETTINGS as DEFAULT_ECONOMIC_EVENT_FILTER_SETTINGS } from '../../components/economicCalendar/EconomicCalendarDrawer';
import { aiFunctionExecution } from './aiFunctionExecutionCall';

export interface TradingAnalysisResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface SearchTradesParams {
  returnCacheKey?: boolean;
  dateRange?: string;
  tradeType?: 'win' | 'loss' | 'breakeven' | 'all';
  minAmount?: number;
  maxAmount?: number;
  tags?: string[];
  session?: 'Asia' | 'London' | 'NY AM' | 'NY PM' | 'london' | 'new-york' | 'tokyo' | 'sydney';
  dayOfWeek?: string;
  limit?: number;
  // Economic events filtering
  hasEconomicEvents?: boolean;
  economicEventImpact?: 'High' | 'Medium' | 'Low' | 'all';
  economicEventCurrency?: 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD' | 'CAD' | 'CHF' | 'NZD' | 'all';
  economicEventName?: string;
}

export interface FunctionCall {
  name: string;
  args: any;
}

export interface ExecuteMultipleFunctionsParams {
  functions: FunctionCall[];
  description?: string;
}

export interface GetStatisticsParams {
  returnCacheKey?: boolean;
  period?: string;
  groupBy?: 'day' | 'week' | 'month' | 'session' | 'tag' | 'dayOfWeek' | 'economicEvent';
  tradeType?: 'win' | 'loss' | 'breakeven' | 'all';
  tradeIds?: string[]; // Filter statistics to specific trade IDs
  // Economic events analysis
  includeEconomicEventStats?: boolean;
  economicEventImpact?: 'High' | 'Medium' | 'Low' | 'all';
}

export interface FindSimilarTradesParams {
  returnCacheKey?: boolean;
  query: string;
  limit?: number;
}

export interface QueryDatabaseParams {
  returnCacheKey?: boolean;
  query: string;
  description?: string;
}

export interface AnalyzeEconomicEventsParams {
  returnCacheKey?: boolean;
  impactLevel?: 'High' | 'Medium' | 'Low' | 'all';
  currency?: 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD' | 'CAD' | 'CHF' | 'NZD' | 'all';
  eventName?: string;
  dateRange?: string;
  compareWithoutEvents?: boolean;
}

export interface FetchEconomicEventsParams {
  returnCacheKey?: boolean;
  startDate?: string; // Unix timestamp in milliseconds or date string
  endDate?: string; // Unix timestamp in milliseconds or date string
  currency?: 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD' | 'CAD' | 'CHF' | 'NZD' | 'all';
  impact?: 'High' | 'Medium' | 'all'; // Low impact events excluded for cost efficiency
  dateRange?: string; // "next 7 days", "this week", "next week", etc.
  limit?: number;
}

export interface ExtractTradeIdsParams {
  returnCacheKey?: boolean;
  trades: any[]; // Array of trade objects or trade data
}

export interface ConvertTradeIdsToCardsParams {
  returnCacheKey?: boolean;
  tradeIds: string[]; // Array of trade IDs to convert to card format
  sortBy?: 'date' | 'amount' | 'name'; // Sort order for the cards
  sortOrder?: 'asc' | 'desc'; // Sort direction
}

export interface ConvertTradeIdsToDataParams {
  returnCacheKey?: boolean;
  tradeIds: string[]; // Array of trade IDs to convert to full trade data
  includeImages?: boolean; // Whether to include image data (default: false for performance)
  fields?: string[]; // Specific fields to include in the response
}

class TradingAnalysisFunctions {
  private trades: Trade[] = [];
  private calendar: Calendar | null = null;
  private userId: string = '';
  private maxContextTrades = 100;

  /**
   * Initialize with current trading data
   */
  initialize(trades: Trade[], calendar: Calendar, maxContextTrades = 100) {
    this.trades = trades;
    this.calendar = calendar;
    this.userId = calendar.userId;
    this.maxContextTrades = maxContextTrades;
  }

  /**
   * Check if reinitialization is needed
   */
  needsReinitialization(trades: Trade[], calendar: Calendar): boolean {
    return this.calendar?.id !== calendar.id ||
      this.trades.length !== trades.length ||
      this.userId !== calendar.userId;
  }

  /**
   * Handle cache key logic for function results
   */
  private handleCacheKeyResult(
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

  simpleTradeData(trades: Trade[]): Omit<Trade, 'images' | 'isDeleted' | 'isTemporary' | 'isPinned' | 'shareLink' | 'isShared' | 'sharedAt' | 'shareId'>[] {
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
   * Search for trades based on criteria
   */
  async searchTrades(params: SearchTradesParams): Promise<TradingAnalysisResult> {
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

      let filteredTrades = [...this.trades];

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
          params.tags!.some(tag => trade.tags?.includes(tag))
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

      const resultData = {
        trades: this.simpleTradeData(filteredTrades),
        count: filteredTrades.length,
        totalPnl: filteredTrades.reduce((sum, trade) => sum + trade.amount, 0),
        winRate: this.calculateWinRate(filteredTrades)
      };



      return this.handleCacheKeyResult('searchTrades', resultData, params.returnCacheKey, resultData.trades);

    } catch (error) {
      logger.error('Error in searchTrades:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get statistical analysis of trades
   */
  async getTradeStatistics(params: GetStatisticsParams): Promise<TradingAnalysisResult> {
    try {
      logger.log('AI requested trade statistics with params:', params);

      let tradesToAnalyze = [...this.trades];


      // Filter by specific trade IDs if provided
      if (params.tradeIds && params.tradeIds.length > 0) {
        tradesToAnalyze = tradesToAnalyze.filter(trade =>
          params.tradeIds!.includes(trade.id)
        );
        logger.log(`Filtered to ${tradesToAnalyze.length} trades by trade IDs:`, params.tradeIds);
      }

      // Filter by trade type if specified
      if (params.tradeType && params.tradeType !== 'all') {
        tradesToAnalyze = tradesToAnalyze.filter(trade => {
          if (params.tradeType === 'win') return trade.type === 'win';
          if (params.tradeType === 'loss') return trade.type === 'loss';
          if (params.tradeType === 'breakeven') return trade.type === 'breakeven';
          return true;
        });
      }

      const stats = {
        totalTrades: tradesToAnalyze.length,
        totalPnl: tradesToAnalyze.reduce((sum, trade) => sum + trade.amount, 0),
        winRate: this.calculateWinRate(tradesToAnalyze),
        averagePnl: tradesToAnalyze.length > 0 ?
          tradesToAnalyze.reduce((sum, trade) => sum + trade.amount, 0) / tradesToAnalyze.length : 0,
        bestTrade: this.getBestTrade(tradesToAnalyze),
        worstTrade: this.getWorstTrade(tradesToAnalyze),
        groupedData: this.groupTradesByPeriod(tradesToAnalyze, params.groupBy || 'month'),
        ...(params.includeEconomicEventStats && {
          economicEventStats: this.calculateEconomicEventStats(tradesToAnalyze, params.economicEventImpact)
        })
      };


      return this.handleCacheKeyResult('getTradeStatistics', stats, params.returnCacheKey, this.simpleTradeData(tradesToAnalyze));

    } catch (error) {
      logger.error('Error in getTradeStatistics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Find trades similar to given criteria using vector search
   */
  async findSimilarTrades(params: FindSimilarTradesParams): Promise<TradingAnalysisResult> {
    try {
      logger.log('AI requested similar trades search with query:', params.query);

      if (!this.calendar) {
        return {
          success: false,
          error: 'Calendar not available for vector search'
        };
      }

      const similarTrades = await vectorSearchService.searchSimilarTrades(
        params.query,
        this.userId,
        this.calendar.id,
        {
          maxResults: params.limit || this.maxContextTrades,
          similarityThreshold: 0.3
        }
      );

      // Get the actual trade objects
      const tradeIds = similarTrades.map(st => st.tradeId);
      const actualTrades = this.trades.filter(trade => tradeIds.includes(trade.id));

      logger.log(`Found ${actualTrades.length} actual trades from vector search results`);

      const resultData = {
        trades: this.simpleTradeData(actualTrades),
        searchResults: similarTrades,
        count: actualTrades.length,
        query: params.query
      };


      return this.handleCacheKeyResult('findSimilarTrades', resultData, params.returnCacheKey, resultData.trades);

    } catch (error) {
      logger.error('Error in findSimilarTrades:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Analyze economic events correlation with trading performance
   */
  async analyzeEconomicEvents(params: AnalyzeEconomicEventsParams): Promise<TradingAnalysisResult> {
    try {
      logger.log('AI requested economic events analysis with params:', params);

      let tradesWithEvents = this.trades.filter(trade =>
        trade.economicEvents && trade.economicEvents.length > 0
      );

      let tradesWithoutEvents = this.trades.filter(trade =>
        !trade.economicEvents || trade.economicEvents.length === 0
      );

      // Apply filters
      if (params.impactLevel && params.impactLevel !== 'all') {
        tradesWithEvents = tradesWithEvents.filter(trade =>
          trade.economicEvents!.some(event => event.impact === params.impactLevel)
        );
      }

      if (params.currency && params.currency !== 'all') {
        tradesWithEvents = tradesWithEvents.filter(trade =>
          trade.economicEvents!.some(event => event.currency === params.currency)
        );
      }

      if (params.eventName) {
        const searchTerm = params.eventName.toLowerCase();
        tradesWithEvents = tradesWithEvents.filter(trade =>
          trade.economicEvents!.some(event =>
            event.name.toLowerCase().includes(searchTerm)
          )
        );
      }

      // Apply date range filter
      if (params.dateRange) {
        const dateFilter = this.parseDateRange(params.dateRange);
        if (dateFilter) {
          tradesWithEvents = tradesWithEvents.filter(trade =>
            trade.date >= dateFilter.start && trade.date <= dateFilter.end
          );
          tradesWithoutEvents = tradesWithoutEvents.filter(trade =>
            trade.date >= dateFilter.start && trade.date <= dateFilter.end
          );
        }
      }

      // Calculate detailed analysis
      const analysis: any = {
        tradesWithEvents: {
          count: tradesWithEvents.length,
          totalPnl: tradesWithEvents.reduce((sum, trade) => sum + trade.amount, 0),
          winRate: this.calculateWinRate(tradesWithEvents),
          avgPnl: tradesWithEvents.length > 0 ?
            tradesWithEvents.reduce((sum, trade) => sum + trade.amount, 0) / tradesWithEvents.length : 0
        },
        economicEventStats: this.calculateEconomicEventStats(tradesWithEvents, params.impactLevel),
        trades: this.simpleTradeData(tradesWithEvents)
      };

      // Include comparison with trades without events if requested
      if (params.compareWithoutEvents) {
        analysis.tradesWithoutEvents = {
          count: tradesWithoutEvents.length,
          totalPnl: tradesWithoutEvents.reduce((sum, trade) => sum + trade.amount, 0),
          winRate: this.calculateWinRate(tradesWithoutEvents),
          avgPnl: tradesWithoutEvents.length > 0 ?
            tradesWithoutEvents.reduce((sum, trade) => sum + trade.amount, 0) / tradesWithoutEvents.length : 0
        };

        // Add comparison metrics
        analysis.comparison = {
          winRateDifference: analysis.tradesWithEvents.winRate - analysis.tradesWithoutEvents.winRate,
          avgPnlDifference: analysis.tradesWithEvents.avgPnl - analysis.tradesWithoutEvents.avgPnl,
          totalPnlDifference: analysis.tradesWithEvents.totalPnl - analysis.tradesWithoutEvents.totalPnl
        };
      }


      return this.handleCacheKeyResult('analyzeEconomicEvents', analysis, params.returnCacheKey, this.simpleTradeData(tradesWithEvents));

    } catch (error) {
      logger.error('Error in analyzeEconomicEvents:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Extract trade IDs from trade objects or trade data
   */
  async extractTradeIds(params: ExtractTradeIdsParams): Promise<TradingAnalysisResult> {
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
      return this.handleCacheKeyResult('extractTradeIds', data, params.returnCacheKey, uniqueTradeIds);

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
  async convertTradeIdsToCards(params: ConvertTradeIdsToCardsParams): Promise<TradingAnalysisResult> {
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
      const matchingTrades = this.trades.filter(trade =>
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
      return this.handleCacheKeyResult('convertTradeIdsToCards', resultData, params.returnCacheKey, sortedTradeIds);

    } catch (error) {
      logger.error('Error in convertTradeIdsToCards:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Fetch economic events from Firebase
   */
  async fetchEconomicEvents(params: FetchEconomicEventsParams): Promise<TradingAnalysisResult> {
    try {
      logger.log('AI requested economic events fetch with params:', params);

      // Parse date range or use specific dates
      let startDate: Date;
      let endDate: Date;

      if (params.dateRange) {
        const dateRange = this.parseDateRangeForEvents(params.dateRange);
        if (!dateRange) {
          return {
            success: false,
            error: 'Invalid date range format'
          };
        }
        startDate = dateRange.start;
        endDate = dateRange.end;
      } else {
        // Use provided dates or default to next 7 days
        if (params.startDate) {
          // Check if it's a Unix timestamp (number) or date string
          const startTimestamp = parseInt(params.startDate);
          startDate = isNaN(startTimestamp) ? new Date(params.startDate) : new Date(startTimestamp);
        } else {
          startDate = new Date(); // Today
        }

        if (params.endDate) {
          const endTimestamp = parseInt(params.endDate);
          endDate = isNaN(endTimestamp) ? new Date(params.endDate) : new Date(endTimestamp);
        } else {
          endDate = new Date();
          endDate.setDate(endDate.getDate() + 7); // Next 7 days
        }
      }

      // Build filters
      const filters: {
        currencies?: Currency[];
        impacts?: ImpactLevel[];
        onlyUpcoming?: boolean;
      } = {};

      if (params.currency && params.currency !== 'all') {
        filters.currencies = [params.currency as Currency];
      }
      else {
        filters.currencies = this.calendar!.economicCalendarFilters?.currencies || DEFAULT_ECONOMIC_EVENT_FILTER_SETTINGS.currencies;
      }

      // Only fetch High and Medium impact events to reduce costs and focus on relevant events
      if (params.impact && params.impact !== 'all') {
        filters.impacts = [params.impact as ImpactLevel];
      } else {
        // Default to High and Medium impact only
        filters.impacts = ['High', 'Medium'] as ImpactLevel[];
      }

      // For future events, set onlyUpcoming to true
      if (startDate > new Date()) {
        filters.onlyUpcoming = true;
      }

      // Set default limit to prevent expensive Firebase reads
      const defaultLimit = 50; // Reasonable default for chat responses
      const maxLimit = 300; // Maximum allowed limit
      const effectiveLimit = params.limit
        ? Math.min(params.limit, maxLimit)
        : defaultLimit;

      // Use pagination to limit Firebase reads
      const paginatedResult = await economicCalendarService.fetchEventsPaginated(
        { start: startDate, end: endDate },
        { pageSize: effectiveLimit },
        filters
      );

      const limitedEvents = paginatedResult.events;
      logger.log(`Fetched ${limitedEvents.length} economic events from Firebase`);

      // Sort by unixTimestamp if available, otherwise by time
      limitedEvents.sort((a, b) => {
        const timeA = a.unixTimestamp || new Date(a.timeUtc).getTime();
        const timeB = b.unixTimestamp || new Date(b.timeUtc).getTime();
        return timeA - timeB;
      });

      const resultData = {
        events: limitedEvents,
        count: limitedEvents.length,
        hasMore: paginatedResult.hasMore,
        limitApplied: effectiveLimit,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        filters: {
          currency: params.currency || 'all',
          impact: params.impact || 'all'
        }
      };

      // No trade IDs for economic events
      return this.handleCacheKeyResult('fetchEconomicEvents', resultData, params.returnCacheKey, limitedEvents);

    } catch (error) {
      logger.error('Error in fetchEconomicEvents:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Execute a SQL query against the Supabase database
   */
  async queryDatabase(params: QueryDatabaseParams): Promise<TradingAnalysisResult> {
    try {
      logger.log('AI requested database query:', params.query);

      // Ensure we have a calendar for filtering
      if (!this.calendar) {
        return {
          success: false,
          error: 'Calendar not available for database queries'
        };
      }

      // Security: Only allow SELECT queries and specific safe operations
      const sanitizedQuery = params.query.trim();
      const queryLower = sanitizedQuery.toLowerCase();

      // Basic security checks
      if (!queryLower.startsWith('select')) {
        return {
          success: false,
          error: 'Only SELECT queries are allowed for security reasons'
        };
      }

      // Prevent potentially dangerous operations
      const dangerousKeywords = ['drop', 'delete', 'update', 'insert', 'alter', 'create', 'truncate'];
      if (dangerousKeywords.some(keyword => queryLower.includes(keyword))) {
        return {
          success: false,
          error: 'Query contains potentially dangerous operations. Only SELECT queries are allowed.'
        };
      }

      // Add user and calendar filtering to ensure users only see their own data
      let finalQuery = sanitizedQuery;
      if (queryLower.includes('trade_embeddings') && !queryLower.includes('user_id')) {
        // Automatically add user_id and calendar_id filters for trade_embeddings table
        const userFilter = `user_id = '${this.userId}'`;
        const calendarFilter = `calendar_id = '${this.calendar?.id}'`;
        const combinedFilter = `${userFilter} AND ${calendarFilter}`;

        if (queryLower.includes('where')) {
          finalQuery = sanitizedQuery.replace(/where/i, `WHERE ${combinedFilter} AND`);
        } else {
          finalQuery = sanitizedQuery.replace(/from\s+trade_embeddings/i, `FROM trade_embeddings WHERE ${combinedFilter}`);
        }
      }

      // Note: Database views have been removed as they are redundant.
      // The AI performs all aggregations directly on the trade_embeddings table.
      // All queries should use the main trade_embeddings table with proper user/calendar filtering.

      // Execute the query
      logger.log('Executing final query:', finalQuery);
      const { data, error } = await supabase.rpc('execute_sql', {
        sql_query: finalQuery
      });

      if (error) {
        logger.error('Database query error:', error);
        logger.error('Query that failed:', finalQuery);

        // Check if the function doesn't exist
        if (error.message?.includes('function execute_sql') || error.code === '42883') {
          return {
            success: false,
            error: 'The execute_sql function is not deployed to Supabase. Please run the SQL functions from src/database/supabase-sql-functions-fixed.sql in your Supabase SQL Editor.'
          };
        }

        return {
          success: false,
          error: `Database query failed: ${error.message}`
        };
      }

      // Check if the function returned an error
      if (data && typeof data === 'object' && data.error) {
        return {
          success: false,
          error: `SQL execution failed: ${data.message}`
        };
      }

      // Extract results from the function response
      const results = data && data.data ? data.data : data;
      const rowCount = data && data.row_count ? data.row_count : (Array.isArray(results) ? results.length : 0);

      // Try to extract trade IDs from results and fetch corresponding trades
      let trades: Trade[] = [];
      if (Array.isArray(results) && results.length > 0) {
        logger.log(`Found ${results.length} results from query, attempting to extract trade IDs`);
        const tradeIds = this.extractTradeIdsFromResults(results);
        if (tradeIds.length > 0) {
          trades = this.trades.filter(trade => tradeIds.includes(trade.id));
        }
      }

      // No fallback needed - multi-step function calling handles this intelligently

      const resultData = {
        results: results,
        query: finalQuery,
        description: params.description,
        rowCount: rowCount,
        trades: this.simpleTradeData(trades),
        count: trades.length,
        totalPnl: trades.reduce((sum, trade) => sum + trade.amount, 0),
        winRate: this.calculateWinRate(trades)
      };


      return this.handleCacheKeyResult('queryDatabase', resultData, params.returnCacheKey, trades);

    } catch (error) {
      logger.error('Error in queryDatabase:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Helper methods

  /**
   * Extract trades array from function result data
   */
  private extractTrades(result: any): any[] {
    if (!result) return [];

    // Handle different result formats
    if (Array.isArray(result)) {
      return result;
    }

    if (result.trades && Array.isArray(result.trades)) {
      return result.trades;
    }

    if (result.data && Array.isArray(result.data)) {
      return result.data;
    }

    if (result.data && result.data.trades && Array.isArray(result.data.trades)) {
      return result.data.trades;
    }

    return [];
  }

  /**
   * Parse indices from placeholder string (e.g., "MERGE_TRADE_IDS_0_1_2" -> [0, 1, 2])
   */
  private parseIndices(value: string, prefix: string): number[] {
    const indexPart = value.replace(prefix, '');
    if (!indexPart) return [];

    return indexPart.split('_')
      .map(str => parseInt(str))
      .filter(num => !isNaN(num));
  }

  /**
   * Merge trade IDs from multiple results
   */
  private mergeTradeIds(previousResults: any[], indices: number[]): string[] {
    const allTradeIds: string[] = [];

    for (const index of indices) {
      if (index >= 0 && index < previousResults.length) {
        const result = previousResults[index].result;
        const tradeIds = this.extractTradeIdsFromResult(result);
        allTradeIds.push(...tradeIds);
      }
    }

    return allTradeIds;
  }

  /**
   * Find intersection of trade IDs from multiple results
   */
  private intersectTradeIds(previousResults: any[], indices: number[]): string[] {
    if (indices.length === 0) return [];

    const tradeSets = indices.map(index => {
      if (index >= 0 && index < previousResults.length) {
        const result = previousResults[index].result;
        const tradeIds = this.extractTradeIdsFromResult(result);
        return new Set(tradeIds);
      }
      return new Set<string>();
    }).filter(set => set.size > 0);

    if (tradeSets.length === 0) return [];

    // Find intersection of all sets
    let intersection = tradeSets[0];
    for (let i = 1; i < tradeSets.length; i++) {
      intersection = new Set(Array.from(intersection).filter(id => tradeSets[i].has(id)));
    }

    return Array.from(intersection);
  }

  /**
   * Extract trade IDs from various result formats
   */
  private extractTradeIdsFromResult(result: any): string[] {
    if (!result) return [];

    // Handle array of trade IDs
    if (Array.isArray(result)) {
      return result.filter(item => typeof item === 'string');
    }

    // Handle result with tradeIds property
    if (result.tradeIds && Array.isArray(result.tradeIds)) {
      return result.tradeIds;
    }

    // Handle result with data.tradeIds
    if (result.data && result.data.tradeIds && Array.isArray(result.data.tradeIds)) {
      return result.data.tradeIds;
    }

    // Handle result with trades array - extract IDs
    const trades = this.extractTrades(result);
    return trades.map(trade => trade.id || trade.tradeId || trade.trade_id).filter(Boolean);
  }

  private extractTradeIdsFromResults(results: any[]): string[] {
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

  private calculateWinRate(trades: Trade[]): number {
    if (trades.length === 0) return 0;
    const wins = trades.filter(trade => trade.type === 'win').length;
    return (wins / trades.length) * 100;
  }

  private getBestTrade(trades: Trade[]): Trade | null {
    if (trades.length === 0) return null;
    return trades.reduce((best, trade) =>
      trade.amount > best.amount ? trade : best
    );
  }

  private getWorstTrade(trades: Trade[]): Trade | null {
    if (trades.length === 0) return null;
    return trades.reduce((worst, trade) =>
      trade.amount < worst.amount ? trade : worst
    );
  }

  private groupTradesByPeriod(trades: Trade[], groupBy: string): any {
    const groups: { [key: string]: Trade[] } = {};

    trades.forEach(trade => {
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
        winRate: this.calculateWinRate(groupTrades)
      };
    });

    return summary;
  }

  private parseDateRange(dateRange: string): { start: Date; end: Date } | null {
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

  private parseDateRangeForEvents(dateRange: string): { start: Date; end: Date } | null {
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
    return this.parseDateRange(dateRange);
  }

  private calculateEconomicEventStats(trades: Trade[], impactFilter?: string): any {
    const tradesWithEvents = trades.filter(trade =>
      trade.economicEvents && trade.economicEvents.length > 0
    );

    if (tradesWithEvents.length === 0) {
      return {
        totalTradesWithEvents: 0,
        percentageWithEvents: 0,
        eventImpactBreakdown: {},
        eventCurrencyBreakdown: {},
        mostCommonEvents: []
      };
    }

    // Filter by impact if specified
    let eventsToAnalyze = tradesWithEvents;
    if (impactFilter && impactFilter !== 'all') {
      eventsToAnalyze = tradesWithEvents.filter(trade =>
        trade.economicEvents!.some(event => event.impact === impactFilter)
      );
    }

    // Calculate impact breakdown
    const impactBreakdown: { [key: string]: { count: number; winRate: number; avgPnl: number } } = {};
    const currencyBreakdown: { [key: string]: { count: number; winRate: number; avgPnl: number } } = {};
    const eventNameCounts: { [key: string]: number } = {};

    eventsToAnalyze.forEach(trade => {
      trade.economicEvents!.forEach(event => {
        // Impact breakdown
        if (!impactBreakdown[event.impact]) {
          impactBreakdown[event.impact] = { count: 0, winRate: 0, avgPnl: 0 };
        }
        impactBreakdown[event.impact].count++;

        // Currency breakdown
        if (!currencyBreakdown[event.currency]) {
          currencyBreakdown[event.currency] = { count: 0, winRate: 0, avgPnl: 0 };
        }
        currencyBreakdown[event.currency].count++;

        // Event name counts
        eventNameCounts[event.name] = (eventNameCounts[event.name] || 0) + 1;
      });
    });

    // Calculate win rates and average P&L for each category
    Object.keys(impactBreakdown).forEach(impact => {
      const tradesForImpact = eventsToAnalyze.filter(trade =>
        trade.economicEvents!.some(event => event.impact === impact)
      );
      impactBreakdown[impact].winRate = this.calculateWinRate(tradesForImpact);
      impactBreakdown[impact].avgPnl = tradesForImpact.reduce((sum, trade) => sum + trade.amount, 0) / tradesForImpact.length;
    });

    Object.keys(currencyBreakdown).forEach(currency => {
      const tradesForCurrency = eventsToAnalyze.filter(trade =>
        trade.economicEvents!.some(event => event.currency === currency)
      );
      currencyBreakdown[currency].winRate = this.calculateWinRate(tradesForCurrency);
      currencyBreakdown[currency].avgPnl = tradesForCurrency.reduce((sum, trade) => sum + trade.amount, 0) / tradesForCurrency.length;
    });

    // Get most common events
    const mostCommonEvents = Object.entries(eventNameCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    return {
      totalTradesWithEvents: tradesWithEvents.length,
      percentageWithEvents: (tradesWithEvents.length / trades.length) * 100,
      eventImpactBreakdown: impactBreakdown,
      eventCurrencyBreakdown: currencyBreakdown,
      mostCommonEvents,
      winRateWithEvents: this.calculateWinRate(tradesWithEvents),
      winRateWithoutEvents: this.calculateWinRate(trades.filter(trade =>
        !trade.economicEvents || trade.economicEvents.length === 0
      ))
    };
  }

  /**
   * Execute multiple functions in sequence and return the final result
   * This allows the AI to combine multiple function calls into a single request
   */
  async executeMultipleFunctions(params: ExecuteMultipleFunctionsParams): Promise<TradingAnalysisResult> {
    try {
      logger.log('Executing multiple functions:', params.functions.map(f => f.name));

      if (!params.functions || params.functions.length === 0) {
        return {
          success: false,
          error: 'No functions provided to execute'
        };
      }

      const results: any[] = [];
      let lastResult: any = null;

      // Validate that functions don't use returnCacheKey (placeholders need actual data)
      for (const functionCall of params.functions) {
        if (functionCall.args && functionCall.args.returnCacheKey === true) {
          logger.error(`❌ CRITICAL ERROR: Function ${functionCall.name} in executeMultipleFunctions uses returnCacheKey=true. This breaks placeholder functionality!`);
          logger.error(`Remove returnCacheKey from function arguments in executeMultipleFunctions - placeholders need actual data, not cache keys.`);
          return {
            success: false,
            error: `Function ${functionCall.name} incorrectly uses returnCacheKey=true in executeMultipleFunctions. Placeholders need actual data, not cache keys. Remove returnCacheKey from the function arguments.`
          };
        }
      }

      // Execute functions sequentially
      for (let i = 0; i < params.functions.length; i++) {
        const functionCall = params.functions[i];
        logger.log(`Executing function ${i + 1}/${params.functions.length}: ${functionCall.name}`);

        // Process arguments to handle references to previous results
        const processedArgs = this.processMultiFunctionArgs(functionCall.args, results, lastResult);

        // Execute the function (preserve cache for all but the last function)
        const preserveCache = i < params.functions.length - 1;
        const result = await aiFunctionExecution.executeFunctionCall(functionCall.name, processedArgs, preserveCache);

        if (!result.success) {
          logger.error(`Function ${functionCall.name} failed:`, result.error);
          return {
            success: false,
            error: `Function ${functionCall.name} failed: ${result.error}`,
            data: {
              completedFunctions: results,
              failedFunction: functionCall.name,
              failedAt: i + 1
            }
          };
        }

        results.push({
          functionName: functionCall.name,
          args: processedArgs,
          result: result.data
        });

        lastResult = result.data;
      }

      logger.log('All functions executed successfully');

      // Clean up any remaining cache keys from this multi-function execution
      aiFunctionExecution.cleanupCacheKeys(results);

      return {
        success: true,
        data: {
          description: params.description || 'Multiple functions executed successfully',
          functions: results,
          finalResult: lastResult,
          totalFunctions: params.functions.length
        }
      };

    } catch (error) {
      logger.error('Error executing multiple functions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error executing multiple functions'
      };
    }
  }

  /**
   * Process arguments for multi-function calls, handling references to previous results
   */
  private processMultiFunctionArgs(args: any, previousResults: any[], lastResult: any): any {
    if (!args || typeof args !== 'object') {
      return args;
    }

    const processedArgs = { ...args };

    // Handle special placeholders that reference previous results
    for (const [key, value] of Object.entries(processedArgs)) {
      if (typeof value === 'string') {
        processedArgs[key] = this.processPlaceholder(value, previousResults, lastResult, key);
      }
    }

    return processedArgs;
  }

  /**
   * Process individual placeholder values
   */
  private processPlaceholder(value: string, previousResults: any[], lastResult: any, _key: string): any {
    // Handle field-specific extraction (e.g., EXTRACT_0.trades.id, EXTRACT_LAST.statistics.winRate)
    if (value.startsWith('EXTRACT_') && value.includes('.')) {
      return this.processFieldExtraction(value, previousResults, lastResult);
    }

    // Handle array operations (e.g., MERGE_TRADE_IDS_0_2, UNIQUE_TRADE_IDS_0_1_2)
    if (value.startsWith('MERGE_') || value.startsWith('UNIQUE_') || value.startsWith('INTERSECT_')) {
      return this.processArrayOperation(value, previousResults);
    }

    // Handle transformations (e.g., SLICE_0.trades.0.5, FILTER_1.trades.type.win)
    if (value.startsWith('SLICE_') || value.startsWith('FILTER_') || value.startsWith('SORT_')) {
      return this.processTransformation(value, previousResults, lastResult);
    }

    // Handle reference to last result
    if (value === 'LAST_RESULT') {
      return lastResult;
    }

    // Handle reference to specific function result by index
    if (value.startsWith('RESULT_')) {
      const index = parseInt(value.replace('RESULT_', ''));
      if (index >= 0 && index < previousResults.length) {
        return previousResults[index].result;
      }
    }

    // Handle reference to trade IDs from previous result
    if (value === 'EXTRACT_TRADE_IDS' && lastResult) {
      return this.extractTradeIds(lastResult);
    }

    // Handle indexed trade ID extraction (e.g., EXTRACT_TRADE_IDS_0)
    if (value.startsWith('EXTRACT_TRADE_IDS_')) {
      const index = parseInt(value.replace('EXTRACT_TRADE_IDS_', ''));
      if (index >= 0 && index < previousResults.length) {
        return this.extractTradeIds(previousResults[index].result);
      }
    }

    // Handle reference to trades array from previous result
    if (value === 'EXTRACT_TRADES' && lastResult) {
      return this.extractTrades(lastResult);
    }

    // Handle indexed trades extraction (e.g., EXTRACT_TRADES_1)
    if (value.startsWith('EXTRACT_TRADES_')) {
      const index = parseInt(value.replace('EXTRACT_TRADES_', ''));
      if (index >= 0 && index < previousResults.length) {
        return this.extractTrades(previousResults[index].result);
      }
    }

    // Handle cache keys from different functions
    if (value.startsWith('ai_function_result_')) {
      return value;
    }

    return value;
  }

  /**
   * Process field-specific extraction (e.g., EXTRACT_0.trades.id, EXTRACT_LAST.statistics.winRate)
   */
  private processFieldExtraction(value: string, previousResults: any[], lastResult: any): any {
    const match = value.match(/^EXTRACT_(\d+|LAST)\.(.+)$/);
    if (!match) {
      logger.warn(`Invalid field extraction format: ${value}. Expected format: EXTRACT_0.field.path or EXTRACT_LAST.field.path`);
      return [];
    }

    const [, indexStr, fieldPath] = match;
    const targetResult = indexStr === 'LAST' ? lastResult : previousResults[parseInt(indexStr)]?.result;
    
    if (!targetResult) {
      logger.warn(`Cannot extract from ${indexStr}: result not found. Available results: 0-${previousResults.length - 1}`);
      return [];
    }

    return this.extractNestedField(targetResult, fieldPath, `EXTRACT_${indexStr}`);
  }

  /**
   * Extract nested field from object using dot notation
   */
  private extractNestedField(obj: any, path: string, context: string): any {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      if (current && typeof current === 'object') {
        // Handle array access with special processing for trades
        if (part === 'id' && Array.isArray(current)) {
          return current.map((item: any) => item.id || item.tradeId || item.trade_id).filter(Boolean);
        }
        
        current = current[part];
      } else {
        const availableFields = current && typeof current === 'object' ? Object.keys(current) : [];
        logger.warn(`Cannot access field '${part}' in ${context}.${parts.slice(0, i).join('.')}. Available fields: ${availableFields.join(', ')}`);
        return [];
      }
    }
    
    return current || [];
  }

  /**
   * Process array operations (MERGE, UNIQUE, INTERSECT)
   */
  private processArrayOperation(value: string, previousResults: any[]): any {
    if (value.startsWith('MERGE_TRADE_IDS_')) {
      const indices = this.parseIndices(value, 'MERGE_TRADE_IDS_');
      return this.mergeTradeIds(previousResults, indices);
    }
    
    if (value.startsWith('UNIQUE_TRADE_IDS_')) {
      const indices = this.parseIndices(value, 'UNIQUE_TRADE_IDS_');
      const merged = this.mergeTradeIds(previousResults, indices);
      return Array.from(new Set(merged));
    }

    if (value.startsWith('INTERSECT_TRADE_IDS_')) {
      const indices = this.parseIndices(value, 'INTERSECT_TRADE_IDS_');
      return this.intersectTradeIds(previousResults, indices);
    }

    if (value.startsWith('MERGE_TRADES_')) {
      const indices = this.parseIndices(value, 'MERGE_TRADES_');
      return this.mergeTrades(previousResults, indices);
    }

    if (value.startsWith('UNIQUE_TRADES_')) {
      const indices = this.parseIndices(value, 'UNIQUE_TRADES_');
      const merged = this.mergeTrades(previousResults, indices);
      return this.uniqueTradesById(merged);
    }

    if (value.startsWith('INTERSECT_TRADES_')) {
      const indices = this.parseIndices(value, 'INTERSECT_TRADES_');
      return this.intersectTrades(previousResults, indices);
    }
    
    logger.warn(`Unknown array operation: ${value}`);
    return [];
  }

  /**
   * Process transformations (SLICE, FILTER, SORT)
   */
  private processTransformation(value: string, previousResults: any[], lastResult: any): any {
    // SLICE_0.trades.0.5 - Take first 5 trades from result 0
    if (value.startsWith('SLICE_')) {
      return this.processSliceTransformation(value, previousResults, lastResult);
    }

    // FILTER_1.trades.type.win - Filter to only winning trades from result 1
    if (value.startsWith('FILTER_')) {
      return this.processFilterTransformation(value, previousResults, lastResult);
    }

    // SORT_0.trades.amount.desc - Sort trades by amount descending from result 0
    if (value.startsWith('SORT_')) {
      return this.processSortTransformation(value, previousResults, lastResult);
    }

    logger.warn(`Unknown transformation: ${value}`);
    return [];
  }

  /**
   * Process slice transformation (e.g., SLICE_0.trades.0.5, SLICE_LAST.trades.10.20)
   */
  private processSliceTransformation(value: string, previousResults: any[], lastResult: any): any {
    const match = value.match(/^SLICE_(\d+|LAST)\.(.+)\.(\d+)\.(\d+)$/);
    if (!match) {
      logger.warn(`Invalid slice format: ${value}. Expected: SLICE_0.trades.0.5`);
      return [];
    }

    const [, indexStr, fieldPath, startStr, endStr] = match;
    const targetResult = indexStr === 'LAST' ? lastResult : previousResults[parseInt(indexStr)]?.result;
    
    if (!targetResult) {
      logger.warn(`Cannot slice from ${indexStr}: result not found`);
      return [];
    }

    const data = this.extractNestedField(targetResult, fieldPath, `SLICE_${indexStr}`);
    if (!Array.isArray(data)) {
      logger.warn(`Cannot slice non-array data from ${indexStr}.${fieldPath}`);
      return [];
    }

    const start = parseInt(startStr);
    const end = parseInt(endStr);
    
    return data.slice(start, end);
  }

  /**
   * Process filter transformation (e.g., FILTER_0.trades.type.win, FILTER_1.trades.amount.>100)
   */
  private processFilterTransformation(value: string, previousResults: any[], lastResult: any): any {
    const match = value.match(/^FILTER_(\d+|LAST)\.(.+)\.(.+)\.(.+)$/);
    if (!match) {
      logger.warn(`Invalid filter format: ${value}. Expected: FILTER_0.trades.type.win`);
      return [];
    }

    const [, indexStr, fieldPath, filterField, filterValue] = match;
    const targetResult = indexStr === 'LAST' ? lastResult : previousResults[parseInt(indexStr)]?.result;
    
    if (!targetResult) {
      logger.warn(`Cannot filter from ${indexStr}: result not found`);
      return [];
    }

    const data = this.extractNestedField(targetResult, fieldPath, `FILTER_${indexStr}`);
    if (!Array.isArray(data)) {
      logger.warn(`Cannot filter non-array data from ${indexStr}.${fieldPath}`);
      return [];
    }

    return this.applyFilter(data, filterField, filterValue);
  }

  /**
   * Process sort transformation (e.g., SORT_0.trades.amount.desc, SORT_1.trades.date.asc)
   */
  private processSortTransformation(value: string, previousResults: any[], lastResult: any): any {
    const match = value.match(/^SORT_(\d+|LAST)\.(.+)\.(.+)\.(asc|desc)$/);
    if (!match) {
      logger.warn(`Invalid sort format: ${value}. Expected: SORT_0.trades.amount.desc`);
      return [];
    }

    const [, indexStr, fieldPath, sortField, direction] = match;
    const targetResult = indexStr === 'LAST' ? lastResult : previousResults[parseInt(indexStr)]?.result;
    
    if (!targetResult) {
      logger.warn(`Cannot sort from ${indexStr}: result not found`);
      return [];
    }

    const data = this.extractNestedField(targetResult, fieldPath, `SORT_${indexStr}`);
    if (!Array.isArray(data)) {
      logger.warn(`Cannot sort non-array data from ${indexStr}.${fieldPath}`);
      return [];
    }

    return this.applySort(data, sortField, direction as 'asc' | 'desc');
  }

  /**
   * Apply filter to array based on field and value
   */
  private applyFilter(data: any[], filterField: string, filterValue: string): any[] {
    return data.filter(item => {
      const fieldValue = item[filterField];
      
      // Handle comparison operators
      if (filterValue.startsWith('>')) {
        const compareValue = parseFloat(filterValue.substring(1));
        return !isNaN(compareValue) && parseFloat(fieldValue) > compareValue;
      }
      
      if (filterValue.startsWith('<')) {
        const compareValue = parseFloat(filterValue.substring(1));
        return !isNaN(compareValue) && parseFloat(fieldValue) < compareValue;
      }
      
      if (filterValue.startsWith('>=')) {
        const compareValue = parseFloat(filterValue.substring(2));
        return !isNaN(compareValue) && parseFloat(fieldValue) >= compareValue;
      }
      
      if (filterValue.startsWith('<=')) {
        const compareValue = parseFloat(filterValue.substring(2));
        return !isNaN(compareValue) && parseFloat(fieldValue) <= compareValue;
      }
      
      // Handle special values
      if (filterValue === 'win') {
        return fieldValue === 'win' || (typeof fieldValue === 'number' && fieldValue > 0);
      }
      
      if (filterValue === 'loss') {
        return fieldValue === 'loss' || (typeof fieldValue === 'number' && fieldValue < 0);
      }
      
      // Exact match
      return fieldValue === filterValue || fieldValue?.toString() === filterValue;
    });
  }

  /**
   * Apply sort to array based on field and direction
   */
  private applySort(data: any[], sortField: string, direction: 'asc' | 'desc'): any[] {
    return [...data].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      // Handle different data types
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      if (aValue instanceof Date && bValue instanceof Date) {
        return direction === 'asc' ? aValue.getTime() - bValue.getTime() : bValue.getTime() - aValue.getTime();
      }
      
      // String comparison
      const aStr = aValue?.toString() || '';
      const bStr = bValue?.toString() || '';
      
      if (direction === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });
  }

  /**
   * Merge trades from multiple results
   */
  private mergeTrades(previousResults: any[], indices: number[]): any[] {
    const allTrades: any[] = [];
    
    for (const index of indices) {
      if (index >= 0 && index < previousResults.length) {
        const result = previousResults[index].result;
        const trades = this.extractTrades(result);
        allTrades.push(...trades);
      } else {
        logger.warn(`Invalid index ${index} for merging trades. Available: 0-${previousResults.length - 1}`);
      }
    }
    
    return allTrades;
  }

  /**
   * Get unique trades by ID
   */
  private uniqueTradesById(trades: any[]): any[] {
    const seen = new Set<string>();
    return trades.filter(trade => {
      const id = trade.id || trade.tradeId || trade.trade_id;
      if (id && !seen.has(id)) {
        seen.add(id);
        return true;
      }
      return false;
    });
  }

  /**
   * Find intersection of trades from multiple results
   */
  private intersectTrades(previousResults: any[], indices: number[]): any[] {
    if (indices.length === 0) return [];
    
    const tradeSets = indices.map(index => {
      if (index >= 0 && index < previousResults.length) {
        const trades = this.extractTrades(previousResults[index].result);
        const tradeMap = new Map();
        trades.forEach((trade: any) => {
          const id = trade.id || trade.tradeId || trade.trade_id;
          if (id) tradeMap.set(id, trade);
        });
        return tradeMap;
      }
      return new Map();
    }).filter(map => map.size > 0);

    if (tradeSets.length === 0) return [];
    
    // Find intersection of all sets
    const firstSet = tradeSets[0];
    const intersectionTrades: any[] = [];
    
    Array.from(firstSet.entries()).forEach(([id, trade]) => {
      if (tradeSets.every(set => set.has(id))) {
        intersectionTrades.push(trade);
      }
    });
    
    return intersectionTrades;
  }

  /**
   * Convert trade IDs to full trade data for analysis
   */
  async convertTradeIdsToData(params: ConvertTradeIdsToDataParams): Promise<TradingAnalysisResult> {
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
      const matchingTrades = this.trades.filter(trade =>
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
      const tradesData = this.filterTradeFields(matchingTrades, params.fields, params.includeImages);

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
        winRate: this.calculateWinRate(matchingTrades),
        includedFields: params.fields || ['all'],
        includesImages: params.includeImages || false
      };

      return this.handleCacheKeyResult('convertTradeIdsToData', resultData, params.returnCacheKey, tradesData);

    } catch (error) {
      logger.error('Error in convertTradeIdsToData:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Filter trade fields based on requested fields
   */
  private filterTradeFields(trades: Trade[], fields?: string[], includeImages?: boolean): any[] {
    if (!fields || fields.includes('all')) {
      return includeImages ? trades : this.simpleTradeData(trades);
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
 

}

export const tradingAnalysisFunctions = new TradingAnalysisFunctions();













