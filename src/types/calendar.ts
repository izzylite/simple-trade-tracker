import { Trade } from './trade';
import { ScoreSettings } from './score';

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
  // Duplication tracking
  duplicatedCalendar?: boolean;
  sourceCalendarId?: string;
  // Trash/deletion tracking
  isDeleted?: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  autoDeleteAt?: Date;
  // Tag validation
  requiredTagGroups?: string[];
  // All tags used in this calendar
  tags?: string[];
  // Notes
  note?: string;
  daysNotes?: Map<string, string>;
  // Score settings
  scoreSettings?: ScoreSettings;
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