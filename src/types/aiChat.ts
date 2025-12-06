/**
 * AI Chat Types and Interfaces
 * Defines all TypeScript interfaces for the AI chat feature using Supabase AI Agent
 */

export type MessageRole = 'user' | 'assistant' | 'system';

export type MessageStatus = 'sending' | 'sent' | 'error' | 'received' | 'pending' | 'receiving';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  status: MessageStatus;
  error?: string;
  // HTML formatted message (from Supabase AI agent)
  messageHtml?: string;
  // Citations from tool results (from Supabase AI agent)
  citations?: Array<{
    id: string;
    title: string;
    url: string;
    source?: string;
    toolName: string;
  }>;
  // Embedded data for inline references (fetched from backend)
  embeddedTrades?: Record<string, any>; // Trade objects keyed by ID
  embeddedEvents?: Record<string, any>; // Event objects keyed by ID
  embeddedNotes?: Record<string, any>; // Note objects keyed by ID
}

// Serializable version for database storage (timestamp as ISO string)
export interface SerializableChatMessage extends Omit<ChatMessage, 'timestamp'> {
  timestamp: string; // ISO 8601 string
}

// Conversation stored in database (after transformation from repository)
export interface AIConversation {
  id: string;
  calendar_id: string;
  user_id: string;
  trade_id?: string | null; // Optional: NULL = calendar-level, set = trade-specific
  title: string;
  messages: ChatMessage[]; // Transformed to ChatMessage with Date objects
  message_count: number;
  created_at: Date;
  updated_at: Date;
}

// Serializable version from database (before transformation, dates as ISO strings)
export interface SerializableAIConversation {
  id: string;
  calendar_id: string;
  user_id: string;
  trade_id?: string | null; // Optional: NULL = calendar-level, set = trade-specific
  title: string;
  messages: SerializableChatMessage[]; // Messages with string timestamps
  message_count: number;
  created_at: string;
  updated_at: string;
}



export interface ChatError {
  type: 'api_key_invalid' | 'rate_limit' | 'network_error' | 'provider_error' | 'context_too_large';
  message: string;
  details?: string;
  retryable: boolean;
  retryAfter?: number; // seconds
  trade_type?: 'win' | 'loss' | 'breakeven';
}

export interface InlineReference {
  type: 'trade' | 'event';
  id: string;
  trade_type?: 'win' | 'loss' | 'breakeven';
}

export interface DisplayItem {
  id: string;
  type: 'trade' | 'event';
  trade_type?: 'win' | 'loss' | 'breakeven';
}

export interface Citation {
  id: string;
  url: string;
  title?: string;
  source?: string;
  toolName?: string;
}
