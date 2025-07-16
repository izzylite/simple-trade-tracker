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
import { getGenerativeModel, FunctionCallingMode } from 'firebase/ai';
import { logger } from '../../utils/logger';
import { DEFAULT_ECONOMIC_EVENT_FILTER_SETTINGS } from '../../components/economicCalendar/EconomicCalendarDrawer';
import { tradingAnalysisFunctions, TradingAnalysisResult } from './tradingAnalysisFunctions';
import { Trade } from '../../types/trade';
import { Calendar } from '../../types/calendar';
import { getSystemPrompt } from './aiSystemPrompt';
import { getFunctionDeclarations } from './aiFunctionDeclarations';



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
          functionDeclarations: getFunctionDeclarations(calendar.economicCalendarFilters?.currencies || DEFAULT_ECONOMIC_EVENT_FILTER_SETTINGS.currencies)
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
                  _reminder: "IMPORTANT: Focus on analysis and insights rather than listing individual trade details."
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

If you want to display specific trades as cards, include their IDs in JSON format: {\"tradeCards\": [\"trade-id-1\", \"trade-id-2\"], \"title\": \"Example Title\"}. 
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

        case 'fetchEconomicEvents':
          return await tradingAnalysisFunctions.fetchEconomicEvents(call.args);

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
