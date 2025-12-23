import { Trade } from '../types/dualWrite';
import { TagCombination, TagPatternInsight, TagPatternAnalysis, ScoreSettings } from '../types/score';
import { subDays, isAfter } from 'date-fns';
import { generateTagCombinationsInWorker } from '../workers/tagPatternWorker';
import { logger } from '../utils/logger';

/**
 * Service for analyzing tag patterns and winrate trends
 */
class TagPatternService {
  private minTradesForAnalysis = 5;
  private minTradesForCombination = 3;
  private recentPeriodDays = 30;
  private historicalPeriodDays = 90;

  /**
   * Analyze tag patterns and generate insights
   * Now async to support Web Worker integration
   */
  async analyzeTagPatterns(trades: Trade[], targetDate: Date = new Date(), settings?: ScoreSettings): Promise<TagPatternAnalysis> {
    const recentCutoff = subDays(targetDate, this.recentPeriodDays);
    const historicalCutoff = subDays(targetDate, this.historicalPeriodDays);

    // Filter trades into recent and historical periods
    const recentTrades = trades.filter(trade => isAfter(new Date(trade.trade_date), recentCutoff));
    const historicalTrades = trades.filter(trade =>
      isAfter(new Date(trade.trade_date), historicalCutoff) &&
      !isAfter(new Date(trade.trade_date), recentCutoff)
    );

    // Get all tag combinations using Web Worker (excluding specified tags)
    let combinations: string[][];
    try {
      combinations = await generateTagCombinationsInWorker(trades, settings?.excludedTagsFromPatterns);
    } catch (error) {
      logger.error('Tag pattern worker failed, using fallback:', error);
      combinations = this.generateTagCombinations(trades, settings?.excludedTagsFromPatterns);
    }

    // Analyze each combination
    const analyzedCombinations = combinations.map(combo =>
      this.analyzeTagCombination(combo, recentTrades, historicalTrades, trades)
    ).filter(combo => combo.total_trades >= this.minTradesForCombination);

    // Sort by win rate and total trades
    const topCombinations = [...analyzedCombinations]
      .sort((a, b) => {
        // Primary sort by win rate, secondary by total trades
        const winRateDiff = b.win_rate - a.win_rate;
        if (Math.abs(winRateDiff) < 5) { // If win rates are close, prioritize volume
          return b.total_trades - a.total_trades;
        }
        return winRateDiff;
      })
      .slice(0, 10);

    // Find declining combinations
    const decliningCombinations = analyzedCombinations
      .filter(combo => combo.trend === 'declining' && combo.total_trades >= this.minTradesForAnalysis)
      .sort((a, b) => (a.recentWinRate - a.historicalWinRate) - (b.recentWinRate - b.historicalWinRate))
      .slice(0, 5);

    // Generate insights
    const insights = this.generateInsights(topCombinations, decliningCombinations, trades);

    // Generate market condition alerts
    const marketConditionAlerts = this.generateMarketConditionAlerts(analyzedCombinations, trades);

    return {
      insights: [...insights, ...marketConditionAlerts],
      topCombinations,
      decliningCombinations,
      marketConditionAlerts
    };
  }

  /**
   * Generate all meaningful tag combinations from trades
   */
  private generateTagCombinations(trades: Trade[], excludedTags?: string[]): string[][] {
    const allTags = new Set<string>();
    const tagPairs = new Set<string>();
    const tagTriples = new Set<string>();

    // Collect all tags and their combinations
    trades.forEach(trade => {
      if (trade.tags && trade.tags.length > 0) {
        // Filter out system tags like Partials and excluded tags
        const filteredTags = trade.tags.filter(tag =>
          !tag.startsWith('Partials:') &&
          (!excludedTags || !excludedTags.includes(tag))
        );
        
        // Single tags
        filteredTags.forEach(tag => allTags.add(tag));

        // Tag pairs
        if (filteredTags.length >= 2) {
          for (let i = 0; i < filteredTags.length; i++) {
            for (let j = i + 1; j < filteredTags.length; j++) {
              const pair = [filteredTags[i], filteredTags[j]].sort().join('|');
              tagPairs.add(pair);
            }
          }
        }

        // Tag triples (for high-volume traders)
        if (filteredTags.length >= 3) {
          for (let i = 0; i < filteredTags.length; i++) {
            for (let j = i + 1; j < filteredTags.length; j++) {
              for (let k = j + 1; k < filteredTags.length; k++) {
                const triple = [filteredTags[i], filteredTags[j], filteredTags[k]].sort().join('|');
                tagTriples.add(triple);
              }
            }
          }
        }
      }
    });

    // Convert to arrays
    const combinations: string[][] = [];
    
    // Add single tags
    allTags.forEach(tag => combinations.push([tag]));
    
    // Add pairs
    tagPairs.forEach(pair => combinations.push(pair.split('|')));
    
    // Add triples (only if we have enough trades)
    if (trades.length > 50) {
      tagTriples.forEach(triple => combinations.push(triple.split('|')));
    }

    return combinations;
  }

  /**
   * Analyze a specific tag combination
   */
  private analyzeTagCombination(
    tags: string[], 
    recentTrades: Trade[], 
    historicalTrades: Trade[], 
    allTrades: Trade[]
  ): TagCombination {
    // Filter trades that have all tags in the combination
    const matchingTrades = allTrades.filter(trade =>
      trade.tags && tags.every(tag => trade.tags!.includes(tag))
    );

    const recentMatchingTrades = recentTrades.filter(trade =>
      trade.tags && tags.every(tag => trade.tags!.includes(tag))
    );

    const historicalMatchingTrades = historicalTrades.filter(trade =>
      trade.tags && tags.every(tag => trade.tags!.includes(tag))
    );

    // Calculate overall stats
    const wins = matchingTrades.filter(trade => trade.trade_type === 'win').length;
    const losses = matchingTrades.filter(trade => trade.trade_type === 'loss').length;
    const totalTrades = wins + losses; // Exclude breakevens from win rate calculation
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const totalPnL = matchingTrades.reduce((sum, trade) => sum + trade.amount, 0);
    const avgPnL = matchingTrades.length > 0 ? totalPnL / matchingTrades.length : 0;

    // Calculate recent and historical win rates
    const recentWins = recentMatchingTrades.filter(trade => trade.trade_type === 'win').length;
    const recentLosses = recentMatchingTrades.filter(trade => trade.trade_type === 'loss').length;
    const recentTotal = recentWins + recentLosses;
    const recentWinRate = recentTotal > 0 ? (recentWins / recentTotal) * 100 : 0;

    const historicalWins = historicalMatchingTrades.filter(trade => trade.trade_type === 'win').length;
    const historicalLosses = historicalMatchingTrades.filter(trade => trade.trade_type === 'loss').length;
    const historicalTotal = historicalWins + historicalLosses;
    const historicalWinRate = historicalTotal > 0 ? (historicalWins / historicalTotal) * 100 : 0;

    // Determine trend
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (recentTotal >= 3 && historicalTotal >= 3) {
      const winRateDiff = recentWinRate - historicalWinRate;
      if (winRateDiff > 10) trend = 'improving';
      else if (winRateDiff < -10) trend = 'declining';
    }

    return {
      tags,
      win_rate: winRate,
      total_trades: matchingTrades.length,
      wins,
      losses,
      total_pnl: totalPnL,
      avgPnL,
      trend,
      recentWinRate,
      historicalWinRate
    };
  }

  /**
   * Generate insights from analyzed combinations
   */
  private generateInsights(
    topCombinations: TagCombination[], 
    decliningCombinations: TagCombination[],
    allTrades: Trade[]
  ): TagPatternInsight[] {
    const insights: TagPatternInsight[] = [];

    // High performance insights
    topCombinations.slice(0, 3).forEach((combo, index) => {
      if (combo.win_rate > 70 && combo.total_trades >= this.minTradesForAnalysis) {
        insights.push({
          type: 'high_performance',
          title: `High-Performance Pattern #${index + 1}`,
          description: `The combination "${combo.tags.join(' + ')}" shows exceptional performance with ${combo.win_rate.toFixed(1)}% win rate across ${combo.total_trades} trades.`,
          tagCombination: combo.tags,
          win_rate: combo.win_rate,
          confidence: Math.min(95, 50 + (combo.total_trades * 2)),
          recommendation: `Consider focusing more on trades that match this pattern. Your success rate with "${combo.tags.join(' + ')}" is significantly above average.`,
          severity: combo.win_rate > 80 ? 'high' : 'medium'
        });
      }
    });

    // Declining pattern insights
    decliningCombinations.forEach((combo, index) => {
      const winRateDecline = combo.historicalWinRate - combo.recentWinRate;
      if (winRateDecline > 15) {
        insights.push({
          type: 'declining_pattern',
          title: `Declining Pattern Alert`,
          description: `The combination "${combo.tags.join(' + ')}" has declined from ${combo.historicalWinRate.toFixed(1)}% to ${combo.recentWinRate.toFixed(1)}% win rate recently.`,
          tagCombination: combo.tags,
          win_rate: combo.recentWinRate,
          confidence: Math.min(90, 40 + (combo.total_trades * 3)),
          recommendation: `Review your approach with "${combo.tags.join(' + ')}" trades. Market conditions may have changed, requiring strategy adjustment.`,
          severity: winRateDecline > 25 ? 'high' : 'medium'
        });
      }
    });

    return insights;
  }

  /**
   * Generate market condition alerts based on tag patterns
   */
  private generateMarketConditionAlerts(
    combinations: TagCombination[], 
    allTrades: Trade[]
  ): TagPatternInsight[] {
    const alerts: TagPatternInsight[] = [];

    // Look for session-based patterns
    const sessionCombos = combinations.filter(combo => 
      combo.tags.some(tag => ['Asia', 'London', 'NY AM', 'NY PM'].includes(tag))
    );

    sessionCombos.forEach(combo => {
      if (combo.trend === 'declining' && combo.total_trades >= 5) {
        const sessionTag = combo.tags.find(tag => ['Asia', 'London', 'NY AM', 'NY PM'].includes(tag));
        if (sessionTag) {
          alerts.push({
            type: 'market_condition',
            title: `${sessionTag} Session Performance Decline`,
            description: `Your performance during ${sessionTag} session with "${combo.tags.filter(t => t !== sessionTag).join(' + ')}" has declined recently.`,
            tagCombination: combo.tags,
            win_rate: combo.recentWinRate,
            confidence: 75,
            recommendation: `Consider adjusting your strategy for ${sessionTag} session or reducing position sizes during this time until performance improves.`,
            severity: 'medium'
          });
        }
      }
    });

    return alerts.slice(0, 2); // Limit to 2 alerts to avoid overwhelming
  }

  /**
   * Get tag combination statistics for a specific combination
   */
  getTagCombinationStats(trades: Trade[], tags: string[]): TagCombination | null {
    const recentCutoff = subDays(new Date(), this.recentPeriodDays);
    const historicalCutoff = subDays(new Date(), this.historicalPeriodDays);

    const recentTrades = trades.filter(trade => isAfter(new Date(trade.trade_date), recentCutoff));
    const historicalTrades = trades.filter(trade => 
      isAfter(new Date(trade.trade_date), historicalCutoff) && 
      !isAfter(new Date(trade.trade_date), recentCutoff)
    );

    return this.analyzeTagCombination(tags, recentTrades, historicalTrades, trades);
  }
}

export const tagPatternService = new TagPatternService();
