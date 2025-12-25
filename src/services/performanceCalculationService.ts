import { logger } from '../utils/logger';
import { Trade } from '../types/dualWrite';

export interface PerformanceCalculationResult {
  winLossStats: any;
  tagStats: any[];
  dailySummaryData: any[];
  riskRewardStats: any;
  sessionStats: any[];
  comparisonWinLossData: any[] | null;
  allTags: string[];
  winLossData: any[];
}

export class PerformanceCalculationService {
  private static instance: PerformanceCalculationService;

  public static getInstance(): PerformanceCalculationService {
    if (!PerformanceCalculationService.instance) {
      PerformanceCalculationService.instance = new PerformanceCalculationService();
    }
    return PerformanceCalculationService.instance;
  }

  // Calculate tag performance from trades (client-side, no DB query)
  public calculateTagPerformanceFromTrades(
    trades: Trade[],
    primaryTags: string[],
    secondaryTags: string[] = []
  ): any[] {
    try {
      // If no tags selected, return empty array
      if (primaryTags.length === 0) {
        return [];
      }

      // Calculate performance for each primary tag
      const tagPerformanceResults = primaryTags.map(primaryTag => {
        // Filter trades that have this primary tag AND all secondary tags
        const filteredTrades = trades.filter(trade => {
          // Check if trade has the primary tag
          if (!trade.tags?.includes(primaryTag)) return false;
          // Check if trade has all secondary tags
          if (secondaryTags.length > 0 && !secondaryTags.every(tag => trade.tags?.includes(tag))) return false;
          return true;
        });

        // Skip if no trades match
        if (filteredTrades.length === 0) {
          return null;
        }

        // Calculate metrics for this tag
        const wins = filteredTrades.filter(t => t.trade_type === 'win');
        const losses = filteredTrades.filter(t => t.trade_type === 'loss');
        const breakevens = filteredTrades.filter(t => t.trade_type === 'breakeven');
        const totalTrades = filteredTrades.length;
        const totalPnl = filteredTrades.reduce((sum, t) => sum + t.amount, 0);
        const avgPnl = totalTrades > 0 ? totalPnl / totalTrades : 0;
        const maxWin = wins.length > 0 ? Math.max(...wins.map(t => t.amount)) : 0;
        const maxLoss = losses.length > 0 ? Math.min(...losses.map(t => t.amount)) : 0;
        const winRate = totalTrades > 0 ? Math.round((wins.length / totalTrades) * 100 * 100) / 100 : 0;

        return {
          tag: primaryTag,
          wins: wins.length,
          losses: losses.length,
          breakevens: breakevens.length,
          total_trades: totalTrades,
          win_rate: winRate,
          total_pnl: totalPnl,
          avg_pnl: avgPnl,
          max_win: maxWin,
          max_loss: maxLoss
        };
      }).filter(result => result !== null); // Remove tags with no trades

      return tagPerformanceResults;
    } catch (error) {
      logger.error('Error in calculateTagPerformanceFromTrades:', error);
      throw error;
    }
  }
}

export const performanceCalculationService = PerformanceCalculationService.getInstance();
