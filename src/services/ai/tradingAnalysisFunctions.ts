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

export interface TradingAnalysisResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface SearchTradesParams {
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
  economicEventCurrency?: 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD' | 'CAD' | 'CHF' | 'all';
  economicEventName?: string;
}

export interface GetStatisticsParams {
  period?: string;
  groupBy?: 'day' | 'week' | 'month' | 'session' | 'tag' | 'dayOfWeek' | 'economicEvent';
  tradeType?: 'win' | 'loss' | 'breakeven' | 'all';
  // Economic events analysis
  includeEconomicEventStats?: boolean;
  economicEventImpact?: 'High' | 'Medium' | 'Low' | 'all';
}

export interface FindSimilarTradesParams {
  query: string;
  limit?: number;
}

export interface QueryDatabaseParams {
  query: string;
  description?: string;
}

export interface AnalyzeEconomicEventsParams {
  impactLevel?: 'High' | 'Medium' | 'Low' | 'all';
  currency?: 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD' | 'CAD' | 'CHF' | 'all';
  eventName?: string;
  dateRange?: string;
  compareWithoutEvents?: boolean;
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

      

      return {
        success: true,
        data: {
          trades: filteredTrades,
          count: filteredTrades.length,
          totalPnl: filteredTrades.reduce((sum, trade) => sum + trade.amount, 0),
          winRate: this.calculateWinRate(filteredTrades)
        }
      };

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

      return {
        success: true,
        data: stats
      };

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

      return {
        success: true,
        data: {
          trades: actualTrades,
          searchResults: similarTrades,
          count: actualTrades.length,
          query: params.query
        }
      };

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
      const analysis = {
        tradesWithEvents: {
          count: tradesWithEvents.length,
          totalPnl: tradesWithEvents.reduce((sum, trade) => sum + trade.amount, 0),
          winRate: this.calculateWinRate(tradesWithEvents),
          avgPnl: tradesWithEvents.length > 0 ?
            tradesWithEvents.reduce((sum, trade) => sum + trade.amount, 0) / tradesWithEvents.length : 0
        },
        tradesWithoutEvents: {
          count: tradesWithoutEvents.length,
          totalPnl: tradesWithoutEvents.reduce((sum, trade) => sum + trade.amount, 0),
          winRate: this.calculateWinRate(tradesWithoutEvents),
          avgPnl: tradesWithoutEvents.length > 0 ?
            tradesWithoutEvents.reduce((sum, trade) => sum + trade.amount, 0) / tradesWithoutEvents.length : 0
        },
        economicEventStats: this.calculateEconomicEventStats(tradesWithEvents, params.impactLevel),
        trades: tradesWithEvents.slice(0, 50) // Limit to 50 trades for performance
      };

      return {
        success: true,
        data: analysis
      };

    } catch (error) {
      logger.error('Error in analyzeEconomicEvents:', error);
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

      // Also handle views that might reference trade_embeddings data
      const viewNames = [
        'user_trade_embeddings_summary',
        'trade_embeddings_by_session',
        'trade_embeddings_by_day',
        'trade_embeddings_by_month',
        'trade_embeddings_tag_analysis'
      ];

      for (const viewName of viewNames) {
        if (queryLower.includes(viewName) && !queryLower.includes('user_id')) {
          const userFilter = `user_id = '${this.userId}'`;
          const calendarFilter = `calendar_id = '${this.calendar?.id}'`;
          const combinedFilter = `${userFilter} AND ${calendarFilter}`;

          if (queryLower.includes('where')) {
            finalQuery = finalQuery.replace(/where/i, `WHERE ${combinedFilter} AND`);
          } else {
            const regex = new RegExp(`from\\s+${viewName}`, 'i');
            finalQuery = finalQuery.replace(regex, `FROM ${viewName} WHERE ${combinedFilter}`);
          }
          break; // Only apply filter once
        }
      }

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
          const foundTrades = this.trades.filter(trade => tradeIds.includes(trade.id));

          // Only create lightweight versions if there are more than 20 trades
          trades = foundTrades.length > 20
            ? foundTrades.map(trade => ({
                ...trade,
                images: [] // Remove images to avoid serialization issues
              }))
            : foundTrades; // Keep full data for 20 or fewer trades
        }
      }

      // No fallback needed - multi-step function calling handles this intelligently

      return {
        success: true,
        data: {
          results: results,
          query: finalQuery,
          description: params.description,
          rowCount: rowCount,
          trades: trades.length > 0 ? trades : undefined,
          count: trades.length,
          totalPnl: trades.reduce((sum, trade) => sum + trade.amount, 0),
          winRate: this.calculateWinRate(trades)
        }
      };

    } catch (error) {
      logger.error('Error in queryDatabase:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Helper methods
  private extractTradeIdsFromResults(results: any[]): string[] {
    const tradeIds: string[] = [];

    // If no results, return empty array
    if (!results || results.length === 0) {
      return [];
    }

    // Check if we're dealing with aggregated data from views
    const firstResult = results[0];
    const isAggregatedData =
      'trade_count' in firstResult ||
      'win_count' in firstResult ||
      'tag_count' in firstResult;

    // If this is aggregated data from views, we can't extract trade IDs
    if (isAggregatedData) {
      return [];
    }

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
}

export const tradingAnalysisFunctions = new TradingAnalysisFunctions();
