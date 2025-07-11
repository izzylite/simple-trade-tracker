/**
 * AI Chat Service
 * Handles API calls to different AI providers with trading data context
 */

import { 
  AIProvider, 
  ChatMessage, 
  APIKeySettings, 
  TradingDataContext, 
  ChatError,
  AI_PROVIDERS
} from '../types/aiChat';
import { apiKeyService } from './apiKeyService';
import { logger } from '../utils/logger';

interface ChatCompletionRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  model: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
}

interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

class AIChatService {
  private readonly SYSTEM_PROMPT = `You are an expert trading analyst assistant helping a trader analyze their trading performance and data. You have access to comprehensive trading statistics, patterns, insights, and COMPLETE DETAILED TRADE HISTORY.

Key guidelines:
1. Provide actionable insights based on the trading data
2. Be specific and reference actual trade names, dates, and details from the data
3. Suggest concrete improvements for trading performance
4. Identify patterns in wins/losses, sessions, tags, and risk management
5. Be encouraging but honest about areas needing improvement
6. Format responses clearly with bullet points, tables, or charts when helpful
7. Always base recommendations on the actual trading data provided
8. Reference specific trades by name and date when providing examples
9. Analyze individual trade performance and patterns

You have access to:
- Overall performance metrics (win rate, profit factor, P&L)
- Session-based performance patterns
- Tag-based strategy effectiveness
- Risk management and drawdown analysis
- Recent performance trends
- Economic events impact on trading
- Consecutive wins/losses patterns
- COMPLETE TRADE HISTORY with all details including:
  * Trade names and dates
  * Session information
  * P&L amounts
  * Risk:Reward ratios
  * Tags and strategies used
  * Notes and observations
  * Economic events during trades
  * Creation and update timestamps

When analyzing, you can:
- Reference specific trades by name (e.g., "Your trade 'EURUSD Long' on 2024-01-15")
- Identify patterns across multiple trades
- Compare similar trades and their outcomes
- Analyze the effectiveness of specific strategies/tags
- Examine the impact of economic events on specific trades
- Track improvement over time by comparing older vs newer trades

Respond in a professional, helpful tone that encourages good trading practices.`;

  /**
   * Send a chat message and get AI response
   */
  async sendMessage(
    message: string,
    provider: AIProvider,
    tradingContext: TradingDataContext,
    conversationHistory: ChatMessage[] = []
  ): Promise<{ response: string; tokenCount?: number }> {
    try {
      logger.log(`Sending message to ${provider}...`);

      // Get API key settings
      const apiKeySettings = apiKeyService.getAPIKey(provider);
      
      // Validate API key
      const keyError = apiKeyService.validateAPIKeyWithError(provider, apiKeySettings.apiKey);
      if (keyError) {
        throw this.createChatError(keyError);
      }

      // Prepare messages for API
      const messages = this.prepareMessages(message, tradingContext, conversationHistory);
      
      // Make API call based on provider
      const response = await this.callAIProvider(provider, apiKeySettings, messages);
      
      logger.log(`Received response from ${provider}`);
      return response;

    } catch (error) {
      logger.error(`Error sending message to ${provider}:`, error);
      
      if (error instanceof Error && error.message.includes('ChatError')) {
        throw error;
      }
      
      throw this.createNetworkError(error);
    }
  }

  /**
   * Prepare messages for AI API call
   */
  private prepareMessages(
    userMessage: string,
    tradingContext: TradingDataContext,
    conversationHistory: ChatMessage[]
  ): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    // Add system prompt with trading context
    const contextSummary = this.formatTradingContext(tradingContext);
    messages.push({
      role: 'system',
      content: `${this.SYSTEM_PROMPT}\n\nCurrent Trading Data Context:\n${contextSummary}`
    });

    // Add conversation history (limit to last 10 messages for context)
    const recentHistory = conversationHistory.slice(-10);
    recentHistory.forEach(msg => {
      if (msg.role !== 'system') {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        });
      }
    });

    // Add current user message
    messages.push({
      role: 'user',
      content: userMessage
    });

    return messages;
  }

  /**
   * Format trading context for AI consumption
   */
  private formatTradingContext(context: TradingDataContext): string {
    const sections = [
      `TRADING PERFORMANCE OVERVIEW:`,
      `• Total Trades: ${context.totalTrades}`,
      `• Win Rate: ${context.winRate.toFixed(1)}%`,
      `• Profit Factor: ${context.profitFactor.toFixed(2)}`,
      `• Total P&L: $${context.totalPnL.toFixed(2)}`,
      `• Average Win: $${context.avgWin.toFixed(2)}`,
      `• Average Loss: $${Math.abs(context.avgLoss).toFixed(2)}`,
      `• Max Drawdown: ${context.maxDrawdown.toFixed(1)}%`,
      `• Trading Period: ${context.dateRange.start.toDateString()} to ${context.dateRange.end.toDateString()}`,
      `• Trading Days: ${context.tradingDays}`,
      `• Average Trades per Day: ${context.avgTradesPerDay.toFixed(1)}`,
      ``
    ];

    // Session performance
    if (context.sessionStats.length > 0) {
      sections.push(`SESSION PERFORMANCE:`);
      context.sessionStats.forEach(session => {
        sections.push(`• ${session.session}: ${session.trades} trades, ${session.winRate.toFixed(1)}% win rate, $${session.pnl.toFixed(2)} P&L`);
      });
      sections.push(``);
    }

    // Top tags
    if (context.topTags.length > 0) {
      sections.push(`TOP TRADING STRATEGIES/TAGS:`);
      context.topTags.slice(0, 8).forEach(tag => {
        sections.push(`• ${tag.tag}: ${tag.count} trades, ${tag.winRate.toFixed(1)}% win rate, $${tag.avgPnL.toFixed(2)} avg P&L`);
      });
      sections.push(``);
    }

    // Recent trends
    if (context.recentTrends.length > 0) {
      sections.push(`RECENT PERFORMANCE TRENDS:`);
      context.recentTrends.forEach(trend => {
        sections.push(`• ${trend.period}: ${trend.tradeCount} trades, ${trend.winRate.toFixed(1)}% win rate, $${trend.pnl.toFixed(2)} P&L`);
      });
      sections.push(``);
    }

    // Risk metrics
    sections.push(`RISK MANAGEMENT METRICS:`);
    sections.push(`• Average Risk:Reward Ratio: ${context.riskMetrics.avgRiskReward.toFixed(2)}`);
    sections.push(`• Max Consecutive Wins: ${context.riskMetrics.maxConsecutiveWins}`);
    sections.push(`• Max Consecutive Losses: ${context.riskMetrics.maxConsecutiveLosses}`);
    sections.push(`• Largest Win: $${context.riskMetrics.largestWin.toFixed(2)}`);
    sections.push(`• Largest Loss: $${context.riskMetrics.largestLoss.toFixed(2)}`);

    // Economic events impact
    if (context.economicEventsImpact) {
      sections.push(``, `ECONOMIC EVENTS IMPACT:`);
      sections.push(`• High Impact Event Trades: ${context.economicEventsImpact.highImpactTrades}`);
      sections.push(`• High Impact Win Rate: ${context.economicEventsImpact.highImpactWinRate.toFixed(1)}%`);
      if (context.economicEventsImpact.commonEvents.length > 0) {
        sections.push(`• Common Events: ${context.economicEventsImpact.commonEvents.join(', ')}`);
      }
    }

    // Detailed trade information (if available)
    if (context.trades && context.trades.length > 0) {
      sections.push(``, `DETAILED TRADE HISTORY:`);
      sections.push(`The following is a complete list of all ${context.trades.length} trades with detailed information:`);
      sections.push(``);

      context.trades.forEach((trade, index) => {
        sections.push(`Trade ${index + 1}:`);
        sections.push(`• ID: ${trade.id}`);
        sections.push(`• Name: ${trade.name}`);
        sections.push(`• Date: ${trade.date}`);
        sections.push(`• Session: ${trade.session}`);
        sections.push(`• Result: ${trade.type.toUpperCase()}`);
        sections.push(`• P&L: $${trade.amount.toFixed(2)}`);

        if (trade.riskToReward) {
          sections.push(`• Risk:Reward: 1:${trade.riskToReward.toFixed(2)}`);
        }

        if (trade.tags && trade.tags.length > 0) {
          sections.push(`• Tags: ${trade.tags.join(', ')}`);
        }

        if (trade.notes) {
          sections.push(`• Notes: ${trade.notes}`);
        }

        if (trade.economicEvents && trade.economicEvents.length > 0) {
          sections.push(`• Economic Events: ${trade.economicEvents.map(e => `${e.event} (${e.impact} impact, ${e.currency})`).join(', ')}`);
        }

        sections.push(`• Created: ${trade.createdAt}`);
        sections.push(`• Updated: ${trade.updatedAt}`);
        sections.push(``); // Empty line between trades
      });
    }

    return sections.join('\n');
  }

  /**
   * Call AI provider API
   */
  private async callAIProvider(
    provider: AIProvider,
    settings: APIKeySettings,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  ): Promise<{ response: string; tokenCount?: number }> {
    switch (provider) {
      case 'openai':
        return this.callOpenAI(settings, messages);
      case 'anthropic':
        return this.callAnthropic(settings, messages);
      case 'google':
        return this.callGoogle(settings, messages);
      case 'custom':
        return this.callCustomProvider(settings, messages);
      default:
        throw this.createProviderError(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(
    settings: APIKeySettings,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  ): Promise<{ response: string; tokenCount?: number }> {
    const config = AI_PROVIDERS.openai;
    const url = `${settings.baseUrl || config.baseUrl}/v1/chat/completions`;

    const requestBody: ChatCompletionRequest = {
      model: settings.model || 'gpt-4-turbo-preview',
      messages,
      temperature: settings.settings?.temperature || 0.7,
      max_tokens: settings.settings?.maxTokens || 2000,
      top_p: settings.settings?.topP || 1,
      frequency_penalty: settings.settings?.frequencyPenalty || 0,
      presence_penalty: settings.settings?.presencePenalty || 0
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw await this.handleAPIError(response, 'openai');
    }

    const data: ChatCompletionResponse = await response.json();

    return {
      response: data.choices[0]?.message?.content || 'No response received',
      tokenCount: data.usage?.total_tokens
    };
  }

  /**
   * Call Anthropic API
   */
  private async callAnthropic(
    settings: APIKeySettings,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  ): Promise<{ response: string; tokenCount?: number }> {
    const config = AI_PROVIDERS.anthropic;
    const url = `${settings.baseUrl || config.baseUrl}/v1/messages`;

    // Anthropic requires system message to be separate
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const requestBody = {
      model: settings.model || 'claude-3-sonnet-20240229',
      max_tokens: settings.settings?.maxTokens || 2000,
      temperature: settings.settings?.temperature || 0.7,
      system: systemMessage,
      messages: conversationMessages
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw await this.handleAPIError(response, 'anthropic');
    }

    const data = await response.json();

    return {
      response: data.content?.[0]?.text || 'No response received',
      tokenCount: data.usage?.input_tokens + data.usage?.output_tokens
    };
  }

  /**
   * Call Google Gemini API
   */
  private async callGoogle(
    settings: APIKeySettings,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  ): Promise<{ response: string; tokenCount?: number }> {
    const config = AI_PROVIDERS.google;
    const model = settings.model || 'gemini-1.5-flash';
    const url = `${settings.baseUrl || config.baseUrl}/v1/models/${model}:generateContent?key=${settings.apiKey}`;

    // Convert messages to Gemini format
    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const requestBody = {
      contents,
      generationConfig: {
        temperature: settings.settings?.temperature || 0.7,
        maxOutputTokens: settings.settings?.maxTokens || 2000,
        topP: settings.settings?.topP || 1
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw await this.handleAPIError(response, 'google');
    }

    const data = await response.json();

    return {
      response: data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response received',
      tokenCount: data.usageMetadata?.totalTokenCount
    };
  }

  /**
   * Call custom provider API
   */
  private async callCustomProvider(
    settings: APIKeySettings,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  ): Promise<{ response: string; tokenCount?: number }> {
    if (!settings.baseUrl) {
      throw this.createProviderError('Custom provider requires base URL');
    }

    const url = `${settings.baseUrl}/v1/chat/completions`;

    const requestBody: ChatCompletionRequest = {
      model: settings.model || 'custom-model',
      messages,
      temperature: settings.settings?.temperature || 0.7,
      max_tokens: settings.settings?.maxTokens || 2000
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw await this.handleAPIError(response, 'custom');
    }

    const data: ChatCompletionResponse = await response.json();

    return {
      response: data.choices[0]?.message?.content || 'No response received',
      tokenCount: data.usage?.total_tokens
    };
  }

  /**
   * Handle API errors
   */
  private async handleAPIError(response: Response, provider: AIProvider): Promise<Error> {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let errorType: ChatError['type'] = 'provider_error';

    try {
      const errorData = await response.json();

      if (response.status === 401) {
        errorType = 'api_key_invalid';
        errorMessage = 'Invalid API key';
      } else if (response.status === 429) {
        errorType = 'rate_limit';
        errorMessage = 'Rate limit exceeded';

        // Extract retry-after header if available
        const retryAfter = response.headers.get('retry-after');
        if (retryAfter) {
          errorMessage += ` (retry after ${retryAfter} seconds)`;
        }
      } else if (errorData.error?.message) {
        errorMessage = errorData.error.message;
      }
    } catch {
      // Use default error message if JSON parsing fails
    }

    return this.createChatError({
      type: errorType,
      message: errorMessage,
      details: `${AI_PROVIDERS[provider]?.name || provider} API error`,
      retryable: response.status >= 500 || response.status === 429
    });
  }

  /**
   * Create a ChatError
   */
  private createChatError(error: ChatError): Error {
    const chatError = new Error(`ChatError: ${error.message}`);
    (chatError as any).chatError = error;
    return chatError;
  }

  /**
   * Create a network error
   */
  private createNetworkError(originalError: any): Error {
    const error: ChatError = {
      type: 'network_error',
      message: 'Network error occurred',
      details: originalError?.message || 'Unknown network error',
      retryable: true
    };

    return this.createChatError(error);
  }

  /**
   * Create a provider error
   */
  private createProviderError(message: string): Error {
    const error: ChatError = {
      type: 'provider_error',
      message,
      details: 'Provider configuration error',
      retryable: false
    };

    return this.createChatError(error);
  }

  /**
   * Extract ChatError from Error object
   */
  static extractChatError(error: Error): ChatError | null {
    return (error as any).chatError || null;
  }

  /**
   * Check if provider supports streaming
   */
  supportsStreaming(provider: AIProvider): boolean {
    return AI_PROVIDERS[provider]?.supportsStreaming || false;
  }

  /**
   * Get available models for provider
   */
  getAvailableModels(provider: AIProvider): Array<{ id: string; name: string; description: string }> {
    return AI_PROVIDERS[provider]?.models || [];
  }

  /**
   * Estimate token count for messages (rough estimation)
   */
  estimateTokenCount(messages: Array<{ content: string }>): number {
    const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(totalChars / 4);
  }

  /**
   * Validate message content
   */
  validateMessage(message: string, provider: AIProvider): { isValid: boolean; error?: string } {
    if (!message.trim()) {
      return { isValid: false, error: 'Message cannot be empty' };
    }

    const config = AI_PROVIDERS[provider];
    if (!config) {
      return { isValid: false, error: 'Invalid provider' };
    }

    // Check message length (rough token estimation)
    const estimatedTokens = this.estimateTokenCount([{ content: message }]);
    const maxTokens = config.models[0]?.maxTokens || 4096;

    if (estimatedTokens > maxTokens * 0.8) { // Use 80% of max tokens as safety margin
      return {
        isValid: false,
        error: `Message too long. Estimated ${estimatedTokens} tokens, max ${Math.floor(maxTokens * 0.8)}`
      };
    }

    return { isValid: true };
  }
}

// Export class and singleton instance
export { AIChatService };
export const aiChatService = new AIChatService();
