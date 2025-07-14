/**
 * Vector Search Service
 * Handles semantic search using Supabase pgvector
 */

import { supabase, SUPABASE_TABLES, VECTOR_CONFIG } from '../config/supabase';
import { embeddingService } from './embeddingService';
import { Trade } from '../types/trade';
import { logger } from '../utils/logger';

export interface TradeSearchResult {
  tradeId: string;
  similarity: number;
  tradeType: 'win' | 'loss' | 'breakeven';
  tradeAmount: number;
  tradeDate: string;
  tradeSession?: string;
  tags: string[];
  embeddedContent: string;
}

export interface SearchOptions {
  similarityThreshold?: number;
  maxResults?: number;
  tradeTypes?: ('win' | 'loss' | 'breakeven')[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  tags?: string[];
}

class VectorSearchService {
  /**
   * Search for similar trades using semantic similarity
   */
  async searchSimilarTrades(
    query: string,
    userId: string,
    calendarId: string,
    options: SearchOptions = {}
  ): Promise<TradeSearchResult[]> {
    try {
      // Generate embedding for the query
      const queryEmbedding = await embeddingService.generateEmbedding(query);
      
      // Prepare search parameters
      const {
        similarityThreshold = VECTOR_CONFIG.SIMILARITY_THRESHOLD,
        maxResults = VECTOR_CONFIG.MAX_RESULTS,
        tradeTypes,
        dateRange,
        tags
      } = options;

      // Use the search function we created in the schema
      const { data, error } = await supabase.rpc('search_similar_trades', {
        query_embedding: `[${queryEmbedding.join(',')}]`,
        user_id_param: userId,
        calendar_id_param: calendarId,
        similarity_threshold: similarityThreshold,
        max_results: maxResults
      });

      if (error) {
        logger.error('Vector search failed:', error);
        throw error;
      }

      // Transform results
      return (data || []).map((row: any) => ({
        tradeId: row.trade_id,
        similarity: parseFloat(row.similarity),
        tradeType: row.trade_type,
        tradeAmount: parseFloat(row.trade_amount),
        tradeDate: row.trade_date,
        tradeSession: row.trade_session,
        tags: row.tags || [],
        embeddedContent: row.embedded_content
      }));

    } catch (error) {
      logger.error('Error in searchSimilarTrades:', error);
      throw error;
    }
  }

  /**
   * Store trade embedding in the database
   */
  async storeTradeEmbedding(
    trade: Trade,
    embedding: number[],
    content: string,
    userId: string,
    calendarId: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from(SUPABASE_TABLES.TRADE_EMBEDDINGS)
        .upsert({
          trade_id: trade.id,
          calendar_id: calendarId,
          user_id: userId,
          trade_type: trade.type,
          trade_amount: trade.amount,
          trade_date: trade.date.toISOString(),
          trade_session: trade.session,
          tags: trade.tags || [],
          embedding: `[${embedding.join(',')}]`,
          embedded_content: content
        }, {
          onConflict: 'trade_id,calendar_id,user_id'
        });

      if (error) {
        logger.error('Failed to store trade embedding:', error);
        throw error;
      }

      logger.log(`Stored embedding for trade ${trade.id}`);
    } catch (error) {
      logger.error('Error storing trade embedding:', error);
      throw error;
    }
  }

  /**
   * Store multiple trade embeddings in batch
   */
  async storeTradeEmbeddings(
    tradeEmbeddings: Array<{
      trade: Trade;
      embedding: number[];
      content: string;
    }>,
    userId: string,
    calendarId: string
  ): Promise<void> {
    try {
      const embeddings = tradeEmbeddings.map(({ trade, embedding, content }) => ({
        trade_id: trade.id,
        calendar_id: calendarId,
        user_id: userId,
        trade_type: trade.type,
        trade_amount: trade.amount,
        trade_date: trade.date.toISOString(),
        trade_session: trade.session,
        tags: trade.tags || [],
        embedding: `[${embedding.join(',')}]`,
        embedded_content: content
      }));

      const { error } = await supabase
        .from(SUPABASE_TABLES.TRADE_EMBEDDINGS)
        .upsert(embeddings, {
          onConflict: 'trade_id,calendar_id,user_id'
        });

      if (error) {
        logger.error('Failed to store trade embeddings:', error);
        throw error;
      }

      logger.log(`Stored ${embeddings.length} trade embeddings`);
    } catch (error) {
      logger.error('Error storing trade embeddings:', error);
      throw error;
    }
  }

  /**
   * Delete trade embedding
   */
  async deleteTradeEmbedding(
    tradeId: string,
    userId: string,
    calendarId: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from(SUPABASE_TABLES.TRADE_EMBEDDINGS)
        .delete()
        .match({
          trade_id: tradeId,
          calendar_id: calendarId,
          user_id: userId
        });

      if (error) {
        logger.error('Failed to delete trade embedding:', error);
        throw error;
      }

      logger.log(`Deleted embedding for trade ${tradeId}`);
    } catch (error) {
      logger.error('Error deleting trade embedding:', error);
      throw error;
    }
  }

  /**
   * Get embedding statistics for a calendar
   */
  async getEmbeddingStats(
    userId: string,
    calendarId: string
  ): Promise<{
    totalEmbeddings: number;
    lastUpdated?: string;
  }> {
    try {
      const { data, error } = await supabase
        .from(SUPABASE_TABLES.TRADE_EMBEDDINGS)
        .select('id, updated_at')
        .match({
          user_id: userId,
          calendar_id: calendarId
        });

      if (error) {
        logger.error('Failed to get embedding stats:', error);
        throw error;
      }

      const totalEmbeddings = data?.length || 0;
      const lastUpdated = data && data.length > 0 
        ? Math.max(...data.map(row => new Date(row.updated_at).getTime()))
        : undefined;

      return {
        totalEmbeddings,
        lastUpdated: lastUpdated ? new Date(lastUpdated).toISOString() : undefined
      };
    } catch (error) {
      logger.error('Error getting embedding stats:', error);
      throw error;
    }
  }

  /**
   * Check if embeddings exist for trades
   */
  async checkEmbeddingsExist(
    tradeIds: string[],
    userId: string,
    calendarId: string
  ): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from(SUPABASE_TABLES.TRADE_EMBEDDINGS)
        .select('trade_id')
        .in('trade_id', tradeIds)
        .match({
          user_id: userId,
          calendar_id: calendarId
        });

      if (error) {
        logger.error('Failed to check embeddings:', error);
        throw error;
      }

      return data?.map(row => row.trade_id) || [];
    } catch (error) {
      logger.error('Error checking embeddings:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const vectorSearchService = new VectorSearchService();
