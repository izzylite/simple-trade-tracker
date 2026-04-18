export type TaskType =
  | 'market_research'
  | 'daily_analysis'
  | 'weekly_review'
  | 'monthly_rollup';

export type TaskStatus = 'active' | 'paused' | 'disabled';

export type Significance = 'low' | 'medium' | 'high';

export type TradingSession = 'asia' | 'london' | 'ny_am' | 'ny_pm';

export type SessionCheckpoint = 'start' | 'mid' | 'end';

export type CoachingTone = 'tough_love' | 'blunt_analyst' | 'supportive_mentor';

export interface MarketResearchConfig {
  sessions: TradingSession[];
  checkpoints: SessionCheckpoint[];
  markets: string[];
  custom_topics: string[];
  instrument_aware: boolean;
}

export interface DailyAnalysisConfig {
  run_time_utc: string;
  tone: CoachingTone;
}

export interface WeeklyReviewConfig {
  run_day: number;
  run_time_utc: string;
  comparison_weeks: number;
}

export interface MonthlyRollupConfig {
  run_time_utc: string;
  comparison_months: number;
}

export type TaskConfig =
  | MarketResearchConfig
  | DailyAnalysisConfig
  | WeeklyReviewConfig
  | MonthlyRollupConfig;

export interface OrionTask {
  id: string;
  user_id: string;
  calendar_id: string;
  task_type: TaskType;
  status: TaskStatus;
  config: TaskConfig;
  created_at: string;
  updated_at: string;
}

export interface OrionTaskResult {
  id: string;
  task_id: string;
  user_id: string;
  task_type: TaskType;
  content_html: string;
  content_plain: string;
  significance: Significance | null;
  metadata: Record<string, unknown>;
  group_date: string;
  is_read: boolean;
  created_at: string;
}

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  market_research: 'Market Research',
  daily_analysis: 'Daily Analysis',
  weekly_review: 'Weekly Review',
  monthly_rollup: 'Monthly Rollup',
};

export const DEFAULT_CONFIGS: Record<TaskType, TaskConfig> = {
  market_research: {
    sessions: ['london', 'ny_am'],
    checkpoints: ['start', 'end'],
    markets: ['forex'],
    custom_topics: [],
    instrument_aware: true,
  },
  daily_analysis: {
    run_time_utc: '21:00',
    tone: 'tough_love',
  },
  weekly_review: {
    run_day: 6,
    run_time_utc: '09:00',
    comparison_weeks: 4,
  },
  monthly_rollup: {
    run_time_utc: '21:00',
    comparison_months: 3,
  },
};
