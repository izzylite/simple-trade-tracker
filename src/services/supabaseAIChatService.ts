/**
 * Supabase AI Chat Service
 * Frontend service for communicating with AI Trading Agent edge function
 * Handles HTML formatting and citations from the edge function
 */

import { supabase, supabaseUrl } from '../config/supabase';
import { logger } from '../utils/logger';
import type { Trade } from '../types/trade';
import type { Calendar } from '../types/calendar';
import type { ChatMessage as ChatMessageType } from '../types/aiChat';

export interface AgentResponse {
  success: boolean;
  message: string;
  messageHtml?: string;
  citations?: Array<{
    id: string;
    title: string;
    url: string;
    source?: string;
    toolName: string;
  }>;
  embeddedTrades?: Record<string, any>;
  embeddedEvents?: Record<string, any>;
  metadata?: {
    functionCalls: Array<{
      name: string;
      args: Record<string, any>;
      result: any;
    }>;
    model: string;
    timestamp: string;
  };
}

export type SSEEventType =
  | 'text_chunk'
  | 'tool_call'
  | 'tool_result'
  | 'citation'
  | 'embedded_data'
  | 'done'
  | 'error';

export interface SSEEvent {
  type: SSEEventType;
  data: any;
}

class SupabaseAIChatService {
  private readonly FUNCTION_NAME = 'ai-trading-agent';

  /**
   * Get the edge function URL
   */
  private getFunctionUrl(): string {
    return `${supabaseUrl}/functions/v1/${this.FUNCTION_NAME}`;
  }

  /**
   * Send a message to the AI Trading Agent with streaming support
   * Yields SSE events as they arrive
   */
  async *sendMessageStreaming(
    message: string,
    userId: string,
    calendarId: string,
    conversationHistory: ChatMessageType[] = []
  ): AsyncGenerator<SSEEvent, void, unknown> {
    try {
      logger.log(`Sending streaming message to AI agent: "${message.substring(0, 50)}..."`);

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      // Convert conversation history
      const formattedHistory = conversationHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));

      // Call edge function with streaming
      const url = this.getFunctionUrl() + '?stream=true'; // Use query param for streaming
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'Accept': 'text/event-stream' // Also set Accept header for proper response type
        },
        body: JSON.stringify({
          message,
          userId,
          calendarId,
          conversationHistory: formattedHistory,
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI agent error: ${response.status} - ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Process SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEventType: SSEEventType | null = null;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Decode chunk and add to buffer
          buffer += decoder.decode(value, { stream: true });

          // Process complete lines
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) {
              // Empty line signals end of event
              currentEventType = null;
              continue;
            }

            // Parse SSE format: "event: type\ndata: {...}\n\n"
            if (trimmedLine.startsWith('event: ')) {
              currentEventType = trimmedLine.substring(7).trim() as SSEEventType;
              continue;
            }

            if (trimmedLine.startsWith('data: ')) {
              const dataStr = trimmedLine.substring(6);
              try {
                const data = JSON.parse(dataStr);

                // Use explicit event type or infer from data
                const eventType = currentEventType || this.inferEventType(data);

                yield { type: eventType, data };
              } catch (parseError) {
                logger.error('Failed to parse SSE data:', parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      logger.log('Streaming complete');
    } catch (error) {
      logger.error('Error in sendMessageStreaming:', error);
      yield { type: 'error', data: { error: error instanceof Error ? error.message : 'Unknown error' } };
    }
  }

  /**
   * Infer event type from data structure
   */
  private inferEventType(data: any): SSEEventType {
    if (data.text !== undefined) return 'text_chunk';
    if (data.name && data.args !== undefined) return 'tool_call';
    if (data.name && data.result !== undefined) return 'tool_result';
    if (data.citations) return 'citation';
    if (data.embeddedTrades || data.embeddedEvents) return 'embedded_data';
    if (data.success !== undefined || data.messageHtml !== undefined) return 'done';
    if (data.error) return 'error';
    return 'text_chunk';
  }

  /**
   * Send a message to the AI Trading Agent edge function (non-streaming)
   */
  async sendMessage(
    message: string,
    userId: string,
    calendarId: string,
    conversationHistory: ChatMessageType[] = []
  ): Promise<AgentResponse> {
    try {
      logger.log(`Sending message to Supabase AI agent: "${message.substring(0, 50)}..."`);

      // Convert conversation history to the format expected by the edge function
      const formattedHistory = conversationHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));

      // Call edge function
      const { data, error } = await supabase.functions.invoke<AgentResponse>(
        this.FUNCTION_NAME,
        {
          body: {
            message,
            userId,
            calendarId,
            conversationHistory: formattedHistory,
          },
        }
      );

      if (error) {
        logger.error('Edge function error:', error);
        throw new Error(`AI agent error: ${error.message}`);
      }

      if (!data) {
        throw new Error('No response from AI agent');
      }

      if (!data.success && !data.message) {
        throw new Error('AI agent returned empty response');
      }

      logger.log(`Received response from Supabase AI agent ${JSON.stringify(data)}`);
      logger.log(`Response includes ${data.citations?.length || 0} citations`);

      return data;
    } catch (error) {
      logger.error('Error in sendMessage:', error);
      throw error;
    }
  }

  /**
   * Convert agent response to ChatMessage format
   */
  convertToChatMessage(
    response: AgentResponse,
    messageId: string
  ): ChatMessageType {
    return {
      id: messageId,
      role: 'assistant',
      content: response.message,
      messageHtml: response.messageHtml,
      citations: response.citations,
      embeddedTrades: response.embeddedTrades,
      embeddedEvents: response.embeddedEvents,
      timestamp: new Date(),
      status: 'received'
    };
  }
}

export const supabaseAIChatService = new SupabaseAIChatService();

