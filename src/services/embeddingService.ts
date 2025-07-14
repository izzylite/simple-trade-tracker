/**
 * Embedding Service
 * Generates vector embeddings from trade data using local transformer models
 */

import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';
import { Trade } from '../types/trade';
import { logger } from '../utils/logger';

// Embedding model configuration
const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
const EMBEDDING_DIMENSION = 384;

class EmbeddingService {
  private embeddingPipeline: FeatureExtractionPipeline | null = null;
  private isInitializing = false;

  /**
   * Initialize the embedding model
   */
  async initialize(): Promise<void> {
    if (this.embeddingPipeline || this.isInitializing) {
      return;
    }

    try {
      this.isInitializing = true;
      logger.log('Initializing embedding model...');

      // Configure environment for transformers.js
      const { env } = await import('@xenova/transformers');

      // Disable local models and browser cache to avoid corrupted cache issues
      env.allowLocalModels = false;
      env.allowRemoteModels = true;
      env.useBrowserCache = false;

      this.embeddingPipeline = await pipeline(
        'feature-extraction',
        MODEL_NAME,
        {
          quantized: true, // Use quantized model for better performance
          revision: 'main',
          progress_callback: (progress: any) => {
            if (progress.status === 'downloading') {
              logger.log(`Downloading model: ${Math.round(progress.progress || 0)}%`);
            } else if (progress.status === 'loading') {
              logger.log('Loading model into memory...');
            }
          }
        }
      );

      logger.log('Embedding model initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize embedding model:', error);

      // Try alternative approach with different configuration
      try {
        logger.log('Trying alternative model configuration...');

        // Ensure environment is still configured correctly for fallback
        const { env } = await import('@xenova/transformers');
        env.allowLocalModels = false;
        env.allowRemoteModels = true;
        env.useBrowserCache = false;

        this.embeddingPipeline = await pipeline(
          'feature-extraction',
          'Xenova/all-MiniLM-L6-v2',
          {
            quantized: false, // Try without quantization
            revision: 'main'
          }
        );

        logger.log('Alternative model configuration successful');
      } catch (fallbackError) {
        logger.error('Fallback model initialization also failed:', fallbackError);
        throw new Error(`Model initialization failed: ${error}. Fallback also failed: ${fallbackError}`);
      }
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.embeddingPipeline) {
      await this.initialize();
    }

    if (!this.embeddingPipeline) {
      throw new Error('Embedding model not initialized');
    }

    try {
      const result = await this.embeddingPipeline(text, {
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

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    
    for (const text of texts) {
      const embedding = await this.generateEmbedding(text);
      embeddings.push(embedding);
    }
    
    return embeddings;
  }

  /**
   * Convert trade data to searchable text content
   */
  public tradeToSearchableText(trade: Trade): string {
    const parts: string[] = [];

    // Basic trade info
    parts.push(`${trade.type} trade`);
    parts.push(`amount ${Math.abs(trade.amount)}`);
    
    // Trade details
    if (trade.name) {
      parts.push(`name ${trade.name}`);
    }
    
    if (trade.session) {
      parts.push(`session ${trade.session}`);
    }
    
    if (trade.entry) {
      parts.push(`entry ${trade.entry}`);
    }
    
    if (trade.exit) {
      parts.push(`exit ${trade.exit}`);
    }
    
    if (trade.riskToReward) {
      parts.push(`risk reward ratio ${trade.riskToReward}`);
    }
    
    if (trade.partialsTaken) {
      parts.push('partials taken');
    }
    
    // Tags
    if (trade.tags && trade.tags.length > 0) {
      parts.push(`tags ${trade.tags.join(' ')}`);
    }
    
    // Notes
    if (trade.notes) {
      parts.push(`notes ${trade.notes}`);
    }
    
    // Economic events
    if (trade.economicEvents && trade.economicEvents.length > 0) {
      const events = trade.economicEvents.map(event => 
        `${event.name} ${event.impact} ${event.currency}`
      ).join(' ');
      parts.push(`economic events ${events}`);
    }
    
    // Date information
    const date = new Date(trade.date);
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
  
    // Add month groupings
    const season = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'fall', 'fall', 'fall', 'winter'][date.getMonth()];
    parts.push(`season ${season}`);
    
    return parts.join(' ').toLowerCase();
  }

  /**
   * Generate embedding for a trade
   */
  async generateTradeEmbedding(trade: Trade): Promise<{
    embedding: number[];
    content: string;
  }> {
    const content = this.tradeToSearchableText(trade);
    const embedding = await this.generateEmbedding(content);
    
    return {
      embedding,
      content
    };
  }

  /**
   * Generate embeddings for multiple trades
   */
  async generateTradeEmbeddings(trades: Trade[]): Promise<Array<{
    trade: Trade;
    embedding: number[];
    content: string;
  }>> {
    const results: Array<{
      trade: Trade;
      embedding: number[];
      content: string;
    }> = [];

    for (const trade of trades) {
      try {
        const { embedding, content } = await this.generateTradeEmbedding(trade);
        results.push({
          trade,
          embedding,
          content
        });
      } catch (error) {
        logger.error(`Failed to generate embedding for trade ${trade.id}:`, error);
        // Continue with other trades
      }
    }

    return results;
  }

  /**
   * Check if the model is ready
   */
  isReady(): boolean {
    return this.embeddingPipeline !== null;
  }

  /**
   * Get model information
   */
  getModelInfo() {
    return {
      name: MODEL_NAME,
      dimension: EMBEDDING_DIMENSION,
      ready: this.isReady()
    };
  }
}

// Create singleton instance
export const embeddingService = new EmbeddingService();
export { EMBEDDING_DIMENSION, MODEL_NAME };
