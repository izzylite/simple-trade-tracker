/**
 * Conversation Repository
 * Handles all AI conversation-related database operations with Supabase
 */

import {
  AbstractBaseRepository,
  RepositoryConfig,
  RepositoryResult
} from './BaseRepository';
import { 
  AIConversation, 
  SerializableAIConversation,
  ChatMessage,
  SerializableChatMessage
} from '../../../types/aiChat';
import { logger } from '../../../utils/logger';
import { supabase } from '../../../config/supabase';

/**
 * Safely parse a date value, returning a valid Date or fallback
 */
const parseDate = (dateValue: any, fallback: Date = new Date()): Date => {
  if (!dateValue) return fallback;
  const parsed = new Date(dateValue);
  return isNaN(parsed.getTime()) ? fallback : parsed;
};

/**
 * Transform Supabase conversation data to AIConversation type
 * Converts string dates to Date objects and serializable messages to ChatMessage
 */
const transformSupabaseConversation = (data: any): AIConversation => {
  return {
    ...data,
    created_at: parseDate(data.created_at),
    updated_at: parseDate(data.updated_at),
    messages: data.messages ? data.messages.map((msg: SerializableChatMessage) => ({
      ...msg,
      timestamp: parseDate(msg.timestamp)
    })) : []
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

/**
 * Generate conversation title from first user message
 */
const generateConversationTitle = (messages: ChatMessage[]): string => {
  const firstUserMessage = messages.find(msg => msg.role === 'user');
  if (firstUserMessage && firstUserMessage.content) {
    // Take first 50 characters and add ellipsis if truncated
    const title = firstUserMessage.content.substring(0, 50);
    return title.length < firstUserMessage.content.length ? `${title}...` : title;
  }
  // Fallback to timestamp
  return `Conversation on ${new Date().toLocaleDateString()}`;
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
   * Find all conversations for a specific calendar
   * Ordered by most recently updated first
   */
  async findByCalendarId(calendarId: string): Promise<AIConversation[]> {
    try {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('calendar_id', calendarId)
        .order('updated_at', { ascending: false });

      if (error) {
        logger.error('Error finding conversations by calendar ID:', error);
        return [];
      }

      return data ? data.map(item => transformSupabaseConversation(item)) : [];
    } catch (error) {
      logger.error('Error finding conversations by calendar ID:', error);
      return [];
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
    
    // Generate title if not provided
    const title = entity.title || generateConversationTitle(entity.messages);
    
    const conversationData = {
      calendar_id: entity.calendar_id,
      user_id: entity.user_id,
      title: title.substring(0, 100), // Enforce max length
      messages: serializeMessages(entity.messages),
      message_count: entity.message_count,
      created_at: now,
      updated_at: now
    };

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
   * Save or update a conversation
   * If conversation has an ID, update it; otherwise create new
   * If update fails (conversation not found), create a new one
   */
  async saveConversation(
    conversationId: string | null,
    calendarId: string,
    userId: string,
    messages: ChatMessage[],
    title?: string
  ): Promise<RepositoryResult<AIConversation>> {
    try {
      const conversationTitle = title || generateConversationTitle(messages);

      if (conversationId) {
        // Try to update existing conversation
        const updateResult = await this.update(conversationId, {
          messages,
          message_count: messages.length,
          title: conversationTitle
        } as Partial<AIConversation>);

        // If update failed because conversation doesn't exist, create new one
        if (!updateResult.success && updateResult.error?.message?.includes('not found')) {
          logger.warn(`Conversation ${conversationId} not found, creating new conversation`);
          return await this.create({
            calendar_id: calendarId,
            user_id: userId,
            title: conversationTitle,
            messages,
            message_count: messages.length
          } as Omit<AIConversation, 'id' | 'created_at' | 'updated_at'>);
        }

        return updateResult;
      } else {
        // Create new conversation
        return await this.create({
          calendar_id: calendarId,
          user_id: userId,
          title: conversationTitle,
          messages,
          message_count: messages.length
        } as Omit<AIConversation, 'id' | 'created_at' | 'updated_at'>);
      }
    } catch (error) {
      logger.error('Error saving conversation:', error);
      const { parseSupabaseError } = await import('../../../utils/supabaseErrorHandler');
      return {
        success: false,
        error: parseSupabaseError(error, 'Saving conversation'),
        timestamp: new Date(),
        operation: conversationId ? 'update' : 'create'
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
      const { parseSupabaseError } = await import('../../../utils/supabaseErrorHandler');
      return {
        success: false,
        error: parseSupabaseError(error, 'Deleting conversations by calendar ID'),
        timestamp: new Date(),
        operation: 'deleteByCalendarId'
      };
    }
  }
}

