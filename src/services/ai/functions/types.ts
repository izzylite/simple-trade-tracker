/**
 * Shared types and interfaces for AI trading analysis functions
 */

export interface TradingAnalysisResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface SearchTradesParams {
  returnCacheKey?: boolean;
  fields?: string[];
  dateRange?: string;
  tradeType?: 'win' | 'loss' | 'breakeven' | 'all';
  minAmount?: number;
  maxAmount?: number;
  tags?: string[];
  session?: 'Asia' | 'London' | 'NY AM' | 'NY PM' | 'london' | 'new-york' | 'tokyo' | 'sydney';
  dayOfWeek?: string;
  limit?: number;
  // Economic events filtering
  hasEconomicEvents?: boolean;
  economicEventImpact?: 'High' | 'Medium' | 'Low' | 'all';
  economicEventCurrency?: 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD' | 'CAD' | 'CHF' | 'NZD' | 'all';
  economicEventName?: string;
}

export interface GetStatisticsParams {
  returnCacheKey?: boolean;
  period?: string;
  groupBy?: 'day' | 'week' | 'month' | 'session' | 'tag' | 'dayOfWeek' | 'economicEvent';
  tradeType?: 'win' | 'loss' | 'breakeven' | 'all';
  tradeIds?: string[]; // Filter statistics to specific trade IDs
  // Economic events analysis
  includeEconomicEventStats?: boolean;
  economicEventImpact?: 'High' | 'Medium' | 'Low' | 'all';
}

export interface FindSimilarTradesParams {
  returnCacheKey?: boolean;
  fields?: string[];
  query: string;
  limit?: number;
}

export interface QueryDatabaseParams {
  returnCacheKey?: boolean;
  fields?: string[];
  query: string;
  description?: string;
}

export interface AnalyzeEconomicEventsParams {
  returnCacheKey?: boolean;
  impactLevel?: 'High' | 'Medium' | 'Low' | 'all';
  currency?: 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD' | 'CAD' | 'CHF' | 'NZD' | 'all';
  eventName?: string;
  dateRange?: string;
  compareWithoutEvents?: boolean;
}

export interface FetchEconomicEventsParams {
  returnCacheKey?: boolean;
  fields?: string[];
  startDate?: string; // Unix timestamp in milliseconds or date string
  endDate?: string; // Unix timestamp in milliseconds or date string
  currency?: 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD' | 'CAD' | 'CHF' | 'NZD' | 'all';
  impact?: 'High' | 'Medium' | 'all'; // Low impact events excluded for cost efficiency
  dateRange?: string; // "next 7 days", "this week", "next week", etc.
  limit?: number;
}

export interface ExtractTradeIdsParams {
  returnCacheKey?: boolean;
  trades: any[]; // Array of trade objects or trade data
}



export interface ConvertTradeIdsToDataParams {
  returnCacheKey?: boolean;
  tradeIds: string[]; // Array of trade IDs to convert to full trade data
  includeImages?: boolean; // Whether to include image data (default: false for performance)
  fields?: string[]; // Specific fields to include in the response
}
