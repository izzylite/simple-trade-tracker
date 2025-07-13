/**
 * Optimized AI Context Service
 * Sends entire dataset but with trimmed trade objects (removes heavy fields like images)
 */

import { Trade } from '../types/trade';
import { Calendar } from '../types/calendar';
import { AIChatConfig, TrimmedTrade } from '../types/aiChat';
import { tradingDataContextService } from './tradingDataContextService';
import { logger } from '../utils/logger';
 
export interface OptimizedTradingContext {
  // Summary statistics (lightweight)
  summary: {
    totalTrades: number;
    winRate: number;
    profitFactor: number;
    totalPnL: number;
    avgWin: number;
    avgLoss: number;
    maxDrawdown: number;
    tradingDays: number;
    avgTradesPerDay: number;
  };
  
  // Risk metrics
  riskMetrics: {
    avgRiskReward: number;
    maxConsecutiveLosses: number;
    maxConsecutiveWins: number;
    largestWin: number;
    largestLoss: number;
  };

  // Top performing tags (limited)
  topTags: Array<{
    tag: string;
    count: number;
    winRate: number;
    avgPnL: number;
  }>;

  // Recent trends
  recentTrends: Array<{
    period: string;
    winRate: number;
    pnl: number;
    tradeCount: number;
  }>;

  // All trades with trimmed data (no images or heavy fields)
  allTrades: TrimmedTrade[];

  // Context metadata
  contextInfo: {
    totalTradesInDataset: number;
    queryUsed?: string;
    optimizationMethod: 'trimmed-full-dataset';
  };
}

class OptimizedAIContextService {
  
  /**
   * Generate optimized context with entire dataset but trimmed trade objects
   */
  async generateOptimizedContext(
    userQuery: string,
    trades: Trade[],
    calendar: Calendar,
    config: AIChatConfig
  ): Promise<OptimizedTradingContext> {
    try {
      logger.log('Generating optimized AI context with trimmed full dataset...');

      // Generate full context with all trades
      const fullContext = await tradingDataContextService.generateContext(trades, calendar, config);
 

      const optimizedContext: OptimizedTradingContext = {
        summary: {
          totalTrades: fullContext.totalTrades,
          winRate: fullContext.winRate,
          profitFactor: fullContext.profitFactor,
          totalPnL: fullContext.totalPnL,
          avgWin: fullContext.avgWin,
          avgLoss: fullContext.avgLoss,
          maxDrawdown: fullContext.maxDrawdown,
          tradingDays: fullContext.tradingDays,
          avgTradesPerDay: fullContext.avgTradesPerDay
        },
        riskMetrics: fullContext.riskMetrics,
        topTags: fullContext.topTags.slice(0, 5), // Limit to top 5 tags
        recentTrends: fullContext.recentTrends,
        allTrades: fullContext.trades,
        contextInfo: {
          totalTradesInDataset: fullContext.totalTrades,
          queryUsed: userQuery,
          optimizationMethod: 'trimmed-full-dataset'
        }
      };

      logger.log(`Optimized AI context generated successfully with ${fullContext.trades.length} trimmed trades`);
      return optimizedContext;

    } catch (error) {
      logger.error('Error generating optimized AI context:', error);
      throw new Error('Failed to generate optimized AI context');
    }
  }
 



  /**
   * Generate context summary for system prompt
   */
  generateContextSummary(context: OptimizedTradingContext): string {
    const summary = [
      `TRADING PERFORMANCE SUMMARY:`,
      `• Total Trades: ${context.summary.totalTrades}`,
      `• Win Rate: ${context.summary.winRate.toFixed(1)}%`,
      `• Profit Factor: ${context.summary.profitFactor.toFixed(2)}`,
      `• Total P&L: $${context.summary.totalPnL.toFixed(2)}`,
      `• Max Drawdown: ${context.summary.maxDrawdown.toFixed(1)}%`,
      `• Average Trades per Day: ${context.summary.avgTradesPerDay.toFixed(1)}`,
      ``,
      `RISK METRICS:`,
      `• Average Risk/Reward: ${context.riskMetrics.avgRiskReward.toFixed(2)}`,
      `• Max Consecutive Losses: ${context.riskMetrics.maxConsecutiveLosses}`,
      `• Max Consecutive Wins: ${context.riskMetrics.maxConsecutiveWins}`,
      `• Largest Win: $${context.riskMetrics.largestWin.toFixed(2)}`,
      `• Largest Loss: $${context.riskMetrics.largestLoss.toFixed(2)}`,
      ``,
      `TOP PERFORMING TAGS:`,
      ...context.topTags.map(tag => 
        `• ${tag.tag}: ${tag.count} trades, ${tag.winRate.toFixed(1)}% win rate, $${tag.avgPnL.toFixed(2)} avg P&L`
      ),
      ``,
      `RECENT TRENDS:`,
      ...context.recentTrends.map(trend => 
        `• ${trend.period}: ${trend.winRate.toFixed(1)}% win rate, $${trend.pnl.toFixed(2)} P&L, ${trend.tradeCount} trades`
      ),
      ``,
      `ALL TRADES DATA:`,
      `The following is the COMPLETE dataset of ALL ${context.allTrades.length} trades (optimized by removing images and heavy fields for efficiency):`,
      JSON.stringify(context.allTrades, null, 2)
    ];

    return summary.join('\n');
  }
}

export const optimizedAIContextService = new OptimizedAIContextService();
