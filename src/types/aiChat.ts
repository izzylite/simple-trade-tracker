/**
 * AI Chat Types and Interfaces
 * Defines all TypeScript interfaces for the AI chat feature using Supabase AI Agent
 */

export type MessageRole = 'user' | 'assistant' | 'system';

export type MessageStatus = 'sending' | 'sent' | 'error' | 'received';

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
