-- ============================================================
-- Orion Tasks: user-configured scheduled AI tasks
-- ============================================================

-- Task type enum
CREATE TYPE public.orion_task_type AS ENUM (
  'market_research',
  'daily_analysis',
  'weekly_review',
  'monthly_rollup'
);

-- Task status enum
CREATE TYPE public.orion_task_status AS ENUM (
  'active',
  'paused',
  'disabled'
);

-- Main tasks table
CREATE TABLE public.orion_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  calendar_id UUID NOT NULL REFERENCES public.calendars(id) ON DELETE CASCADE,
  task_type public.orion_task_type NOT NULL,
  status public.orion_task_status NOT NULL DEFAULT 'active',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT orion_tasks_config_is_object CHECK (jsonb_typeof(config) = 'object')
);

-- Indexes
CREATE INDEX idx_orion_tasks_user_id ON public.orion_tasks(user_id);
CREATE INDEX idx_orion_tasks_calendar_id ON public.orion_tasks(calendar_id);
CREATE INDEX idx_orion_tasks_status ON public.orion_tasks(status) WHERE status = 'active';
CREATE INDEX idx_orion_tasks_type_status ON public.orion_tasks(task_type, status);

-- RLS
ALTER TABLE public.orion_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tasks"
  ON public.orion_tasks FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own tasks"
  ON public.orion_tasks FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own tasks"
  ON public.orion_tasks FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own tasks"
  ON public.orion_tasks FOR DELETE
  USING (user_id = auth.uid());

-- Updated_at trigger (reuse pattern from ai_conversations)
CREATE OR REPLACE FUNCTION public.update_orion_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_orion_tasks_updated_at_trigger
  BEFORE UPDATE ON public.orion_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_orion_tasks_updated_at();

-- ============================================================
-- Orion Task Results: stored outputs from task executions
-- ============================================================

CREATE TABLE public.orion_task_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.orion_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  task_type public.orion_task_type NOT NULL,
  content_html TEXT NOT NULL,
  content_plain TEXT NOT NULL,
  significance TEXT CHECK (significance IN ('low', 'medium', 'high')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  group_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT orion_task_results_metadata_is_object CHECK (jsonb_typeof(metadata) = 'object')
);

-- Indexes
CREATE INDEX idx_orion_task_results_task_id ON public.orion_task_results(task_id);
CREATE INDEX idx_orion_task_results_user_id ON public.orion_task_results(user_id);
CREATE INDEX idx_orion_task_results_group_date ON public.orion_task_results(group_date DESC);
CREATE INDEX idx_orion_task_results_unread
  ON public.orion_task_results(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_orion_task_results_created_at ON public.orion_task_results(created_at DESC);
CREATE INDEX idx_orion_task_results_cleanup
  ON public.orion_task_results(created_at) WHERE created_at < NOW() - INTERVAL '30 days';

-- RLS
ALTER TABLE public.orion_task_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own task results"
  ON public.orion_task_results FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role can insert task results"
  ON public.orion_task_results FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own task results"
  ON public.orion_task_results FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own task results"
  ON public.orion_task_results FOR DELETE
  USING (user_id = auth.uid());

-- Auto-cleanup: delete results older than 30 days (daily at 3am UTC)
SELECT cron.schedule(
  'cleanup-orion-task-results',
  '0 3 * * *',
  $$DELETE FROM public.orion_task_results WHERE created_at < NOW() - INTERVAL '30 days';$$
);

COMMENT ON TABLE public.orion_tasks IS 'User-configured scheduled AI tasks (market research, daily analysis, etc.)';
COMMENT ON TABLE public.orion_task_results IS 'Stored outputs from Orion task executions, auto-cleaned after 30 days';
