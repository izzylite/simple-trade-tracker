/**
 * Primary Data Models
 * Clean, database-agnostic TypeScript interfaces
 * Used by the repository layer and modern components
 */

import { TradeImage } from '../components/trades/TradeForm';
import { ScoreSettings } from './score';
import { ImageAttribution } from '../components/heroImage';
import { EconomicCalendarFilterSettings } from '../components/economicCalendar/EconomicCalendarDrawer';
import { ImpactLevel, Currency } from './economicCalendar';

// =====================================================
// CORE INTERFACES
// =====================================================

/**
 * Base interface for all entities
 */
export interface BaseEntity {
  id: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * User entity - Supabase schema
 * Matches exact Supabase database schema with snake_case fields
 */
export interface User extends BaseEntity {
  // Core identity
  email: string;
  display_name?: string;
  photo_url?: string;
  provider: string;

  // Status
  is_active: boolean;
  last_login?: Date;
}

/**
 * Simplified economic event for trade correlation
 * Matches exact Supabase database schema with snake_case fields
 */
export interface TradeEconomicEvent {
  name: string;
  flag_code?: string;
  impact: ImpactLevel;
  currency: Currency;
  time_utc: string;
}

/**
 * Trade entity - canonical database schema
 * Matches exact Supabase database schema with snake_case fields
 * Used everywhere: frontend, backend, Edge Functions
 */
export interface Trade {
  id: string
  calendar_id: string
  user_id: string

  // Core trade data
  name?: string
  amount: number
  trade_type: 'win' | 'loss' | 'breakeven'
  trade_date: Date

  // Trade details
  entry_price?: number
  exit_price?: number
  stop_loss?: number
  take_profit?: number
  risk_to_reward?: number
  partials_taken?: boolean
  session?: string
  notes?: string

  // Categorization
  tags?: string[]

  // Status flags
  is_temporary?: boolean
  is_pinned?: boolean

  // Images (stored as JSONB array)
  images?: TradeImageEntity[]

  // Economic events
  economic_events?: TradeEconomicEvent[]

  // Sharing
  share_link?: string
  is_shared?: boolean
  shared_at?: Date | null
  share_id?: string

  // Timestamps (inherited from BaseEntity)
  created_at: Date
  updated_at: Date
}

/**
 * Pinned economic event
 */
export interface PinnedEvent {
  event: string; // Event name for backward compatibility
  event_id: string; // Database ID of the economic event
  notes?: string;
  impact?: ImpactLevel;
  currency?: Currency;
  flag_url?: string;
  country?: string;
}

/**
 * Calendar entity - canonical database schema
 * Matches exact Supabase database schema with snake_case fields
 */
export interface Calendar extends BaseEntity {
  // Core calendar data
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

  // Duplication tracking
  duplicated_calendar?: boolean;
  source_calendar_id?: string;

  // Soft delete / trash (for trash feature)
  deleted_at?: Date;
  deleted_by?: string;
  auto_delete_at?: Date;

  // Tag validation and management
  required_tag_groups?: string[];
  tags?: string[];

  // Media
  hero_image_url?: string;
  hero_image_attribution?: ImageAttribution;

  // Settings
  score_settings?: ScoreSettings;
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
  drawdown_start_date?: Date | null;
  drawdown_end_date?: Date | null;
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

  // Sharing
  share_link?: string | null;
  is_shared?: boolean;
  shared_at?: Date;
  share_id?: string | null;
}

/**
 * Trade image entity - stored as JSONB array in trades table
 * Simplified to match actual usage patterns
 */
export interface TradeImageEntity {
  id: string;
  url: string;
  calendar_id: string;

  // Optional metadata
  filename?: string;
  original_filename?: string;
  storage_path?: string;

  // Image properties
  width?: number;
  height?: number;
  file_size?: number;
  mime_type?: string;
  caption?: string;

  // Layout properties
  row?: number;
  column?: number;
  column_width?: number;

  // UI state
  pending?: boolean;
}

 