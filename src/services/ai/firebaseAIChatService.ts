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
import { getGenerativeModel, SchemaType, FunctionDeclaration, FunctionCallingMode } from 'firebase/ai';
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

      // Get the model to use - gemini-2.5-flash is recommended for function calling
      const modelName = modelSettings?.model || 'gemini-2.5-flash';

      // Create generative model instance with function declarations
      const model = getGenerativeModel(ai, {
        model: modelName,
        // Add system instruction following official guidelines
        systemInstruction: this.SYSTEM_PROMPT,
        generationConfig: {
          // Use lower temperature for more deterministic function calls (official recommendation)
          temperature: modelSettings?.settings?.temperature || 0.3,
          maxOutputTokens: modelSettings?.settings?.maxTokens || 8000,
          topP: modelSettings?.settings?.topP || 1
        },
        tools: [{
          functionDeclarations: this.getFunctionDeclarations()
        }],
        // Use AUTO mode by default - model decides when to use functions
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingMode.AUTO
          }
        }
      });

      // Convert messages to a simple prompt string for function calling
      const prompt = messages.map(msg => `${msg.role}: ${msg.content}`).join('\n');

      // Use official compositional function calling pattern
      let finalResponse = '';
      const executedFunctions: any[] = [];

      // Create a chat session for natural function calling flow
      const chat = model.startChat();
      let currentResponse = await chat.sendMessage(prompt);

      // Support up to 10 rounds of function calling (increased for complex analysis)
      const maxRounds = 10;
      let currentRound = 0;

      // Natural compositional function calling loop
      while (currentRound < maxRounds) {
        // Check for function calls using the standard Firebase AI SDK method
        const functionCalls = currentResponse.response.functionCalls();

        if (!functionCalls || functionCalls.length === 0) {
          // No more function calls needed - model has final response
          finalResponse = currentResponse.response.text() || 'No response received';
          break;
        }

        currentRound++;
        logger.log(`AI requested ${functionCalls.length} function calls (round ${currentRound}):`,
          functionCalls.map(fc => `${fc.name}(${Object.keys(fc.args || {}).join(', ')})`));

        // Execute all function calls for this round
        const functionResponseParts: any[] = [];

        for (const functionCall of functionCalls) {
          try {
            const result = await this.executeFunctionCall({
              name: functionCall.name,
              args: functionCall.args
            });

            executedFunctions.push({
              name: functionCall.name,
              args: functionCall.args,
              result: result,
              round: currentRound
            });

            // Add trade card reminder for findSimilarTrades
            let processedResult = result;
            if (functionCall.name === 'findSimilarTrades' && result?.success && result?.data?.trades) {
              processedResult = {
                ...result,
                data: {
                  ...result.data,
                  _reminder: "IMPORTANT: If you want to display specific trades as cards, include their IDs in JSON format: {\"tradeCards\": [\"trade-id-1\", \"trade-id-2\"], \"title\": \"Example Title\"}. Focus on analysis and insights rather than listing individual trade details."
                }
              };
            }

            functionResponseParts.push({
              functionResponse: {
                name: functionCall.name,
                response: processedResult || { success: false, error: 'Function returned undefined' }
              }
            });

          } catch (error) {
            logger.error(`Error executing function ${functionCall.name}:`, error);
            const errorResult = {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            };

            executedFunctions.push({
              name: functionCall.name,
              args: functionCall.args || {},
              result: errorResult,
              round: currentRound
            });

            functionResponseParts.push({
              functionResponse: {
                name: functionCall.name,
                response: errorResult
              }
            });
          }
        }

        try {
          // Send function responses back to model
          logger.log(`Sending ${functionResponseParts.length} function responses to AI`);
          currentResponse = await chat.sendMessage(functionResponseParts);

        } catch (sendError) {
          logger.error('Error sending function responses to AI:', sendError);
          finalResponse = 'I encountered an error while processing the function results. Please try rephrasing your question.';
          break;
        }
      }

      // Handle max rounds reached
      if (currentRound >= maxRounds && !finalResponse) {
        finalResponse = currentResponse.response.text() || 'Analysis completed. The system made multiple function calls to gather comprehensive information.';
      }

      logger.log('Received response from Firebase AI Logic with function calling');

      return {
        response: finalResponse,
        tokenCount: currentResponse.response.usageMetadata?.totalTokenCount,
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

    // Add conversation history (system instruction is now set at model level)
    for (const historyMessage of conversationHistory) {
      if (historyMessage.role !== 'system') {
        messages.push({
          role: historyMessage.role as 'user' | 'assistant',
          content: historyMessage.content
        });
      }
    }

    // Add current user message with technical context
    const contextualMessage = this.addTechnicalContext(message);
    messages.push({
      role: 'user',
      content: contextualMessage
    });

    return messages;
  }

  /**
   * Add technical context to user message when needed
   */
  private addTechnicalContext(message: string): string {


    return `${message}
    
## TRADE CARD DISPLAY:
When you want to display specific trades as interactive cards, include trade IDs in JSON format:

\`\`\`json
{
  "tradeCards": ["trade-id-1", "trade-id-2", "trade-id-3"],
  "title": "Analyzed Trades"
}
\`\`\`
## TRADE DISPLAY RULES:
- Use functions to get trade data, then include relevant trade IDs in JSON format
- Only include trade IDs for trades you specifically want to highlight as examples
- DO NOT describe individual trade details in text when cards will be shown - avoid redundancy
- Focus your text on high-level analysis, patterns, and recommendations
- Trade cards will automatically display below your response using the provided IDs

Your response should always contain:
- High-level analysis and insights
- Patterns and trends you observe
- Actionable recommendations
- Summary statistics (total P&L, win rate, trade count)
- Strategic advice based on the data`;
  }

  /**
   * Get function declarations for the AI model
   */
  private getFunctionDeclarations(): FunctionDeclaration[] {
    return [
      {
        name: 'searchTrades',
        description: 'Search and filter trades based on specific criteria such as date ranges, trade outcomes, profit/loss amounts, tags, trading sessions, days of the week, or economic events. Can filter by economic event presence, impact level, currency, or event names. Returns matching trades with summary statistics including total P&L and win rate.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            dateRange: {
              type: SchemaType.STRING,
              description: 'Date range filter. Supports formats like "last 30 days", "last 6 months", "last 1 week", or specific months like "2024-01" for January 2024. Use "last X days/weeks/months" for relative periods.'
            },
            tradeType: {
              type: SchemaType.STRING,
              enum: ['win', 'loss', 'breakeven', 'all'],
              description: 'Filter trades by their outcome: "win" for profitable trades, "loss" for losing trades, "breakeven" for neutral trades, or "all" for no filtering by outcome.'
            },
            minAmount: {
              type: SchemaType.NUMBER,
              description: 'Minimum profit/loss amount in absolute value. For example, 100 will include trades with P&L >= $100 or <= -$100.'
            },
            maxAmount: {
              type: SchemaType.NUMBER,
              description: 'Maximum profit/loss amount in absolute value. For example, 500 will include trades with P&L between -$500 and $500.'
            },
            tags: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: 'Array of tag names to filter by. Trades must contain at least one of the specified tags. Use exact tag names as they appear in the trading system.'
            },
            session: {
              type: SchemaType.STRING,
              enum: ['london', 'new-york', 'tokyo', 'sydney'],
              description: 'Trading session to filter by: "london" for London session, "new-york" for New York session, "tokyo" for Tokyo/Asian session, "sydney" for Sydney session.'
            },
            dayOfWeek: {
              type: SchemaType.STRING,
              description: 'Day of the week to filter by. Use full day names like "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday" (case insensitive).'
            },
            limit: {
              type: SchemaType.NUMBER,
              description: 'Maximum number of trades to return. Defaults to all matching trades if not specified. Use reasonable limits (e.g., 50-100) for large datasets.'
            },
            hasEconomicEvents: {
              type: SchemaType.BOOLEAN,
              description: 'Filter trades by presence of economic events. True = only trades with economic events, False = only trades without economic events.'
            },
            economicEventImpact: {
              type: SchemaType.STRING,
              description: 'Filter trades by economic event impact level. Options: "High", "Medium", "Low", "all". Only includes trades that have events with the specified impact level.'
            },
            economicEventCurrency: {
              type: SchemaType.STRING,
              description: 'Filter trades by economic event currency. Options: "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "all". Only includes trades that have events for the specified currency.'
            },
            economicEventName: {
              type: SchemaType.STRING,
              description: 'Filter trades by economic event name (partial match). Examples: "NFP", "FOMC", "GDP", "CPI". Only includes trades that have events containing this text in the event name.'
            }
          }
        }
      },
      {
        name: 'getTradeStatistics',
        description: 'Calculate comprehensive statistical analysis and performance metrics for trades including total P&L, win rate, average trade size, best/worst trades, grouped performance data, and economic events correlation analysis. Can analyze how economic events impact trading performance by event impact level, currency, and frequency.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            period: {
              type: SchemaType.STRING,
              description: 'Time period for analysis. Can be relative periods like "last 30 days", "last 3 months", or specific periods like "2024-01" for January 2024.'
            },
            groupBy: {
              type: SchemaType.STRING,
              enum: ['day', 'week', 'month', 'session', 'tag', 'dayOfWeek', 'economicEvent'],
              description: 'How to group the statistical analysis: "day" for daily breakdown, "week" for weekly, "month" for monthly, "session" for trading session analysis, "tag" for tag-based grouping, "dayOfWeek" for day-of-week patterns, "economicEvent" for economic event correlation analysis.'
            },
            tradeType: {
              type: SchemaType.STRING,
              enum: ['win', 'loss', 'breakeven', 'all'],
              description: 'Filter statistics by trade outcome: "win" for winning trades only, "loss" for losing trades only, "breakeven" for neutral trades, "all" for comprehensive statistics.'
            },
            includeEconomicEventStats: {
              type: SchemaType.BOOLEAN,
              description: 'Include detailed economic events statistics in the analysis. Provides breakdown by event impact, currency, most common events, and win rates with/without events.'
            },
            economicEventImpact: {
              type: SchemaType.STRING,
              enum: ['High', 'Medium', 'Low', 'all'],
              description: 'Filter economic events analysis by impact level. Only relevant when includeEconomicEventStats is true.'
            }
          }
        }
      },
      {
        name: 'findSimilarTrades',
        description: `Find trades similar to a natural language query using semantic vector search. Searches through trade notes, descriptions, and metadata to find conceptually similar trades based on trading patterns, market conditions, strategies, or outcomes described in natural language. For finding similar trades or contextual analysis: Use findSimilarTrades (analyze results to answer user's question)`,
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            query: {
              type: SchemaType.STRING,
              description: 'Natural language description of what trades to find. Examples: "trades during high volatility", "breakout trades that failed", "trades with good risk management", "similar market conditions to today", "trades with specific patterns or setups".'
            },
            limit: {
              type: SchemaType.NUMBER,
              description: 'Maximum number of similar trades to return. Recommended range is 5-20 for focused analysis, up to 50 for comprehensive review.'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'analyzeEconomicEvents',
        description: 'Analyze the correlation between economic events and trading performance. Provides detailed statistics comparing trades with and without economic events, breakdown by impact level and currency, and identifies the most common events affecting trades.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            impactLevel: {
              type: SchemaType.STRING,
              enum: ['High', 'Medium', 'Low', 'all'],
              description: 'Filter analysis by economic event impact level. "High" for major market-moving events, "Medium" for moderate impact, "Low" for minor events, "all" for comprehensive analysis.'
            },
            currency: {
              type: SchemaType.STRING,
              enum: ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'all'],
              description: 'Filter analysis by currency of economic events. Focus on specific currency events or use "all" for comprehensive analysis.'
            },
            eventName: {
              type: SchemaType.STRING,
              description: 'Filter by specific economic event name (partial match). Examples: "NFP", "FOMC", "GDP", "CPI", "Interest Rate Decision".'
            },
            dateRange: {
              type: SchemaType.STRING,
              description: 'Time period for analysis. Supports formats like "last 30 days", "last 6 months", or specific months like "2024-01".'
            },
            compareWithoutEvents: {
              type: SchemaType.BOOLEAN,
              description: 'Include comparison with trades that had no economic events during their session. Useful for understanding the impact of news vs. quiet market conditions.'
            }
          }
        }
      },
      {
        name: 'queryDatabase',
        description: `Execute a SQL SELECT query against the Supabase database to retrieve specific trading data, perform complex aggregations, or access database views. Automatically filters results to user\'s data for security. Use this for complex queries that cannot be handled by other functions.
        DATABASE SCHEMA:

Main Table: trade_embeddings
- id: UUID (primary key)
- trade_id: TEXT (unique trade identifier)
- user_id: TEXT (user identifier)
- calendar_id: TEXT (calendar identifier)
- trade_type: TEXT ('win', 'loss', 'breakeven')
- trade_amount: DECIMAL (profit/loss amount)
- trade_date: BIGINT (Unix timestamp in milliseconds when trade occurred)
- trade_updated_at: BIGINT (Unix timestamp in milliseconds when trade was last modified)
- trade_session: TEXT ('Asia', 'London', 'NY AM', 'NY PM' or NULL)
- tags: TEXT[] (array of tag strings)
- economic_events: JSONB (array of economic events that occurred during the trade)
- embedding: vector(384) (vector embedding for similarity search)
- embedded_content: TEXT (text content that was embedded)
- created_at: TIMESTAMP WITH TIME ZONE (when embedding was created)
- updated_at: TIMESTAMP WITH TIME ZONE (when embedding was last updated)

IMPORTANT: The embedded_content field contains searchable text that includes additional trade properties not stored as separate columns, such as:
- risk_to_reward: The risk-to-reward ratio of the trade (e.g., "risk reward ratio 2.5")
- entry_price: The entry price (e.g., "entry 1.2345")
- exit_price: The exit price (e.g., "exit 1.2456")
- partials_taken: Whether partial profits were taken (e.g., "partials taken")
- trade_name: The name of the trade (e.g., "name EUR/USD breakout")
- notes: Any notes about the trade
- economic_events: Economic events that occurred during the trade (e.g., "economic events Non-Farm Payrolls high USD")

You can search for these properties using pattern matching on the embedded_content field:
- Risk-to-reward ratio: embedded_content ILIKE '%risk reward ratio%'
- Entry price: embedded_content ILIKE '%entry%'
- Exit price: embedded_content ILIKE '%exit%'

DATE FILTERING EXAMPLES (trade_date and trade_updated_at are Unix timestamps in milliseconds):
- Last 7 days: trade_date >= ${Date.now() - 7 * 24 * 60 * 60 * 1000}
- Last 30 days: trade_date >= ${Date.now() - 30 * 24 * 60 * 60 * 1000}
- This year: trade_date >= ${new Date(new Date().getFullYear(), 0, 1).getTime()}
- Specific date range: trade_date BETWEEN 1640995200000 AND 1641081600000
- Recently updated trades: trade_updated_at >= ${Date.now() - 24 * 60 * 60 * 1000}

Available Database Views:
- trade_embeddings: Raw trade data with embeddings (includes trade_id)
- user_trade_embeddings_summary: Aggregated trade statistics per user
- trade_embeddings_by_session: Trade performance by trading session (aggregated)
- trade_embeddings_session_details: Individual trades by session (includes trade_id for card display)
- trade_embeddings_by_day: Trade performance by day of week (aggregated)
- trade_embeddings_day_details: Individual trades by day of week (includes trade_id for card display)
- trade_embeddings_by_month: Trade performance by month (aggregated)
- trade_embeddings_month_details: Individual trades by month (includes trade_id for card display)
- trade_embeddings_tag_analysis: Analysis of trade tags and their performance (aggregated)
- trade_embeddings_tag_details: Individual trades by tag (includes trade_id for card display)

IMPORTANT: Use the *_details views when you want to show individual trades as cards. Use the aggregated views for statistics only.

Common SQL Patterns:
- Day of week: EXTRACT(DOW FROM trade_date) (0=Sunday, 1=Monday, etc.)
- Month grouping: DATE_TRUNC('month', trade_date) or TO_CHAR(trade_date, 'YYYY-MM')
- Tag filtering: 'tag_name' = ANY(tags) or tags @> ARRAY['tag_name']
- Date ranges: trade_date >= NOW() - INTERVAL '6 months'
- Risk-to-reward filtering: embedded_content ILIKE '%risk reward ratio 2%' (for ratio above 2:1)
- Entry/exit price search: embedded_content ILIKE '%entry 1.23%' or embedded_content ILIKE '%exit 1.24%'
- Partials taken: embedded_content ILIKE '%partials taken%'
- Trade name search: embedded_content ILIKE '%name EUR/USD%'
- Economic events: embedded_content ILIKE '%economic events%' or embedded_content ILIKE '%Non-Farm Payrolls%'
- High impact events: embedded_content ILIKE '%high USD%' or embedded_content ILIKE '%high EUR%'
- Specific events: embedded_content ILIKE '%FOMC%' or embedded_content ILIKE '%NFP%'
`,
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            query: {
              type: SchemaType.STRING,
              description: `SQL SELECT statement to execute. Only SELECT queries are allowed for security. The query will be automatically filtered to include only the current user\'s data.`
            },
            description: {
              type: SchemaType.STRING,
              description: 'Optional description of what the query is intended to find or analyze. This helps with understanding the query purpose and results interpretation.'
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

        case 'analyzeEconomicEvents':
          return await tradingAnalysisFunctions.analyzeEconomicEvents(call.args);

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
