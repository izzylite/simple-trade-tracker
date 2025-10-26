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
import { aiFunctionExecution } from './aiFunctionExecutionCall';




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
  ): Promise<{ response: string; tokenCount?: number; functionCalls?: any[] }> {
    try {
      logger.log('Sending message with AI-driven function calling...');

      // Initialize trading analysis functions with current data
      tradingAnalysisFunctions.initialize(trades, calendar);

      // Prepare messages for function calling
      const messages = this.prepareFunctionCallingMessages(message, conversationHistory);

      // Get the model to use - gemini-2.5-flash is recommended for function calling
      const modelName = modelSettings?.model || 'gemini-2.5-flash';
      logger.log(`Using model ${modelName} for function calling`);

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

         for (let i = 0; i < functionCalls.length; i++) {
           const functionCall = functionCalls[i];
 
           try {
             const result = await aiFunctionExecution.executeFunctionCall(functionCall.name, functionCall.args);
 
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
 
             // Ensure we have a valid result before adding to response parts
             const validResult = processedResult || { success: false, error: 'Function returned undefined' };
 
            functionResponseParts.push({
              functionResponse: {
                name: functionCall.name,
                response: validResult
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

            // Ensure we have a valid error result
            const validErrorResult = errorResult || { success: false, error: 'Unknown function execution error' };

            functionResponseParts.push({
              functionResponse: {
                name: functionCall.name,
                response: validErrorResult
              }
            });
          }
        }

        try {
          // Send function responses back to model
          // According to Firebase AI docs, function responses should be sent directly as parts array
          logger.log(`Sending ${functionResponseParts.length} function responses to AI`);

          // Defensive programming: ensure we have valid function response parts
          if (!functionResponseParts || functionResponseParts.length === 0) {
            logger.error('No function response parts to send to AI');
            finalResponse = 'I encountered an error processing the function results. Please try rephrasing your question.';
            break;
          }

          // Validate each function response part
          const validResponseParts = functionResponseParts.filter(part =>
            part && part.functionResponse && part.functionResponse.name && part.functionResponse.response
          );

          if (validResponseParts.length === 0) {
            logger.error('No valid function response parts found');
            finalResponse = 'I encountered an error processing the function results. Please try rephrasing your question.';
            break;
          }

          
          currentResponse = await chat.sendMessage(validResponseParts);

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

## NOTE
If you want to display specific trades as cards, Use convertTradeIdsToCards function to generate JSON. the system will parse the JSON and display the cards automatically. 
`;
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
