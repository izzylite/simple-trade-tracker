/**
 * Database query functions for AI trading analysis
 */

import { Trade } from '../../../types/trade';
import { Calendar } from '../../../types/calendar';
import { logger } from '../../../utils/logger';
import { supabase } from '../../../config/supabase';
import { QueryDatabaseParams, TradingAnalysisResult } from './types';
import { handleCacheKeyResult, simpleTradeData, calculateWinRate, extractTradeIdsFromResults } from './utils';
import { filterTradeFields } from './dataConversion';

/**
 * Execute a SQL query against the Supabase database
 */
export async function queryDatabase(
  trades: Trade[],
  calendar: Calendar | null,
  userId: string,
  params: QueryDatabaseParams
): Promise<TradingAnalysisResult> {
  try {
    logger.log('AI requested database query:', params.query);

    // Ensure we have a calendar for filtering
    if (!calendar) {
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
      const userFilter = `user_id = '${userId}'`;
      const calendarFilter = `calendar_id = '${calendar?.id}'`;
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
    let tradesData: Trade[] = [];
    let filteredTradesData: any[] = [];
    if (Array.isArray(results) && results.length > 0) {
      logger.log(`Found ${results.length} results from query, attempting to extract trade IDs`);
      const tradeIds = extractTradeIdsFromResults(results);
      if (tradeIds.length > 0) {
        tradesData = trades.filter(trade => tradeIds.includes(trade.id));
        // Apply field filtering based on request
        filteredTradesData = filterTradeFields(tradesData, params.fields, false);
      }
    }

    // No fallback needed - multi-step function calling handles this intelligently

    const resultData = {
      results: results,
      query: finalQuery,
      description: params.description,
      rowCount: rowCount,
      trades: filteredTradesData.length > 0 ? filteredTradesData : simpleTradeData(tradesData),
      count: tradesData.length,
      totalPnl: tradesData.reduce((sum, trade) => sum + trade.amount, 0),
      winRate: calculateWinRate(tradesData),
      includedFields: params.fields || ['default']
    };

    return handleCacheKeyResult('queryDatabase', resultData, params.returnCacheKey, filteredTradesData.length > 0 ? filteredTradesData : tradesData);

  } catch (error) {
    logger.error('Error in queryDatabase:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
