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

export type TaskHandler = (
  task: OrionTask,
  supabase: SupabaseClient
) => Promise<TaskResult>;

export interface MarketResearchConfig {
  sessions: string[];
  checkpoints: string[];
  markets: string[];
  custom_topics: string[];
  instrument_aware: boolean;
}
