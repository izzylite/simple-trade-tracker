/**
 * Shared types for Edge Functions
 * Database models and API interfaces
 */

// Database Models (matching PostgreSQL schema)
export interface User {
  id: string
  firebase_uid?: string
  email: string
  display_name?: string
  photo_url?: string
  provider: string
  created_at: string
  updated_at: string
  last_login?: string
  is_active: boolean
}

export interface Calendar {
  id: string
  user_id: string
  name: string
  description?: string
  initial_balance: number
  target_balance?: number
  currency: string
  timezone: string
  created_at: string
  updated_at: string
  
  // Risk settings
  risk_per_trade?: number
  dynamic_risk_enabled: boolean
  increased_risk_percentage?: number
  profit_threshold_percentage?: number
  
  // Duplication tracking
  duplicated_calendar: boolean
  source_calendar_id?: string
  
  // Soft delete
  is_deleted: boolean
  deleted_at?: string
  deleted_by?: string
  auto_delete_at?: string
  
  // Tags and validation
  required_tag_groups: string[]
  tags: string[]
  
  // Media and notes
  note?: string
  hero_image_url?: string
  hero_image_attribution?: any
  days_notes?: any
  
  // Settings
  score_settings?: any
  economic_calendar_filters?: any
  pinned_events?: any[]
  
  // Calculated statistics
  win_rate: number
  profit_factor: number
  max_drawdown: number
  target_progress: number
  pnl_performance: number
  total_trades: number
  win_count: number
  loss_count: number
  total_pnl: number
  current_balance: number
}

export interface Trade {
  id: string
  calendar_id: string
  user_id: string
  
  // Trade details
  symbol: string
  direction: 'long' | 'short'
  entry_price: number
  exit_price?: number
  quantity: number
  
  // Dates
  date: string
  entry_time?: string
  exit_time?: string
  
  // Financial
  pnl?: number
  commission?: number
  swap?: number
  risk_amount?: number
  risk_percentage?: number
  
  // Metadata
  tags: string[]
  notes?: string
  images?: TradeImage[]
  
  // Status
  status: 'open' | 'closed' | 'cancelled'
  
  // Timestamps
  created_at: string
  updated_at: string
}

export interface TradeImage {
  id: string
  url: string
  filename: string
  size: number
  mime_type: string
  uploaded_at: string
}

export interface EconomicEvent {
  id: string
  currency: string
  event: string
  impact: 'high' | 'medium' | 'low'
  time_utc: string
  date: string
  actual?: string
  forecast?: string
  previous?: string
  country: string
  flag_code: string
  flag_url?: string
  last_updated: number
  source: string
  unix_timestamp?: number
}

export interface SharedTrade {
  id: string
  trade_id: string
  calendar_id: string
  user_id: string
  created_at: string
  is_active: boolean
  view_count: number
}

export interface SharedCalendar {
  id: string
  calendar_id: string
  user_id: string
  created_at: string
  is_active: boolean
  view_count: number
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
  old_record?: any
  new_record?: any
  timestamp: string
}

export interface TradeChangeEvent extends DatabaseTriggerEvent {
  table: 'trades'
  old_record?: Trade
  new_record?: Trade
}

export interface CalendarDeleteEvent extends DatabaseTriggerEvent {
  table: 'calendars'
  old_record: Calendar
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
  details?: any
}

// Background Task Types
export interface BackgroundTaskContext {
  waitUntil: (promise: Promise<any>) => void
}
