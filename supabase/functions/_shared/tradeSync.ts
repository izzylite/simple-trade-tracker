/**
 * Trade Sync Utilities
 * Shared utilities for syncing trades between linked calendars
 */

import type { Trade } from './types.ts';

/**
 * Calendar settings needed for amount calculation
 */
export interface CalendarRiskSettings {
  account_balance: number;
  risk_per_trade?: number;
  // Dynamic risk settings
  dynamic_risk_enabled?: boolean;
  increased_risk_percentage?: number;
  profit_threshold_percentage?: number;
  // Cumulative P&L for dynamic risk calculation (from year_stats or calculated)
  cumulative_pnl?: number;
}

/**
 * Raw calendar data from database query
 */
export interface CalendarRiskData {
  account_balance: number;
  risk_per_trade?: number | null;
  dynamic_risk_enabled?: boolean | null;
  increased_risk_percentage?: number | null;
  profit_threshold_percentage?: number | null;
}

/**
 * Build CalendarRiskSettings from raw calendar data
 * Converts nullable database fields to optional interface fields
 *
 * @param calendar - Raw calendar data from database
 * @param cumulativePnL - Pre-calculated cumulative P&L for the target calendar
 * @returns CalendarRiskSettings ready for amount calculation
 */
export function buildCalendarRiskSettings(
  calendar: CalendarRiskData,
  cumulativePnL: number = 0
): CalendarRiskSettings {
  return {
    account_balance: calendar.account_balance,
    risk_per_trade: calendar.risk_per_trade ?? undefined,
    dynamic_risk_enabled: calendar.dynamic_risk_enabled ?? undefined,
    increased_risk_percentage: calendar.increased_risk_percentage ?? undefined,
    profit_threshold_percentage: calendar.profit_threshold_percentage ?? undefined,
    cumulative_pnl: cumulativePnL,
  };
}

/**
 * Calculate effective risk percentage based on dynamic risk settings
 * If profit threshold is met, use increased risk percentage
 *
 * @param settings - Calendar risk settings including dynamic risk config
 * @returns Effective risk percentage to use
 */
export function calculateEffectiveRiskPercentage(settings: CalendarRiskSettings): number {
  if (!settings.risk_per_trade) return 0;

  // If dynamic risk is not enabled or missing settings, return base risk
  if (!settings.dynamic_risk_enabled ||
      !settings.increased_risk_percentage ||
      !settings.profit_threshold_percentage ||
      settings.account_balance <= 0) {
    return settings.risk_per_trade;
  }

  // Calculate profit percentage
  const cumulativePnL = settings.cumulative_pnl ?? 0;
  const profitPercentage = (cumulativePnL / settings.account_balance) * 100;

  // Check if profit threshold is met
  if (profitPercentage >= settings.profit_threshold_percentage) {
    return settings.increased_risk_percentage;
  }

  return settings.risk_per_trade;
}

/**
 * Calculate the risk amount based on account balance and risk percentage
 * Formula: (accountBalance + cumulativePnL) * (riskPercentage / 100)
 *
 * @param accountBalance - Calendar's base account balance
 * @param riskPercentage - Risk per trade percentage
 * @param cumulativePnL - Cumulative P&L (defaults to 0 for synced trades)
 */
export function calculateRiskAmount(
  accountBalance: number,
  riskPercentage: number,
  cumulativePnL: number = 0
): number {
  const totalAccountValue = accountBalance + cumulativePnL;
  return (totalAccountValue * riskPercentage) / 100;
}

/**
 * Calculate the synced trade amount for a target calendar
 *
 * Uses the same formula as TradeFormDialog:
 * - WIN: riskAmount * risk_to_reward
 * - LOSS: -riskAmount
 * - BREAKEVEN: 0
 *
 * @param sourceTrade - The original trade from source calendar
 * @param targetSettings - Target calendar's risk settings
 * @returns The calculated amount for the target calendar
 */
export function calculateSyncedAmount(
  sourceTrade: Trade,
  targetSettings: CalendarRiskSettings
): number {
  // If target calendar doesn't have risk_per_trade set, copy raw amount
  if (!targetSettings.risk_per_trade || targetSettings.risk_per_trade <= 0) {
    return sourceTrade.amount;
  }

  // If source trade doesn't have R:R, copy raw amount
  if (!sourceTrade.risk_to_reward || sourceTrade.risk_to_reward <= 0) {
    return sourceTrade.amount;
  }

  // If partials were taken, copy raw amount (can't recalculate partial profits)
  if (sourceTrade.partials_taken) {
    return sourceTrade.amount;
  }

  // Breakeven trades have 0 amount
  if (sourceTrade.trade_type === 'breakeven') {
    return 0;
  }

  // Calculate effective risk percentage (considers dynamic risk if enabled)
  const effectiveRiskPercentage = calculateEffectiveRiskPercentage(targetSettings);
  const cumulativePnL = targetSettings.cumulative_pnl ?? 0;

  // Calculate risk amount for target calendar
  const riskAmount = calculateRiskAmount(
    targetSettings.account_balance,
    effectiveRiskPercentage,
    cumulativePnL
  );

  // Calculate amount based on trade type and R:R
  if (sourceTrade.trade_type === 'win') {
    return Math.round(riskAmount * sourceTrade.risk_to_reward);
  } else {
    // Loss
    return -Math.round(riskAmount);
  }
}

/**
 * Prepare a trade for syncing to target calendar
 * Strips source-specific fields and sets sync tracking fields
 *
 * @param sourceTrade - The original trade
 * @param targetCalendarId - Target calendar ID
 * @param targetSettings - Optional: target calendar settings for amount recalculation
 * @returns Trade data ready for insertion into target calendar
 */
export function prepareSyncedTrade(
  sourceTrade: Trade,
  targetCalendarId: string,
  targetSettings?: CalendarRiskSettings
): Omit<Trade, 'id' | 'created_at' | 'updated_at'> {
  // Calculate amount - recalculate if target settings provided, otherwise copy raw
  const syncedAmount = targetSettings
    ? calculateSyncedAmount(sourceTrade, targetSettings)
    : sourceTrade.amount;

  // Strip source-specific fields
  const {
    id,
    created_at,
    updated_at,
    calendar_id,
    source_trade_id,
    is_synced_copy,
    // Don't copy sharing status - target trade is independent
    share_link,
    is_shared,
    shared_at,
    share_id,
    ...tradeData
  } = sourceTrade;

  return {
    ...tradeData,
    amount: syncedAmount,
    calendar_id: targetCalendarId,
    source_trade_id: sourceTrade.id,
    is_synced_copy: true,
    // Reset sharing fields for synced copy
    share_link: undefined,
    is_shared: false,
    shared_at: undefined,
    share_id: undefined,
  };
}

/**
 * Check if a trade is within the sync window (24 hours from creation)
 * After this window, the target trade becomes independent
 *
 * @param trade - The trade to check
 * @returns true if within sync window, false otherwise
 */
export function isWithinSyncWindow(trade: Trade): boolean {
  const createdAt = new Date(trade.created_at);
  const now = new Date();
  const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
  return hoursSinceCreation <= 24;
}

/**
 * Get hours remaining in sync window
 * Useful for UI display
 *
 * @param trade - The trade to check
 * @returns Hours remaining (0 if expired)
 */
export function getSyncWindowHoursRemaining(trade: Trade): number {
  const createdAt = new Date(trade.created_at);
  const now = new Date();
  const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
  return Math.max(0, 24 - hoursSinceCreation);
}
