import { FOREX_MACRO_TEMPLATE } from '../config/researchTemplates';

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
 * `watchlist_symbols` is the single source of user intent: Yahoo symbols drive
 * price grounding, per-instrument news queries (via a symbol→readable-name
 * mapping), and economic-event currency filtering (via a symbol→currencies
 * mapping). Required non-empty at save time.
 *
 * Template fields (`template_id`, `macro_queries`) snapshot from a preset at
 * creation time. The user can edit any of them after picking; edits to the
 * original preset definition do not propagate back into existing tasks.
 */
export interface MarketResearchConfig {
  markets: string[];
  frequency_minutes: AlertFrequency;
  min_significance: AlertMinSignificance;
  template_id: string;
  macro_queries: string[];
  watchlist_symbols: string[];
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
  tone: CoachingTone;
}

export interface MonthlyRollupConfig {
  run_time_utc: string;
  timezone: string;
  comparison_months: number;
  tone: CoachingTone;
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

/**
 * Bundle of state and actions exposed by `useOrionTasks`. Passed around as a
 * single `aiTasks` prop so consumers don't have to thread 13 individual props.
 */
export interface AITasksBundle {
  tasks: OrionTask[];
  results: OrionTaskResult[];
  unreadCount: number;
  loading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  createTask: (taskType: TaskType, config: TaskConfig) => Promise<OrionTask | undefined>;
  updateTask: (
    taskId: string,
    updates: { status?: OrionTask['status']; config?: TaskConfig }
  ) => Promise<OrionTask | undefined>;
  deleteTask: (taskId: string) => Promise<void>;
  markRead: (resultId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  hideResult: (resultId: string) => Promise<void>;
  loadMore: () => Promise<void>;
  refetchTasks: () => Promise<void>;
  refetchResults: () => Promise<void>;
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

// Per-task accent color used for chips, card headers, and any task-scoped
// visual. Picked from Material's 400-level palette so it reads on both themes.
export const TASK_TYPE_COLORS: Record<TaskType, string> = {
  market_research: '#7C4DFF', // purple
  daily_analysis: '#29B6F6',  // cyan
  weekly_review: '#66BB6A',   // green
  monthly_rollup: '#EC407A',  // pink
};

export function buildDefaultConfigs(timezone: string): Record<TaskType, TaskConfig> {
  return {
    market_research: {
      markets: ['forex'],
      frequency_minutes: 30,
      min_significance: 'high',
      template_id: FOREX_MACRO_TEMPLATE.id,
      macro_queries: [...FOREX_MACRO_TEMPLATE.macro_queries],
      watchlist_symbols: [],
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
      tone: 'tough_love',
    },
    monthly_rollup: {
      run_time_utc: '21:00',
      timezone,
      comparison_months: 3,
      tone: 'tough_love',
    },
  };
}

/** @deprecated Use `buildDefaultConfigs(detectBrowserTimezone())` so time-based
 *  tasks pick up the user's local TZ instead of silently defaulting to UTC. */
export const DEFAULT_CONFIGS: Record<TaskType, TaskConfig> = buildDefaultConfigs('UTC');
