import { Trade } from '../types/dualWrite';
import { endOfDay } from 'date-fns';

/**
 * Dynamic risk settings interface
 */
export interface DynamicRiskSettings {
  account_balance: number;
  risk_per_trade?: number;
  dynamic_risk_enabled?: boolean;
  increased_risk_percentage?: number;
  profit_threshold_percentage?: number;
}

/**
 * Calculate cumulative P&L up to (but not including) a specific date
 * This ensures that when calculating risk for a trade on date X,
 * we only consider trades BEFORE date X (historical accuracy)
 */
export const calculateCumulativePnLToDate = (
  targetDate: Date,
  allTrades: Trade[]
): number => {
  // Use start of the target date to exclude all trades on that day
  const targetStart = new Date(targetDate);
  targetStart.setHours(0, 0, 0, 0);

  return allTrades
    .filter(trade => {
      const tradeDate = new Date(trade.trade_date);
      tradeDate.setHours(0, 0, 0, 0);
      return tradeDate < targetStart;
    })
    .sort((a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime())
    .reduce((cumulative, trade) => cumulative + trade.amount, 0);
};

/**
 * Calculate the effective risk percentage for a specific date/trade
 */
export const calculateEffectiveRiskPercentage = (
  targetDate: Date,
  allTrades: Trade[],
  dynamicRiskSettings: DynamicRiskSettings
): number => {
  if (!dynamicRiskSettings.risk_per_trade) return 0;

  // If dynamic risk is not enabled, return base risk percentage
  if (!dynamicRiskSettings.dynamic_risk_enabled ||
      !dynamicRiskSettings.increased_risk_percentage ||
      !dynamicRiskSettings.profit_threshold_percentage ||
      dynamicRiskSettings.account_balance <= 0) {
    return dynamicRiskSettings.risk_per_trade;
  }

  // Calculate cumulative P&L up to the target date
  const cumulativePnL = calculateCumulativePnLToDate(targetDate, allTrades);

  // Check if profit threshold is met
  const profitPercentage = (cumulativePnL / dynamicRiskSettings.account_balance) * 100;
  if (profitPercentage >= dynamicRiskSettings.profit_threshold_percentage) {
    return dynamicRiskSettings.increased_risk_percentage;
  }

  return dynamicRiskSettings.risk_per_trade;
};

/**
 * Calculate the effective risk percentage for the current state (latest trade date)
 */
export const calculateCurrentEffectiveRiskPercentage = (
  allTrades: Trade[],
  dynamicRiskSettings: DynamicRiskSettings
): number => {
  if (allTrades.length === 0) {
    return dynamicRiskSettings.risk_per_trade || 0;
  }

  // Use the latest trade date + 1 day to ensure we include all trades
  const latestDate = new Date(Math.max(...allTrades.map(trade => new Date(trade.trade_date).getTime())));
  const currentDate = new Date(latestDate.getTime() + 24 * 60 * 60 * 1000);

  return calculateEffectiveRiskPercentage(currentDate, allTrades, dynamicRiskSettings);
};

/**
 * Calculate current total account value (account balance + cumulative profit)
 */
export const calculateCurrentTotalValue = (
  accountBalance: number,
  allTrades: Trade[]
): number => {
  const totalPnL = allTrades.reduce((sum, trade) => sum + trade.amount, 0);
  return accountBalance + totalPnL;
};

/**
 * Calculate percentage based on current total value instead of just account balance
 */
export const calculatePercentageOfCurrentValue = (
  amount: number,
  accountBalance: number,
  allTrades: Trade[]
): number => {
  const currentTotalValue = calculateCurrentTotalValue(accountBalance, allTrades);
  return currentTotalValue > 0 ? (amount / currentTotalValue) * 100 : 0;
};

/**
 * Calculate percentage based on account value at a specific point in time
 * Excludes trades after the specified date to provide consistent baseline calculations
 */
export const calculatePercentageOfValueAtDate = (
  amount: number,
  accountBalance: number,
  allTrades: Trade[],
  excludeAfterDate: Date
): number => {
  const relevantTrades = allTrades.filter(trade => new Date(trade.trade_date) < excludeAfterDate);
  const baselineValue = calculateCurrentTotalValue(accountBalance, relevantTrades);
  return baselineValue > 0 ? (amount / baselineValue) * 100 : 0;
};

/**
 * Calculate risk amount based on effective risk percentage and account value
 */
export const calculateRiskAmount = (
  effectiveRiskPercentage: number,
  accountBalance: number,
  cumulativePnL: number = 0
): number => {
  const totalAccountValue = accountBalance + cumulativePnL;
  return (totalAccountValue * effectiveRiskPercentage) / 100;
};

/**
 * Calculate trade amount based on risk-to-reward ratio and dynamic risk settings
 */
export const calculateTradeAmount = (
  tradeType: 'win' | 'loss' | 'breakeven',
  riskToReward: number,
  targetDate: Date,
  allTrades: Trade[],
  dynamicRiskSettings: DynamicRiskSettings
): number => {
  if (tradeType === 'breakeven') return 0;

  const effectiveRisk = calculateEffectiveRiskPercentage(targetDate, allTrades, dynamicRiskSettings);
  const cumulativePnL = calculateCumulativePnLToDate(targetDate, allTrades);
  const riskAmount = calculateRiskAmount(effectiveRisk, dynamicRiskSettings.account_balance, cumulativePnL);

  if (tradeType === 'win') {
    return Math.round(riskAmount * riskToReward);
  } else {
    return -Math.round(riskAmount);
  }
};

/**
 * Normalize trade amount to a common risk basis for fair comparison
 */
export const normalizeTradeAmount = (
  trade: Trade,
  allTrades: Trade[],
  dynamicRiskSettings: DynamicRiskSettings
): number => {
  // Skip normalization for trades without risk/reward or partials taken
  if (!trade.risk_to_reward || trade.partials_taken || trade.trade_type === 'breakeven') {
    return Math.abs(trade.amount);
  }

  const effectiveRisk = calculateEffectiveRiskPercentage(new Date(trade.trade_date), allTrades, dynamicRiskSettings);
  
  if (effectiveRisk === 0) {
    return Math.abs(trade.amount);
  }
  const baseRiskPercentage = dynamicRiskSettings.risk_per_trade || 1;
  // Calculate what the trade size would be with the base risk percentage
  const normalizedAmount = (Math.abs(trade.amount) * baseRiskPercentage) / effectiveRisk;
  
  return normalizedAmount;
};

/**
 * Check if dynamic risk is currently active
 */
export const isDynamicRiskActive = (
  allTrades: Trade[],
  dynamicRiskSettings: DynamicRiskSettings
): boolean => {
  if (!dynamicRiskSettings.dynamic_risk_enabled ||
      !dynamicRiskSettings.increased_risk_percentage ||
      !dynamicRiskSettings.profit_threshold_percentage ||
      dynamicRiskSettings.account_balance <= 0) {
    return false;
  }

  const currentEffectiveRisk = calculateCurrentEffectiveRiskPercentage(allTrades, dynamicRiskSettings);
  return currentEffectiveRisk === dynamicRiskSettings.increased_risk_percentage;
};

/**
 * Calculate effective max daily drawdown based on dynamic risk settings
 */
export const calculateEffectiveMaxDailyDrawdown = (
  maxDailyDrawdown: number,
  allTrades: Trade[],
  dynamicRiskSettings: DynamicRiskSettings
): number => {
  if (!isDynamicRiskActive(allTrades, dynamicRiskSettings)) {
    return maxDailyDrawdown;
  }

  // Adjust drawdown limit proportionally to the risk increase
  const riskRatio = dynamicRiskSettings.increased_risk_percentage! / (dynamicRiskSettings.risk_per_trade || 1);
  return maxDailyDrawdown * riskRatio;
};

/**
 * Get dynamic risk status information for display
 */
export const getDynamicRiskStatus = (
  allTrades: Trade[],
  dynamicRiskSettings: DynamicRiskSettings
): {
  isActive: boolean;
  currentRiskPercentage: number;
  baseRiskPercentage: number;
  profitPercentage: number;
  thresholdMet: boolean;
} => {
  const currentRiskPercentage = calculateCurrentEffectiveRiskPercentage(allTrades, dynamicRiskSettings);
  const baseRiskPercentage = dynamicRiskSettings.risk_per_trade || 0;
  const isActive = isDynamicRiskActive(allTrades, dynamicRiskSettings);
  
  const totalPnL = allTrades.reduce((sum, trade) => sum + trade.amount, 0);
  const profitPercentage = dynamicRiskSettings.account_balance > 0 
    ? (totalPnL / dynamicRiskSettings.account_balance) * 100 
    : 0;
  
  const thresholdMet = profitPercentage >= (dynamicRiskSettings.profit_threshold_percentage || 0);

  return {
    isActive,
    currentRiskPercentage,
    baseRiskPercentage,
    profitPercentage,
    thresholdMet
  };
};

