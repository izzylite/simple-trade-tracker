import { Trade } from '../types/trade';
import {
  ScoreMetrics,
  ScoreBreakdown,
  ScoreHistory,
  ScoreSettings,
  ScoreAnalysis
} from '../types/score';
import {
  DEFAULT_SCORE_SETTINGS,
  calculateTradingPattern,
  calculateConsistencyScore,
  calculateRiskManagementScore,
  calculatePerformanceScore,
  calculateDisciplineScore,
  generateRecommendations
} from '../utils/scoreUtils';
import { DynamicRiskSettings } from '../utils/dynamicRiskUtils';
import { tagPatternService } from './tagPatternService';
import {
  subDays,
  subWeeks,
  subMonths,
  subYears,
  isSameDay,
  isSameWeek,
  isSameMonth,
  isSameYear
} from 'date-fns';

/**
 * Main score calculation service
 */
export class ScoreService {
  private settings: ScoreSettings;
  private dynamicRiskSettings?: DynamicRiskSettings;

  constructor(settings: ScoreSettings = DEFAULT_SCORE_SETTINGS) {
    this.settings = settings;
  }

  /**
   * Update dynamic risk settings for score calculations
   */
  updateDynamicRiskSettings(dynamicRiskSettings?: DynamicRiskSettings): void {
    this.dynamicRiskSettings = dynamicRiskSettings;
  }

  /**
   * Calculate comprehensive score analysis for a given period
   */
  async calculateScore(
    allTrades: Trade[],
    period: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'weekly',
    targetDate: Date = new Date(),
    scoreSettings: ScoreSettings = DEFAULT_SCORE_SETTINGS
  ): Promise<ScoreAnalysis> {
    // Filter trades for the target period
    const periodTrades = this.getTradesForPeriod(allTrades, period, targetDate);

    // Yield control to prevent UI blocking
    await new Promise(resolve => setTimeout(resolve, 0));

    // Calculate historical pattern from longer lookback period
    const historicalTrades = this.getHistoricalTrades(allTrades, targetDate);
    const pattern = calculateTradingPattern(targetDate, historicalTrades, this.settings.thresholds.lookbackPeriod, this.settings.selectedTags, this.dynamicRiskSettings);

    // Yield control again
    await new Promise(resolve => setTimeout(resolve, 0));

    // Calculate individual score components
    const consistency = calculateConsistencyScore(periodTrades, pattern, this.settings, allTrades, this.dynamicRiskSettings);
    const riskManagement = calculateRiskManagementScore(periodTrades, pattern, this.settings, allTrades, this.dynamicRiskSettings);
    const performance = calculatePerformanceScore(periodTrades, pattern, this.settings, allTrades, this.dynamicRiskSettings);
    const discipline = calculateDisciplineScore(periodTrades, pattern, this.settings, allTrades, this.dynamicRiskSettings);

    // Calculate overall score using weights
    const overall = (
      (consistency.score * this.settings.weights.consistency) +
      (riskManagement.score * this.settings.weights.riskManagement) +
      (performance.score * this.settings.weights.performance) +
      (discipline.score * this.settings.weights.discipline)
    ) / 100;

    // Ensure overall score is not NaN
    const finalOverall = isNaN(overall) ? 0 : overall;

    const currentScore: ScoreMetrics = {
      consistency: isNaN(consistency.score) ? 0 : consistency.score,
      riskManagement: isNaN(riskManagement.score) ? 0 : riskManagement.score,
      performance: isNaN(performance.score) ? 0 : performance.score,
      discipline: isNaN(discipline.score) ? 0 : discipline.score,
      overall: finalOverall
    };

    const breakdown: ScoreBreakdown = {
      consistency,
      riskManagement,
      performance,
      discipline
    };

    // Determine trend
    const trend = this.calculateTrend(allTrades, period, targetDate);

    // Calculate tag pattern analysis (only for sufficient data)
    const tagPatternAnalysis = allTrades.length >= 10
      ? tagPatternService.analyzeTagPatterns(allTrades, targetDate, scoreSettings)
      : undefined;

    // Generate recommendations (including tag pattern insights)
    const { recommendations, strengths, weaknesses } = generateRecommendations(breakdown, pattern, tagPatternAnalysis);

    return {
      currentScore,
      breakdown,
      pattern,
      recommendations,
      strengths,
      weaknesses,
      trend,
      tagPatternAnalysis
    };
  }

  /**
   * Get score history for a range of periods
   */
  async getScoreHistory(
    allTrades: Trade[],
    period: 'daily' | 'weekly' | 'monthly' | 'yearly',
    periodsBack: number = 12,
    scoreSettings: ScoreSettings = DEFAULT_SCORE_SETTINGS
  ): Promise<ScoreHistory[]> {
    const history: ScoreHistory[] = [];
    const today = new Date();

    for (let i = 0; i < periodsBack; i++) {
      let targetDate: Date;

      switch (period) {
        case 'daily':
          targetDate = subDays(today, i);
          break;
        case 'weekly':
          targetDate = subWeeks(today, i);
          break;
        case 'monthly':
          targetDate = subMonths(today, i);
          break;
        case 'yearly':
          targetDate = subYears(today, i);
          break;
      }

      const periodTrades = this.getTradesForPeriod(allTrades, period, targetDate);

      if (periodTrades.length >= this.settings.thresholds.minTradesForScore) {
        const analysis = await this.calculateScore(allTrades, period, targetDate, scoreSettings);

        history.push({
          date: targetDate,
          period,
          metrics: analysis.currentScore,
          breakdown: analysis.breakdown,
          tradeCount: periodTrades.length
        });
      }

      // Yield control periodically to prevent UI blocking
      if (i % 3 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    return history.reverse(); // Return chronological order
  }

  /**
   * Get trades for a specific period
   */
  private getTradesForPeriod(
    trades: Trade[],
    period: 'daily' | 'weekly' | 'monthly' | 'yearly',
    targetDate: Date
  ): Trade[] {
    return trades.filter(trade => {
      const tradeDate = new Date(trade.date);

      switch (period) {
        case 'daily':
          return isSameDay(tradeDate, targetDate);
        case 'weekly':
          return isSameWeek(tradeDate, targetDate, { weekStartsOn: 0 });
        case 'monthly':
          return isSameMonth(tradeDate, targetDate);
        case 'yearly':
          return isSameYear(tradeDate, targetDate);
        default:
          return false;
      }
    });
  }

  /**
   * Get historical trades for pattern calculation
   */
  private getHistoricalTrades(trades: Trade[], targetDate: Date): Trade[] {
    const cutoffDate = subDays(targetDate, this.settings.thresholds.lookbackPeriod);
    return trades.filter(trade => {
      const tradeDate = new Date(trade.date);
      return tradeDate >= cutoffDate && tradeDate <= targetDate;
    });
  }

  /**
   * Calculate trend based on recent score history
   */
  private calculateTrend(
    allTrades: Trade[],
    period: 'daily' | 'weekly' | 'monthly' | 'yearly',
    targetDate: Date
  ): 'improving' | 'declining' | 'stable' {
    try {
      // Get current period trades
      const currentTrades = this.getTradesForPeriod(allTrades, period, targetDate);

      // Get previous period date
      const previousDate = new Date(targetDate);
      switch (period) {
        case 'daily':
          previousDate.setDate(previousDate.getDate() - 1);
          break;
        case 'weekly':
          previousDate.setDate(previousDate.getDate() - 7);
          break;
        case 'monthly':
          previousDate.setMonth(previousDate.getMonth() - 1);
          break;
        case 'yearly':
          previousDate.setFullYear(previousDate.getFullYear() - 1);
          break;
      }

      // Get previous period trades
      const previousTrades = this.getTradesForPeriod(allTrades, period, previousDate);

      // Need at least some trades in both periods to calculate trend
      if (currentTrades.length < 2 || previousTrades.length < 2) {
        return 'stable';
      }

      // Calculate scores for both periods (without recursion by using a simple calculation)
      const currentScore = this.calculateSimpleScore(currentTrades);
      const previousScore = this.calculateSimpleScore(previousTrades);

      // Compare scores to determine trend
      const scoreDifference = currentScore - previousScore;
      const threshold = 5; // 5% threshold for trend detection

      if (scoreDifference > threshold) {
        return 'improving';
      } else if (scoreDifference < -threshold) {
        return 'declining';
      } else {
        return 'stable';
      }
    } catch (error) {
      console.error('Error calculating trend:', error);
      return 'stable';
    }
  }

  /**
   * Calculate a simple overall score without trend calculation (to avoid recursion)
   */
  private calculateSimpleScore(trades: Trade[]): number {
    if (trades.length === 0) return 0;

    // Simple calculation based on win rate and average return
    const wins = trades.filter(t => t.type === 'win').length;
    const winRate = (wins / trades.length) * 100;

    const totalPnL = trades.reduce((sum, t) => sum + t.amount, 0);
    const avgReturn = totalPnL / trades.length;

    // Combine win rate and average return for a simple score
    const returnScore = avgReturn > 0 ? Math.min(100, avgReturn * 10) : Math.max(0, 50 + avgReturn * 10);

    return (winRate + returnScore) / 2;
  }

  /**
   * Update score settings
   */
  updateSettings(newSettings: Partial<ScoreSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
  }

  /**
   * Get current settings
   */
  getSettings(): ScoreSettings {
    return { ...this.settings };
  }

  /**
   * Calculate score for multiple periods at once
   */
  async calculateMultiPeriodScore(allTrades: Trade[], targetDate: Date = new Date(), scoreSettings: ScoreSettings = DEFAULT_SCORE_SETTINGS): Promise<{
    daily: ScoreAnalysis;
    weekly: ScoreAnalysis;
    monthly: ScoreAnalysis;
    yearly: ScoreAnalysis;
  }> {
    const [daily, weekly, monthly, yearly] = await Promise.all([
      this.calculateScore(allTrades, 'daily', targetDate, scoreSettings),
      this.calculateScore(allTrades, 'weekly', targetDate, scoreSettings),
      this.calculateScore(allTrades, 'monthly', targetDate, scoreSettings),
      this.calculateScore(allTrades, 'yearly', targetDate, scoreSettings)
    ]);

    return {
      daily,
      weekly,
      monthly,
      yearly
    };
  }

  /**
   * Get score summary for dashboard
   */
  async getScoreSummary(allTrades: Trade[], scoreSettings: ScoreSettings = DEFAULT_SCORE_SETTINGS): Promise<{
    currentWeekly: ScoreMetrics;
    trend: 'improving' | 'declining' | 'stable';
    keyMetric: string;
    recommendation: string;
  }> {
    const weeklyAnalysis = await this.calculateScore(allTrades, 'weekly', new Date(), scoreSettings);

    // Find the lowest scoring component
    const scores = [
      { name: 'Consistency', value: weeklyAnalysis.currentScore.consistency },
      { name: 'Risk Management', value: weeklyAnalysis.currentScore.riskManagement },
      { name: 'Performance', value: weeklyAnalysis.currentScore.performance },
      { name: 'Discipline', value: weeklyAnalysis.currentScore.discipline }
    ];

    const lowestScore = scores.reduce((min, score) =>
      score.value < min.value ? score : min
    );

    const keyMetric = `${lowestScore.name}: ${lowestScore.value.toFixed(0)}%`;
    const recommendation = weeklyAnalysis.recommendations[0] || "Keep following your trading plan";

    return {
      currentWeekly: weeklyAnalysis.currentScore,
      trend: weeklyAnalysis.trend,
      keyMetric,
      recommendation
    };
  }
}

// Export singleton instance
export const scoreService = new ScoreService();
