/**
 * AI Chat Types and Interfaces
 * Defines all TypeScript interfaces for the AI chat feature
 */

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'custom';

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

export interface APIKeySettings {
  provider: AIProvider;
  apiKey: string;
  model?: string;
  baseUrl?: string; // For custom providers
  isValid?: boolean;
  lastValidated?: Date;
  // Provider-specific settings
  settings?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  provider: AIProvider;
  model?: string;
  // Trading context when session was created
  tradingContext: TradingDataContext;
  // Session metadata
  metadata: {
    totalMessages: number;
    totalTokens?: number;
    calendarId: string;
    dateRange: {
      start: Date;
      end: Date;
    };
  };
}

export interface TradingDataContext {
  // Basic statistics
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  totalPnL: number;
  avgWin: number;
  avgLoss: number;
  maxDrawdown: number;

  // Time-based analysis
  dateRange: {
    start: Date;
    end: Date;
  };
  tradingDays: number;
  avgTradesPerDay: number;

  // Performance by session
  sessionStats: {
    session: string;
    trades: number;
    winRate: number;
    pnl: number;
  }[];

  // Tag analysis
  topTags: {
    tag: string;
    count: number;
    winRate: number;
    avgPnL: number;
  }[];

  // Recent performance
  recentTrends: {
    period: string;
    winRate: number;
    pnl: number;
    tradeCount: number;
  }[];

  // Risk metrics
  riskMetrics: {
    avgRiskReward: number;
    maxConsecutiveLosses: number;
    maxConsecutiveWins: number;
    largestWin: number;
    largestLoss: number;
  };

  // Economic events correlation
  economicEventsImpact?: {
    highImpactTrades: number;
    highImpactWinRate: number;
    commonEvents: string[];
  };

  // Detailed trade information
  trades: {
    id: string;
    name: string;
    date: string;
    session: string;
    type: 'win' | 'loss' | 'breakeven';
    amount: number;
    riskToReward?: number;
    tags?: string[];
    notes?: string;
    economicEvents?: {
      event: string;
      impact: string;
      currency: string;
      time: string;
    }[];
    images?: string[];
    createdAt: string;
    updatedAt: string;
  }[];
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

export interface ChatState {
  isOpen: boolean;
  isLoading: boolean;
  isTyping: boolean;
  currentSession: ChatSession | null;
  sessions: ChatSession[];
  apiKeys: Record<AIProvider, APIKeySettings>;
  config: AIChatConfig;
  error: ChatError | null;
}

// Default configurations for supported AI providers
export const AI_PROVIDERS: Record<AIProvider, AIProviderConfig> = {
  openai: {
    provider: 'openai',
    name: 'OpenAI',
    description: 'GPT models from OpenAI',
    models: [
      {
        id: 'gpt-4-turbo-preview',
        name: 'GPT-4 Turbo',
        description: 'Most capable model, best for complex analysis',
        maxTokens: 128000,
        costPer1kTokens: 0.01
      },
      {
        id: 'gpt-4',
        name: 'GPT-4',
        description: 'High-quality responses, good for detailed analysis',
        maxTokens: 8192,
        costPer1kTokens: 0.03
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        description: 'Fast and cost-effective for basic queries',
        maxTokens: 16384,
        costPer1kTokens: 0.001
      }
    ],
    apiKeyFormat: /^sk-[a-zA-Z0-9]{48}$/,
    testEndpoint: '/v1/models',
    baseUrl: 'https://api.openai.com',
    headers: {
      'Content-Type': 'application/json'
    },
    supportsStreaming: true,
    supportsImages: true,
    supportsFunctions: true
  },
  anthropic: {
    provider: 'anthropic',
    name: 'Anthropic',
    description: 'Claude models from Anthropic',
    models: [
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        description: 'Most powerful model for complex reasoning',
        maxTokens: 200000,
        costPer1kTokens: 0.015
      },
      {
        id: 'claude-3-sonnet-20240229',
        name: 'Claude 3 Sonnet',
        description: 'Balanced performance and speed',
        maxTokens: 200000,
        costPer1kTokens: 0.003
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        description: 'Fast and cost-effective',
        maxTokens: 200000,
        costPer1kTokens: 0.00025
      }
    ],
    apiKeyFormat: /^sk-ant-[a-zA-Z0-9\-_]{95}$/,
    testEndpoint: '/v1/messages',
    baseUrl: 'https://api.anthropic.com',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    supportsStreaming: true,
    supportsImages: true,
    supportsFunctions: false
  },
  google: {
    provider: 'google',
    name: 'Google',
    description: 'Gemini models from Google',
    models: [
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        description: 'Fast and efficient model for most tasks',
        maxTokens: 1048576,
        costPer1kTokens: 0.00015
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        description: 'Most capable model for complex reasoning',
        maxTokens: 2097152,
        costPer1kTokens: 0.0035
      },
      {
        id: 'gemini-pro',
        name: 'Gemini Pro (Legacy)',
        description: 'Previous generation model',
        maxTokens: 32768,
        costPer1kTokens: 0.0005
      }
    ],
    apiKeyFormat: /^[a-zA-Z0-9\-_]{39}$/,
    testEndpoint: '/v1/models',
    baseUrl: 'https://generativelanguage.googleapis.com',
    headers: {
      'Content-Type': 'application/json'
    },
    supportsStreaming: true,
    supportsImages: true,
    supportsFunctions: true
  },
  custom: {
    provider: 'custom',
    name: 'Custom Provider',
    description: 'Custom API endpoint',
    models: [
      {
        id: 'custom-model',
        name: 'Custom Model',
        description: 'Custom model configuration',
        maxTokens: 4096
      }
    ],
    apiKeyFormat: /^.+$/,
    testEndpoint: '/health',
    baseUrl: '',
    headers: {
      'Content-Type': 'application/json'
    },
    supportsStreaming: false,
    supportsImages: false,
    supportsFunctions: false
  }
};

// Default configuration
export const DEFAULT_AI_CHAT_CONFIG: AIChatConfig = {
  defaultProvider: 'google',
  defaultModel: 'gemini-1.5-flash',
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
