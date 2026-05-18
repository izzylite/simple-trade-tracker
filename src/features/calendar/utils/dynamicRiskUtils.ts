import { Trade, Calendar } from '../types/dualWrite';
import { TradeRepository } from 'services/repository/repositories/TradeRepository';

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
 * Internal helper used by isDynamicRiskActive.
 */
const calculateCurrentEffectiveRiskPercentage = (
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
 * Check if dynamic risk is currently active.
 * Internal helper used by calculateEffectiveMaxDailyDrawdown.
 */
const isDynamicRiskActive = (
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

