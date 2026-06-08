export type TaskType = 'market_research';

export type TaskStatus = 'active' | 'paused' | 'disabled';

export type Significance = 'low' | 'medium' | 'high';

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
 * `subscribed_assets` is the single source of user intent: broker-format
 * symbols (e.g. EURUSD, XAUUSD, BTCUSD) the user wants briefed. Results are
 * delivered from the shared `asset_research_pool` table — no per-user Gemini
 * calls. Required non-empty at save time.
 */
export interface MarketResearchConfig {
  frequency_minutes: AlertFrequency;
  min_significance: AlertMinSignificance;
  /** Broker-format symbols the user wants briefed (e.g. EURUSD, XAUUSD). */
  subscribed_assets: string[];
}

export type TaskConfig = MarketResearchConfig;

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
  createTask: (config: TaskConfig) => Promise<OrionTask | undefined>;
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
};

// Per-task accent color used for chips, card headers, and any task-scoped
// visual. Picked from Material's 400-level palette so it reads on both themes.
export const TASK_TYPE_COLORS: Record<TaskType, string> = {
  market_research: '#7C4DFF', // purple
};

export function buildDefaultConfigs(): Record<TaskType, TaskConfig> {
  return {
    market_research: {
      frequency_minutes: 60,
      min_significance: 'high',
      subscribed_assets: [],
    },
  };
}

