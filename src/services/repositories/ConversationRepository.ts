/**
 * Conversation Repository
 * Handles all AI conversation-related database operations with Supabase
 */

import {
  AbstractBaseRepository,
  RepositoryConfig,
  RepositoryResult
} from 'services/repositories/BaseRepository';
import {
  AIConversation,
  SerializableAIConversation,
  ChatMessage,
  SerializableChatMessage
} from 'features/orion/types/aiChat';
import { logger } from 'utils/logger';
import { supabase } from 'config/supabase';
import { generateConversationTitle } from 'features/orion/utils/conversationTitle';

/**
 * Pagination options for conversation queries.
 *
 * `pinnedOnly` is server-side — when true, the query adds `pinned = true`
 * to both the count and the row select, so pagination math reflects only
 * the pinned subset. Client-side filtering after the fact would
 * under-count when pinned matches happen to live past the first page.
 */
export interface ConversationPaginationOptions {
  limit?: number;
  offset?: number;
  pinnedOnly?: boolean;
}

/**
 * Paginated result with metadata
 */
export interface PaginatedConversations {
  conversations: AIConversation[];
  totalCount: number;
  hasMore: boolean;
}

/**
 * Safely parse a date value, returning a valid Date or fallback
 */
const parseDate = (dateValue: any, fallback: Date = new Date()): Date => {
  if (!dateValue) return fallback;
  const parsed = new Date(dateValue);
  return isNaN(parsed.getTime()) ? fallback : parsed;
};

/**
 * Columns selected by the history-list queries. Deliberately excludes the
 * heavy `messages` JSONB blob — the full thread is loaded lazily via
 * `findById` when the user opens a conversation. `last_message_preview` is
 * the denormalized snapshot rendered in the list.
 */
const LIST_COLUMNS =
  'id, calendar_id, user_id, trade_id, title, message_count, pinned, ' +
  'last_message_preview, created_at, updated_at';

/**
 * Transform Supabase conversation data to AIConversation type.
 * Converts string dates to Date objects and serializable messages to
 * ChatMessage. When the row was fetched by a list query (no `messages`
 * column), leaves `messages` undefined — callers must call `findById` to
 * hydrate the full thread instead of treating an absent array as empty.
 */
const transformSupabaseConversation = (data: any): AIConversation => {
  return {
    ...data,
    pinned: Boolean(data.pinned),
    created_at: parseDate(data.created_at),
    updated_at: parseDate(data.updated_at),
    messages: data.messages
      ? data.messages.map((msg: SerializableChatMessage) => ({
          ...msg,
          timestamp: parseDate(msg.timestamp)
        }))
      : undefined
  } as AIConversation;
};

/**
 * Transform ChatMessage array to SerializableChatMessage array for database storage
 */
const serializeMessages = (messages: ChatMessage[]): SerializableChatMessage[] => {
  return messages.map(msg => ({
    ...msg,
    timestamp: msg.timestamp.toISOString()
  }));
};

export class ConversationRepository extends AbstractBaseRepository<AIConversation> {
  constructor(config?: Partial<RepositoryConfig>) {
    super(config);
  }

  // =====================================================
  // READ OPERATIONS
  // =====================================================

  /**
   * Find conversation by ID
   */
  async findById(id: string): Promise<AIConversation | null> {
    try {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        logger.error('Error finding conversation by ID:', error);
        return null;
      }

      return data ? transformSupabaseConversation(data) : null;
    } catch (error) {
      logger.error('Error finding conversation by ID:', error);
      return null;
    }
  }

  /**
   * Find all conversations for a specific calendar (calendar-level only, excludes trade-specific)
   * Ordered by most recently updated first
   * @param calendarId - The calendar ID to filter by
   * @param options - Optional pagination options (limit, offset)
   */
  async findByCalendarId(
    calendarId: string,
    options?: ConversationPaginationOptions
  ): Promise<PaginatedConversations> {
    const DEFAULT_LIMIT = 15;
    const limit = options?.limit ?? DEFAULT_LIMIT;
    const offset = options?.offset ?? 0;
    const pinnedOnly = options?.pinnedOnly === true;

    try {
      // Get total count first
      let countQuery = supabase
        .from('ai_conversations')
        .select('*', { count: 'exact', head: true })
        .eq('calendar_id', calendarId)
        .is('trade_id', null);
      if (pinnedOnly) countQuery = countQuery.eq('pinned', true);
      const { count, error: countError } = await countQuery;

      if (countError) {
        logger.error('Error counting conversations by calendar ID:', countError);
        return { conversations: [], totalCount: 0, hasMore: false };
      }

      const totalCount = count ?? 0;

      // Get paginated data — list shape only (no `messages` blob).
      let dataQuery = supabase
        .from('ai_conversations')
        .select(LIST_COLUMNS)
        .eq('calendar_id', calendarId)
        .is('trade_id', null);
      if (pinnedOnly) dataQuery = dataQuery.eq('pinned', true);
      const { data, error } = await dataQuery
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error('Error finding conversations by calendar ID:', error);
        return { conversations: [], totalCount: 0, hasMore: false };
      }

      const conversations = data ? data.map(item => transformSupabaseConversation(item)) : [];
      const hasMore = offset + conversations.length < totalCount;

      return { conversations, totalCount, hasMore };
    } catch (error) {
      logger.error('Error finding conversations by calendar ID:', error);
      return { conversations: [], totalCount: 0, hasMore: false };
    }
  }

  /**
   * Find all conversations for a specific trade
   * Ordered by most recently updated first
   * @param tradeId - The trade ID to filter by
   * @param options - Optional pagination options (limit, offset)
   */
  async findByTradeId(
    tradeId: string,
    options?: ConversationPaginationOptions
  ): Promise<PaginatedConversations> {
    const DEFAULT_LIMIT = 15;
    const limit = options?.limit ?? DEFAULT_LIMIT;
    const offset = options?.offset ?? 0;
    const pinnedOnly = options?.pinnedOnly === true;

    try {
      // Get total count first
      let countQuery = supabase
        .from('ai_conversations')
        .select('*', { count: 'exact', head: true })
        .eq('trade_id', tradeId);
      if (pinnedOnly) countQuery = countQuery.eq('pinned', true);
      const { count, error: countError } = await countQuery;

      if (countError) {
        logger.error('Error counting conversations by trade ID:', countError);
        return { conversations: [], totalCount: 0, hasMore: false };
      }

      const totalCount = count ?? 0;

      // Get paginated data — list shape only (no `messages` blob).
      let dataQuery = supabase
        .from('ai_conversations')
        .select(LIST_COLUMNS)
        .eq('trade_id', tradeId);
      if (pinnedOnly) dataQuery = dataQuery.eq('pinned', true);
      const { data, error } = await dataQuery
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error('Error finding conversations by trade ID:', error);
        return { conversations: [], totalCount: 0, hasMore: false };
      }

      const conversations = data ? data.map(item => transformSupabaseConversation(item)) : [];
      const hasMore = offset + conversations.length < totalCount;

      return { conversations, totalCount, hasMore };
    } catch (error) {
      logger.error('Error finding conversations by trade ID:', error);
      return { conversations: [], totalCount: 0, hasMore: false };
    }
  }

  /**
   * Find all conversations for a specific user
   */
  async findByUserId(userId: string): Promise<AIConversation[]> {
    try {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) {
        logger.error('Error finding conversations by user ID:', error);
        return [];
      }

      return data ? data.map(item => transformSupabaseConversation(item)) : [];
    } catch (error) {
      logger.error('Error finding conversations by user ID:', error);
      return [];
    }
  }

  /**
   * Find user-level conversations (no calendar) with pagination.
   * Used by Home page AI chat where there's no specific calendar context.
   */
  async findUserLevel(
    userId: string,
    options?: ConversationPaginationOptions
  ): Promise<PaginatedConversations> {
    const DEFAULT_LIMIT = 15;
    const limit = options?.limit ?? DEFAULT_LIMIT;
    const offset = options?.offset ?? 0;
    const pinnedOnly = options?.pinnedOnly === true;

    try {
      let countQuery = supabase
        .from('ai_conversations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('calendar_id', null)
        .is('trade_id', null);
      if (pinnedOnly) countQuery = countQuery.eq('pinned', true);
      const { count, error: countError } = await countQuery;

      if (countError) {
        logger.error('Error counting user-level conversations:', countError);
        return { conversations: [], totalCount: 0, hasMore: false };
      }

      const totalCount = count ?? 0;

      let dataQuery = supabase
        .from('ai_conversations')
        .select(LIST_COLUMNS)
        .eq('user_id', userId)
        .is('calendar_id', null)
        .is('trade_id', null);
      if (pinnedOnly) dataQuery = dataQuery.eq('pinned', true);
      const { data, error } = await dataQuery
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error('Error loading user-level conversations:', error);
        return { conversations: [], totalCount, hasMore: false };
      }

      const conversations = data
        ? data.map(item => transformSupabaseConversation(item))
        : [];

      return {
        conversations,
        totalCount,
        hasMore: offset + conversations.length < totalCount
      };
    } catch (error) {
      logger.error('Error loading user-level conversations:', error);
      return { conversations: [], totalCount: 0, hasMore: false };
    }
  }

  /**
   * Scope for server-side text search. Mirrors the three list contexts
   * (`findByCalendarId`, `findByTradeId`, `findUserLevel`) so search
   * results respect the same boundaries as the list the user is browsing.
   */
  // (kept inline to avoid leaking another export from this file)
  // searchConversations dispatches on `kind` below.

  /**
   * Server-side ILIKE search against the denormalized `searchable` column
   * (title + every message's content). Indexed via pg_trgm GIN so it stays
   * fast at scale. List shape only — no `messages` blob; selecting a
   * result still hits `findById` for the full thread.
   *
   * Wildcards (`%`, `_`, `\`) are stripped from the query so user typing
   * doesn't accidentally trigger pattern matching. Short queries (< 2
   * chars) return an empty result rather than scanning the whole table.
   */
  async searchConversations(
    scope:
      | { kind: 'calendar'; calendarId: string }
      | { kind: 'trade'; tradeId: string }
      | { kind: 'user'; userId: string },
    query: string,
    options?: ConversationPaginationOptions
  ): Promise<PaginatedConversations> {
    const DEFAULT_LIMIT = 15;
    const limit = options?.limit ?? DEFAULT_LIMIT;
    const offset = options?.offset ?? 0;
    const pinnedOnly = options?.pinnedOnly === true;

    const sanitized = query.replace(/[\\%_]/g, '').trim();
    if (sanitized.length < 2) {
      return { conversations: [], totalCount: 0, hasMore: false };
    }
    const pattern = `%${sanitized}%`;

    try {
      // Scope filter applied inline to both queries — Supabase JS's filter
      // builder isn't typed in a way that lets us factor it into a shared
      // helper without `any`-casting, so we just repeat the three branches.
      const buildCountQuery = () => {
        let q = supabase
          .from('ai_conversations')
          .select('*', { count: 'exact', head: true })
          .ilike('searchable', pattern);
        if (scope.kind === 'calendar') {
          q = q.eq('calendar_id', scope.calendarId).is('trade_id', null);
        } else if (scope.kind === 'trade') {
          q = q.eq('trade_id', scope.tradeId);
        } else {
          q = q
            .eq('user_id', scope.userId)
            .is('calendar_id', null)
            .is('trade_id', null);
        }
        if (pinnedOnly) q = q.eq('pinned', true);
        return q;
      };

      const buildDataQuery = () => {
        let q = supabase
          .from('ai_conversations')
          .select(LIST_COLUMNS)
          .ilike('searchable', pattern);
        if (scope.kind === 'calendar') {
          q = q.eq('calendar_id', scope.calendarId).is('trade_id', null);
        } else if (scope.kind === 'trade') {
          q = q.eq('trade_id', scope.tradeId);
        } else {
          q = q
            .eq('user_id', scope.userId)
            .is('calendar_id', null)
            .is('trade_id', null);
        }
        if (pinnedOnly) q = q.eq('pinned', true);
        return q;
      };

      const { count, error: countError } = await buildCountQuery();
      if (countError) {
        logger.error('Error counting search results:', countError);
        return { conversations: [], totalCount: 0, hasMore: false };
      }

      const totalCount = count ?? 0;

      const { data, error } = await buildDataQuery()
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error('Error running conversation search:', error);
        return { conversations: [], totalCount, hasMore: false };
      }

      const conversations = data
        ? data.map((item: unknown) => transformSupabaseConversation(item))
        : [];

      return {
        conversations,
        totalCount,
        hasMore: offset + conversations.length < totalCount
      };
    } catch (error) {
      logger.error('Error running conversation search:', error);
      return { conversations: [], totalCount: 0, hasMore: false };
    }
  }

  /**
   * Find all conversations (admin use only - respects RLS)
   */
  async findAll(): Promise<AIConversation[]> {
    try {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        logger.error('Error finding all conversations:', error);
        return [];
      }

      return data ? data.map(item => transformSupabaseConversation(item)) : [];
    } catch (error) {
      logger.error('Error finding all conversations:', error);
      return [];
    }
  }

  // =====================================================
  // SUPABASE OPERATIONS
  // =====================================================

  /**
   * Create a new conversation in Supabase
   */
  protected async createInSupabase(entity: Omit<AIConversation, 'id' | 'created_at' | 'updated_at'>): Promise<AIConversation> {
    const now = new Date();

    // Generate title if not provided. The shared util takes the raw first
    // user message content (slash-command framing is stripped inside).
    // `messages` is optional on AIConversation (list rows omit it) but
    // create callers always supply the initial messages array — fall back
    // to [] defensively so TypeScript is satisfied for the new optional type.
    const entityMessages = entity.messages ?? [];
    const firstUserMessage = entityMessages.find(m => m.role === 'user');
    const title = entity.title
      || generateConversationTitle(firstUserMessage?.content);

    const conversationData: Record<string, any> = {
      calendar_id: entity.calendar_id,
      user_id: entity.user_id,
      title: title.substring(0, 100), // Enforce max length
      messages: serializeMessages(entityMessages),
      message_count: entity.message_count,
      created_at: now,
      updated_at: now
    };

    // Only include trade_id if it's set (not null/undefined)
    if (entity.trade_id) {
      conversationData.trade_id = entity.trade_id;
    }

    const { data, error } = await supabase
      .from('ai_conversations')
      .insert(conversationData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return transformSupabaseConversation(data);
  }

  /**
   * Update an existing conversation in Supabase
   */
  protected async updateInSupabase(id: string, updates: Partial<AIConversation>): Promise<AIConversation> {
    if ((updates as { messages?: unknown }).messages !== undefined) {
      throw new Error(
        'ConversationRepository.update: writing `messages` from the client is no longer supported — backend persists messages on each turn'
      );
    }
    const updateData: any = {
      updated_at: new Date()
    };

    // Only include fields that are being updated
    if (updates.title !== undefined) {
      updateData.title = updates.title.substring(0, 100);
    }
    if (updates.messages !== undefined) {
      updateData.messages = serializeMessages(updates.messages);
      updateData.message_count = updates.messages.length;
    }
    if (updates.message_count !== undefined) {
      updateData.message_count = updates.message_count;
    }

    const { data, error } = await supabase
      .from('ai_conversations')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) {
      throw error;
    }

    // Check if any rows were returned
    if (!data || data.length === 0) {
      throw new Error(`Conversation not found: ${id}`);
    }

    // Return the first (and should be only) row
    return transformSupabaseConversation(data[0]);

    return transformSupabaseConversation(data);
  }

  /**
   * Delete a conversation from Supabase
   */
  protected async deleteInSupabase(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('ai_conversations')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return true;
  }

  // =====================================================
  // CUSTOM OPERATIONS
  // =====================================================

  /**
   * Toggle the pinned flag on a conversation.
   * Writes directly to avoid re-serializing messages through update().
   */
  async setPinned(
    conversationId: string,
    pinned: boolean
  ): Promise<RepositoryResult<AIConversation>> {
    try {
      const { data, error } = await supabase
        .from('ai_conversations')
        .update({ pinned })
        .eq('id', conversationId)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: transformSupabaseConversation(data),
        timestamp: new Date(),
        operation: 'setPinned'
      };
    } catch (error) {
      logger.error('Error setting conversation pinned:', error);
      const { parseSupabaseError } = await import('utils/supabaseErrorHandler');
      return {
        success: false,
        error: parseSupabaseError(error, 'Setting conversation pinned'),
        timestamp: new Date(),
        operation: 'setPinned'
      };
    }
  }

  /**
   * Delete all conversations for a calendar
   * Note: This is handled automatically by CASCADE DELETE in the database
   * This method is provided for explicit deletion if needed
   */
  async deleteByCalendarId(calendarId: string): Promise<RepositoryResult<boolean>> {
    try {
      const { error } = await supabase
        .from('ai_conversations')
        .delete()
        .eq('calendar_id', calendarId);

      if (error) {
        throw error;
      }

      return {
        success: true,
        data: true,
        timestamp: new Date(),
        operation: 'deleteByCalendarId'
      };
    } catch (error) {
      logger.error('Error deleting conversations by calendar ID:', error);
      const { parseSupabaseError } = await import('utils/supabaseErrorHandler');
      return {
        success: false,
        error: parseSupabaseError(error, 'Deleting conversations by calendar ID'),
        timestamp: new Date(),
        operation: 'deleteByCalendarId'
      };
    }
  }
}

