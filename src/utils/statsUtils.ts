import { Trade } from '../types/dualWrite';
import { calculateEffectiveMaxDailyDrawdown, DynamicRiskSettings } from './dynamicRiskUtils';
import {
  DayStatus
} from '../components/StyledComponents';

/**
 * Calculate total PnL for a set of trades (internal helper)
 */
const calculateTotalPnL = (trades: Trade[]): number => {
  return trades.reduce((sum, trade) => sum + trade.amount, 0);
};

/**
 * Calculate target progress for a set of trades
 * @param trades Array of trades
 * @param accountBalance Initial account balance
 * @param target Target percentage
 * @param startDate Optional start date to calculate account value at start of period
 * @param allTrades Optional all trades array for calculating account value at start date
 * @returns Target progress percentage (capped at 100%)
 */
export const calculateTargetProgress = (
  trades: Trade[],
  accountBalance: number,
  target: number,
  startDate?: Date,
  allTrades?: Trade[]
): number => {
  if (!target || target <= 0 || !accountBalance) return 0;

  const totalPnL = calculateTotalPnL(trades);

  // Calculate account value at start of period if startDate and allTrades are provided
  let baselineAccountValue = accountBalance;
  if (startDate && allTrades) {
    const tradesBeforePeriod = allTrades.filter(trade => new Date(trade.trade_date) < startDate);
    baselineAccountValue = accountBalance + tradesBeforePeriod.reduce((sum, trade) => sum + trade.amount, 0);
  }

  if (baselineAccountValue <= 0) return 0;

  const targetAmount = (target / 100) * baselineAccountValue;

  // Cap progress at 100% to prevent overflow in UI components
  return Math.min(Math.max((totalPnL / targetAmount) * 100, 0), 100);
};


interface DayStats {
  netAmount: number;
  status: DayStatus;
  percentage: string;
  isDrawdownViolation: boolean;
}

export const calculateDayStats = (
  dayTrades: Trade[],
  accountBalance: number,
  maxDailyDrawdown: number,
  dynamicRiskSettings?: DynamicRiskSettings,
  allTrades?: Trade[],
  dayDate?: Date,
  totalAccountValue?: number
): DayStats => {
  // Calculate net amount for the day
  const netAmount = dayTrades.reduce((sum, trade) => sum + trade.amount, 0);

  // Calculate percentage relative to total account value (start-of-month balance)
  // This gives meaningful percentages when trades span only the current month
  const baseValue = totalAccountValue ?? accountBalance;
  const percentage = baseValue > 0
    ? ((netAmount / baseValue) * 100).toFixed(1)
    : '0';

  let status: DayStatus = 'neutral';
  if (dayTrades.length > 0) {
    status = netAmount > 0 ? 'win' : netAmount < 0 ? 'loss' : dayTrades.find(trade => trade.trade_type === 'breakeven') ? 'breakeven' : 'neutral';
  }

  // Calculate effective max daily drawdown based on dynamic risk settings
  let effectiveMaxDailyDrawdown = maxDailyDrawdown;

  if (dynamicRiskSettings && allTrades) {
    effectiveMaxDailyDrawdown = calculateEffectiveMaxDailyDrawdown(
      maxDailyDrawdown,
      allTrades,
      dynamicRiskSettings
    );
  }

  // Check for drawdown violation using dollar amounts against total account value
  const ddLimitAmount = (effectiveMaxDailyDrawdown / 100) * baseValue;
  const isDrawdownViolation = status === 'loss' && Math.abs(netAmount) > ddLimitAmount;

  return { netAmount, status, percentage, isDrawdownViolation };
};
