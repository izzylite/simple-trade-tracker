import { Trade, Calendar } from '../types/dualWrite';
import { TradeRepository } from '../services/repository/repositories/TradeRepository';

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
 * Calculate cumulative P&L up to (but not including) a specific date using year_stats.
 * Synchronous version - use when you already have the month's trades loaded.
 *
 * @param targetDate - The date to calculate cumulative P&L up to (exclusive)
 * @param calendar - Calendar object with year_stats containing account_value_at_start
 * @param monthTrades - Trades from the target month (can include trades after targetDate)
 * @returns Cumulative P&L before targetDate
 */
export const calculateCumulativePnLToDateSync = (
  targetDate: Date,
  calendar: Calendar,
  monthTrades: Trade[]
): number => {
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth(); // 0-11

  // Get account_value_at_start from year_stats (includes all P&L before this month)
  const yearStats = calendar.year_stats?.[year.toString()];
  const monthStats = yearStats?.monthly_stats?.[month];

  let accountValueAtMonthStart: number;

  if (monthStats?.account_value_at_start !== undefined) {
    // Use the stored value for this month
    accountValueAtMonthStart = Number(monthStats.account_value_at_start);
  } else if (yearStats) {
    // Year exists but month doesn't have value yet - use account_balance as fallback
    accountValueAtMonthStart = Number(calendar.account_balance);
  } else {
    // No year_stats for this year - calculate from previous years
    // Sum up all yearly P&L from previous years
    let totalPreviousYearsPnL = 0;
    if (calendar.year_stats) {
      for (const [statsYear, stats] of Object.entries(calendar.year_stats)) {
        const statsYearNum = parseInt(statsYear, 10);
        if (statsYearNum < year && stats.yearly_pnl !== undefined) {
          totalPreviousYearsPnL += Number(stats.yearly_pnl);
        }
      }
    }
    accountValueAtMonthStart = Number(calendar.account_balance) + totalPreviousYearsPnL;
  }

  // account_value_at_start = account_balance + all historical P&L up to month start
  // So cumulative P&L at month start = account_value_at_start - account_balance
  const cumulativePnLAtMonthStart = accountValueAtMonthStart - Number(calendar.account_balance);

  // Filter trades: before targetDate (exclusive) - use full timestamp comparison
  const targetTime = targetDate.getTime();

  const monthPnLBeforeTarget = monthTrades
    .filter(trade => {
      const tradeTime = new Date(trade.trade_date).getTime();
      return tradeTime < targetTime;
    })
    .reduce((sum, trade) => sum + Number(trade.amount), 0);

  // Total cumulative P&L = historical + this month's trades before target
  return cumulativePnLAtMonthStart + monthPnLBeforeTarget;
};

/**
 * Calculate cumulative P&L up to (but not including) a specific date using year_stats.
 * Async version - fetches month trades internally when not available.
 *
 * @param targetDate - The date to calculate cumulative P&L up to (exclusive)
 * @param calendar - Calendar object with year_stats containing account_value_at_start
 * @param providedTrades - Optional trades array to use instead of fetching from database
 * @returns Promise<number> Cumulative P&L before targetDate
 */
export const calculateCumulativePnLToDateAsync = async (
  targetDate: Date,
  calendar: Calendar,
  providedTrades?: Trade[]
): Promise<number> => {
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth(); // 0-11

  // Get account_value_at_start from year_stats
  const yearStats = calendar.year_stats?.[year.toString()];
  const monthStats = yearStats?.monthly_stats?.[month];

  let accountValueAtMonthStart: number;

  if (monthStats?.account_value_at_start !== undefined) {
    // Use the stored value for this month
    accountValueAtMonthStart = Number(monthStats.account_value_at_start);
  } else if (yearStats) {
    // Year exists but month doesn't have value yet - use account_balance as fallback
    accountValueAtMonthStart = Number(calendar.account_balance);
  } else {
    // No year_stats for this year - calculate from previous years
    // Sum up all yearly P&L from previous years
    let totalPreviousYearsPnL = 0;
    if (calendar.year_stats) {
      for (const [statsYear, stats] of Object.entries(calendar.year_stats)) {
        const statsYearNum = parseInt(statsYear, 10);
        if (statsYearNum < year && stats.yearly_pnl !== undefined) {
          totalPreviousYearsPnL += Number(stats.yearly_pnl);
        }
      }
    }
    accountValueAtMonthStart = Number(calendar.account_balance) + totalPreviousYearsPnL;
  }

  const cumulativePnLAtMonthStart = accountValueAtMonthStart - Number(calendar.account_balance);

  // Use provided trades or fetch from database
  let monthTrades: Pick<Trade, 'trade_date' | 'amount'>[];

  if (providedTrades) {
    // Filter provided trades to get only this month's trades
    monthTrades = providedTrades
      .filter(trade => {
        const tradeDate = new Date(trade.trade_date);
        return tradeDate.getFullYear() === year && tradeDate.getMonth() === month;
      })
      .map(trade => ({ trade_date: trade.trade_date, amount: trade.amount }));
  } else {
    // Fetch only trade_date and amount for this month (optimized query)
    const tradeRepo = new TradeRepository();
    monthTrades = await tradeRepo.getTradesByMonth(calendar.id!, year, month, ['trade_date', 'amount']);
  }

  // Filter trades before targetDate and sum their amounts - use full timestamp comparison
  const targetTime = targetDate.getTime();

  const monthPnLBeforeTarget = monthTrades
    .filter(trade => {
      const tradeTime = new Date(trade.trade_date).getTime();
      return tradeTime < targetTime;
    })
    .reduce((sum, trade) => sum + Number(trade.amount), 0);

  return cumulativePnLAtMonthStart + monthPnLBeforeTarget;
};

/**
 * Calculate the effective risk percentage for a specific date/trade using year_stats.
 * Async version - fetches month trades internally when not available.
 *
 * @param targetDate - The date to calculate effective risk for
 * @param calendar - Calendar object with year_stats
 * @param dynamicRiskSettings - Dynamic risk settings
 * @param providedTrades - Optional trades array to use instead of fetching from database
 */
export const calculateEffectiveRiskPercentageAsync = async (
  targetDate: Date,
  calendar: Calendar,
  dynamicRiskSettings: DynamicRiskSettings,
  providedTrades?: Trade[]
): Promise<number> => {
  if (!dynamicRiskSettings.risk_per_trade) return 0;

  // If dynamic risk is not enabled, return base risk percentage
  if (!dynamicRiskSettings.dynamic_risk_enabled ||
      !dynamicRiskSettings.increased_risk_percentage ||
      !dynamicRiskSettings.profit_threshold_percentage ||
      dynamicRiskSettings.account_balance <= 0) {
    return dynamicRiskSettings.risk_per_trade;
  }

  // Calculate cumulative P&L up to the target date using year_stats
  const cumulativePnL = await calculateCumulativePnLToDateAsync(targetDate, calendar, providedTrades);

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
  if (!dynamicRiskSettings.risk_per_trade) return 0;

  if (allTrades.length === 0) {
    return dynamicRiskSettings.risk_per_trade || 0;
  }

  // If dynamic risk is not enabled, return base risk percentage
  if (!dynamicRiskSettings.dynamic_risk_enabled ||
      !dynamicRiskSettings.increased_risk_percentage ||
      !dynamicRiskSettings.profit_threshold_percentage ||
      dynamicRiskSettings.account_balance <= 0) {
    return dynamicRiskSettings.risk_per_trade;
  }

  // Calculate cumulative P&L (all trades)
  const cumulativePnL = allTrades.reduce((sum, trade) => sum + trade.amount, 0);

  // Check if profit threshold is met
  const profitPercentage = (cumulativePnL / dynamicRiskSettings.account_balance) * 100;
  if (profitPercentage >= dynamicRiskSettings.profit_threshold_percentage) {
    return dynamicRiskSettings.increased_risk_percentage;
  }

  return dynamicRiskSettings.risk_per_trade;
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
  const currentTotalValue = calculateCurrentTotalValue(Number(accountBalance), allTrades);
  return currentTotalValue > 0 ? (Number(amount) / currentTotalValue) * 100 : 0;
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
  const targetTime = excludeAfterDate.getTime();
  const relevantTrades = allTrades.filter(trade => new Date(trade.trade_date).getTime() < targetTime);
  const baselineValue = calculateCurrentTotalValue(Number(accountBalance), relevantTrades);
  return baselineValue > 0 ? (Number(amount) / baselineValue) * 100 : 0;
};

/**
 * Calculate risk amount based on effective risk percentage and account value
 */
export const calculateRiskAmount = (
  effectiveRiskPercentage: number,
  accountBalance: number,
  cumulativePnL: number = 0
): number => {
  const totalAccountValue = Number(accountBalance) + Number(cumulativePnL);
  return (totalAccountValue * Number(effectiveRiskPercentage)) / 100;
};

/**
 * Calculate trade amount based on risk-to-reward ratio and dynamic risk settings.
 * Async version - uses year_stats and fetches month trades internally when not available.
 *
 * @param tradeType - Type of trade (win/loss/breakeven)
 * @param riskToReward - Risk to reward ratio
 * @param targetDate - Date of the trade
 * @param calendar - Calendar object with year_stats
 * @param dynamicRiskSettings - Dynamic risk settings
 * @param providedTrades - Optional trades array to use instead of fetching from database
 */
export const calculateTradeAmountAsync = async (
  tradeType: 'win' | 'loss' | 'breakeven',
  riskToReward: number,
  targetDate: Date,
  calendar: Calendar,
  dynamicRiskSettings: DynamicRiskSettings,
  providedTrades?: Trade[]
): Promise<number> => {
  if (tradeType === 'breakeven') return 0;
  const effectiveRisk = await calculateEffectiveRiskPercentageAsync(
    targetDate, calendar, dynamicRiskSettings, providedTrades
  );
  const cumulativePnL = await calculateCumulativePnLToDateAsync(targetDate, calendar, providedTrades);
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

  // Calculate effective risk inline
  if (!dynamicRiskSettings.risk_per_trade) {
    return Math.abs(trade.amount);
  }

  let effectiveRisk = dynamicRiskSettings.risk_per_trade;

  // If dynamic risk is enabled, check if threshold is met
  if (dynamicRiskSettings.dynamic_risk_enabled &&
      dynamicRiskSettings.increased_risk_percentage &&
      dynamicRiskSettings.profit_threshold_percentage &&
      dynamicRiskSettings.account_balance > 0) {

    // Calculate cumulative P&L up to (but not including) this trade - use full timestamp comparison
    const targetTime = new Date(trade.trade_date).getTime();

    const cumulativePnL = allTrades
      .filter(t => {
        const tradeTime = new Date(t.trade_date).getTime();
        return tradeTime < targetTime;
      })
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const profitPercentage = (cumulativePnL / dynamicRiskSettings.account_balance) * 100;
    if (profitPercentage >= dynamicRiskSettings.profit_threshold_percentage) {
      effectiveRisk = dynamicRiskSettings.increased_risk_percentage;
    }
  }

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

