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
  }
};

/**
 * Calculate trading pattern from historical trades
 */
export const calculateTradingPattern = (trades: Trade[], lookbackDays: number = 30): TradingPattern => {
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

  const cutoffDate = subDays(new Date(), lookbackDays);
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

  // Calculate common tags
  const tagCounts = recentTrades.reduce((acc, trade) => {
    if (trade.tags) {
      trade.tags.forEach(tag => {
        acc[tag] = (acc[tag] || 0) + 1;
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

  // Calculate average position size
  const avgPositionSize = Math.abs(recentTrades.reduce((sum, trade) => sum + trade.amount, 0)) / recentTrades.length;

  // Calculate average risk/reward
  const riskRewardTrades = recentTrades.filter(trade => trade.riskToReward && trade.riskToReward > 0);
  const avgRiskReward = riskRewardTrades.length > 0 
    ? riskRewardTrades.reduce((sum, trade) => sum + (trade.riskToReward || 0), 0) / riskRewardTrades.length
    : 0;

  // Calculate performance metrics
  const winRate = calculateWinRate(recentTrades);
  const profitFactor = calculateProfitFactor(recentTrades);

  // Calculate max drawdown
  let maxDrawdown = 0;
  let peak = 0;
  let runningPnL = 0;

  recentTrades.forEach(trade => {
    runningPnL += trade.amount;
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
  settings: ScoreSettings
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
  const sessionConsistency = sessionTrades.length > 0 
    ? (sessionTrades.filter(trade => pattern.preferredSessions.includes(trade.session!)).length / sessionTrades.length) * 100
    : 50;

  // Tag consistency
  const tagTrades = trades.filter(trade => trade.tags && trade.tags.length > 0);
  const tagConsistency = tagTrades.length > 0
    ? (tagTrades.filter(trade => 
        trade.tags!.some(tag => pattern.commonTags.includes(tag))
      ).length / tagTrades.length) * 100
    : 50;

  // Timing consistency (trading on preferred days)
  const timingConsistency = trades.length > 0
    ? (trades.filter(trade => 
        pattern.tradingDays.includes(getDay(new Date(trade.date)))
      ).length / trades.length) * 100
    : 50;

  // Size consistency (position sizing relative to pattern)
  const avgTradeSize = Math.abs(trades.reduce((sum, trade) => sum + trade.amount, 0)) / trades.length;
  const sizeDeviation = Math.abs(avgTradeSize - pattern.avgPositionSize) / Math.max(pattern.avgPositionSize, 1);
  const sizeConsistency = Math.max(0, 100 - (sizeDeviation * 100));

  const factors = {
    sessionConsistency,
    tagConsistency,
    timingConsistency,
    sizeConsistency
  };

  const score = (sessionConsistency + tagConsistency + timingConsistency + sizeConsistency) / 4;

  return { score, factors };
};

/**
 * Calculate risk management score
 */
export const calculateRiskManagementScore = (
  trades: Trade[], 
  pattern: TradingPattern, 
  settings: ScoreSettings
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
  const rrDeviation = Math.abs(avgRR - settings.targets.avgRiskReward) / settings.targets.avgRiskReward;
  const riskRewardRatio = Math.max(0, 100 - (rrDeviation * 100));

  // Position sizing consistency
  const tradeSizes = trades.map(trade => Math.abs(trade.amount));
  const avgSize = tradeSizes.reduce((sum, size) => sum + size, 0) / tradeSizes.length;
  const sizeVariance = tradeSizes.reduce((sum, size) => sum + Math.pow(size - avgSize, 2), 0) / tradeSizes.length;
  const sizeStdDev = Math.sqrt(sizeVariance);
  const positionSizing = Math.max(0, 100 - ((sizeStdDev / avgSize) * 100));

  // Max drawdown adherence
  let maxDrawdown = 0;
  let peak = 0;
  let runningPnL = 0;

  trades.forEach(trade => {
    runningPnL += trade.amount;
    if (runningPnL > peak) {
      peak = runningPnL;
    }
    const drawdown = ((peak - runningPnL) / Math.max(peak, 1)) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  });

  const maxDrawdownAdherence = maxDrawdown <= settings.targets.maxDrawdown 
    ? 100 
    : Math.max(0, 100 - ((maxDrawdown - settings.targets.maxDrawdown) * 10));

  // Stop loss usage (approximated by loss trades having reasonable sizes)
  const lossTrades = trades.filter(trade => trade.type === 'loss');
  const avgLoss = lossTrades.length > 0 
    ? Math.abs(lossTrades.reduce((sum, trade) => sum + trade.amount, 0)) / lossTrades.length
    : 0;
  const winTrades = trades.filter(trade => trade.type === 'win');
  const avgWin = winTrades.length > 0 
    ? winTrades.reduce((sum, trade) => sum + trade.amount, 0) / winTrades.length
    : 0;
  
  const stopLossUsage = avgWin > 0 && avgLoss > 0 
    ? Math.min(100, (avgWin / avgLoss) * 50) // Reasonable win/loss ratio indicates stop loss usage
    : 50;

  const factors = {
    riskRewardRatio,
    positionSizing,
    maxDrawdownAdherence,
    stopLossUsage
  };

  const score = (riskRewardRatio + positionSizing + maxDrawdownAdherence + stopLossUsage) / 4;

  return { score, factors };
};

/**
 * Calculate performance score based on consistency with historical performance
 */
export const calculatePerformanceScore = (
  trades: Trade[],
  pattern: TradingPattern,
  settings: ScoreSettings
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
  const currentProfitFactor = calculateProfitFactor(trades);

  // Win rate consistency
  const winRateDeviation = Math.abs(currentWinRate - pattern.winRate) / Math.max(pattern.winRate, 1);
  const winRateConsistency = Math.max(0, 100 - (winRateDeviation * 100));

  // Profit factor stability
  const pfDeviation = Math.abs(currentProfitFactor - pattern.profitFactor) / Math.max(pattern.profitFactor, 1);
  const profitFactorStability = Math.max(0, 100 - (pfDeviation * 100));

  // Returns consistency (daily returns variance)
  const dailyReturns = trades.map(trade => trade.amount);
  const avgReturn = dailyReturns.reduce((sum, ret) => sum + ret, 0) / dailyReturns.length;
  const returnVariance = dailyReturns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / dailyReturns.length;
  const returnStdDev = Math.sqrt(returnVariance);
  const returnsConsistency = Math.max(0, 100 - ((returnStdDev / Math.max(Math.abs(avgReturn), 1)) * 50));

  // Volatility control (based on drawdown patterns)
  let maxDrawdown = 0;
  let peak = 0;
  let runningPnL = 0;

  trades.forEach(trade => {
    runningPnL += trade.amount;
    if (runningPnL > peak) {
      peak = runningPnL;
    }
    const drawdown = ((peak - runningPnL) / Math.max(peak, 1)) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  });

  const volatilityControl = maxDrawdown <= pattern.maxDrawdown * 1.2
    ? 100
    : Math.max(0, 100 - ((maxDrawdown - pattern.maxDrawdown) * 5));

  const factors = {
    winRateConsistency,
    profitFactorStability,
    returnsConsistency,
    volatilityControl
  };

  const score = (winRateConsistency + profitFactorStability + returnsConsistency + volatilityControl) / 4;

  return { score, factors };
};

/**
 * Calculate discipline score based on trading behavior
 */
export const calculateDisciplineScore = (
  trades: Trade[],
  pattern: TradingPattern,
  settings: ScoreSettings
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
  const sessionAdherence = trades.filter(trade =>
    trade.session && pattern.preferredSessions.includes(trade.session)
  ).length / Math.max(trades.filter(trade => trade.session).length, 1) * 100;

  const tagAdherence = trades.filter(trade =>
    trade.tags && trade.tags.some(tag => pattern.commonTags.includes(tag))
  ).length / Math.max(trades.filter(trade => trade.tags && trade.tags.length > 0).length, 1) * 100;

  const tradingPlanAdherence = (sessionAdherence + tagAdherence) / 2;

  // Emotional control (based on trade size consistency and revenge trading patterns)
  const tradeSizes = trades.map(trade => Math.abs(trade.amount));
  const avgSize = tradeSizes.reduce((sum, size) => sum + size, 0) / tradeSizes.length;
  const sizeVariance = tradeSizes.reduce((sum, size) => sum + Math.pow(size - avgSize, 2), 0) / tradeSizes.length;
  const sizeCoeffVar = Math.sqrt(sizeVariance) / avgSize;
  const emotionalControl = Math.max(0, 100 - (sizeCoeffVar * 200));

  // Overtrading detection
  const currentFrequency = trades.length / 30; // trades per day over last 30 days
  const expectedFrequency = pattern.avgTradesPerDay;
  const frequencyRatio = currentFrequency / Math.max(expectedFrequency, 0.1);
  const overtrading = frequencyRatio <= 1.5
    ? 100
    : Math.max(0, 100 - ((frequencyRatio - 1.5) * 50));

  // Rule following (based on having required fields filled)
  const rulesFollowed = trades.filter(trade =>
    trade.session &&
    trade.tags &&
    trade.tags.length > 0 &&
    (trade.riskToReward || trade.type === 'breakeven')
  ).length / trades.length * 100;

  const factors = {
    tradingPlanAdherence,
    emotionalControl,
    overtrading,
    ruleFollowing: rulesFollowed
  };

  const score = (tradingPlanAdherence + emotionalControl + overtrading + rulesFollowed) / 4;

  return { score, factors };
};

/**
 * Generate recommendations based on score analysis
 */
export const generateRecommendations = (
  breakdown: any,
  pattern: TradingPattern
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

  return { recommendations, strengths, weaknesses };
};
