/**
 * AI Chat Types and Interfaces
 * Defines all TypeScript interfaces for the AI chat feature using Firebase AI Logic
 */
 

export type AIProvider = 'firebase-ai';

export type MessageRole = 'user' | 'assistant' | 'system';

export type MessageStatus = 'sending' | 'sent' | 'error' | 'received';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  status: MessageStatus;
  provider?: AIProvider;
  tokenCount?: number;
  error?: string;
  // For assistant messages with structured data
  metadata?: {
    tradingInsights?: TradingInsight[];
    charts?: ChartData[];
    recommendations?: string[];
  };
  // Function calls data for trade card display
  functionCalls?: any[];
}

export interface TradingInsight {
  type: 'statistic' | 'pattern' | 'recommendation' | 'warning';
  title: string;
  value: string | number;
  description?: string;
  confidence?: number; // 0-100
  timeframe?: string;
}

export interface ChartData {
  type: 'line' | 'bar' | 'pie' | 'scatter';
  title: string;
  data: any[];
  labels?: string[];
  colors?: string[];
}

export interface AIModelSettings {
  model: string;
  // Model-specific settings
  settings?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
}
 
  

export interface AIChatConfig {
  // Default provider settings
  defaultProvider: AIProvider;
  defaultModel: string;

  // UI preferences
  autoScroll: boolean;
  showTokenCount: boolean;
  enableSyntaxHighlighting: boolean;

  // Context settings
  includeRecentTrades: boolean;
  includeTagAnalysis: boolean;
  includeEconomicEvents: boolean;
  maxContextTrades: number; // Limit for performance
  includeDetailedTrades: boolean; // Include full trade details

  // Note: Vector search removed - now using keyword-based filtering without limits

  // Session settings
  maxSessionHistory: number;
  autoSaveSessions: boolean;
  sessionRetentionDays: number;
}

export interface AIProviderConfig {
  provider: AIProvider;
  name: string;
  description: string;
  models: {
    id: string;
    name: string;
    description: string;
    maxTokens: number;
    costPer1kTokens?: number;
  }[];
  apiKeyFormat: RegExp;
  testEndpoint: string;
  baseUrl: string;
  headers: Record<string, string>;
  supportsStreaming: boolean;
  supportsImages: boolean;
  supportsFunctions: boolean;
}

export interface ChatError {
  type: 'api_key_invalid' | 'rate_limit' | 'network_error' | 'provider_error' | 'context_too_large';
  message: string;
  details?: string;
  retryable: boolean;
  retryAfter?: number; // seconds
}

 

// Default configurations for supported AI providers
export const AI_PROVIDERS: Record<AIProvider, AIProviderConfig> = {
  'firebase-ai': {
    provider: 'firebase-ai',
    name: 'Firebase AI Logic',
    description: 'Gemini models via Firebase AI Logic',
    models: [
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        description: 'Latest fast and efficient model for most tasks',
        maxTokens: 1048576
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        description: 'Fast and efficient model for most tasks',
        maxTokens: 1048576
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        description: 'Most capable model for complex reasoning',
        maxTokens: 2097152
      }
    ],
    apiKeyFormat: /^.*$/, // Not used with Firebase AI Logic
    testEndpoint: '', // Not used with Firebase AI Logic
    baseUrl: '', // Not used with Firebase AI Logic
    headers: {},
    supportsStreaming: true,
    supportsImages: true,
    supportsFunctions: true
  }
};

// Default configuration
export const DEFAULT_AI_CHAT_CONFIG: AIChatConfig = {
  defaultProvider: 'firebase-ai',
  defaultModel: 'gemini-2.5-flash',
  autoScroll: true,
  showTokenCount: false,
  enableSyntaxHighlighting: true,
  includeRecentTrades: true,
  includeTagAnalysis: true,
  includeEconomicEvents: true,
  maxContextTrades: 100,
  includeDetailedTrades: true,
  maxSessionHistory: 50,
  autoSaveSessions: true,
  sessionRetentionDays: 30
};
