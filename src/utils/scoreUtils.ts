import { Trade } from '../types/trade';
import { TradingPattern, ScoreSettings } from '../types/score';
import {
  calculateWinRate,
  calculateProfitFactor
} from './statsUtils';
import {
  getDay,
  subDays
} from 'date-fns';
import {
  DynamicRiskSettings,
  normalizeTradeAmount
} from './dynamicRiskUtils';

/**
 * Default scoring settings
 */
export const DEFAULT_SCORE_SETTINGS: ScoreSettings = {
  weights: {
    consistency: 40,
    riskManagement: 25,
    performance: 20,
    discipline: 15
  },
  thresholds: {
    minTradesForScore: 3,
    lookbackPeriod: 30,
    consistencyTolerance: 15
  },
  targets: {
    winRate: 60,
    profitFactor: 1.5,
    maxDrawdown: 5,
    avgRiskReward: 2.0
  },
  selectedTags: [],
  excludedTagsFromPatterns: []
};

/**
 * Calculate recommended score based on user's targets and settings
 * This provides a target score that represents good trading performance
 */
export const calculateRecommendedScore = (settings: ScoreSettings): number => {
  // Base score calculation based on targets
  // These are reasonable benchmarks for each component

  // Consistency: 75% is a good target for following patterns
  const consistencyTarget = 75;

  // Risk Management: Based on targets, calculate expected score
  const riskMgmtTarget = Math.min(85,
    // Win rate factor (60% target = 75 points, 70% = 85 points)
    (settings.targets.winRate / 60) * 75 +
    // Risk/reward factor (2.0 target = 10 points)
    Math.min(10, (settings.targets.avgRiskReward / 2.0) * 10)
  );

  // Performance: Based on profit factor and win rate targets
  const performanceTarget = Math.min(80,
    // Profit factor contribution (1.5 target = 60 points, 2.0 = 80 points)
    Math.min(60, (settings.targets.profitFactor / 1.5) * 60) +
    // Win rate contribution (60% = 20 points)
    Math.min(20, (settings.targets.winRate / 60) * 20)
  );

  // Discipline: 70% is a reasonable target for discipline metrics
  const disciplineTarget = 70;

  // Calculate weighted recommended score
  const recommendedScore = (
    (consistencyTarget * settings.weights.consistency) +
    (riskMgmtTarget * settings.weights.riskManagement) +
    (performanceTarget * settings.weights.performance) +
    (disciplineTarget * settings.weights.discipline)
  ) / 100;

  // Ensure the score is between 50-90 (reasonable range)
  return Math.max(50, Math.min(90, recommendedScore));
};



/**
 * Calculate trading pattern from historical trades
 */
export const calculateTradingPattern = (
  targetDate: Date,
  trades: Trade[],
  lookbackDays: number = 30,
  selectedTags?: string[],
  dynamicRiskSettings?: DynamicRiskSettings
): TradingPattern => {
  if (trades.length === 0) {
    return {
      preferredSessions: [],
      commonTags: [],
      avgTradesPerDay: 0,
      avgTradesPerWeek: 0,
      avgPositionSize: 0,
      avgRiskReward: 0,
      winRate: 0,
      profitFactor: 0,
      maxDrawdown: 0,
      tradingDays: []
    };
  }

  const cutoffDate = subDays(targetDate, lookbackDays);
  const recentTrades = trades.filter(trade => new Date(trade.date) >= cutoffDate);

  // Calculate session preferences
  const sessionCounts = recentTrades.reduce((acc, trade) => {
    if (trade.session) {
      acc[trade.session] = (acc[trade.session] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>); 

  const preferredSessions = Object.entries(sessionCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 2)
    .map(([session]) => session);

  // Calculate common tags (only from selected tags if provided)
  const tagCounts = recentTrades.reduce((acc, trade) => {
    if (trade.tags) {
      trade.tags.forEach(tag => {
        // Only count tags that are in selectedTags (if provided), otherwise count all tags
        if (!selectedTags || selectedTags.length === 0 || selectedTags.includes(tag)) {
          acc[tag] = (acc[tag] || 0) + 1;
        }
      });
    }
    return acc;
  }, {} as Record<string, number>);

  const commonTags = Object.entries(tagCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([tag]) => tag);

  // Calculate trading frequency
  const tradingDays = lookbackDays;
  const avgTradesPerDay = recentTrades.length / tradingDays;
  const avgTradesPerWeek = avgTradesPerDay * 7;

  // Calculate average position size (normalized for dynamic risk if settings provided)
  const avgPositionSize = recentTrades.length > 0
    ? dynamicRiskSettings
      ? recentTrades.reduce((sum, trade) => sum + normalizeTradeAmount(trade, trades, dynamicRiskSettings), 0) / recentTrades.length
      : Math.abs(recentTrades.reduce((sum, trade) => sum + trade.amount, 0)) / recentTrades.length
    : 0;

  // Calculate average risk/reward
  const riskRewardTrades = recentTrades.filter(trade => trade.riskToReward && trade.riskToReward > 0);
  const avgRiskReward = riskRewardTrades.length > 0
    ? riskRewardTrades.reduce((sum, trade) => sum + (trade.riskToReward || 0), 0) / riskRewardTrades.length
    : 0;

  // Calculate performance metrics
  const winRate = calculateWinRate(recentTrades);

  // Calculate profit factor with dynamic risk normalization if available
  const profitFactor = dynamicRiskSettings
    ? (() => {
        const normalizedTrades = recentTrades.map(trade => ({
          ...trade,
          amount: normalizeTradeAmount(trade, trades, dynamicRiskSettings)
        }));
        return calculateProfitFactor(normalizedTrades);
      })()
    : calculateProfitFactor(recentTrades);

  // Calculate max drawdown (normalized for dynamic risk if settings provided)
  let maxDrawdown = 0;
  let peak = 0;
  let runningPnL = 0;

  recentTrades.forEach(trade => {
    const tradeAmount = dynamicRiskSettings
      ? normalizeTradeAmount(trade, trades, dynamicRiskSettings)
      : trade.amount;
    runningPnL += tradeAmount;
    if (runningPnL > peak) {
      peak = runningPnL;
    }
    const drawdown = ((peak - runningPnL) / Math.max(peak, 1)) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  });

  // Calculate preferred trading days
  const dayOfWeekCounts = recentTrades.reduce((acc, trade) => {
    const dayOfWeek = getDay(new Date(trade.date));
    acc[dayOfWeek] = (acc[dayOfWeek] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const tradingDaysArray = Object.entries(dayOfWeekCounts)
    .filter(([, count]) => count >= avgTradesPerDay * 0.5) // Days with significant trading activity
    .map(([day]) => parseInt(day))
    .sort((a, b) => a - b);

  return {
    preferredSessions,
    commonTags,
    avgTradesPerDay,
    avgTradesPerWeek,
    avgPositionSize,
    avgRiskReward,
    winRate,
    profitFactor,
    maxDrawdown,
    tradingDays: tradingDaysArray
  };
};

/**
 * Calculate consistency score based on adherence to trading pattern
 */
export const calculateConsistencyScore = (
  trades: Trade[],
  pattern: TradingPattern,
  settings: ScoreSettings,
  allTrades?: Trade[],
  dynamicRiskSettings?: DynamicRiskSettings
): { score: number; factors: any } => {
  if (trades.length < settings.thresholds.minTradesForScore) {
    return {
      score: 0,
      factors: {
        sessionConsistency: 0,
        tagConsistency: 0,
        timingConsistency: 0,
        sizeConsistency: 0
      }
    };
  }

  // Session consistency
  const sessionTrades = trades.filter(trade => trade.session);
  const sessionConsistency = sessionTrades.length > 0 && pattern.preferredSessions.length > 0
    ? (sessionTrades.filter(trade => pattern.preferredSessions.includes(trade.session!)).length / sessionTrades.length) * 100
    : 50;

  // Tag consistency
  const tagTrades = trades.filter(trade => trade.tags && trade.tags.length > 0);
  const tagConsistency = tagTrades.length > 0 && pattern.commonTags.length > 0
    ? (tagTrades.filter(trade =>
        trade.tags!.some(tag => pattern.commonTags.includes(tag))
      ).length / tagTrades.length) * 100
    : 50;

  // Timing consistency (trading on preferred days)
  const timingConsistency = trades.length > 0 && pattern.tradingDays.length > 0
    ? (trades.filter(trade =>
        pattern.tradingDays.includes(getDay(new Date(trade.date)))
      ).length / trades.length) * 100
    : 50;

  // Size consistency (position sizing relative to pattern, normalized for dynamic risk)
  const avgTradeSize = trades.length > 0
    ? (dynamicRiskSettings && allTrades
      ? trades.reduce((sum, trade) => sum + normalizeTradeAmount(trade, allTrades, dynamicRiskSettings), 0) / trades.length
      : Math.abs(trades.reduce((sum, trade) => sum + trade.amount, 0)) / trades.length)
    : 0;
  const sizeDeviation = pattern.avgPositionSize > 0
    ? Math.abs(avgTradeSize - pattern.avgPositionSize) / pattern.avgPositionSize
    : 0;
    
  const sizeConsistency = Math.max(0, 100 - (sizeDeviation * 100));

  const factors = {
    sessionConsistency: isNaN(sessionConsistency) ? 50 : sessionConsistency,
    tagConsistency: isNaN(tagConsistency) ? 50 : tagConsistency,
    timingConsistency: isNaN(timingConsistency) ? 50 : timingConsistency,
    sizeConsistency: isNaN(sizeConsistency) ? 50 : sizeConsistency
  };

  const score = (factors.sessionConsistency + factors.tagConsistency + factors.timingConsistency + factors.sizeConsistency) / 4;

  return { score: isNaN(score) ? 0 : score, factors };
};

/**
 * Calculate risk management score
 */
export const calculateRiskManagementScore = (
  trades: Trade[],
  pattern: TradingPattern,
  settings: ScoreSettings,
  allTrades?: Trade[],
  dynamicRiskSettings?: DynamicRiskSettings
): { score: number; factors: any } => {
  if (trades.length < settings.thresholds.minTradesForScore) {
    return {
      score: 0,
      factors: {
        riskRewardRatio: 0,
        positionSizing: 0,
        maxDrawdownAdherence: 0,
        stopLossUsage: 0
      }
    };
  }

  // Risk/Reward ratio adherence
  const rrTrades = trades.filter(trade => trade.riskToReward && trade.riskToReward > 0);
  const avgRR = rrTrades.length > 0
    ? rrTrades.reduce((sum, trade) => sum + (trade.riskToReward || 0), 0) / rrTrades.length
    : 0;
  const rrDeviation = settings.targets.avgRiskReward > 0
    ? Math.abs(avgRR - settings.targets.avgRiskReward) / settings.targets.avgRiskReward
    : 0;
  const riskRewardRatio = avgRR > 0 ? Math.max(0, 100 - (rrDeviation * 100)) : 50;

  // Position sizing consistency (normalized for dynamic risk)
  const tradeSizes = dynamicRiskSettings && allTrades
    ? trades.map(trade => normalizeTradeAmount(trade, allTrades, dynamicRiskSettings))
    : trades.map(trade => Math.abs(trade.amount));
  const avgSize = tradeSizes.length > 0
    ? tradeSizes.reduce((sum, size) => sum + size, 0) / tradeSizes.length
    : 0;
  const sizeVariance = tradeSizes.length > 0
    ? tradeSizes.reduce((sum, size) => sum + Math.pow(size - avgSize, 2), 0) / tradeSizes.length
    : 0;
  const sizeStdDev = Math.sqrt(sizeVariance);
  const positionSizing = avgSize > 0
    ? Math.max(0, 100 - ((sizeStdDev / avgSize) * 100))
    : 50;

  // Max drawdown adherence (normalized for dynamic risk)
  let maxDrawdown = 0;
  let peak = 0;
  let runningPnL = 0;

  trades.forEach(trade => {
    const tradeAmount = dynamicRiskSettings && allTrades
      ? normalizeTradeAmount(trade, allTrades, dynamicRiskSettings)
      : trade.amount;
    runningPnL += tradeAmount;
    if (runningPnL > peak) {
      peak = runningPnL;
    }
    const drawdown = peak > 0 ? ((peak - runningPnL) / peak) * 100 : 0;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  });

  const maxDrawdownAdherence = maxDrawdown <= settings.targets.maxDrawdown
    ? 100
    : Math.max(0, 100 - ((maxDrawdown - settings.targets.maxDrawdown) * 10));

  // Stop loss usage (approximated by loss trades having reasonable sizes, normalized for dynamic risk)
  const lossTrades = trades.filter(trade => trade.type === 'loss');
  const avgLoss = lossTrades.length > 0
    ? (dynamicRiskSettings && allTrades
      ? Math.abs(lossTrades.reduce((sum, trade) => sum + normalizeTradeAmount(trade, allTrades, dynamicRiskSettings), 0)) / lossTrades.length
      : Math.abs(lossTrades.reduce((sum, trade) => sum + trade.amount, 0)) / lossTrades.length)
    : 0;
  const winTrades = trades.filter(trade => trade.type === 'win');
  const avgWin = winTrades.length > 0
    ? (dynamicRiskSettings && allTrades
      ? winTrades.reduce((sum, trade) => sum + normalizeTradeAmount(trade, allTrades, dynamicRiskSettings), 0) / winTrades.length
      : winTrades.reduce((sum, trade) => sum + trade.amount, 0) / winTrades.length)
    : 0;

  const stopLossUsage = avgWin > 0 && avgLoss > 0
    ? Math.min(100, (avgWin / avgLoss) * 50) // Reasonable win/loss ratio indicates stop loss usage
    : 50;

  const factors = {
    riskRewardRatio: isNaN(riskRewardRatio) ? 50 : riskRewardRatio,
    positionSizing: isNaN(positionSizing) ? 50 : positionSizing,
    maxDrawdownAdherence: isNaN(maxDrawdownAdherence) ? 50 : maxDrawdownAdherence,
    stopLossUsage: isNaN(stopLossUsage) ? 50 : stopLossUsage
  };

  const score = (factors.riskRewardRatio + factors.positionSizing + factors.maxDrawdownAdherence + factors.stopLossUsage) / 4;

  return { score: isNaN(score) ? 0 : score, factors };
};

/**
 * Calculate performance score based on consistency with historical performance
 */
export const calculatePerformanceScore = (
  trades: Trade[],
  pattern: TradingPattern,
  settings: ScoreSettings,
  allTrades?: Trade[],
  dynamicRiskSettings?: DynamicRiskSettings
): { score: number; factors: any } => {
  if (trades.length < settings.thresholds.minTradesForScore) {
    return {
      score: 0,
      factors: {
        winRateConsistency: 0,
        profitFactorStability: 0,
        returnsConsistency: 0,
        volatilityControl: 0
      }
    };
  }

  const currentWinRate = calculateWinRate(trades);

  // Calculate profit factor with dynamic risk normalization if available
  const currentProfitFactor = dynamicRiskSettings && allTrades
    ? (() => {
        const normalizedTrades = trades.map(trade => ({
          ...trade,
          amount: normalizeTradeAmount(trade, allTrades, dynamicRiskSettings)
        }));
        return calculateProfitFactor(normalizedTrades);
      })()
    : calculateProfitFactor(trades);

  // Win rate consistency
  const winRateDeviation = pattern.winRate > 0
    ? Math.abs(currentWinRate - pattern.winRate) / pattern.winRate
    : 0;
  const winRateConsistency = pattern.winRate > 0
    ? Math.max(0, 100 - (winRateDeviation * 100))
    : 50;

  // Profit factor stability
  const pfDeviation = pattern.profitFactor > 0
    ? Math.abs(currentProfitFactor - pattern.profitFactor) / pattern.profitFactor
    : 0;
  const profitFactorStability = pattern.profitFactor > 0
    ? Math.max(0, 100 - (pfDeviation * 100))
    : 50;

  // Returns consistency (daily returns variance, normalized for dynamic risk)
  const dailyReturns = dynamicRiskSettings && allTrades
    ? trades.map(trade => normalizeTradeAmount(trade, allTrades, dynamicRiskSettings))
    : trades.map(trade => trade.amount);
  const avgReturn = dailyReturns.length > 0
    ? dailyReturns.reduce((sum, ret) => sum + ret, 0) / dailyReturns.length
    : 0;
  const returnVariance = dailyReturns.length > 0
    ? dailyReturns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / dailyReturns.length
    : 0;
  const returnStdDev = Math.sqrt(returnVariance);
  const returnsConsistency = Math.abs(avgReturn) > 0
    ? Math.max(0, 100 - ((returnStdDev / Math.abs(avgReturn)) * 50))
    : 50;

  // Volatility control (based on drawdown patterns, normalized for dynamic risk)
  let maxDrawdown = 0;
  let peak = 0;
  let runningPnL = 0;

  trades.forEach(trade => {
    const tradeAmount = dynamicRiskSettings && allTrades
      ? normalizeTradeAmount(trade, allTrades, dynamicRiskSettings)
      : trade.amount;
    runningPnL += tradeAmount;
    if (runningPnL > peak) {
      peak = runningPnL;
    }
    const drawdown = peak > 0 ? ((peak - runningPnL) / peak) * 100 : 0;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  });

  const volatilityControl = pattern.maxDrawdown > 0 && maxDrawdown <= pattern.maxDrawdown * 1.2
    ? 100
    : pattern.maxDrawdown > 0
      ? Math.max(0, 100 - ((maxDrawdown - pattern.maxDrawdown) * 5))
      : 50;

  const factors = {
    winRateConsistency: isNaN(winRateConsistency) ? 50 : winRateConsistency,
    profitFactorStability: isNaN(profitFactorStability) ? 50 : profitFactorStability,
    returnsConsistency: isNaN(returnsConsistency) ? 50 : returnsConsistency,
    volatilityControl: isNaN(volatilityControl) ? 50 : volatilityControl
  };

  const score = (factors.winRateConsistency + factors.profitFactorStability + factors.returnsConsistency + factors.volatilityControl) / 4;

  return { score: isNaN(score) ? 0 : score, factors };
};

/**
 * Calculate discipline score based on trading behavior
 */
export const calculateDisciplineScore = (
  trades: Trade[],
  pattern: TradingPattern,
  settings: ScoreSettings,
  allTrades?: Trade[],
  dynamicRiskSettings?: DynamicRiskSettings
): { score: number; factors: any } => {
  if (trades.length < settings.thresholds.minTradesForScore) {
    return {
      score: 0,
      factors: {
        tradingPlanAdherence: 0,
        emotionalControl: 0,
        overtrading: 0,
        ruleFollowing: 0
      }
    };
  }

  // Trading plan adherence (based on session and tag consistency)
  const sessionTrades = trades.filter(trade => trade.session);
  const sessionAdherence = sessionTrades.length > 0 && pattern.preferredSessions.length > 0
    ? (trades.filter(trade =>
        trade.session && pattern.preferredSessions.includes(trade.session)
      ).length / sessionTrades.length) * 100
    : 50;

  const tagTrades = trades.filter(trade => trade.tags && trade.tags.length > 0);
  const tagAdherence = tagTrades.length > 0 && pattern.commonTags.length > 0
    ? (trades.filter(trade =>
        trade.tags && trade.tags.some(tag => pattern.commonTags.includes(tag))
      ).length / tagTrades.length) * 100
    : 50;

  const tradingPlanAdherence = (sessionAdherence + tagAdherence) / 2;

  // Emotional control (based on trade size consistency and revenge trading patterns, normalized for dynamic risk)
  const tradeSizes = dynamicRiskSettings && allTrades
    ? trades.map(trade => normalizeTradeAmount(trade, allTrades, dynamicRiskSettings))
    : trades.map(trade => Math.abs(trade.amount));
  const avgSize = tradeSizes.length > 0
    ? tradeSizes.reduce((sum, size) => sum + size, 0) / tradeSizes.length
    : 0;
  const sizeVariance = tradeSizes.length > 0
    ? tradeSizes.reduce((sum, size) => sum + Math.pow(size - avgSize, 2), 0) / tradeSizes.length
    : 0;
  const sizeCoeffVar = avgSize > 0 ? Math.sqrt(sizeVariance) / avgSize : 0;
  const emotionalControl = Math.max(0, 100 - (sizeCoeffVar * 200));

  // Overtrading detection
  const currentFrequency = trades.length / 30; // trades per day over last 30 days
  const expectedFrequency = pattern.avgTradesPerDay;
  const frequencyRatio = expectedFrequency > 0
    ? currentFrequency / expectedFrequency
    : currentFrequency / 0.1;
  const overtrading = frequencyRatio <= 1.5
    ? 100
    : Math.max(0, 100 - ((frequencyRatio - 1.5) * 50));

  // Rule following (based on having required fields filled)
  const rulesFollowed = trades.length > 0
    ? (trades.filter(trade =>
        trade.session &&
        trade.tags &&
        trade.tags.length > 0 &&
        (trade.riskToReward || trade.type === 'breakeven')
      ).length / trades.length) * 100
    : 0;

  const factors = {
    tradingPlanAdherence: isNaN(tradingPlanAdherence) ? 50 : tradingPlanAdherence,
    emotionalControl: isNaN(emotionalControl) ? 50 : emotionalControl,
    overtrading: isNaN(overtrading) ? 50 : overtrading,
    ruleFollowing: isNaN(rulesFollowed) ? 50 : rulesFollowed
  };

  const score = (factors.tradingPlanAdherence + factors.emotionalControl + factors.overtrading + factors.ruleFollowing) / 4;

  return { score: isNaN(score) ? 0 : score, factors };
};

/**
 * Generate recommendations based on score analysis
 */
export const generateRecommendations = (
  breakdown: any,
  pattern: TradingPattern,
  tagPatternAnalysis?: any
): { recommendations: string[]; strengths: string[]; weaknesses: string[] } => {
  const recommendations: string[] = [];
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  // Analyze consistency
  if (breakdown.consistency.score < 70) {
    if (breakdown.consistency.factors.sessionConsistency < 70) {
      recommendations.push("Focus on trading during your most profitable sessions");
      weaknesses.push("Inconsistent session timing");
    }
    if (breakdown.consistency.factors.tagConsistency < 70) {
      recommendations.push("Stick to your proven trading strategies and setups");
      weaknesses.push("Deviating from successful patterns");
    }
  } else {
    strengths.push("Consistent trading approach");
  }

  // Analyze risk management
  if (breakdown.riskManagement.score < 70) {
    if (breakdown.riskManagement.factors.maxDrawdownAdherence < 70) {
      recommendations.push("Reduce position sizes to control drawdown");
      weaknesses.push("Excessive drawdown risk");
    }
    if (breakdown.riskManagement.factors.riskRewardRatio < 70) {
      recommendations.push("Improve risk/reward ratios on your trades");
      weaknesses.push("Poor risk/reward management");
    }
  } else {
    strengths.push("Strong risk management");
  }

  // Analyze performance
  if (breakdown.performance.score < 70) {
    if (breakdown.performance.factors.winRateConsistency < 70) {
      recommendations.push("Focus on quality setups to maintain win rate");
      weaknesses.push("Declining win rate");
    }
  } else {
    strengths.push("Consistent performance");
  }

  // Analyze discipline
  if (breakdown.discipline.score < 70) {
    if (breakdown.discipline.factors.overtrading < 70) {
      recommendations.push("Reduce trading frequency and focus on quality");
      weaknesses.push("Overtrading detected");
    }
    if (breakdown.discipline.factors.emotionalControl < 70) {
      recommendations.push("Work on emotional control and position sizing");
      weaknesses.push("Emotional trading patterns");
    }
  } else {
    strengths.push("Good trading discipline");
  }

  // Add tag pattern insights to recommendations
  if (tagPatternAnalysis && tagPatternAnalysis.insights) {
    tagPatternAnalysis.insights.slice(0, 2).forEach((insight: any) => {
      if (insight.type === 'high_performance') {
        recommendations.push(`Focus on "${insight.tagCombination.join(' + ')}" pattern (${insight.winRate.toFixed(1)}% win rate)`);
        strengths.push(`Strong performance with ${insight.tagCombination.join(' + ')} combination`);
      } else if (insight.type === 'declining_pattern') {
        recommendations.push(`Review "${insight.tagCombination.join(' + ')}" strategy - performance declining`);
        weaknesses.push(`Declining performance in ${insight.tagCombination.join(' + ')} trades`);
      }
    });
  }

  return { recommendations, strengths, weaknesses };
};
