/**
 * Shared types for Edge Functions
 * Database models and API interfaces
 * All types match the Supabase PostgreSQL schema
 */

// Database Models (matching PostgreSQL schema)

/**
 * Monthly statistics for a specific month
 * Pre-calculated and stored in calendar.year_stats
 */
export interface MonthlyStats {
  month_index: number // 0-11 (0 = January, 11 = December)
  month_pnl: number
  trade_count: number
  win_count: number
  loss_count: number
  growth_percentage: number
  account_value_at_start: number
}

/**
 * Yearly statistics including monthly breakdown
 * Pre-calculated and stored in calendar.year_stats
 */
export interface YearStats {
  year: number
  yearly_pnl: number
  yearly_growth_percentage: number
  total_trades: number
  win_count: number
  loss_count: number
  win_rate: number
  best_month_index: number // 0-11 (0 = January, 11 = December)
  best_month_pnl: number
  monthly_stats: MonthlyStats[] // Array of 12 months (indices 0-11)
}

export interface User {
  id: string
  email: string
  display_name?: string
  photo_url?: string
  provider?: string
  created_at: string
  updated_at: string
  last_login?: string
  is_active?: boolean
}

export interface Calendar {
  id: string
  user_id: string
  name: string
  created_at: string
  updated_at: string
  account_balance: number
  max_daily_drawdown: number
  weekly_target?: number
  monthly_target?: number
  yearly_target?: number
  risk_per_trade?: number
  dynamic_risk_enabled?: boolean
  increased_risk_percentage?: number
  profit_threshold_percentage?: number
  duplicated_calendar?: boolean
  source_calendar_id?: string
  linked_to_calendar_id?: string // Target calendar for one-way trade sync
  deleted_at?: string
  deleted_by?: string
  auto_delete_at?: string
  required_tag_groups?: string[]
  tags?: string[]
  note?: string
  hero_image_url?: string
  hero_image_attribution?: Record<string, unknown>
  score_settings?: Record<string, unknown>
  economic_calendar_filters?: Record<string, unknown>
  pinned_events?: Record<string, unknown>[]
  year_stats?: Record<string, YearStats>
  win_rate: number
  profit_factor: number
  max_drawdown: number
  target_progress: number
  pnl_performance: number
  total_trades: number
  win_count: number
  loss_count: number
  total_pnl: number
  drawdown_start_date?: string
  drawdown_end_date?: string
  drawdown_recovery_needed: number
  drawdown_duration: number
  avg_win: number
  avg_loss: number
  current_balance: number
  weekly_pnl: number
  monthly_pnl: number
  yearly_pnl: number
  weekly_pnl_percentage: number
  monthly_pnl_percentage: number
  yearly_pnl_percentage: number
  weekly_progress: number
  monthly_progress: number
  share_link?: string
  is_shared?: boolean
  shared_at?: string
  share_id?: string
  mark_for_deletion?: boolean
  deletion_date?: string
}

export interface Trade {
  id: string
  calendar_id: string
  user_id: string
  name?: string
  amount: number
  trade_type: 'win' | 'loss' | 'breakeven'
  trade_date: string
  created_at: string
  updated_at: string
  entry_price?: number
  exit_price?: number
  risk_to_reward?: number
  partials_taken?: boolean
  session?: 'Asia' | 'London' | 'NY AM' | 'NY PM'
  notes?: string
  tags?: string[]
  is_temporary?: boolean
  is_pinned?: boolean
  source_trade_id?: string // Reference to original trade if this is a synced copy
  is_synced_copy?: boolean // True if auto-created by calendar linking
  share_link?: string
  is_shared?: boolean
  shared_at?: string
  share_id?: string
  images?: Record<string, unknown>
  stop_loss?: number
  take_profit?: number
  economic_events?: Record<string, unknown>[]
}

export interface EconomicEvent {
  id: string
  external_id: string
  currency: string
  event_name: string
  impact: 'Low' | 'Medium' | 'High' | 'Holiday' | 'Non-Economic'
  event_date: string
  event_time: string
  time_utc: string
  unix_timestamp?: number
  actual_value?: string
  forecast_value?: string
  previous_value?: string
  actual_result_type?: 'good' | 'bad' | 'neutral' | ''
  country?: string
  flag_code?: string
  flag_url?: string
  is_all_day?: boolean
  description?: string
  source_url?: string
  data_source?: string
  last_updated: string
  created_at: string
}

export interface SharedTrade {
  id: string
  share_id: string
  trade_id: string
  calendar_id: string
  share_link: string
  is_active?: boolean
  view_count?: number
  created_at: string
  expires_at?: string
  last_viewed_at?: string
  viewer_ips?: Record<string, unknown>
  user_id: string
}

export interface SharedCalendar {
  id: string
  share_id: string
  calendar_id: string
  share_link: string
  is_active?: boolean
  view_count?: number
  created_at: string
  expires_at?: string
  last_viewed_at?: string
  viewer_ips?: Record<string, unknown>
  user_id: string
}

// API Request/Response Types
export interface UpdateTagRequest {
  calendar_id: string
  old_tag: string
  new_tag: string
}

export interface UpdateTagResponse {
  success: boolean
  updated_trades: number
  message: string
}

export interface GenerateShareLinkRequest {
  trade_id?: string
  calendar_id?: string
}

export interface GenerateShareLinkResponse {
  success: boolean
  share_link: string
  share_id: string
  direct_link: string
}

export interface ProcessEconomicEventsRequest {
  target_date?: string
  currencies?: string[]
  events?: string[]
}

export interface ProcessEconomicEventsResponse {
  success: boolean
  events_processed: number
  events_stored: number
  message: string
  // Enhanced stats for verification/logging
  parsed_total?: number
  existing_count?: number
  inserted_count?: number
  upserted_count?: number
  events?: EconomicEvent[]
}

// Database Trigger Event Types
export interface DatabaseTriggerEvent {
  table: string
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
  old_record?: Record<string, unknown>
  new_record?: Record<string, unknown>
  timestamp: string
}

export interface TradeChangeEvent {
  table: 'trades'
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
  old_record?: Trade
  new_record?: Trade
  timestamp: string
}

export interface CalendarChangeEvent {
  table: 'calendars'
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
  old_record?: Calendar
  new_record?: Calendar
  timestamp: string
}

// Webhook Payload Types
export interface TradeWebhookPayload {
  table: string
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
  old_record?: Trade
  new_record?: Trade
  calendar_id: string
  user_id: string
}

export interface CalendarWebhookPayload {
  table: string
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
  old_record?: Calendar
  new_record?: Calendar
  calendar_id: string
  user_id: string
}

// Utility Types
export interface PaginationParams {
  page?: number
  limit?: number
  offset?: number
}

export interface DateRange {
  start: number // Unix timestamp
  end: number   // Unix timestamp
}

export interface TagUpdateResult {
  updated: boolean
  updated_count: number
}

// Error Types
export interface EdgeFunctionError {
  code: string
  message: string
  details?: Record<string, unknown>
}

// Background Task Types
export interface BackgroundTaskContext {
  waitUntil: (promise: Promise<unknown>) => void
}
