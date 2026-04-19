export type TaskType =
  | 'market_research'
  | 'daily_analysis'
  | 'weekly_review'
  | 'monthly_rollup';

export type TaskStatus = 'active' | 'paused' | 'disabled';

export type Significance = 'low' | 'medium' | 'high';

export type TradingSession = 'asia' | 'london' | 'ny_am' | 'ny_pm';

export type CoachingTone = 'tough_love' | 'blunt_analyst' | 'supportive_mentor';

export type AlertFrequency = 15 | 30 | 60;
export type AlertMinSignificance = 'medium' | 'high';

/**
 * Market Research is a continuous surprise monitor, not a scheduled digest.
 * It runs every `frequency_minutes` and only posts a result when a catalyst
 * clears `min_significance` — central-bank surprise, political statement,
 * geopolitical shock, unexpected data, commodity disruption, etc.
 *
 * `sessions` is a context filter: it narrows which regional news and which
 * currencies from the economic calendar are prioritised in the search. It
 * does NOT control when the task fires.
 */
export interface MarketResearchConfig {
  sessions: TradingSession[];
  markets: string[];
  custom_topics: string[];
  instrument_aware: boolean;
  frequency_minutes: AlertFrequency;
  min_significance: AlertMinSignificance;
}

export interface DailyAnalysisConfig {
  /** Wall-clock run time (HH:MM) interpreted in `timezone`. Field kept as
   *  `run_time_utc` for backward compatibility with existing rows. */
  run_time_utc: string;
  /** IANA timezone name (e.g. "Europe/London"). Defaults to "UTC" on legacy rows. */
  timezone: string;
  tone: CoachingTone;
}

export interface WeeklyReviewConfig {
  run_day: number;
  run_time_utc: string;
  timezone: string;
  comparison_weeks: number;
}

export interface MonthlyRollupConfig {
  run_time_utc: string;
  timezone: string;
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
  /** Most recent handler error message (truncated to 500 chars). null when healthy. */
  last_error: string | null;
  last_error_at: string | null;
  /** Count of consecutive failed runs; resets to 0 after a successful run. */
  consecutive_failures: number;
}

/** Returns the IANA timezone the browser reports, falling back to UTC. */
export function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
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
  /** Soft-delete timestamp. When set, result is hidden from feed but still
   *  feeds Orion's dedup context so the same catalyst isn't re-reported. */
  hidden_at: string | null;
  created_at: string;
}

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  market_research: 'Market Research',
  daily_analysis: 'Daily Analysis',
  weekly_review: 'Weekly Review',
  monthly_rollup: 'Monthly Rollup',
};

export function buildDefaultConfigs(timezone: string): Record<TaskType, TaskConfig> {
  return {
    market_research: {
      sessions: ['london', 'ny_am'],
      markets: ['forex'],
      custom_topics: [],
      instrument_aware: true,
      frequency_minutes: 30,
      min_significance: 'high',
    },
    daily_analysis: {
      run_time_utc: '21:00',
      timezone,
      tone: 'tough_love',
    },
    weekly_review: {
      run_day: 6,
      run_time_utc: '09:00',
      timezone,
      comparison_weeks: 4,
    },
    monthly_rollup: {
      run_time_utc: '21:00',
      timezone,
      comparison_months: 3,
    },
  };
}

/** @deprecated Use `buildDefaultConfigs(detectBrowserTimezone())` so time-based
 *  tasks pick up the user's local TZ instead of silently defaulting to UTC. */
export const DEFAULT_CONFIGS: Record<TaskType, TaskConfig> = buildDefaultConfigs('UTC');
