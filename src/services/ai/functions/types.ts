/**
 * Shared types and interfaces for AI trading analysis functions
 */

export interface TradingAnalysisResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface DateRange {
  start: number; // Unix timestamp in milliseconds
  end: number;   // Unix timestamp in milliseconds
}

export interface SearchTradesParams {
  returnCacheKey?: boolean;
  fields?: string[];
  dateRange?: DateRange;
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
  economicNames?: string[]; // Filter trades that contain any of these economic event names (exact match)
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
  dateRange?: DateRange;
  compareWithoutEvents?: boolean;
}

export interface FetchEconomicEventsParams {
  returnCacheKey?: boolean;
  fields?: string[];
  dateRange?: DateRange;
  currency?: 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD' | 'CAD' | 'CHF' | 'NZD' | 'all';
  impact?: 'High' | 'Medium' | 'all'; // Low impact events excluded for cost efficiency
  limit?: number;
}

export interface GetUserCalendarParams {
  returnCacheKey?: boolean;
  fields?: string[];
  includeStatistics?: boolean; // Include detailed performance statistics
  includeTargets?: boolean; // Include target-related information
  includeRiskManagement?: boolean; // Include risk management settings
  includeConfiguration?: boolean; // Include configuration settings
  includeNotes?: boolean; // Include notes and text content
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
