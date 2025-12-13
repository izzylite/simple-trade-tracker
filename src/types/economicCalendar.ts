/**
 * Economic Calendar Types and Interfaces
 * Based on MyFXBook data structure
 */

import { Calendar } from "./calendar";
import { TradeOperationsProps } from "./tradeOperations";

export type ImpactLevel = 'Low' | 'Medium' | 'High' | 'Holiday' | 'Non-Economic';

export type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD' | 'CAD' | 'CHF' | 'NZD' | 'CNY' | 'ALL';

export interface EconomicEvent {
  id: string;
  external_id?: string; // Original event ID from data source (MyFXBook, etc.)
  currency: Currency;
  event_name: string;
  impact: ImpactLevel;
  actual_result_type: 'good' | 'bad' | 'neutral' | '';
  event_time: string; // ISO string
  time_utc: string; // UTC timestamp
  actual_value: string;
  forecast_value: string;
  previous_value: string;
  event_date: string; // YYYY-MM-DD format
  country?: string;
  flag_code?: string;
  flag_url?: string;
  is_all_day?: boolean;
  description?: string;
  source_url?: string;
  unix_timestamp?: number; // Unix timestamp in milliseconds from MyFXBook's time attribute
}

export interface EconomicCalendarDay {
  date: string; // YYYY-MM-DD format
  events: EconomicEvent[];
}

export interface EconomicCalendarData {
  days: EconomicCalendarDay[];
  lastUpdated: number; // Unix timestamp
  source: 'myfxbook' | 'tradingeconomics' | 'investing';
}

export interface EconomicCalendarFilters {
  currencies: Currency[];
  impacts: ImpactLevel[];
  dateRange: {
    start: string; // YYYY-MM-DD
    end: string; // YYYY-MM-DD
  };
  searchTerm?: string;
  showPastEvents?: boolean;
}

export interface EconomicCalendarSettings {
  autoRefresh: boolean;
  refreshInterval: number; // minutes
  notifications: {
    enabled: boolean;
    highImpactOnly: boolean;
    minutesBefore: number;
  };
  timezone: string;
  defaultCurrencies: Currency[];
}

// API Response types
export interface MyFXBookResponse {
  eco_elements: Array<{
    currency: string;
    event: string;
    impact: string;
    time_utc: string;
    actual: string;
    forecast: string;
    previous: string;
  }>;
}

export interface EconomicCalendarError {
  code: string;
  message: string;
  timestamp: number;
}

// UI Component Props
export interface EconomicEventCardProps {
  event: EconomicEvent;
  showDate?: boolean;
  compact?: boolean;
  onClick?: (event: EconomicEvent) => void;
}

export interface EconomicCalendarProps {
  filters?: Partial<EconomicCalendarFilters>;
  onEventClick?: (event: EconomicEvent) => void;
  onFiltersChange?: (filters: EconomicCalendarFilters) => void;
  onRefresh?: () => Promise<void>;
  compact?: boolean;
  maxHeight?: number;
}

export interface EconomicCalendarDrawerProps {
  open: boolean;
  onClose: () => void;
  calendar: Calendar;
  trades?: any[];
  payload?: { updatedEvents: EconomicEvent[], allEvents: EconomicEvent[] } | null;
  tradeOperations: TradeOperationsProps;
  isReadOnly?: boolean;
}

// Service types
export interface EconomicCalendarService {
  fetchEvents(
    dateRange: { start: string; end: string },
    filters?: { currencies?: Currency[]; impacts?: ImpactLevel[] }
  ): Promise<EconomicEvent[]>;
  getUpcomingEvents(hours?: number): Promise<EconomicEvent[]>;
  getEventsByImpact(impact: ImpactLevel[]): Promise<EconomicEvent[]>;
  searchEvents(query: string): Promise<EconomicEvent[]>;
  subscribeToUpdates(callback: (events: EconomicEvent[]) => void): () => void;
}

// Constants
export const IMPACT_COLORS: Record<ImpactLevel, string> = {
  'Low': '#4caf50',      // Green
  'Medium': '#ff9800',   // Orange  
  'High': '#f44336',     // Red
  'Holiday': '#9c27b0',  // Purple
  'Non-Economic': '#757575' // Grey
};

export const CURRENCY_FLAGS: Record<Currency, string> = {
  'USD': '🇺🇸',
  'EUR': '🇪🇺', 
  'GBP': '🇬🇧',
  'JPY': '🇯🇵',
  'AUD': '🇦🇺',
  'CAD': '🇨🇦',
  'CHF': '🇨🇭',
  'NZD': '🇳🇿',
  'CNY': '🇨🇳',
  'ALL': '🌍'
};

export const DEFAULT_FILTERS: EconomicCalendarFilters = {
  currencies: ['USD', 'EUR', 'GBP', 'JPY'],
  impacts: ['High', 'Medium'],
  dateRange: {
    start: new Date().toISOString().split('T')[0],
    end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  },
  searchTerm: '',
  showPastEvents: false
};

export const DEFAULT_SETTINGS: EconomicCalendarSettings = {
  autoRefresh: true,
  refreshInterval: 30,
  notifications: {
    enabled: false,
    highImpactOnly: true,
    minutesBefore: 15
  },
  timezone: 'America/New_York',
  defaultCurrencies: ['USD', 'EUR', 'GBP', 'JPY']
};
