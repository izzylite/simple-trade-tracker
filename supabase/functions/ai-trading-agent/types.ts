/**
 * Type definitions for AI Trading Agent
 * Mirrors main application types for edge function use
 */

// Economic Calendar Types
export type ImpactLevel = 'Low' | 'Medium' | 'High' | 'Holiday' | 'Non-Economic';
export type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD' | 'CAD' | 'CHF' | 'NZD' | 'CNY' | 'ALL';

export interface EconomicEvent {
  id: string;
  currency: Currency;
  event_name: string;
  impact: ImpactLevel;
  actual_result_type: 'good' | 'bad' | 'neutral' | '';
  event_time: string;
  time_utc: string;
  actual_value: string;
  forecast_value: string;
  previous_value: string;
  event_date: string;
  country?: string;
  flag_code?: string;
  flag_url?: string;
  is_all_day?: boolean;
  description?: string;
  source_url?: string;
  unix_timestamp?: number;
}

// Note Types
export type ReminderType = 'none' | 'once' | 'weekly';
export type DayAbbreviation = 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat';

export interface Note {
  id: string;
  user_id: string;
  calendar_id: string;
  title: string;
  content: string; // HTML format for AI-created notes, Draft.js JSON for user-created notes
  cover_image: string | null;
  is_archived: boolean;
  is_pinned: boolean;
  by_assistant: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;

  // Reminder fields
  reminder_type?: ReminderType;
  reminder_date?: string | null; // ISO date string for one-time reminders
  reminder_days?: DayAbbreviation[]; // For weekly reminders
  is_reminder_active?: boolean;

  // Tags
  tags?: string[]; // Array of tags for categorization and filtering
}

// Trade Types
export interface TradeEconomicEvent {
  name: string;
  flag_code?: string;
  impact: ImpactLevel;
  currency: Currency;
  time_utc: string;
}

export interface TradeImageEntity {
  id: string;
  url: string;
  calendar_id: string;
  filename?: string;
  original_filename?: string;
  storage_path?: string;
  width?: number;
  height?: number;
  file_size?: number;
  mime_type?: string;
  caption?: string;
  row?: number;
  column?: number;
  column_width?: number;
  pending?: boolean;
}

export interface Trade {
  id: string;
  calendar_id: string;
  user_id: string;

  // Core trade data
  name?: string;
  amount: number;
  trade_type: 'win' | 'loss' | 'breakeven';
  trade_date: Date | string;

  // Trade details
  entry_price?: number;
  exit_price?: number;
  stop_loss?: number;
  take_profit?: number;
  risk_to_reward?: number;
  partials_taken?: boolean;
  session?: string;
  notes?: string;

  // Categorization
  tags?: string[];

  // Status flags
  is_temporary?: boolean;
  is_pinned?: boolean;

  // Images
  images?: TradeImageEntity[];

  // Economic events
  economic_events?: TradeEconomicEvent[];

  // Sharing
  share_link?: string;
  is_shared?: boolean;
  shared_at?: Date | string | null;
  share_id?: string;

  // Timestamps
  created_at: Date | string;
  updated_at: Date | string;
}

// Calendar Types
export interface PinnedEvent {
  event: string;
  notes?: string;
}

export interface EconomicCalendarFilterSettings {
  currencies?: string[];
  impacts?: string[];
  onlyUpcomingEvents?: boolean;
}

export interface Calendar {
  id: string;
  user_id: string;
  name: string;

  // Account settings
  account_balance: number;
  max_daily_drawdown: number;
  weekly_target?: number;
  monthly_target?: number;
  yearly_target?: number;
  risk_per_trade?: number;

  // Dynamic risk settings
  dynamic_risk_enabled?: boolean;
  increased_risk_percentage?: number;
  profit_threshold_percentage?: number;

  // Tag validation
  required_tag_groups?: string[];
  tags?: string[];

  // Notes and media
  note?: string;
  hero_image_url?: string;

  // Settings
  economic_calendar_filters?: EconomicCalendarFilterSettings;
  pinned_events?: PinnedEvent[];

  // Calculated statistics
  win_rate?: number;
  profit_factor?: number;
  max_drawdown?: number;
  target_progress?: number;
  pnl_performance?: number;
  total_trades?: number;
  win_count?: number;
  loss_count?: number;
  total_pnl?: number;
  drawdown_start_date?: Date | string | null;
  drawdown_end_date?: Date | string | null;
  drawdown_recovery_needed?: number;
  drawdown_duration?: number;
  avg_win?: number;
  avg_loss?: number;
  current_balance?: number;

  // Period statistics
  weekly_pnl?: number;
  monthly_pnl?: number;
  yearly_pnl?: number;
  weekly_pnl_percentage?: number;
  monthly_pnl_percentage?: number;
  yearly_pnl_percentage?: number;
  weekly_progress?: number;
  monthly_progress?: number;

  // Timestamps
  created_at: Date | string;
  updated_at: Date | string;
}

// Request/Response Types
export interface AgentRequest {
  message: string;
  userId: string;
  calendarId?: string;
  focusedTradeId?: string; // When analyzing a specific trade
  conversationHistory?: ConversationMessage[];
  calendarContext?: Partial<Calendar>;
  userApiKey?: string; // User's own Gemini API key (optional)
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface Citation {
  id: string;
  title: string;
  url: string;
  source?: string;
  toolName: string;
}

export interface ToolCall {
  name: string;
  args: Record<string, any>;
  result: any;
  urls?: string[]; // URLs extracted from tool results
}

export interface AgentResponse {
  success: boolean;
  message: string;
  messageHtml?: string; // HTML formatted message with citations
  citations?: Citation[]; // List of sources/citations
  trades?: Trade[];
  calendars?: Calendar[];
  economicEvents?: EconomicEvent[];
  notes?: Note[];
  // Embedded data for inline references (trade_id:xxx, event_id:xxx, note_id:xxx)
  embeddedTrades?: Record<string, Trade>;
  embeddedEvents?: Record<string, EconomicEvent>;
  embeddedNotes?: Record<string, Note>;
  metadata: {
    functionCalls: ToolCall[];
    tokenUsage?: number;
    model: string;
    timestamp: string;
  };
  error?: string;
}

// Tool Result Types
export interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface TradeStatistics {
  totalTrades: number;
  winCount: number;
  lossCount: number;
  breakevenCount: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  totalPnL: number;
  maxDrawdown: number;

  // Session breakdown
  sessionStats?: {
    [session: string]: {
      trades: number;
      winRate: number;
      pnl: number;
    };
  };

  // Tag breakdown
  tagStats?: {
    [tag: string]: {
      trades: number;
      winRate: number;
      pnl: number;
    };
  };
}

export interface WebSearchResult {
  organic?: Array<{
    title: string;
    link: string;
    snippet: string;
    date?: string;
  }>;
  news?: Array<{
    title: string;
    link: string;
    snippet: string;
    date: string;
    source: string;
  }>;
  searchParameters?: {
    q: string;
    gl: string;
    hl: string;
  };
}
