/**
 * Firebase AI Chat Service
 * Handles AI chat using Firebase AI Logic instead of external API calls
 */

import {
  AIProvider,
  ChatMessage,
  AIModelSettings,
  TradingDataContext,
  ChatError
} from '../types/aiChat';
import { ai } from '../firebase/config';
import { getGenerativeModel } from 'firebase/ai';
import { logger } from '../utils/logger';

interface ChatCompletionRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

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
   * Send a chat message and get AI response using Firebase AI Logic
   */
  async sendMessage(
    message: string,
    provider: AIProvider,
    tradingContext: TradingDataContext,
    conversationHistory: ChatMessage[] = [],
    modelSettings?: AIModelSettings
  ): Promise<{ response: string; tokenCount?: number }> {
    try {
      logger.log('Sending message to Firebase AI Logic...');

      // Prepare messages for Firebase AI Logic
      const messages = this.prepareMessages(message, tradingContext, conversationHistory);

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

      logger.log('Received response from Firebase AI Logic');

      return {
        response: text || 'No response received',
        tokenCount: response.usageMetadata?.totalTokenCount
      };

    } catch (error) {
      logger.error('Error sending message to Firebase AI Logic:', error);
      throw this.createNetworkError(error);
    }
  }

  /**
   * Prepare messages with trading context and conversation history
   */
  private prepareMessages(
    message: string,
    tradingContext: TradingDataContext,
    conversationHistory: ChatMessage[]
  ): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    // Add system prompt with trading context
    const contextualSystemPrompt = this.buildContextualSystemPrompt(tradingContext);
    logger.log('Contextual system prompt:', contextualSystemPrompt);
    messages.push({
      role: 'system',
      content: contextualSystemPrompt
    });

    // Add conversation history (last 10 messages to avoid context limits)
    const recentHistory = conversationHistory.slice(-10);
    for (const historyMessage of recentHistory) {
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
   * Build system prompt with trading context
   */
  private buildContextualSystemPrompt(tradingContext: TradingDataContext): string {
    const contextSummary = `
TRADING PERFORMANCE CONTEXT:
- Total Trades: ${tradingContext.totalTrades}
- Win Rate: ${tradingContext.winRate.toFixed(1)}%
- Profit Factor: ${tradingContext.profitFactor.toFixed(2)}
- Total P&L: $${tradingContext.totalPnL.toFixed(2)}
- Average Win: $${tradingContext.avgWin.toFixed(2)}
- Average Loss: $${tradingContext.avgLoss.toFixed(2)}
- Max Drawdown: $${tradingContext.maxDrawdown.toFixed(2)}
- Trading Period: ${tradingContext.dateRange.start.toLocaleDateString()} to ${tradingContext.dateRange.end.toLocaleDateString()}
- Trading Days: ${tradingContext.tradingDays}
- Average Trades per Day: ${tradingContext.avgTradesPerDay.toFixed(1)}

RISK METRICS:
- Average Risk/Reward: ${tradingContext.riskMetrics.avgRiskReward.toFixed(2)}
- Max Consecutive Losses: ${tradingContext.riskMetrics.maxConsecutiveLosses}
- Max Consecutive Wins: ${tradingContext.riskMetrics.maxConsecutiveWins}
- Largest Win: $${tradingContext.riskMetrics.largestWin.toFixed(2)}
- Largest Loss: $${tradingContext.riskMetrics.largestLoss.toFixed(2)}

TOP PERFORMING TAGS:
${tradingContext.topTags.slice(0, 5).map(tag =>
      `- ${tag.tag}: ${tag.count} trades, ${tag.winRate.toFixed(1)}% win rate, $${tag.avgPnL.toFixed(2)} avg P&L`
    ).join('\n')}

RECENT TRENDS:
${tradingContext.recentTrends.map(trend =>
      `- ${trend.period}: ${trend.winRate.toFixed(1)}% win rate, $${trend.pnl.toFixed(2)} P&L, ${trend.tradeCount} trades`
    ).join('\n')}

${tradingContext.economicEventsImpact ? `
ECONOMIC EVENTS IMPACT:
- High Impact Trades: ${tradingContext.economicEventsImpact.highImpactTrades}
- High Impact Win Rate: ${tradingContext.economicEventsImpact.highImpactWinRate.toFixed(1)}%
- Common Events: ${tradingContext.economicEventsImpact.commonEvents.join(', ')}
` : ''}

DETAILED TRADES DATA:
The following ${tradingContext.trades.length} trades are available for analysis as JSON data${tradingContext.trades.length < tradingContext.totalTrades ? ` (showing ${tradingContext.trades.length} out of ${tradingContext.totalTrades} total trades - this is a limited dataset)` : ''}:
${JSON.stringify(tradingContext.trades)}
`;

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
