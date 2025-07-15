/**
 * Firebase AI Chat Service
 * Handles AI chat using Firebase AI Logic instead of external API calls
 */

import {
  ChatMessage,
  AIModelSettings,
  ChatError,
  AIChatConfig
} from '../types/aiChat';
import { ai } from '../firebase/config';
import { getGenerativeModel, SchemaType, FunctionDeclaration } from 'firebase/ai';
import { logger } from '../utils/logger';
import { optimizedAIContextService, OptimizedTradingContext } from './optimizedAIContextService';
import { vectorSearchService, TradeSearchResult } from './vectorSearchService';
import { aiChatConfigService } from './aiChatConfigService';
import { tradingAnalysisFunctions, TradingAnalysisResult } from './tradingAnalysisFunctions';
import { Trade } from '../types/trade';
import { Calendar } from '../types/calendar';
import { getSystemPrompt } from './aiSystemPrompt';



class FirebaseAIChatService {
  private readonly SYSTEM_PROMPT = getSystemPrompt();

  /**
   * Send a chat message with AI-driven function calling
   */
  async sendMessageWithFunctionCalling(
    message: string,
    trades: Trade[],
    calendar: Calendar, 
    conversationHistory: ChatMessage[] = [],
    modelSettings?: AIModelSettings,
    config?: AIChatConfig
  ): Promise<{ response: string; tokenCount?: number; functionCalls?: any[] }> {
    try {
      logger.log('Sending message with AI-driven function calling...');

      // Initialize trading analysis functions with current data
      tradingAnalysisFunctions.initialize(trades, calendar);

      // Get the current config (for potential future use)
      // const currentConfig = config || aiChatConfigService.getConfig();

      // Prepare messages for function calling
      const messages = this.prepareFunctionCallingMessages(message, conversationHistory);

      // Get the model to use
      const modelName = modelSettings?.model || 'gemini-2.5-flash';

      // Create generative model instance with function declarations
      const model = getGenerativeModel(ai, {
        model: modelName,
        generationConfig: {
          temperature: modelSettings?.settings?.temperature || 0.7,
          maxOutputTokens: modelSettings?.settings?.maxTokens || 2000,
          topP: modelSettings?.settings?.topP || 1
        },
        tools: [{
          functionDeclarations: this.getFunctionDeclarations()
        }]
      });

      // Convert messages to a simple prompt string for function calling
      const prompt = messages.map(msg => `${msg.role}: ${msg.content}`).join('\n');

      // Generate response with function calling
      const result = await model.generateContent([{ text: prompt }]);
      const response = result.response;

      // Check if the AI wants to call functions
      const functionCalls = response.functionCalls();
      let finalResponse = '';
      const executedFunctions: any[] = [];

      if (functionCalls && functionCalls.length > 0) {
        logger.log(`AI requested ${functionCalls.length} function calls`);

        // Execute function calls
        const functionResults: TradingAnalysisResult[] = [];
        for (const call of functionCalls) {
          const result = await this.executeFunctionCall(call);
          functionResults.push(result);
          executedFunctions.push({
            name: call.name,
            args: call.args,
            result: result
          });
        }

        // Send function results back to AI for final response
        // Create a new chat session with the original prompt and function responses
        const chat = model.startChat({
          history: [
            {
              role: 'user',
              parts: [{ text: prompt }]
            },
            {
              role: 'model',
              parts: functionCalls.map(call => ({
                functionCall: {
                  name: call.name,
                  args: call.args
                }
              }))
            }
          ]
        });

        // Send function responses with explicit instruction about trade cards
        const hasTradeData = functionResults.some(result =>
          result.success && result.data && (result.data.trades || result.data.bestTrade || result.data.worstTrade)
        );

        // Modify function results to include trade card reminder if needed
        const functionResponseParts = functionCalls.map((call, index) => {
          const originalResult = functionResults[index];

          // Add reminder to the first function result that contains trade data
          if (hasTradeData && index === 0 && originalResult.success && originalResult.data) {
            const modifiedResult = {
              ...originalResult,
              data: {
                ...originalResult.data,
                _reminder: "IMPORTANT: The trades from this function call will be displayed as interactive cards below your response. Do not list individual trade details in your text - focus only on analysis, insights, and recommendations."
              }
            };
            return {
              functionResponse: {
                name: call.name,
                response: modifiedResult
              }
            };
          }

          return {
            functionResponse: {
              name: call.name,
              response: originalResult
            }
          };
        });

        const followUpResult = await chat.sendMessage(functionResponseParts);

        finalResponse = followUpResult.response.text() || 'No response received';
      } else {
        finalResponse = response.text() || 'No response received';
      }

      logger.log('Received response from Firebase AI Logic with function calling');

      return {
        response: finalResponse,
        tokenCount: response.usageMetadata?.totalTokenCount,
        functionCalls: executedFunctions
      };

    } catch (error) {
      logger.error('Error in sendMessageWithFunctionCalling:', error);

      // Fallback to basic response without function calling
      logger.log('Falling back to basic response');
      const basicContext = await optimizedAIContextService.generateOptimizedContext(
        message,
        trades.slice(0, 50), // Limit for fallback
        calendar,
        config || aiChatConfigService.getConfig()
      );

      return await this.sendMessageOptimized(
        message,
        basicContext,
        conversationHistory,
        modelSettings
      );
    }
  }

  /**
   * Send a chat message with vector search enhanced context
   */
  async sendMessageWithVectorSearch(
    message: string,
    trades: Trade[],
    calendar: Calendar,
    userId: string,
    conversationHistory: ChatMessage[] = [],
    modelSettings?: AIModelSettings,
    config?: AIChatConfig
  ): Promise<{ response: string; tokenCount?: number; relevantTrades?: TradeSearchResult[] }> {
    try {
      logger.log('Sending message with vector search enhancement...');

      // Get the current config or use the provided one
      const currentConfig = config || aiChatConfigService.getConfig();

      // Use vector search to find relevant trades
      const relevantTrades = await vectorSearchService.searchSimilarTrades(
        message,
        userId,
        calendar.id,
        {
          maxResults: currentConfig.maxContextTrades, // Use configured max context trades
          similarityThreshold: 0.3 // Lower threshold for broader search (updated after migration testing)
        }
      );

      logger.log(`Found ${relevantTrades.length} relevant trades via vector search`);

      // If we have relevant trades, create focused context
      let contextToUse: OptimizedTradingContext;

      if (relevantTrades.length > 0) {
        // Get the actual trade objects for the relevant trades
        const relevantTradeIds = relevantTrades.map(rt => rt.tradeId);
        const relevantTradeObjects = trades.filter(trade => relevantTradeIds.includes(trade.id));

        // Create focused context with only relevant trades
        const vectorSearchConfig: AIChatConfig = {
          ...currentConfig,
          maxContextTrades: Math.min(currentConfig.maxContextTrades, relevantTrades.length)
        };

        contextToUse = await optimizedAIContextService.generateOptimizedContext(
          message,
          relevantTradeObjects,
          calendar,
          vectorSearchConfig
        );

        // Add vector search info to context
        contextToUse.contextInfo.queryUsed = message;
        contextToUse.contextInfo.optimizationMethod = 'trimmed-full-dataset';
      } else {
        // Fallback to regular optimized context if no relevant trades found
        logger.log('No relevant trades found via vector search, using regular context');
        const fallbackConfig: AIChatConfig = {
          ...currentConfig,
          maxContextTrades: Math.min(currentConfig.maxContextTrades, 20)
        };

        contextToUse = await optimizedAIContextService.generateOptimizedContext(
          message,
          trades,
          calendar,
          fallbackConfig
        );
      }

      // Send message with the enhanced context
      const result = await this.sendMessageOptimized(
        message,
        contextToUse,
        conversationHistory,
        modelSettings
      );

      return {
        ...result,
        relevantTrades
      };

    } catch (error) {
      logger.error('Error in sendMessageWithVectorSearch:', error);

      // Get the current config for error fallback
      const currentConfig = config || aiChatConfigService.getConfig();

      // Fallback to regular optimized context
      logger.log('Falling back to regular optimized context');
      const errorFallbackConfig: AIChatConfig = {
        ...currentConfig,
        maxContextTrades: Math.min(currentConfig.maxContextTrades, 20)
      };

      const fallbackContext = await optimizedAIContextService.generateOptimizedContext(
        message,
        trades,
        calendar,
        errorFallbackConfig
      );

      return await this.sendMessageOptimized(
        message,
        fallbackContext,
        conversationHistory,
        modelSettings
      );
    }
  }

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
    // logger.log('Optimized contextual system prompt:', contextualSystemPrompt);
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
   * Prepare messages for function calling
   */
  private prepareFunctionCallingMessages(
    message: string,
    conversationHistory: ChatMessage[]
  ): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    // Add system prompt
    messages.push({
      role: 'system',
      content: this.SYSTEM_PROMPT
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
   * Get function declarations for the AI model
   */
  private getFunctionDeclarations(): FunctionDeclaration[] {
    return [
      {
        name: 'searchTrades',
        description: 'Search for trades based on specific criteria like date range, trade type, amount, tags, session, or day of week',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            dateRange: {
              type: SchemaType.STRING,
              description: 'Date range like "last 30 days", "last 6 months", "2024-01", etc.'
            },
            tradeType: {
              type: SchemaType.STRING,
              enum: ['win', 'loss', 'breakeven', 'all'],
              description: 'Filter by trade outcome'
            },
            minAmount: {
              type: SchemaType.NUMBER,
              description: 'Minimum P&L amount to filter by'
            },
            maxAmount: {
              type: SchemaType.NUMBER,
              description: 'Maximum P&L amount to filter by'
            },
            tags: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: 'Array of tag names to filter by'
            },
            session: {
              type: SchemaType.STRING,
              enum: ['london', 'new-york', 'tokyo', 'sydney'],
              description: 'Trading session to filter by'
            },
            dayOfWeek: {
              type: SchemaType.STRING,
              description: 'Day of week like "monday", "tuesday", etc.'
            },
            limit: {
              type: SchemaType.NUMBER,
              description: 'Maximum number of trades to return'
            }
          }
        }
      },
      {
        name: 'getTradeStatistics',
        description: 'Get statistical analysis and performance metrics of trades',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            period: {
              type: SchemaType.STRING,
              description: 'Time period for analysis'
            },
            groupBy: {
              type: SchemaType.STRING,
              enum: ['day', 'week', 'month', 'session', 'tag', 'dayOfWeek'],
              description: 'How to group the statistical analysis'
            },
            tradeType: {
              type: SchemaType.STRING,
              enum: ['win', 'loss', 'breakeven', 'all'],
              description: 'Filter by trade outcome'
            }
          }
        }
      },
      {
        name: 'findSimilarTrades',
        description: 'Find trades similar to a natural language query using semantic search',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            query: {
              type: SchemaType.STRING,
              description: 'Natural language description of what trades to find'
            },
            limit: {
              type: SchemaType.NUMBER,
              description: 'Maximum number of similar trades to return'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'queryDatabase',
        description: 'Execute a SQL SELECT query against the Supabase database to get specific data',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            query: {
              type: SchemaType.STRING,
              description: 'SQL SELECT statement to execute. Only SELECT queries are allowed for security.'
            },
            description: {
              type: SchemaType.STRING,
              description: 'Optional description of what the query is intended to find'
            }
          },
          required: ['query']
        }
      }
    ];
  }

  /**
   * Execute a function call requested by the AI
   */
  private async executeFunctionCall(call: any): Promise<TradingAnalysisResult> {
    try {
      logger.log(`Executing function call: ${call.name}`, call.args);

      switch (call.name) {
        case 'searchTrades':
          return await tradingAnalysisFunctions.searchTrades(call.args);

        case 'getTradeStatistics':
          return await tradingAnalysisFunctions.getTradeStatistics(call.args);

        case 'findSimilarTrades':
          return await tradingAnalysisFunctions.findSimilarTrades(call.args);

        case 'queryDatabase':
          return await tradingAnalysisFunctions.queryDatabase(call.args);

        default:
          return {
            success: false,
            error: `Unknown function: ${call.name}`
          };
      }
    } catch (error) {
      logger.error(`Error executing function ${call.name}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
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
