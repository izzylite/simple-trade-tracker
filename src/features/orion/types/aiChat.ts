/**
 * AI Chat Types and Interfaces
 * Defines all TypeScript interfaces for the AI chat feature using Supabase AI Agent
 */

export type MessageRole = 'user' | 'assistant' | 'system';

export type MessageStatus = 'sending' | 'sent' | 'error' | 'received' | 'pending' | 'receiving';

// Attached image for user messages
export interface AttachedImage {
  id: string;
  url: string; // Can be data URL (base64) or remote URL
  mimeType: string;
  name?: string;
  size?: number; // bytes
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  status: MessageStatus;
  error?: string;
  // Attached images (for user messages)
  images?: AttachedImage[];
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
  // Tool calls used to produce this response (captured from SSE stream — even
  // when the stream is proxy-buffered, these arrive at the end of the request
  // and are rendered in an expandable panel for transparency).
  toolCalls?: ToolCallRecord[];
  // Gemini chain-of-thought summary (thinkingConfig.includeThoughts). Streamed
  // in as reasoning_chunk SSE events and rendered in an expandable panel.
  reasoning?: string;
  // For user messages only: editor segments at send time (text fragments and
  // note-mention chip placeholders). Persisted so the editor can rebuild
  // chip entities when the user clicks Edit, instead of dumping the
  // expanded "[Referenced ...:]" syntax into the input.
  segments?: Array<
    | { type: 'text'; value: string }
    | { type: 'note-mention'; noteId: string; noteTitle: string }
  >;
  // Reminder + future-trigger metadata. Present when this turn was fired
  // by something other than the user typing — e.g. a reminder. The UI
  // renders a small system separator above any message with a triggered_by
  // value starting with 'reminder:'.
  metadata?: {
    triggered_by?: string;          // e.g. 'reminder:<uuid>'
    reminder_description?: string | null;
  };
}

export interface ToolCallRecord {
  name: string;
  label: string; // Human-friendly label
}

// Serializable version for database storage (timestamp as ISO string)
export interface SerializableChatMessage extends Omit<ChatMessage, 'timestamp'> {
  timestamp: string; // ISO 8601 string
  images?: AttachedImage[]; // Images are already serializable
}

// Conversation stored in database (after transformation from repository).
// `messages` is optional because list queries (findByCalendarId etc.) drop
// the heavy JSONB blob to keep the history payload small — callers that need
// the full thread fetch via `findById` after the user opens a conversation.
// `last_message_preview` is a denormalized snapshot (≤200 chars) of the last
// message's content, written by the edge function on every append; it's what
// the history list renders in place of the full messages array.
export interface AIConversation {
  id: string;
  calendar_id: string;
  user_id: string;
  trade_id?: string | null; // Optional: NULL = calendar-level, set = trade-specific
  title: string;
  messages?: ChatMessage[]; // Present on findById; absent on list queries
  last_message_preview?: string | null;
  message_count: number;
  /**
   * Server-measured prompt-token estimate for the NEXT turn (Gemini's
   * promptTokenCount from the final round of the most recent turn +
   * that turn's assistant output). Drives the context-budget meter in
   * the chat UI. Absent on rows that haven't had a turn yet (treat as 0).
   */
  last_prompt_tokens?: number;
  pinned: boolean;
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
  messages?: SerializableChatMessage[];
  last_message_preview?: string | null;
  message_count: number;
  last_prompt_tokens?: number;
  pinned: boolean;
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

export interface Citation {
  id: string;
  url: string;
  title?: string;
  source?: string;
  toolName?: string;
}
