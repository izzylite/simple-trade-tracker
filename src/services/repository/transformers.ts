/**
 * Data Transformation Utilities
 *
 * NOTE: After interface consolidation, transformations are no longer needed.
 * The frontend now uses the database schema directly with snake_case fields.
 * This file is kept for backward compatibility but functions are deprecated.
 */

import {
  Calendar,
  Trade
} from '../../types/dualWrite';

// =====================================================
// DEPRECATED TRANSFORMATION FUNCTIONS
// =====================================================

/**
 * @deprecated No longer needed - frontend uses database schema directly
 * Transform Calendar to Supabase format
 */
export function transformDualWriteCalendarToSupabase(calendar: Calendar): Record<string, any> {
  // Since interfaces now match database schema exactly, no transformation needed
  return calendar as any;
}

/**
 * @deprecated No longer needed - frontend uses database schema directly
 * Transform Supabase data to Calendar format
 */
export function transformSupabaseCalendarToDualWrite(row: any): Calendar {
  // Since interfaces now match database schema exactly, no transformation needed
  return row as Calendar;
}

/**
 * @deprecated No longer needed - frontend uses database schema directly
 * Transform Trade to Supabase format
 */
export function transformDualWriteTradeToSupabase(trade: Trade): Record<string, any> {
  // Since interfaces now match database schema exactly, no transformation needed
  return trade as any;
}

/**
 * @deprecated No longer needed - frontend uses database schema directly
 * Transform Supabase data to Trade format
 */
export function transformSupabaseTradeToDualWrite(row: any): Trade {
  // Since interfaces now match database schema exactly, no transformation needed
  return row as Trade;
}

// =====================================================
// DEPRECATED VALIDATION FUNCTIONS
// =====================================================

/**
 * @deprecated No longer needed - TypeScript provides compile-time validation
 * Validate Calendar data
 */
export function validateDualWriteCalendar(calendar: Calendar): boolean {
  // Basic validation - TypeScript handles most of this now
  return !!(calendar && calendar.id && calendar.user_id && calendar.name);
}

/**
 * @deprecated No longer needed - TypeScript provides compile-time validation
 * Validate Trade data
 */
export function validateDualWriteTrade(trade: Trade): boolean {
  // Basic validation - TypeScript handles most of this now
  return !!(trade && trade.id && trade.calendar_id && trade.user_id && typeof trade.amount === 'number');
}
