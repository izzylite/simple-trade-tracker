import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type SupabaseClient = ReturnType<typeof createClient>;

export interface OrionTask {
  id: string;
  user_id: string;
  calendar_id: string;
  task_type: string;
  status: string;
  config: Record<string, unknown>;
}

export interface TaskResult {
  content_html: string;
  content_plain: string;
  significance: 'low' | 'medium' | 'high' | null;
  metadata: Record<string, unknown>;
}

// Handlers may return `null` to suppress storage — used by market_research
// when a sweep finishes below the configured significance threshold so the
// user isn't spammed on quiet intervals.
export type TaskHandler = (
  task: OrionTask,
  supabase: SupabaseClient
) => Promise<TaskResult | null>;

export interface MarketResearchConfig {
  markets: string[];
  frequency_minutes: 15 | 30 | 60;
  min_significance: 'medium' | 'high';
  // Template snapshot fields. Optional so legacy rows (pre-template) still
  // typecheck — the handler falls back to hardcoded defaults when absent.
  template_id?: string;
  macro_queries?: string[];
  /** Yahoo symbols for price grounding, news queries, and economic-event
   *  currency filtering. UI requires non-empty at save time; handler caps
   *  at MAX_WATCHLIST_SIZE after merging with `markets` defaults. */
  watchlist_symbols?: string[];
}

export type OrionTone = 'tough_love' | 'blunt_analyst' | 'supportive_mentor';

export interface DailyAnalysisConfig {
  run_time_utc: string;
  tone: OrionTone;
}

export interface WeeklyReviewConfig {
  run_day: number;
  run_time_utc: string;
  comparison_weeks: number;
  tone: OrionTone;
}

export interface MonthlyRollupConfig {
  run_time_utc: string;
  comparison_months: number;
  tone: OrionTone;
}
