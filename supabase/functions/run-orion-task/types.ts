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

// Handler may return null to signal "no surprise detected, skip result write."
// The dispatcher treats null as a successful no-op run.
export type TaskHandler = (
  task: OrionTask,
  supabase: SupabaseClient
) => Promise<TaskResult | null>;

export interface MarketResearchConfig {
  markets: string[];
  /** Sweep cadence in minutes. Sub-hourly removed (broke cross-user cache
   *  reuse). Supported: 60 | 120 | 180 | 240 | 360 | 1440. The 1h cache TTL
   *  is safe at any cadence ≥ 60 — longer cadences just see more cache hits
   *  from other users firing within the TTL window. */
  frequency_minutes: 60 | 120 | 180 | 240 | 360 | 1440;
  min_significance: 'medium' | 'high';
  /** User-picked queries from the public.macro_query_catalog. Stored as raw
   *  strings (not catalog IDs) so the handler runs them directly and a
   *  catalog rename never breaks running tasks. Optional for legacy rows. */
  macro_queries?: string[];
  /** Yahoo symbols for price grounding, news queries, and economic-event
   *  currency filtering. UI requires non-empty at save time; handler caps
   *  at MAX_WATCHLIST_SIZE after merging with `markets` defaults. */
  watchlist_symbols?: string[];
}

