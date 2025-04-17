import { Trade } from './trade';

export interface Calendar {
  id: string;
  name: string;
  createdAt: Date;
  lastModified: Date;
  accountBalance: number;
  maxDailyDrawdown: number;
  weeklyTarget?: number;
  monthlyTarget?: number;
  yearlyTarget?: number;
  riskPerTrade?: number;
  dynamicRiskEnabled?: boolean;
  increasedRiskPercentage?: number;
  profitThresholdPercentage?: number;
  // Notes
  note?: string;
  daysNotes?: Map<string, string>;
  // Statistics
  winRate?: number;
  profitFactor?: number;
  maxDrawdown?: number;
  targetProgress?: number;
  pnlPerformance?: number;
  totalTrades?: number;
  winCount?: number;
  lossCount?: number;
  totalPnL?: number;
  drawdownStartDate?: Date | null;
  drawdownEndDate?: Date | null;
  drawdownRecoveryNeeded?: number;
  drawdownDuration?: number;
  avgWin?: number;
  avgLoss?: number;
  currentBalance?: number;
  // Weekly, monthly, and yearly statistics
  weeklyPnL?: number;
  monthlyPnL?: number;
  yearlyPnL?: number;
  weeklyPnLPercentage?: number;
  monthlyPnLPercentage?: number;
  yearlyPnLPercentage?: number;
  weeklyProgress?: number;
  monthlyProgress?: number;
  // Cached trades for the current view
  cachedTrades: Trade[];
  // Track which years have been loaded
  loadedYears: number[];
}