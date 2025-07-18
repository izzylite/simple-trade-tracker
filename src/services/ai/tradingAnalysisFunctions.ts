/**
 * Trading Analysis Functions
 * Functions that the AI can call to dynamically fetch and analyze trading data
 */

import { Trade } from '../../types/trade';
import { Calendar } from '../../types/calendar';
import { ExecuteMultipleFunctionsParams } from './multiFunctionExecutor';
import {
  TradingAnalysisResult,
  SearchTradesParams,
  GetStatisticsParams,
  FindSimilarTradesParams,
  QueryDatabaseParams,
  AnalyzeEconomicEventsParams,
  FetchEconomicEventsParams,
  ExtractTradeIdsParams,
  ConvertTradeIdsToCardsParams,
  ConvertTradeIdsToDataParams
} from './functions/types';


// Interfaces moved to functions/types.ts

// Import individual function modules
import { searchTrades } from './functions/searchTrades';
import { getTradeStatistics } from './functions/getTradeStatistics';
import { findSimilarTrades } from './functions/findSimilarTrades';
import { analyzeEconomicEvents, fetchEconomicEvents } from './functions/economicEvents';
import { extractTradeIds, convertTradeIdsToCards, convertTradeIdsToData } from './functions/dataConversion';
import { queryDatabase } from './functions/databaseQuery';
import { executeMultipleFunctions, getAvailablePlaceholderPatterns, getDataStructureInfo } from './functions/multiFunctionExecution';

class TradingAnalysisFunctions {
  private trades: Trade[] = [];
  private calendar: Calendar | null = null;
  private userId: string = '';

  /**
   * Initialize with current trading data
   */
  initialize(trades: Trade[], calendar: Calendar) {
    this.trades = trades;
    this.calendar = calendar;
    this.userId = calendar.userId;
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
   * Search for trades based on criteria
   */
  async searchTrades(params: SearchTradesParams): Promise<TradingAnalysisResult> {
    return searchTrades(this.trades, params);
  }

  /**
   * Get statistical analysis of trades
   */
  async getTradeStatistics(params: GetStatisticsParams): Promise<TradingAnalysisResult> {
    return getTradeStatistics(this.trades, params);
  }

  /**
   * Find trades similar to given criteria using vector search
   */
  async findSimilarTrades(params: FindSimilarTradesParams): Promise<TradingAnalysisResult> {
    return findSimilarTrades(this.trades, this.calendar, this.userId, params);
  }

  /**
   * Analyze economic events correlation with trading performance
   */
  async analyzeEconomicEvents(params: AnalyzeEconomicEventsParams): Promise<TradingAnalysisResult> {
    return analyzeEconomicEvents(this.trades, params);
  }


  /**
   * Extract trade IDs from trade objects or trade data
   */
  async extractTradeIds(params: ExtractTradeIdsParams): Promise<TradingAnalysisResult> {
    return extractTradeIds(params);
  }

  /**
   * Convert trade IDs to simple JSON format for aiResponseParser.ts to handle
   */
  async convertTradeIdsToCards(params: ConvertTradeIdsToCardsParams): Promise<TradingAnalysisResult> {
    return convertTradeIdsToCards(this.trades, params);
  }

  /**
   * Fetch economic events from Firebase
   */
  async fetchEconomicEvents(params: FetchEconomicEventsParams): Promise<TradingAnalysisResult> {
    return fetchEconomicEvents(this.calendar, params);
  }

  /**
   * Execute a SQL query against the Supabase database
   */
  async queryDatabase(params: QueryDatabaseParams): Promise<TradingAnalysisResult> {
    return queryDatabase(this.trades, this.calendar, this.userId, params);
  }

  /**
   * Execute multiple functions in sequence and return the final result
   * This allows the AI to combine multiple function calls into a single request
   */
  async executeMultipleFunctions(params: ExecuteMultipleFunctionsParams): Promise<TradingAnalysisResult> {
    return executeMultipleFunctions(this.trades, params);
  }

  /**
   * Get comprehensive documentation of all available placeholder patterns for executeMultipleFunctions
   * Call this when you need to use advanced placeholders or are unsure about syntax
   */
  async getAvailablePlaceholderPatterns(params: { category?: string } = {}): Promise<TradingAnalysisResult> {
    return getAvailablePlaceholderPatterns(this.trades, params);
  }



  /**
   * Get comprehensive documentation of data structures and database schema
   * Call this when you need to understand trade data fields, database tables, or query structure
   */
  async getDataStructureInfo(params: {
    type?: 'trade' | 'database' | 'economic' | 'all',
    detail?: 'basic' | 'full' | 'fields-only',
    context?: 'filtering' | 'aggregation' | 'joins' | 'performance' | 'examples'
  } = {}): Promise<TradingAnalysisResult> {
    return getDataStructureInfo(params);
  }

  async convertTradeIdsToData(params: ConvertTradeIdsToDataParams): Promise<TradingAnalysisResult> {
    return convertTradeIdsToData(this.trades, params);
  }

}

export const tradingAnalysisFunctions = new TradingAnalysisFunctions();

// Re-export types for backward compatibility
export type {
  TradingAnalysisResult,
  SearchTradesParams,
  GetStatisticsParams,
  FindSimilarTradesParams,
  QueryDatabaseParams,
  AnalyzeEconomicEventsParams,
  FetchEconomicEventsParams,
  ExtractTradeIdsParams,
  ConvertTradeIdsToCardsParams,
  ConvertTradeIdsToDataParams
} from './functions/types';















