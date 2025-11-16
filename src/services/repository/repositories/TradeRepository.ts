/**
 * Trade Repository
 * Handles Supabase operations for trade entities
 */

import {
  AbstractBaseRepository,
  RepositoryConfig,
  RepositoryResult
} from './BaseRepository';
import { Trade } from '../../../types/dualWrite';
import { logger } from '../../../utils/logger';

// Supabase imports
import { supabase } from '../../../config/supabase';
import { supabaseAuthService } from '../../supabaseAuthService';


// Storage imports
import { uploadTradeImage } from '../../supabaseStorageService';
import { TradeImage } from '../../../components/trades/TradeForm';

// Economic events imports
import { tradeEconomicEventService, getRelevantCurrenciesFromTags } from '../../tradeEconomicEventService';
import { TradeEconomicEvent } from '../../../types/dualWrite';

 

/**
 * Safely parse a date value, returning a valid Date or fallback
 */
const parseDate = (dateValue: any, fallback: Date = new Date()): Date => {
  if (!dateValue) return fallback;
  const parsed = new Date(dateValue);
  return isNaN(parsed.getTime()) ? fallback : parsed;
};

/**
 * Safely parse an optional date value, returning Date or undefined
 */
const parseOptionalDate = (dateValue: any): Date | undefined => {
  if (!dateValue) return undefined;
  const parsed = new Date(dateValue);
  return isNaN(parsed.getTime()) ? undefined : parsed;
};

/**
 * Transform Supabase trade data to Trade type
 * Converts string dates to Date objects with validation
 */
const transformSupabaseTrade = (data: any): Trade => {
  return {
    ...data,
    trade_date: parseDate(data.trade_date),
    created_at: parseDate(data.created_at),
    updated_at: parseDate(data.updated_at),
    shared_at: parseOptionalDate(data.shared_at),
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
      // Ensure session is valid before fetching trade by ID
      await supabaseAuthService.ensureValidSession();

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

  async findByUserId(
    userId: string,
    options?: {
      limit?: number;
      orderBy?: 'trade_date' | 'created_at';
      ascending?: boolean;
    }
  ): Promise<Trade[]> {
    try {
      // Ensure session is valid before fetching trades by user
      await supabaseAuthService.ensureValidSession();

      const { limit, orderBy = 'created_at', ascending = false } = options || {};

      let query = supabase
        .from('trades')
        .select('*')
        .eq('user_id', userId)
        .order(orderBy, { ascending });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

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
      // Ensure session is valid before fetching trades by calendar
      await supabaseAuthService.ensureValidSession();

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
      // Ensure session is valid before fetching all trades
      await supabaseAuthService.ensureValidSession();

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

  /**
   * Search and filter trades with server-side pagination
   * @param calendarId - Calendar ID to search within
   * @param options - Search and filter options
   * @returns Paginated search results
   */
  async searchTrades(
    calendarId: string,
    options: {
      searchQuery?: string;
      selectedTags?: string[];
      dateFilter?: {
        type: 'all' | 'single' | 'range';
        startDate?: Date | null;
        endDate?: Date | null;
      };
      tradeTypes?: ('win' | 'loss' | 'breakeven')[];
      page?: number;
      pageSize?: number;
    } = {}
  ): Promise<{
    trades: Trade[];
    totalCount: number;
    hasMore: boolean;
    currentPage: number;
    totalPages: number;
  }> {
    try {
      // Ensure session is valid before searching trades
      await supabaseAuthService.ensureValidSession();

      const {
        searchQuery = '',
        selectedTags = [],
        dateFilter = { type: 'all' },
        tradeTypes = [],
        page = 1,
        pageSize = 20
      } = options;

      // Calculate pagination
      const offset = (page - 1) * pageSize;

      // Start building the query
      let query = supabase
        .from('trades')
        .select('*', { count: 'exact' })
        .eq('calendar_id', calendarId);

      // Apply text search if provided
      if (searchQuery.trim()) {
        const searchTerms = searchQuery
          .toLowerCase()
          .split(/[,;\s]+/)
          .map(term => term.trim())
          .filter(term => term.length > 0);

        if (searchTerms.length > 0) {
          // For each search term, apply AND logic (all terms must match)
          searchTerms.forEach(term => {
            // Use OR across all searchable fields
            // economic_events_text is a computed column that contains all event names
            query = query.or(
              `name.ilike.%${term}%,` +
              `notes.ilike.%${term}%,` +
              `session.ilike.%${term}%,` +
              `tags.cs.{${term}},` +
              `economic_events_text.ilike.%${term}%`
            );
          });
        }
      }

      // Apply tag filtering (AND logic - trade must have ALL selected tags)
      if (selectedTags.length > 0) {
        // Use contains operator to check if tags array contains all selected tags
        query = query.contains('tags', selectedTags);
      }

      // Apply date filtering
      if (dateFilter.type === 'single' && dateFilter.startDate) {
        const startOfDay = new Date(dateFilter.startDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(dateFilter.startDate);
        endOfDay.setHours(23, 59, 59, 999);

        query = query
          .gte('trade_date', startOfDay.toISOString())
          .lte('trade_date', endOfDay.toISOString());
      } else if (dateFilter.type === 'range' && dateFilter.startDate && dateFilter.endDate) {
        const startOfDay = new Date(dateFilter.startDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(dateFilter.endDate);
        endOfDay.setHours(23, 59, 59, 999);

        query = query
          .gte('trade_date', startOfDay.toISOString())
          .lte('trade_date', endOfDay.toISOString());
      }

      // Apply trade type filtering
      if (tradeTypes.length > 0) {
        query = query.in('trade_type', tradeTypes);
      }

      // Apply sorting (newest first)
      query = query.order('trade_date', { ascending: false });

      // Apply pagination
      query = query.range(offset, offset + pageSize - 1);

      // Execute query
      const { data, count, error } = await query;

      if (error) {
        logger.error('Error searching trades:', error);
        throw error;
      }

      // Transform results
      const trades = data ? data.map(item => transformSupabaseTrade(item)) : [];
      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / pageSize);
      const hasMore = totalCount > offset + pageSize;

      return {
        trades,
        totalCount,
        hasMore,
        currentPage: page,
        totalPages
      };
    } catch (error) {
      logger.error('Error searching trades:', error);
      return {
        trades: [],
        totalCount: 0,
        hasMore: false,
        currentPage: 1,
        totalPages: 0
      };
    }
  }

  // =====================================================
  // SUPABASE OPERATIONS
  // =====================================================
 
  async bulkDelete(
    trades: Trade[],
    batchSize: number = 50
  ): Promise<RepositoryResult<number>> {
    return await this.withRetryAndErrorHandling(async () => {
      // Ensure session is valid before bulk delete
      await supabaseAuthService.ensureValidSession();
 

      const tradeIds = trades?.map(t => t.id) || [];

      if (tradeIds.length === 0) {
        logger.log(`ℹ️ No existing trades to delete`);
        return {
          success: true,
          data: 0,
          timestamp: new Date(),
          operation: 'bulkDelete'
        };
      }

      logger.log(`🗑️ Found ${tradeIds.length} existing trades to delete`);

      // Delete in batches to avoid timeout
      const totalBatches = Math.ceil(tradeIds.length / batchSize);
      let totalDeleted = 0;

      for (let i = 0; i < tradeIds.length; i += batchSize) {
        const batch = tradeIds.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;

        logger.log(`🗑️ Deleting batch ${batchNumber}/${totalBatches} (${batch.length} trades)...`);

        const { error: deleteError } = await supabase
          .from('trades')
          .delete()
          .in('id', batch);

        if (deleteError) {
          logger.error(`Error deleting batch ${batchNumber}:`, deleteError);
          throw deleteError;
        }

        totalDeleted += batch.length;
        logger.log(`✅ Deleted batch ${batchNumber}/${totalBatches} (${batch.length} trades)`);

        // Small delay between batches
        if (batchNumber < totalBatches) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      logger.log(`✅ Deleted ${totalDeleted} existing trades in ${totalBatches} batches`);

      return {
        success: true,
        data: totalDeleted,
        timestamp: new Date(),
        operation: 'bulkDelete'
      };
    }, 'bulkDelete', `Bulk deleting trades for calendar`);
  }

  /**
   * Efficiently bulk create multiple trades in batched database operations
   * Processes trades in batches to avoid payload size limits and timeouts
   *
   * @param calendar_id - Calendar ID for all trades
   * @param trades - Array of trade data to create (partial trades)
   * @param batchSize - Number of trades to create per batch (default: 25)
   * @returns RepositoryResult with created trades
   *
   * @example
   * ```typescript
   * const newTrades = [
   *   { amount: 100, trade_type: 'win', ... },
   *   { amount: -50, trade_type: 'loss', ... }
   * ];
   * const result = await tradeRepository.bulkCreate('cal1', newTrades);
   * ```
   */
  async bulkCreate(
    calendar_id : string,
    trades: Partial<Trade>[],
    batchSize: number = 25
  ): Promise<RepositoryResult<Trade[]>> {
    return await this.withRetryAndErrorHandling(async () => {
      if (trades.length === 0) {
        return {
          success: true,
          data: [],
          timestamp: new Date(),
          operation: 'bulkCreate'
        };
      }

      // Ensure session is valid before bulk create
      await supabaseAuthService.ensureValidSession();

      // Get current user from Supabase Auth
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const now = new Date();
 
      const tradesForCreate = trades.map(trade => ({
        id: trade.id || crypto.randomUUID(),
        calendar_id: calendar_id,
        user_id: user.id, // Use authenticated user's ID for RLS
        name: trade.name,
        trade_type: trade.trade_type,
        trade_date: (trade.trade_date || now).toISOString(), 
        session: trade.session,
        amount: trade.amount,
        entry_price: trade.entry_price ?? null,
        exit_price: trade.exit_price ?? null,
        stop_loss: trade.stop_loss ?? null,
        take_profit: trade.take_profit ?? null,
        risk_to_reward: trade.risk_to_reward ?? null,
        partials_taken: trade.partials_taken ?? null,
        tags: trade.tags || [],
        notes: trade.notes || '',
        images: trade.images || [],
        economic_events: trade.economic_events || [],
        is_temporary: trade.is_temporary ?? false,
        is_pinned: trade.is_pinned ?? false,
        share_link: trade.share_link ?? null,
        is_shared: trade.is_shared ?? false,
        shared_at: trade.shared_at ? trade.shared_at.toISOString() : null, 
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      }));

      // Process trades in batches to avoid payload size limits
      const allCreatedTrades: Trade[] = [];
      const failedBatches: number[] = [];
      const totalBatches = Math.ceil(tradesForCreate.length / batchSize);

      logger.log(`📦 Processing ${tradesForCreate.length} trades in ${totalBatches} batches of ${batchSize}...`);

      for (let i = 0; i < tradesForCreate.length; i += batchSize) {
        const batch = tradesForCreate.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;

        logger.log(`📤 Inserting batch ${batchNumber}/${totalBatches} (${batch.length} trades)...`);

        try {
          const { data, error } = await supabase
            .from('trades')
            .insert(batch)
            .select();

          if (error) {
            logger.error(`❌ Error creating batch ${batchNumber}:`, error);
            failedBatches.push(batchNumber);

            // Try to process remaining batches instead of failing completely
            logger.log(`⚠️ Skipping batch ${batchNumber}, continuing with next batch...`);
            continue;
          }

          // Transform the results back to Trade objects
          const batchCreatedTrades = data ? data.map(item => transformSupabaseTrade(item)) : [];
          allCreatedTrades.push(...batchCreatedTrades);

          logger.log(`✅ Batch ${batchNumber}/${totalBatches} created (${batchCreatedTrades.length} trades)`);

          // Add a small delay between batches to avoid overwhelming the server
          if (batchNumber < totalBatches) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (batchError) {
          logger.error(`❌ Exception in batch ${batchNumber}:`, batchError);
          failedBatches.push(batchNumber);
          logger.log(`⚠️ Skipping batch ${batchNumber}, continuing with next batch...`);
        }
      }

      if (failedBatches.length > 0) {
        logger.warn(`⚠️ ${failedBatches.length} batches failed: ${failedBatches.join(', ')}`);
        logger.log(`✅ Successfully created ${allCreatedTrades.length} trades (${failedBatches.length * batchSize} trades failed)`);
      } else {
        logger.log(`✅ Successfully bulk created ${allCreatedTrades.length} trades in ${totalBatches} batches`);
      }

      return {
        success: true,
        data: allCreatedTrades,
        timestamp: new Date(),
        operation: 'bulkCreate'
      };
    }, 'bulkCreate', `Bulk creating ${trades.length} trades`);
  }

  /**
   * Efficiently bulk update multiple trades in batched database operations
   * Processes trades in batches to avoid payload size limits and timeouts
   *
   * @param trades - Array of complete Trade objects to update
   * @param batchSize - Number of trades to update per batch (default: 25)
   * @returns RepositoryResult with updated trades
   *
   * @example
   * ```typescript
   * const updatedTrades = trades.map(trade => ({
   *   ...trade,
   *   tags: [...trade.tags, 'new-tag']
   * }));
   * const result = await tradeRepository.bulkUpdate(updatedTrades);
   * ```
   */
  async bulkUpdate(trades: Trade[], batchSize: number = 25): Promise<RepositoryResult<Trade[]>> {
    return await this.withRetryAndErrorHandling(async () => {
      if (trades.length === 0) {
        return {
          success: true,
          data: [],
          timestamp: new Date(),
          operation: 'bulkUpdate'
        };
      }

      // Ensure session is valid before bulk update
      await supabaseAuthService.ensureValidSession();

      // Prepare trades for update - convert Date objects to ISO strings
      const tradesForUpdate = trades.map(trade => ({
        id: trade.id,
        calendar_id: trade.calendar_id,
        user_id: trade.user_id,
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
        partials_taken: trade.partials_taken ?? null,
        tags: trade.tags || [],
        notes: trade.notes || '',
        images: trade.images || [],
        economic_events: trade.economic_events || [],
        is_temporary: trade.is_temporary ?? false,
        is_pinned: trade.is_pinned ?? false,
        share_link: trade.share_link ?? null,
        is_shared: trade.is_shared ?? false,
        shared_at: trade.shared_at ? trade.shared_at.toISOString() : null,
        share_id: trade.share_id ?? null,
        updated_at: new Date().toISOString()
      }));

      // Process trades in batches to avoid payload size limits
      const allUpdatedTrades: Trade[] = [];
      const failedBatches: number[] = [];
      const totalBatches = Math.ceil(tradesForUpdate.length / batchSize);

      logger.log(`📦 Processing ${tradesForUpdate.length} trades in ${totalBatches} batches of ${batchSize}...`);

      for (let i = 0; i < tradesForUpdate.length; i += batchSize) {
        const batch = tradesForUpdate.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;

        logger.log(`📤 Updating batch ${batchNumber}/${totalBatches} (${batch.length} trades)...`);

        try {
          const { data, error } = await supabase
            .from('trades')
            .upsert(batch, {
              onConflict: 'id',
              ignoreDuplicates: false
            })
            .select();

          if (error) {
            logger.error(`❌ Error updating batch ${batchNumber}:`, error);
            failedBatches.push(batchNumber);

            // Try to process remaining batches instead of failing completely
            logger.log(`⚠️ Skipping batch ${batchNumber}, continuing with next batch...`);
            continue;
          }

          // Transform the results back to Trade objects
          const batchUpdatedTrades = data ? data.map(item => transformSupabaseTrade(item)) : [];
          allUpdatedTrades.push(...batchUpdatedTrades);

          logger.log(`✅ Batch ${batchNumber}/${totalBatches} updated (${batchUpdatedTrades.length} trades)`);

          // Add a small delay between batches to avoid overwhelming the server
          if (batchNumber < totalBatches) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (batchError) {
          logger.error(`❌ Exception in batch ${batchNumber}:`, batchError);
          failedBatches.push(batchNumber);
          logger.log(`⚠️ Skipping batch ${batchNumber}, continuing with next batch...`);
        }
      }

      if (failedBatches.length > 0) {
        logger.warn(`⚠️ ${failedBatches.length} batches failed: ${failedBatches.join(', ')}`);
        logger.log(`✅ Successfully updated ${allUpdatedTrades.length} trades (${failedBatches.length * batchSize} trades failed)`);
      } else {
        logger.log(`✅ Successfully bulk updated ${allUpdatedTrades.length} trades in ${totalBatches} batches`);
      }

      return {
        success: true,
        data: allUpdatedTrades,
        timestamp: new Date(),
        operation: 'bulkUpdate'
      };
    }, 'bulkUpdate', `Bulk updating ${trades.length} trades`);
  }

  /**
   * Fetch economic events for a trade based on its date, session, and tags
   * This is a helper method used during trade creation and updates
   *
   * @param tradeDate - The date of the trade
   * @param session - The trading session (Asia, London, NY AM, NY PM)
   * @param tags - The trade tags (used to extract currency pairs)
   * @param existingEvents - Existing economic events (if any)
   * @returns Array of economic events for the trade
   */
  private async fetchEconomicEventsForTrade(
    tradeDate: Date,
    session?: string,
    tags?: string[],
    existingEvents?: TradeEconomicEvent[]
  ): Promise<TradeEconomicEvent[]> {
    // Return existing events if already provided
    if (existingEvents && existingEvents.length > 0) {
      return existingEvents;
    }

    // Only fetch events if session is provided
    if (!session) {
      return [];
    }
    if (!tags) {
      return [];
    }

    try {
      // Extract currencies from trade tags
      const currencies = tags ? getRelevantCurrenciesFromTags(tags) : [];

      // Fetch economic events for this trade session
      const economicEvents = await tradeEconomicEventService.fetchEventsForTrade(
        tradeDate,
        session,
        currencies.length > 0 ? currencies : undefined
      );

      logger.log(`📊 Fetched ${economicEvents.length} economic events for trade session ${session}`);
      return economicEvents;
    } catch (error) {
      logger.error('Failed to fetch economic events for trade:', error);
      // Return empty array on error - don't block trade creation/update
      return [];
    }
  }

  protected async createInSupabase(entity: Omit<Trade, 'id' | 'created_at' | 'updated_at'>): Promise<Trade> {
    // Get current user from Supabase Auth
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    // Use existing ID if provided (entity might have it despite TypeScript type), otherwise generate new one
    const tradeId = (entity as any).id || crypto.randomUUID();

    // Fetch economic events for this trade if not already provided
    const economicEvents = await this.fetchEconomicEventsForTrade(
      entity.trade_date,
      entity.session,
      getRelevantCurrenciesFromTags(entity.tags || []), // Pass trade tags for currency filtering
      entity.economic_events
    );

    // Create complete trade object with timestamps and economic events
    const completeTrade: Trade = {
      ...entity,
      id: tradeId,
      user_id: user.id,
      economic_events: economicEvents,
      created_at: new Date(),
      updated_at: new Date()
    } as Trade;

    // Use the transactional function to create trade and update calendar tags
    const result = await this.addTradeWithTags(entity.calendar_id, completeTrade);

    if (!result.tradeId) {
      throw new Error('Failed to create trade');
    }
 
    return completeTrade;
  }

  protected async updateInSupabase(id: string, updates: Partial<Trade>): Promise<Trade> {
    // First, get the existing trade to merge with updates
    const existingTrade = await this.findById(id);
    if (!existingTrade) {
      throw new Error(`Trade not found: ${id}`);
    }

    // Determine if we need to fetch new economic events
    // Fetch if: session changed, date changed, tags changed, or no events exist
    const shouldFetchEvents =
      (updates.session && updates.session !== existingTrade.session) ||
      (updates.trade_date && new Date(updates.trade_date).getTime() !== existingTrade.trade_date.getTime()) ||
      (updates.tags && JSON.stringify(updates.tags) !== JSON.stringify(existingTrade.tags)) ||
      (!existingTrade.economic_events || existingTrade.economic_events.length === 0);

    // Fetch economic events if needed
    let economicEvents = updates.economic_events || existingTrade.economic_events;
    if (shouldFetchEvents) {
      const tradeDate = updates.trade_date || existingTrade.trade_date;
      const session = updates.session || existingTrade.session;
      const tags = updates.tags || existingTrade.tags;

      economicEvents = await this.fetchEconomicEventsForTrade(
        tradeDate,
        session,
        tags,
        updates.economic_events // Don't override if explicitly provided
      );
    }

    // Merge existing trade with updates and economic events
    const completeTrade: Trade = {
      ...existingTrade,
      ...updates,
      economic_events: economicEvents,
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
 

    return result.trade;
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
        economic_events: trade.economic_events || [],
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
  ): Promise<{ success: boolean; tagsUpdated: boolean, trade: Trade }> {
    try {
       
      // Call the transactional PostgreSQL function
      const { data, error } = await supabase.rpc("update_trade_with_tags", {
        p_trade_id: tradeId,
        p_trade_updates: {...trade, trade_date: trade.trade_date.toISOString()},
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
        trade
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
