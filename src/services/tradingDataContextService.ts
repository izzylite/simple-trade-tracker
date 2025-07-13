/**
 * Trading Data Context Service
 * Prepares and formats trading data context for AI queries
 */

import { Trade } from '../types/trade';
import { Calendar } from '../types/calendar';
import { TradingDataContext, AIChatConfig, TrimmedTrade } from '../types/aiChat';
import { calculateWinRate, calculateProfitFactor } from '../utils/statsUtils';
import { logger } from '../utils/logger';
import {
  subDays,
  subMonths,
  isAfter,
  isBefore,
  format
} from 'date-fns';

class TradingDataContextService {
  
  /**
   * Generate comprehensive trading data context for AI analysis
   */
  async generateContext(
    trades: Trade[],
    _calendar: Calendar,
    config: AIChatConfig
  ): Promise<TradingDataContext> {
    try {
      logger.log('Generating trading data context for AI analysis...');

      // Filter trades based on config
      const filteredTrades = this.filterTrades(trades, config);
      
      // Basic statistics
      const basicStats = this.calculateBasicStats(filteredTrades);
      
      // Time-based analysis
      const timeAnalysis = this.calculateTimeAnalysis(filteredTrades);
      
      // Session performance
      const sessionStats = this.calculateSessionStats(filteredTrades);
      
      // Tag analysis
      const tagStats = config.includeTagAnalysis 
        ? this.calculateTagStats(filteredTrades)
        : [];
      
      // Recent trends
      const recentTrends = this.calculateRecentTrends(filteredTrades);
      
      // Risk metrics
      const riskMetrics = this.calculateRiskMetrics(filteredTrades);
      
      // Economic events impact (if enabled)
      const economicEventsImpact = config.includeEconomicEvents
        ? this.calculateEconomicEventsImpact(filteredTrades)
        : undefined;

      // Prepare detailed trade information (if enabled)
      const tradeDetails = config.includeDetailedTrades
        ? this.prepareTradeDetails(filteredTrades)
        : [];

      const context: TradingDataContext = {
        ...basicStats,
        ...timeAnalysis,
        sessionStats,
        topTags: tagStats,
        recentTrends,
        riskMetrics,
        economicEventsImpact,
        trades: tradeDetails
      };

      logger.log('Trading data context generated successfully');
      return context;

    } catch (error) {
      logger.error('Error generating trading data context:', error);
      throw new Error('Failed to generate trading data context');
    }
  }

  /**
   * Filter trades based on configuration
   */
  private filterTrades(trades: Trade[], config: AIChatConfig): Trade[] {
    let filtered = trades.filter(trade => !trade.isDeleted);

    // Limit number of trades for performance
    if (config.maxContextTrades && filtered.length > config.maxContextTrades) {
      // Sort by date (most recent first) and take the limit
      filtered = filtered
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, config.maxContextTrades);
    }

    return filtered;
  }

  /**
   * Calculate basic trading statistics
   */
  private calculateBasicStats(trades: Trade[]) {
    const totalTrades = trades.length;
    const wins = trades.filter(t => t.type === 'win');
    const losses = trades.filter(t => t.type === 'loss');
    
    const winRate = calculateWinRate(trades);
    const profitFactor = calculateProfitFactor(trades);
    
    const totalPnL = trades.reduce((sum, trade) => sum + trade.amount, 0);
    const avgWin = wins.length > 0 ? wins.reduce((sum, trade) => sum + trade.amount, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, trade) => sum + trade.amount, 0) / losses.length) : 0;
    
    // Calculate max drawdown
    let maxDrawdown = 0;
    let peak = 0;
    let runningPnL = 0;
    
    const sortedTrades = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    for (const trade of sortedTrades) {
      runningPnL += trade.amount;
      if (runningPnL > peak) {
        peak = runningPnL;
      }
      const drawdown = ((peak - runningPnL) / Math.abs(peak)) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return {
      totalTrades,
      winRate,
      profitFactor,
      totalPnL,
      avgWin,
      avgLoss,
      maxDrawdown
    };
  }

  /**
   * Calculate time-based analysis
   */
  private calculateTimeAnalysis(trades: Trade[]) {
    if (trades.length === 0) {
      return {
        dateRange: { start: new Date(), end: new Date() },
        tradingDays: 0,
        avgTradesPerDay: 0
      };
    }

    const sortedTrades = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const start = new Date(sortedTrades[0].date);
    const end = new Date(sortedTrades[sortedTrades.length - 1].date);
    
    // Calculate unique trading days
    const uniqueDays = new Set(trades.map(trade => format(new Date(trade.date), 'yyyy-MM-dd')));
    const tradingDays = uniqueDays.size;
    
    const avgTradesPerDay = tradingDays > 0 ? trades.length / tradingDays : 0;

    return {
      dateRange: { start, end },
      tradingDays,
      avgTradesPerDay
    };
  }

  /**
   * Calculate session-based statistics
   */
  private calculateSessionStats(trades: Trade[]) {
    const sessions = ['Asia', 'London', 'NY AM', 'NY PM'] as const;
    
    return sessions.map(session => {
      const sessionTrades = trades.filter(trade => trade.session === session);
      const sessionWins = sessionTrades.filter(trade => trade.type === 'win');
      const sessionPnL = sessionTrades.reduce((sum, trade) => sum + trade.amount, 0);
      const sessionWinRate = sessionTrades.length > 0 ? (sessionWins.length / sessionTrades.length) * 100 : 0;

      return {
        session,
        trades: sessionTrades.length,
        winRate: sessionWinRate,
        pnl: sessionPnL
      };
    }).filter(stat => stat.trades > 0); // Only include sessions with trades
  }

  /**
   * Calculate tag-based statistics
   */
  private calculateTagStats(trades: Trade[]) {
    const tagStats = new Map<string, { count: number; wins: number; totalPnL: number }>();

    trades.forEach(trade => {
      if (trade.tags) {
        trade.tags.forEach(tag => {
          if (!tagStats.has(tag)) {
            tagStats.set(tag, { count: 0, wins: 0, totalPnL: 0 });
          }
          const stats = tagStats.get(tag)!;
          stats.count++;
          stats.totalPnL += trade.amount;
          if (trade.type === 'win') {
            stats.wins++;
          }
        });
      }
    });

    return Array.from(tagStats.entries())
      .map(([tag, stats]) => ({
        tag,
        count: stats.count,
        winRate: (stats.wins / stats.count) * 100,
        avgPnL: stats.totalPnL / stats.count
      }))
      .sort((a, b) => b.count - a.count) // Sort by frequency
      .slice(0, 10); // Top 10 tags
  }

  /**
   * Calculate recent performance trends
   */
  private calculateRecentTrends(trades: Trade[]) {
    const now = new Date();
    const periods = [
      { name: 'Last 7 days', start: subDays(now, 7) },
      { name: 'Last 30 days', start: subDays(now, 30) },
      { name: 'Last 3 months', start: subMonths(now, 3) }
    ];

    return periods.map(period => {
      const periodTrades = trades.filter(trade => 
        isAfter(new Date(trade.date), period.start) && 
        isBefore(new Date(trade.date), now)
      );

      const wins = periodTrades.filter(trade => trade.type === 'win');
      const winRate = periodTrades.length > 0 ? (wins.length / periodTrades.length) * 100 : 0;
      const pnl = periodTrades.reduce((sum, trade) => sum + trade.amount, 0);

      return {
        period: period.name,
        winRate,
        pnl,
        tradeCount: periodTrades.length
      };
    }).filter(trend => trend.tradeCount > 0);
  }

  /**
   * Calculate risk management metrics
   */
  private calculateRiskMetrics(trades: Trade[]) {
    const riskRewards = trades
      .filter(trade => trade.riskToReward && trade.riskToReward > 0)
      .map(trade => trade.riskToReward!);
    
    const avgRiskReward = riskRewards.length > 0 
      ? riskRewards.reduce((sum, rr) => sum + rr, 0) / riskRewards.length 
      : 0;

    // Calculate consecutive wins/losses
    let maxConsecutiveWins = 0;
    let maxConsecutiveLosses = 0;
    let currentWinStreak = 0;
    let currentLossStreak = 0;

    const sortedTrades = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sortedTrades.forEach(trade => {
      if (trade.type === 'win') {
        currentWinStreak++;
        currentLossStreak = 0;
        maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWinStreak);
      } else if (trade.type === 'loss') {
        currentLossStreak++;
        currentWinStreak = 0;
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLossStreak);
      } else {
        // Breakeven resets both streaks
        currentWinStreak = 0;
        currentLossStreak = 0;
      }
    });

    const amounts = trades.map(trade => trade.amount);
    const largestWin = Math.max(...amounts.filter(amount => amount > 0), 0);
    const largestLoss = Math.min(...amounts.filter(amount => amount < 0), 0);

    return {
      avgRiskReward,
      maxConsecutiveWins,
      maxConsecutiveLosses,
      largestWin,
      largestLoss
    };
  }

  /**
   * Prepare detailed trade information for AI context
   */
  private prepareTradeDetails(trades: Trade[]) : TrimmedTrade[] {
    return trades.map(trade => ({
      id: trade.id,
      name: trade.name || 'Unnamed Trade',
      date: Math.floor(new Date(trade.date).getTime() / 1000), // Unix timestamp for trade date
      session: trade.session || 'Unknown',
      type: trade.type,
      amount: trade.amount,
      riskToReward: trade.riskToReward,
      tags: trade.tags || [],
      notes: trade.notes || '',
      economicEvents: trade.economicEvents?.map(event => ({
        name: event.name,
        impact: event.impact,
        currency: event.currency,
        time: event.timeUtc
      })) || [],
      images: trade.images?.map(img => img.url) || [],
      createdAt: Math.floor(new Date(trade.date).getTime() / 1000), // Unix timestamp for creation time
      updatedAt: trade.updatedAt ? Math.floor(new Date(trade.updatedAt).getTime() / 1000) : undefined
    }));
  }

  /**
   * Calculate economic events impact
   */
  private calculateEconomicEventsImpact(trades: Trade[]) {
    const tradesWithEvents = trades.filter(trade => 
      trade.economicEvents && trade.economicEvents.length > 0
    );

    const highImpactTrades = tradesWithEvents.filter(trade =>
      trade.economicEvents?.some(event => event.impact === 'High')
    );

    const highImpactWins = highImpactTrades.filter(trade => trade.type === 'win');
    const highImpactWinRate = highImpactTrades.length > 0 
      ? (highImpactWins.length / highImpactTrades.length) * 100 
      : 0;

    // Get most common economic events
    const eventCounts = new Map<string, number>();
    tradesWithEvents.forEach(trade => {
      trade.economicEvents?.forEach(event => {
        const count = eventCounts.get(event.name) || 0;
        eventCounts.set(event.name, count + 1);
      });
    });

    const commonEvents = Array.from(eventCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([event]) => event);

    return {
      highImpactTrades: highImpactTrades.length,
      highImpactWinRate,
      commonEvents
    };
  }
 }

// Export singleton instance
export const tradingDataContextService = new TradingDataContextService();
