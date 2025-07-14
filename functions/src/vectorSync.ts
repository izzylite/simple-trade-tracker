/**
 * Vector Sync Utilities
 * Utility functions to sync trades to Supabase vector database when Firebase changes
 */

import { logger } from 'firebase-functions';
import { createClient } from '@supabase/supabase-js';

// Supabase configuration from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase configuration in environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Embedding model configuration (same as frontend)
const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
const EMBEDDING_DIMENSION = 384;

// Global embedding pipeline instance
let embeddingPipeline: FeatureExtractionPipeline | null = null;
let isInitializing = false;

/**
 * Initialize the embedding model
 */
async function initializeEmbeddingModel(): Promise<void> {
  if (embeddingPipeline || isInitializing) {
    return;
  }

  try {
    isInitializing = true;
    logger.info('Initializing embedding model...');

    // Configure environment for transformers.js in Node.js
    const { env } = await import('@xenova/transformers');
    env.allowLocalModels = true;
    env.allowRemoteModels = true;
    env.backends.onnx.wasm.numThreads = 1; // Limit threads for cloud functions
    env.backends.onnx.wasm.simd = false; // Disable SIMD for compatibility

    embeddingPipeline = await pipeline(
      'feature-extraction',
      MODEL_NAME,
      {
        quantized: true, // Use quantized model for better performance
        revision: 'main',
        device: 'cpu' // Force CPU usage
      }
    );

    logger.info('Embedding model initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize embedding model:', error);
    throw error;
  } finally {
    isInitializing = false;
  }
}

/**
 * Generate proper semantic embedding using transformers
 */
async function generateEmbedding(text: string): Promise<number[]> {
  if (!embeddingPipeline) {
    await initializeEmbeddingModel();
  }

  if (!embeddingPipeline) {
    throw new Error('Embedding model not initialized');
  }

  try {
    const result = await embeddingPipeline(text, {
      pooling: 'mean',
      normalize: true,
    });

    // Convert tensor to array
    const embedding = Array.from(result.data) as number[];

    if (embedding.length !== EMBEDDING_DIMENSION) {
      throw new Error(`Expected embedding dimension ${EMBEDDING_DIMENSION}, got ${embedding.length}`);
    }

    return embedding;
  } catch (error) {
    logger.error('Failed to generate embedding:', error);
    throw error;
  }
}

function tradeToSearchableText(trade: any): string {
  const parts: string[] = [];
  
  // Basic trade info
  parts.push(`${trade.type} trade`);
  parts.push(`amount ${Math.abs(trade.amount)}`);
  
  // Trade details
  if (trade.name) parts.push(`name ${trade.name}`);
  if (trade.session) parts.push(`session ${trade.session}`);
  if (trade.entry) parts.push(`entry ${trade.entry}`);
  if (trade.exit) parts.push(`exit ${trade.exit}`);
  if (trade.riskToReward) parts.push(`risk reward ratio ${trade.riskToReward}`);
  if (trade.partialsTaken) parts.push('partials taken');
  
  // Tags
  if (trade.tags && trade.tags.length > 0) {
    parts.push(`tags ${trade.tags.join(' ')}`);
  }
  
  // Notes
  if (trade.notes) parts.push(`notes ${trade.notes}`);
  
  // Economic events
  if (trade.economicEvents && trade.economicEvents.length > 0) {
    const events = trade.economicEvents.map((event: any) => 
      `${event.name} ${event.impact} ${event.currency}`
    ).join(' ');
    parts.push(`economic events ${events}`);
  }
  
  // Date information (enhanced)
  const date = trade.date.toDate ? trade.date.toDate() : new Date(trade.date);
  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const year = date.getFullYear();
  const quarter = Math.ceil((date.getMonth() + 1) / 3);
  
  parts.push(`day ${dayOfWeek} month ${month} year ${year} quarter ${quarter}`);
  
  // Add week-related terms
  const isWeekend = dayOfWeek === 'Saturday' || dayOfWeek === 'Sunday';
  const isWeekday = !isWeekend;
  if (isWeekend) parts.push('weekend');
  if (isWeekday) parts.push('weekday');
  
  // Add season
  const season = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'fall', 'fall', 'fall', 'winter'][date.getMonth()];
  parts.push(`season ${season}`);
  
  return parts.join(' ').toLowerCase();
}

async function syncTradeToSupabase(
  trade: any,
  calendarId: string,
  userId: string,
  operation: 'add' | 'update' | 'delete'
): Promise<void> {
  try {
    if (operation === 'delete') {
      // Delete embedding
      const { error } = await supabase
        .from('trade_embeddings')
        .delete()
        .match({
          trade_id: trade.id,
          calendar_id: calendarId,
          user_id: userId
        });

      if (error) {
        throw error;
      }

      logger.info(`Deleted embedding for trade ${trade.id}`);
    } else {
      // Generate proper semantic embedding
      const content = tradeToSearchableText(trade);
      const embedding = await generateEmbedding(content);

      // Store/update embedding
      const { error } = await supabase
        .from('trade_embeddings')
        .upsert({
          trade_id: trade.id,
          calendar_id: calendarId,
          user_id: userId,
          trade_type: trade.type,
          trade_amount: trade.amount,
          trade_date: trade.date.toDate ? trade.date.toDate().toISOString() : new Date(trade.date).toISOString(),
          trade_session: trade.session || null,
          tags: trade.tags || [],
          embedding: `[${embedding.join(',')}]`,
          embedded_content: content
        }, {
          onConflict: 'trade_id,calendar_id,user_id'
        });

      if (error) {
        throw error;
      }

      logger.info(`${operation === 'add' ? 'Added' : 'Updated'} embedding for trade ${trade.id}`);
    }

    // Update metadata
    if (operation !== 'delete') {
      await updateEmbeddingMetadata(userId, calendarId);
    }

  } catch (error) {
    logger.error(`Failed to sync trade ${trade.id} to Supabase:`, error);
    throw error;
  }
}

async function updateEmbeddingMetadata(userId: string, calendarId: string): Promise<void> {
  try {
    // Get current embedding count
    const { count, error: countError } = await supabase
      .from('trade_embeddings')
      .select('*', { count: 'exact', head: true })
      .match({ user_id: userId, calendar_id: calendarId });

    if (countError) {
      throw countError;
    }

    // Update metadata
    const { error } = await supabase
      .from('embedding_metadata')
      .upsert({
        user_id: userId,
        calendar_id: calendarId,
        model_name: MODEL_NAME,
        model_version: 'v1',
        total_trades: count || 0,
        total_embeddings: count || 0,
        last_sync_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,calendar_id,model_name'
      });

    if (error) {
      throw error;
    }
  } catch (error) {
    logger.error('Failed to update embedding metadata:', error);
  }
}

/**
 * Utility function to sync trades when year document is updated
 * Call this from existing onChange triggers
 */
export async function handleVectorSyncOnYearUpdate(
  calendarId: string,
  yearId: string,
  beforeData: any,
  afterData: any,
  userId: string
): Promise<void> {
  logger.info(`Vector sync for year document updated: ${calendarId}/${yearId}`);

  try {
    const beforeTrades = beforeData?.trades || [];
    const afterTrades = afterData?.trades || [];

    // Find added, updated, and deleted trades
    const beforeTradeIds = new Set(beforeTrades.map((t: any) => t.id));
    const afterTradeIds = new Set(afterTrades.map((t: any) => t.id));

    // Added trades
    const addedTrades = afterTrades.filter((t: any) => !beforeTradeIds.has(t.id));

    // Updated trades (compare by lastModified or updatedAt)
    const updatedTrades = afterTrades.filter((afterTrade: any) => {
      const beforeTrade = beforeTrades.find((t: any) => t.id === afterTrade.id);
      if (!beforeTrade) return false;

      // Compare updatedAt timestamps if available
      const afterUpdated = afterTrade.updatedAt?.toMillis?.() || 0;
      const beforeUpdated = beforeTrade.updatedAt?.toMillis?.() || 0;

      return afterUpdated > beforeUpdated;
    });

    // Deleted trades
    const deletedTradeIds = [...beforeTradeIds].filter(id => !afterTradeIds.has(id));
    const deletedTrades = beforeTrades.filter((t: any) => deletedTradeIds.includes(t.id));

    logger.info(`Changes detected: ${addedTrades.length} added, ${updatedTrades.length} updated, ${deletedTrades.length} deleted`);

    // Process changes
    const promises: Promise<void>[] = [];

    // Add new trades
    addedTrades.forEach((trade: any) => {
      promises.push(syncTradeToSupabase(trade, calendarId, userId, 'add'));
    });

    // Update modified trades
    updatedTrades.forEach((trade: any) => {
      promises.push(syncTradeToSupabase(trade, calendarId, userId, 'update'));
    });

    // Delete removed trades
    deletedTrades.forEach((trade: any) => {
      promises.push(syncTradeToSupabase(trade, calendarId, userId, 'delete'));
    });

    // Execute all sync operations
    await Promise.allSettled(promises);

    logger.info(`Vector sync completed for calendar ${calendarId}`);

  } catch (error) {
    logger.error('Error in handleVectorSyncOnYearUpdate:', error);
    throw error;
  }
}

/**
 * Utility function to sync trades when year document is created
 * Call this from existing onCreate triggers if needed
 */
export async function handleVectorSyncOnYearCreate(
  calendarId: string,
  yearId: string,
  yearData: any,
  userId: string
): Promise<void> {
  logger.info(`Vector sync for year document created: ${calendarId}/${yearId}`);

  try {
    const trades = yearData?.trades || [];

    logger.info(`Syncing ${trades.length} trades from new year document`);

    // Sync all trades
    const promises = trades.map((trade: any) =>
      syncTradeToSupabase(trade, calendarId, userId, 'add')
    );

    await Promise.allSettled(promises);

    logger.info(`Vector sync completed for new year ${calendarId}/${yearId}`);

  } catch (error) {
    logger.error('Error in handleVectorSyncOnYearCreate:', error);
    throw error;
  }
}

/**
 * Utility function to clean up vector embeddings when year document is deleted
 * Call this from existing onDelete triggers if needed
 */
export async function handleVectorSyncOnYearDelete(
  calendarId: string,
  yearId: string,
  yearData: any,
  userId: string
): Promise<void> {
  logger.info(`Vector cleanup for year document deleted: ${calendarId}/${yearId}`);

  try {
    const trades = yearData?.trades || [];

    logger.info(`Removing ${trades.length} trades from deleted year document`);

    // Remove all trades
    const promises = trades.map((trade: any) =>
      syncTradeToSupabase(trade, calendarId, userId, 'delete')
    );

    await Promise.allSettled(promises);

    logger.info(`Vector cleanup completed for deleted year ${calendarId}/${yearId}`);

  } catch (error) {
    logger.error('Error in handleVectorSyncOnYearDelete:', error);
    throw error;
  }
}
