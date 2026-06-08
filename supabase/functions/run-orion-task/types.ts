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

// Handler may return null to suppress storage — used by market_research when
// a sweep finishes below the user-configured significance threshold so the
// user isn't spammed on quiet intervals. The dispatcher treats null as a
// successful no-op run.
export type TaskHandler = (
  task: OrionTask,
  supabase: SupabaseClient
) => Promise<TaskResult | null>;

/**
 * Config stored in orion_tasks.config for market_research tasks.
 *
 * `subscribed_assets` holds broker-format symbols (e.g. EURUSD, XAUUSD,
 * BTCUSD) the user wants monitored. Results are delivered from the shared
 * `asset_research_pool` table — no per-user Gemini calls. Required
 * non-empty at save time.
 *
 * Sweep cadence in minutes. Sub-hourly removed (broke cross-user cache
 * reuse). Supported: 60 | 120 | 180 | 240 | 360 | 1440. The 1h cache TTL
 * is safe at any cadence ≥ 60 — longer cadences just see more cache hits
 * from other users firing within the TTL window.
 */
export interface MarketResearchConfig {
  frequency_minutes: 60 | 120 | 180 | 240 | 360 | 1440;
  min_significance: 'medium' | 'high';
  subscribed_assets: string[];
}

