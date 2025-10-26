export interface ScoreMetrics {
  consistency: number; // 0-100
  riskManagement: number; // 0-100
  performance: number; // 0-100
  discipline: number; // 0-100
  overall: number; // 0-100
}

export interface ScoreBreakdown {
  consistency: {
    score: number;
    factors: {
      sessionConsistency: number;
      tagConsistency: number;
      timingConsistency: number;
      sizeConsistency: number;
    };
  };
  riskManagement: {
    score: number;
    factors: {
      riskRewardRatio: number;
      positionSizing: number;
      maxDrawdownAdherence: number;
      stopLossUsage: number;
    };
  };
  performance: {
    score: number;
    factors: {
      winRateConsistency: number;
      profitFactorStability: number;
      returnsConsistency: number;
      volatilityControl: number;
    };
  };
  discipline: {
    score: number;
    factors: {
      tradingPlanAdherence: number;
      emotionalControl: number;
      overtrading: number;
      ruleFollowing: number;
    };
  };
}

export interface ScoreHistory {
  date: Date;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  metrics: ScoreMetrics;
  breakdown: ScoreBreakdown;
  tradeCount: number;
  notes?: string;
}

export interface ScoreSettings {
  weights: {
    consistency: number;
    riskManagement: number;
    performance: number;
    discipline: number;
  };
  thresholds: {
    minTradesForScore: number;
    lookbackPeriod: number; // days
    consistencyTolerance: number; // percentage
  };
  targets: {
    win_rate: number;
    profit_factor: number;
    max_drawdown: number;
    avgRiskReward: number;
  };
  selectedTags?: string[];
  excludedTagsFromPatterns?: string[]; // Tags to exclude from pattern analysis
}

export interface TradingPattern {
  preferredSessions: string[];
  commonTags: string[];
  avgTradesPerDay: number;
  avgTradesPerWeek: number;
  avgPositionSize: number;
  avgRiskReward: number;
  win_rate: number;
  profit_factor: number;
  max_drawdown: number;
  tradingDays: number[]; // 0-6 (Sunday-Saturday)
}

export interface TagCombination {
  tags: string[];
  win_rate: number;
  total_trades: number;
  wins: number;
  losses: number;
  total_pnl: number;
  avgPnL: number;
  trend: 'improving' | 'declining' | 'stable';
  recentWinRate: number; // Win rate in recent period
  historicalWinRate: number; // Win rate in historical period
}

export interface TagPatternInsight {
  type: 'high_performance' | 'declining_pattern' | 'market_condition';
  title: string;
  description: string;
  tagCombination: string[];
  win_rate: number;
  confidence: number; // 0-100
  recommendation: string;
  severity: 'low' | 'medium' | 'high';
}

export interface TagPatternAnalysis {
  insights: TagPatternInsight[];
  topCombinations: TagCombination[];
  decliningCombinations: TagCombination[];
  marketConditionAlerts: TagPatternInsight[];
}

export interface ScoreAnalysis {
  currentScore: ScoreMetrics;
  breakdown: ScoreBreakdown;
  pattern: TradingPattern;
  recommendations: string[];
  strengths: string[];
  weaknesses: string[];
  trend: 'improving' | 'declining' | 'stable';
  tagPatternAnalysis?: TagPatternAnalysis;
}
