export type TaskType =
  | 'market_research'
  | 'daily_analysis'
  | 'weekly_review'
  | 'monthly_rollup';

export type TaskStatus = 'active' | 'paused' | 'disabled';

export type Significance = 'low' | 'medium' | 'high';

export type TradingSession = 'asia' | 'london' | 'ny_am' | 'ny_pm';

export type CoachingTone = 'tough_love' | 'blunt_analyst' | 'supportive_mentor';

/**
 * Supported sweep cadences (minutes). Sub-hourly options were removed because
 * the 1h NEWS_CACHE_TTL kept cold-missing across consecutive runs, breaking
 * cross-user cache reuse. Anything ≥ 60 is safe — the cache TTL stays the
 * same regardless of frequency, so longer cadences just see more cache hits
 * (cheaper) and lower wall-clock cost (fewer scheduled runs).
 *
 * 60   = 1h (most responsive — every hour)
 * 120  = 2h
 * 180  = 3h
 * 240  = 4h
 * 360  = 6h
 * 1440 = 24h (once daily)
 *
 * Legacy 15/30 rows are upgraded to 60 by hydrateMarketResearchConfig and
 * by the cron migration (20260517110000_orion_tasks_hourly_only.sql).
 */
export type AlertFrequency = 60 | 120 | 180 | 240 | 360 | 1440;
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
 * `macro_queries` holds the user's picks from the DB-backed macro query
 * catalog (public.macro_query_catalog). Stored as query strings (not catalog
 * IDs) so the edge function runs them directly and renaming a catalog entry
 * never breaks a running task.
 */
export interface MarketResearchConfig {
  markets: string[];
  frequency_minutes: AlertFrequency;
  min_significance: AlertMinSignificance;
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

/**
 * Starter pack pre-populated into new market_research tasks. Five market-wide
 * queries from the catalog (is_market_wide=true) so they fire regardless of
 * which markets/watchlist the user picks. Gives new users immediate signal
 * on day 1 without needing to navigate the catalog.
 *
 * MUST stay in sync with corresponding entries in public.macro_query_catalog —
 * exact string match is required for cache reuse and catalog lookup. If you
 * rename a catalog entry here, update the matching query string in the DB
 * (or vice versa) or new tasks will fire uncached one-off strings.
 */
const MARKET_RESEARCH_STARTER_QUERIES = [
  'Federal Reserve OR FOMC speech statement policy today',
  'geopolitical tension war sanctions markets today',
  'White House OR US President statement market impact today',
  'US CPI inflation data release reaction today',
  'US Treasury yields bond market today',
];

export function buildDefaultConfigs(timezone: string): Record<TaskType, TaskConfig> {
  return {
    market_research: {
      markets: ['forex'],
      frequency_minutes: 60,
      min_significance: 'high',
      macro_queries: [...MARKET_RESEARCH_STARTER_QUERIES],
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

