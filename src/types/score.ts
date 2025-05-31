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
  period: 'daily' | 'weekly' | 'monthly';
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
    winRate: number;
    profitFactor: number;
    maxDrawdown: number;
    avgRiskReward: number;
  };
}

export interface TradingPattern {
  preferredSessions: string[];
  commonTags: string[];
  avgTradesPerDay: number;
  avgTradesPerWeek: number;
  avgPositionSize: number;
  avgRiskReward: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  tradingDays: number[]; // 0-6 (Sunday-Saturday)
}

export interface ScoreAnalysis {
  currentScore: ScoreMetrics;
  breakdown: ScoreBreakdown;
  pattern: TradingPattern;
  recommendations: string[];
  strengths: string[];
  weaknesses: string[];
  trend: 'improving' | 'declining' | 'stable';
}
