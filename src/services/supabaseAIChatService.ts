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
import { getApiKey } from './apiKeyStorage';

export interface AgentResponse {
  success: boolean;
  message: string;
  messageHtml?: string;
  error?: string; // Error message from edge function
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
   * Process @tag mentions in the message and provide context to the AI
   * Converts @tag mentions to structured context for better AI understanding
   */
  private processTagMentions(message: string, availableTags: string[]): { processedMessage: string; tagContext: string } {
    // Find all @tag mentions in the message using exec loop for compatibility
    const tagMentionRegex = /@([^\s]+)/g;
    const mentions: RegExpExecArray[] = [];
    let match;

    while ((match = tagMentionRegex.exec(message)) !== null) {
      mentions.push(match);
    }

    if (mentions.length === 0) {
      return { processedMessage: message, tagContext: '' };
    }

    const referencedTags: string[] = [];
    let processedMessage = message;

    // Process each mention
    for (const match of mentions) {
      const mentionedTag = match[1];

      // Check if the mentioned tag exists in available tags (case-insensitive)
      const actualTag = availableTags.find(tag =>
        tag.toLowerCase() === mentionedTag.toLowerCase()
      );

      if (actualTag) {
        referencedTags.push(actualTag);
        // Replace @tag with a more descriptive reference for the AI
        processedMessage = processedMessage.replace(
          match[0],
          `the "${actualTag}" tag`
        );
      }
    }

    // Build context string for the AI
    let tagContext = '';
    if (referencedTags.length > 0) {
      tagContext = `\n\nTag Context: The user is specifically asking about trades tagged with: ${referencedTags.join(', ')}. When analyzing trades, focus on those with these tags and provide insights specific to these categories.`;
    }

    return { processedMessage, tagContext };
  }

  private getCurrentDayNote(calendar: Calendar): string | undefined {
    if (!calendar.days_notes) {
      return undefined;
    }

    const dayKey = new Date().toLocaleDateString('en-US', { weekday: 'short' });
    const note = calendar.days_notes[dayKey];

    if (!note || !note.trim()) {
      return undefined;
    }

    return note.trim();
  }

  private buildCalendarContext(calendar: Calendar) {
    return {
      ...calendar,
      daily_note: this.getCurrentDayNote(calendar),
    };
  }

  /**
   * Send a message to the AI Trading Agent with streaming support
   * Yields SSE events as they arrive
   */
  async *sendMessageStreaming(
    message: string,
    userId: string,
    calendar: Calendar | undefined,
    conversationHistory: ChatMessageType[] = [],
    signal?: AbortSignal
  ): AsyncGenerator<SSEEvent, void, unknown> {
    try {
      logger.log(`Sending streaming message to AI agent: "${message.substring(0, 50)}..."`);

      const availableTags = calendar?.tags || [];

      // Process @tag mentions
      const { processedMessage, tagContext } = this.processTagMentions(message, availableTags);
      const finalMessage = processedMessage + tagContext;

      // Get valid auth token with auto-refresh
      const session = await this.getValidSession();

      // Convert conversation history
      const formattedHistory = conversationHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));

      // Get user's API key from localStorage (if available)
      const userApiKey = getApiKey();

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
          message: finalMessage,
          userId,
          calendarId: calendar?.id,
          conversationHistory: formattedHistory,
          calendarContext: calendar ? this.buildCalendarContext(calendar) : undefined,
          userApiKey: userApiKey || undefined, // Send user's API key if available
        }),
        signal
      });

      if (!response.ok) {
        const errorText = await response.text();

        // Try to parse error response as JSON to get detailed error message
        let detailedError = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          // Extract the error field from AgentResponse
          if (errorJson.error) {
            detailedError = errorJson.error;
          } else if (errorJson.message) {
            detailedError = errorJson.message;
          }
        } catch {
          // If not JSON, use the raw text
        }

        // Throw error with the detailed message (will be parsed by parseQuotaError in component)
        throw new Error(detailedError);
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
      const isAbortError =
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        (error as any).name === 'AbortError';

      if (isAbortError || signal?.aborted) {
        logger.log('AI streaming request aborted by caller');
        return;
      }

      logger.error('Error in sendMessageStreaming:', error);
      yield {
        type: 'error',
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
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
   * Get valid auth session with automatic refresh if needed
   */
  private async getValidSession() {
    // Try to get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      logger.error('Session error:', sessionError);
      throw new Error('Failed to get authentication session');
    }

    if (!session) {
      // No session - try to refresh
      logger.log('No active session, attempting to refresh...');
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError || !refreshedSession) {
        logger.error('Session refresh failed:', refreshError);
        throw new Error('Authentication required. Please sign in again.');
      }

      logger.log('Session refreshed successfully');
      return refreshedSession;
    }

    // Check if token is about to expire (within 5 minutes)
    const expiresAt = session.expires_at;
    if (expiresAt) {
      const expiresInSeconds = expiresAt - Math.floor(Date.now() / 1000);
      if (expiresInSeconds < 300) { // Less than 5 minutes
        logger.log('Token expiring soon, refreshing...');
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();

        if (refreshError || !refreshedSession) {
          logger.warn('Token refresh failed, using existing session:', refreshError);
          return session; // Fall back to existing session
        }

        logger.log('Token refreshed successfully');
        return refreshedSession;
      }
    }

    return session;
  }

  /**
   * Send a message to the AI Trading Agent edge function (non-streaming)
   */
  async sendMessage(
    message: string,
    userId: string,
    calendar: Calendar | undefined,
    conversationHistory: ChatMessageType[] = []
  ): Promise<AgentResponse> {
    try {
      logger.log(`Sending message to Supabase AI agent: "${message.substring(0, 50)}..."`);

      const availableTags = calendar?.tags || [];

      // Process @tag mentions
      const { processedMessage, tagContext } = this.processTagMentions(message, availableTags);
      const finalMessage = processedMessage + tagContext;

      // Convert conversation history to the format expected by the edge function
      const formattedHistory = conversationHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));

      // Get user's API key from localStorage (if available)
      const userApiKey = getApiKey();

      // Get valid auth token with auto-refresh
      const session = await this.getValidSession();

      // Call edge function using fetch (not supabase.functions.invoke) to get detailed error messages
      const response = await fetch(
        `${supabaseUrl}/functions/v1/${this.FUNCTION_NAME}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            message: finalMessage,
            userId,
            calendarId: calendar?.id,
            conversationHistory: formattedHistory,
            calendarContext: calendar ? this.buildCalendarContext(calendar) : undefined,
            userApiKey: userApiKey || undefined,
          }),
        }
      );

      // Parse response
      const responseText = await response.text();

      if (!response.ok) {
        // Try to parse error response as JSON to get detailed error message
        let detailedError = responseText;
        try {
          const errorJson = JSON.parse(responseText);
          // Extract the error field from AgentResponse
          if (errorJson.error) {
            detailedError = errorJson.error;
          } else if (errorJson.message) {
            detailedError = errorJson.message;
          }
        } catch {
          // If not JSON, use the raw text
        }

        // Throw error with the detailed message (will be parsed by parseQuotaError in component)
        throw new Error(detailedError);
      }

      // Parse successful response
      const data: AgentResponse = JSON.parse(responseText);

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

