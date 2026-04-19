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
  sessions: string[];
  markets: string[];
  custom_topics: string[];
  instrument_aware: boolean;
  frequency_minutes: 15 | 30 | 60;
  min_significance: 'medium' | 'high';
}

export interface DailyAnalysisConfig {
  run_time_utc: string;
  tone: 'tough_love' | 'blunt_analyst' | 'supportive_mentor';
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
