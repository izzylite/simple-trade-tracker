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
import {
  subDays,
  subWeeks,
  subMonths,
  isSameDay,
  isSameWeek,
  isSameMonth
} from 'date-fns';

/**
 * Main score calculation service
 */
export class ScoreService {
  private settings: ScoreSettings;

  constructor(settings: ScoreSettings = DEFAULT_SCORE_SETTINGS) {
    this.settings = settings;
  }

  /**
   * Calculate comprehensive score analysis for a given period
   */
  calculateScore(
    allTrades: Trade[], 
    period: 'daily' | 'weekly' | 'monthly' = 'weekly',
    targetDate: Date = new Date()
  ): ScoreAnalysis {
    // Filter trades for the target period
    const periodTrades = this.getTradesForPeriod(allTrades, period, targetDate);
    
    // Calculate historical pattern from longer lookback period
    const historicalTrades = this.getHistoricalTrades(allTrades, targetDate);
    const pattern = calculateTradingPattern(historicalTrades, this.settings.thresholds.lookbackPeriod);

    // Calculate individual score components
    const consistency = calculateConsistencyScore(periodTrades, pattern, this.settings);
    const riskManagement = calculateRiskManagementScore(periodTrades, pattern, this.settings);
    const performance = calculatePerformanceScore(periodTrades, pattern, this.settings);
    const discipline = calculateDisciplineScore(periodTrades, pattern, this.settings);

    // Calculate overall score using weights
    const overall = (
      (consistency.score * this.settings.weights.consistency) +
      (riskManagement.score * this.settings.weights.riskManagement) +
      (performance.score * this.settings.weights.performance) +
      (discipline.score * this.settings.weights.discipline)
    ) / 100;

    const currentScore: ScoreMetrics = {
      consistency: consistency.score,
      riskManagement: riskManagement.score,
      performance: performance.score,
      discipline: discipline.score,
      overall
    };

    const breakdown: ScoreBreakdown = {
      consistency,
      riskManagement,
      performance,
      discipline
    };

    // Generate recommendations
    const { recommendations, strengths, weaknesses } = generateRecommendations(breakdown, pattern);

    // Determine trend
    const trend = this.calculateTrend(allTrades, period, targetDate);

    return {
      currentScore,
      breakdown,
      pattern,
      recommendations,
      strengths,
      weaknesses,
      trend
    };
  }

  /**
   * Get score history for a range of periods
   */
  getScoreHistory(
    allTrades: Trade[], 
    period: 'daily' | 'weekly' | 'monthly',
    periodsBack: number = 12
  ): ScoreHistory[] {
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
      }

      const periodTrades = this.getTradesForPeriod(allTrades, period, targetDate);
      
      if (periodTrades.length >= this.settings.thresholds.minTradesForScore) {
        const analysis = this.calculateScore(allTrades, period, targetDate);
        
        history.push({
          date: targetDate,
          period,
          metrics: analysis.currentScore,
          breakdown: analysis.breakdown,
          tradeCount: periodTrades.length
        });
      }
    }

    return history.reverse(); // Return chronological order
  }

  /**
   * Get trades for a specific period
   */
  private getTradesForPeriod(
    trades: Trade[],
    period: 'daily' | 'weekly' | 'monthly',
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
    period: 'daily' | 'weekly' | 'monthly', 
    targetDate: Date
  ): 'improving' | 'declining' | 'stable' {
    const history = this.getScoreHistory(allTrades, period, 4);
    
    if (history.length < 3) {
      return 'stable';
    }

    const recentScores = history.slice(-3).map(h => h.metrics.overall);
    const trend = recentScores[2] - recentScores[0];

    if (trend > 5) {
      return 'improving';
    } else if (trend < -5) {
      return 'declining';
    } else {
      return 'stable';
    }
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
  calculateMultiPeriodScore(allTrades: Trade[], targetDate: Date = new Date()): {
    daily: ScoreAnalysis;
    weekly: ScoreAnalysis;
    monthly: ScoreAnalysis;
  } {
    return {
      daily: this.calculateScore(allTrades, 'daily', targetDate),
      weekly: this.calculateScore(allTrades, 'weekly', targetDate),
      monthly: this.calculateScore(allTrades, 'monthly', targetDate)
    };
  }

  /**
   * Get score summary for dashboard
   */
  getScoreSummary(allTrades: Trade[]): {
    currentWeekly: ScoreMetrics;
    trend: 'improving' | 'declining' | 'stable';
    keyMetric: string;
    recommendation: string;
  } {
    const weeklyAnalysis = this.calculateScore(allTrades, 'weekly');
    
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
