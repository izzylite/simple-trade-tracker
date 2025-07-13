/**
 * Firebase AI Chat Service
 * Handles AI chat using Firebase AI Logic instead of external API calls
 */

import {
  ChatMessage,
  AIModelSettings,
  ChatError
} from '../types/aiChat';
import { ai } from '../firebase/config';
import { getGenerativeModel } from 'firebase/ai';
import { logger } from '../utils/logger';
import { optimizedAIContextService, OptimizedTradingContext } from './optimizedAIContextService';



class FirebaseAIChatService {
  private readonly SYSTEM_PROMPT = `You are an expert trading analyst assistant. You help traders analyze their trading performance, identify patterns, and provide actionable insights.

Key capabilities:
- Analyze trading statistics and performance metrics
- Identify patterns in trading behavior and outcomes
- Provide specific, actionable recommendations
- Calculate and explain risk metrics
- Analyze the impact of economic events on trading
- Help with trade timing and strategy optimization

Guidelines:
- Always base your analysis on the provided trading data
- Be specific and quantitative in your insights
- Provide clear, actionable recommendations
- Use trading terminology appropriately
- Focus on practical improvements the trader can implement
- When analyzing time-based data, consider that timestamps are in Unix format (seconds since epoch)
- You can calculate day of week, time of day, and other time-based insights from Unix timestamps
- When data appears limited (e.g., showing only 100 out of 181 trades), acknowledge this limitation and suggest increasing the context if needed for complete analysis

Current date and time: ${new Date().toISOString()}`;

  /**
   * Send a chat message and get AI response using Firebase AI Logic with optimized context
   */
  async sendMessageOptimized(
    message: string,
    optimizedContext: OptimizedTradingContext,
    conversationHistory: ChatMessage[] = [],
    modelSettings?: AIModelSettings
  ): Promise<{ response: string; tokenCount?: number }> {
    try {
      logger.log('Sending message to Firebase AI Logic with optimized context...');

      // Prepare messages with optimized context
      const messages = this.prepareOptimizedMessages(message, optimizedContext, conversationHistory);

      // Get the model to use
      const modelName = modelSettings?.model || 'gemini-2.5-flash';

      // Create generative model instance
      const model = getGenerativeModel(ai, {
        model: modelName,
        generationConfig: {
          temperature: modelSettings?.settings?.temperature || 0.7,
          maxOutputTokens: modelSettings?.settings?.maxTokens || 2000,
          topP: modelSettings?.settings?.topP || 1
        }
      });

      // Convert messages to Firebase AI Logic format
      const prompt = this.formatMessagesForFirebaseAI(messages);

      // Generate response
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      logger.log('Received response from Firebase AI Logic (optimized)');

      return {
        response: text || 'No response received',
        tokenCount: response.usageMetadata?.totalTokenCount
      };

    } catch (error) {
      logger.error('Error sending message to Firebase AI Logic (optimized):', error);
      throw this.createNetworkError(error);
    }
  }



  /**
   * Prepare messages with optimized trading context and conversation history
   */
  private prepareOptimizedMessages(
    message: string,
    optimizedContext: OptimizedTradingContext,
    conversationHistory: ChatMessage[]
  ): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    // Add system prompt with optimized trading context
    const contextualSystemPrompt = this.buildOptimizedContextualSystemPrompt(optimizedContext);
    logger.log('Optimized contextual system prompt:', contextualSystemPrompt);
    messages.push({
      role: 'system',
      content: contextualSystemPrompt
    });

    // Add conversation history
    for (const historyMessage of conversationHistory) {
      if (historyMessage.role !== 'system') {
        messages.push({
          role: historyMessage.role as 'user' | 'assistant',
          content: historyMessage.content
        });
      }
    }

    // Add current user message
    messages.push({
      role: 'user',
      content: message
    });

    return messages;
  }



  /**
   * Build system prompt with optimized trading context
   */
  private buildOptimizedContextualSystemPrompt(optimizedContext: OptimizedTradingContext): string {
    const contextSummary = optimizedAIContextService.generateContextSummary(optimizedContext);
    return this.SYSTEM_PROMPT + '\n\n' + contextSummary;
  }



  /**
   * Format messages for Firebase AI Logic
   */
  private formatMessagesForFirebaseAI(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  ): string {
    // Firebase AI Logic expects a single prompt string
    // We'll combine system message with conversation
    let prompt = '';

    for (const message of messages) {
      if (message.role === 'system') {
        prompt += message.content + '\n\n';
      } else if (message.role === 'user') {
        prompt += `User: ${message.content}\n\n`;
      } else if (message.role === 'assistant') {
        prompt += `Assistant: ${message.content}\n\n`;
      }
    }

    return prompt.trim();
  }

  /**
   * Create network error
   */
  private createNetworkError(error: any): ChatError {
    return {
      type: 'network_error',
      message: 'Failed to communicate with Firebase AI Logic',
      details: error?.message || 'Unknown error occurred',
      retryable: true
    };
  }
}

// Export singleton instance
export const firebaseAIChatService = new FirebaseAIChatService();
