/**
 * Supabase AI Chat Service
 * Frontend service for communicating with AI Trading Agent edge function
 * Handles HTML formatting and citations from the edge function
 */

import { supabase } from '../config/supabase';
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

class SupabaseAIChatService {
  private readonly FUNCTION_NAME = 'ai-trading-agent';

  /**
   * Send a message to the AI Trading Agent edge function
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

