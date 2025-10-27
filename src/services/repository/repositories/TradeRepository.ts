/**
 * Trade Repository
 * Handles Supabase operations for trade entities
 */

import {
  AbstractBaseRepository,
  RepositoryConfig
} from './BaseRepository';
import { Trade } from '../../../types/dualWrite';
import { logger } from '../../../utils/logger';

// Supabase imports
import { supabase } from '../../../config/supabase';

// Storage imports
import { uploadTradeImage, optimizeImage } from '../../supabaseStorageService';
import { TradeImage } from '../../../components/trades/TradeForm';

// Re-export optimizeImage for convenience
export { optimizeImage };

/**
 * Transform Supabase trade data to Trade type
 * Converts string dates to Date objects
 */
const transformSupabaseTrade = (data: any): Trade => {
  return {
    ...data,
    trade_date: data.trade_date ? new Date(data.trade_date) : new Date(),
    created_at: data.created_at ? new Date(data.created_at) : new Date(),
    updated_at: data.updated_at ? new Date(data.updated_at) : new Date(),
    shared_at: data.shared_at ? new Date(data.shared_at) : undefined,
  } as Trade;
};

export class TradeRepository extends AbstractBaseRepository<Trade> {
  constructor(config?: Partial<RepositoryConfig>) {
    super(config);
  }

  // =====================================================
  // READ OPERATIONS
  // =====================================================

  async findById(id: string): Promise<Trade | null> {
    try {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        logger.error('Error finding trade by ID:', error);
        return null;
      }

      return data ? transformSupabaseTrade(data) : null;
    } catch (error) {
      logger.error('Error finding trade by ID:', error);
      return null;
    }
  }

  async findByUserId(userId: string): Promise<Trade[]> {
    try {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        logger.error('Error finding trades by user ID:', error);
        return [];
      }

      return data ? data.map(item => transformSupabaseTrade(item)) : [];
    } catch (error) {
      logger.error('Error finding trades by user ID:', error);
      return [];
    }
  }

  async findByCalendarId(calendarId: string): Promise<Trade[]> {
    try {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('calendar_id', calendarId);

      if (error) {
        logger.error('Error finding trades by calendar ID:', error);
        return [];
      }

      return data ? data.map(item => transformSupabaseTrade(item)) : [];
    } catch (error) {
      logger.error('Error finding trades by calendar ID:', error);
      return [];
    }
  }

  async findAll(): Promise<Trade[]> {
    try {
      const { data, error } = await supabase
        .from('trades')
        .select('*');

      if (error) {
        logger.error('Error finding all trades:', error);
        return [];
      }

      return data ? data.map(item => transformSupabaseTrade(item)) : [];
    } catch (error) {
      logger.error('Error finding all trades:', error);
      return [];
    }
  }

  // =====================================================
  // SUPABASE OPERATIONS
  // =====================================================

  protected async createInSupabase(entity: Omit<Trade, 'id' | 'created_at' | 'updated_at'>): Promise<Trade> {
    // Get current user from Supabase Auth
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    // Use existing ID if provided (entity might have it despite TypeScript type), otherwise generate new one
    const tradeId = (entity as any).id || crypto.randomUUID();

    // Create complete trade object with timestamps
    const completeTrade: Trade = {
      ...entity,
      id: tradeId,
      user_id: user.id,
      created_at: new Date(),
      updated_at: new Date()
    } as Trade;

    // Use the transactional function to create trade and update calendar tags
    const result = await this.addTradeWithTags(entity.calendar_id, completeTrade);

    if (!result.tradeId) {
      throw new Error('Failed to create trade');
    }

    // Fetch and return the created trade
    const createdTrade = await this.findById(result.tradeId);
    if (!createdTrade) {
      throw new Error('Trade created but not found');
    }

    return createdTrade;
  }

  protected async updateInSupabase(id: string, updates: Partial<Trade>): Promise<Trade> {
    // First, get the existing trade to merge with updates
    const existingTrade = await this.findById(id);
    if (!existingTrade) {
      throw new Error(`Trade not found: ${id}`);
    }

    // Merge existing trade with updates
    const completeTrade: Trade = {
      ...existingTrade,
      ...updates,
      id: existingTrade.id, // Ensure ID doesn't change
      updated_at: new Date()
    };

    // Use the transactional function to update trade and calendar tags
    const result = await this.updateTradeWithTags(
      id,
      existingTrade.calendar_id,
      completeTrade
    );

    if (!result.success) {
      throw new Error('Failed to update trade');
    }

    // Fetch and return the updated trade
    const updatedTrade = await this.findById(id);
    if (!updatedTrade) {
      throw new Error('Trade updated but not found');
    }

    return updatedTrade;
  }

  protected async deleteInSupabase(id: string): Promise<boolean> {
    // Delete the trade (images are stored as JSONB array, so they're deleted automatically)
    const { error } = await supabase
      .from('trades')
      .delete()
      .eq('id', id);

    if (error) {
      throw error; // Let the error handler parse this
    }

    return true;
  }

  // =====================================================
  // IMAGE UPLOAD OPERATIONS
  // =====================================================

  /**
   * Generate a unique image ID for a file
   * Creates a timestamp-based ID with the original filename
   */
  generateImageId(file: File): string {
    const timestamp = Date.now();
    const extension = file.name.split(".").pop() || "jpg";
    return `${timestamp}_image.${extension}`;
  }

  /**
   * Upload an image for a trade
   * This is the main method that uploads to storage and returns image metadata
   */
  async uploadImage(
    calendarId: string,
    filename: string,
    file: File,
    width?: number,
    height?: number,
    caption?: string,
    onProgress?: (progress: number) => void,
  ): Promise<TradeImage> {
    try {
      return await uploadTradeImage(
        calendarId,
        filename,
        file,
        width,
        height,
        caption,
        onProgress,
      );
    } catch (error) {
      logger.error("Error uploading image:", error);
      throw error;
    }
  }

  // =====================================================
  // TRANSACTIONAL TRADE OPERATIONS (RPC)
  // =====================================================

  /**
   * Add a trade using the transactional PostgreSQL function
   * This atomically creates the trade AND updates calendar tags in a single transaction
   */
  async addTradeWithTags(
    calendarId: string,
    trade: Trade,
  ): Promise<{ tradeId: string; tagsUpdated: boolean }> {
    try {
      // Prepare trade data for the transactional function
      // Note: Numeric values are passed as numbers, not strings
      const tradeData = {
        id: trade.id,
        name: trade.name,
        trade_type: trade.trade_type,
        trade_date: trade.trade_date.toISOString(),
        session: trade.session,
        amount: trade.amount,
        entry_price: trade.entry_price ?? null,
        exit_price: trade.exit_price ?? null,
        stop_loss: trade.stop_loss ?? null,
        take_profit: trade.take_profit ?? null,
        risk_to_reward: trade.risk_to_reward ?? null,
        partials_taken: trade.partials_taken,
        notes: trade.notes,
        tags: trade.tags || [],
        images: trade.images || [],
        is_temporary: trade.is_temporary,
      };

      // Call the transactional PostgreSQL function
      const { data, error } = await supabase.rpc("add_trade_with_tags", {
        p_trade: tradeData,
        p_calendar_id: calendarId,
      });

      if (error) {
        throw error;
      }

      if (!data?.success) {
        throw new Error("Failed to create trade");
      }

      logger.log(
        `Trade created successfully. Trade ID: ${data.trade_id}, Tags updated: ${data.tags_updated}`,
      );

      return {
        tradeId: data.trade_id,
        tagsUpdated: data.tags_updated,
      };
    } catch (error) {
      logger.error("Error adding trade with tags:", error);
      throw error;
    }
  }

  /**
   * Update a trade using the transactional PostgreSQL function
   * This atomically updates the trade AND calendar tags in a single transaction
   */
  async updateTradeWithTags(
    tradeId: string,
    calendarId: string,
    trade: Trade,
  ): Promise<{ success: boolean; tagsUpdated: boolean }> {
    try {
      // Prepare trade updates for the transactional function
      // Note: Numeric values are passed as numbers, not strings
      const tradeUpdates = {
        name: trade.name,
        trade_type: trade.trade_type,
        trade_date: trade.trade_date.toISOString(),
        session: trade.session,
        amount: trade.amount,
        entry_price: trade.entry_price ?? null,
        exit_price: trade.exit_price ?? null,
        stop_loss: trade.stop_loss ?? null,
        take_profit: trade.take_profit ?? null,
        risk_to_reward: trade.risk_to_reward ?? null,
        partials_taken: trade.partials_taken,
        notes: trade.notes,
        tags: trade.tags || [],
        images: trade.images || [],
        is_temporary: trade.is_temporary,
        is_pinned: trade.is_pinned,
      };

      // Call the transactional PostgreSQL function
      const { data, error } = await supabase.rpc("update_trade_with_tags", {
        p_trade_id: tradeId,
        p_trade_updates: tradeUpdates,
        p_calendar_id: calendarId,
      });

      if (error) {
        throw error;
      }

      if (!data?.success) {
        throw new Error("Failed to update trade");
      }

      logger.log(
        `Trade updated successfully. Trade ID: ${tradeId}, Tags updated: ${data.tags_updated}`,
      );

      return {
        success: data.success,
        tagsUpdated: data.tags_updated,
      };
    } catch (error) {
      logger.error("Error updating trade with tags:", error);
      throw error;
    }
  }

  /**
   * Delete a trade using the transactional PostgreSQL function
   * This atomically deletes the trade (stats updated by trigger)
   * Images are deleted via the handle-trade-changes edge function webhook
   */
  async deleteTradeTransactional(tradeId: string): Promise<boolean> {
    try {
      // Call the transactional PostgreSQL function to delete the trade
      const { data, error } = await supabase.rpc("delete_trade_transactional", {
        p_trade_id: tradeId,
      });

      if (error) {
        throw error;
      }

      if (!data?.success) {
        throw new Error("Failed to delete trade");
      }

      logger.log(`Trade deleted successfully. Trade ID: ${tradeId}`);

      return data.success;
    } catch (error) {
      logger.error("Error deleting trade transactionally:", error);
      throw error;
    }
  }
}
