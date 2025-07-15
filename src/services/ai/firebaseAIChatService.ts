/**
 * Firebase AI Chat Service
 * Handles AI chat using Firebase AI Logic instead of external API calls
 */

import {
  ChatMessage,
  AIModelSettings,
  ChatError,
  AIChatConfig
} from '../../types/aiChat';
import { ai } from '../../firebase/config';
import { getGenerativeModel, SchemaType, FunctionDeclaration } from 'firebase/ai';
import { logger } from '../../utils/logger';

import { tradingAnalysisFunctions, TradingAnalysisResult } from './tradingAnalysisFunctions';
import { Trade } from '../../types/trade';
import { Calendar } from '../../types/calendar';
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
      tradingAnalysisFunctions.initialize(trades, calendar, config?.maxContextTrades || 100);

      // Prepare messages for function calling
      const messages = this.prepareFunctionCallingMessages(message, conversationHistory);

      // Get the model to use
      const modelName = modelSettings?.model || 'gemini-2.5-flash';

      // Create generative model instance with function declarations
      const model = getGenerativeModel(ai, {
        model: modelName,
        generationConfig: {
          temperature: modelSettings?.settings?.temperature || 0.7,
          maxOutputTokens: modelSettings?.settings?.maxTokens || 8000,
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

      // Validate response
      if (!response) {
        throw new Error('No response received from AI model');
      }

      // Check if the AI wants to call functions
      let functionCalls: any[] = [];
      try {
        functionCalls = response.functionCalls() || [];
      } catch (error) {
        logger.warn('Error extracting function calls from response:', error);
        functionCalls = [];
      }

      let finalResponse = '';
      const executedFunctions: any[] = [];

      if (functionCalls && Array.isArray(functionCalls) && functionCalls.length > 0) {
        logger.log(`AI requested ${functionCalls.length} function calls`);

        // Execute function calls
        const functionResults: TradingAnalysisResult[] = [];
        for (const call of functionCalls) {
          if (call && call.name) {
            const result = await this.executeFunctionCall(call);
            functionResults.push(result);
            executedFunctions.push({
              name: call.name,
              args: call.args,
              result: result
            });
          } else {
            logger.warn('Invalid function call received:', call);
          }
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
              parts: functionCalls
                .filter(call => call && call.name)
                .map(call => ({
                  functionCall: {
                    name: call.name,
                    args: call.args || {}
                  }
                }))
            }
          ]
        });

        // Send function responses with explicit instruction about trade cards
        const hasTradeData = Array.isArray(functionResults) && functionResults.some(result =>
          result && result.success && result.data && (result.data.trades || result.data.bestTrade || result.data.worstTrade)
        );

        // Modify function results to include appropriate reminders based on function type
        const functionResponseParts = functionCalls.map((call, index) => {
          const originalResult = functionResults[index];
 

          // Add reminder to the first function result that contains trade data
          if (hasTradeData && index === 0 && originalResult.success && originalResult.data) {
            let reminder: string;

            if (call.name === 'findSimilarTrades' || (call.name === 'queryDatabase' && originalResult.data?.fallbackUsed)) {
              // For findSimilarTrades or queryDatabase with fallback, AI should analyze the trades to answer the user's question
              reminder = "CRITICAL: These trades are for CONTEXT only - they are NOT the final answer. You must ANALYZE these trades to answer the user's specific question. Do not just list or describe the trades. Instead, examine them for patterns, insights, and conclusions that directly address what the user asked. Focus on answering their question using these trades as evidence. If you want to highlight specific trades as examples, include their IDs in JSON format: {\"tradeCards\": [\"trade-id-1\", \"trade-id-2\"], \"title\": \"Example Title\"}.";
            } else {
              // For other functions, trades are the direct answer
              reminder = "IMPORTANT: If you want to display specific trades as cards, include their IDs in JSON format: {\"tradeCards\": [\"trade-id-1\", \"trade-id-2\"], \"title\": \"Example Title\"}. Do not list individual trade details in your text - focus only on analysis, insights, and recommendations.";
            }

            const modifiedResult = {
              ...originalResult,
              data: {
                ...originalResult.data,
                _reminder: reminder
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

        try {
          logger.log(`Sending ${functionResponseParts.length} function responses to AI for final processing`);
          const followUpResult = await chat.sendMessage(functionResponseParts);

          // Safely extract response text
          try {
            finalResponse = followUpResult.response.text() || 'No response received';
          } catch (textError) {
            logger.warn('Error extracting text from follow-up response:', textError);
            finalResponse = 'Response received but text extraction failed';
          }
        } catch (sendError) {
          logger.error('Error sending function responses to AI:', sendError);
          logger.error('Function response parts that caused error:', JSON.stringify(functionResponseParts, null, 2));

          // Fallback: try with minimal data
          const minimalParts = functionCalls.map((call, index) => ({
            functionResponse: {
              name: call.name,
              response: {
                success: functionResults[index].success,
                data: {
                  count: functionResults[index].data?.count || 0,
                  message: 'Function executed successfully but data was simplified for processing'
                }
              }
            }
          }));

          try {
            logger.log('Attempting fallback with minimal function response data');
            const fallbackResult = await chat.sendMessage(minimalParts);
            finalResponse = fallbackResult.response.text() || 'Function executed but response processing failed';
          } catch (fallbackError) {
            logger.error('Fallback also failed:', fallbackError);
            finalResponse = 'Function executed successfully but response processing encountered technical difficulties. Please try rephrasing your question.';
          }
        }
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
      throw this.createNetworkError(error);
    }
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
