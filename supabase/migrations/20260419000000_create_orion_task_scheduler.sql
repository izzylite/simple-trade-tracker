-- ============================================================
-- Orion Task Scheduler: next_run_at / last_run_at + auto-compute
-- ============================================================

-- Add scheduling columns
ALTER TABLE public.orion_tasks
  ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ;

-- Dispatcher polls on this predicate; partial index keeps it lean.
CREATE INDEX IF NOT EXISTS idx_orion_tasks_next_run_at
  ON public.orion_tasks (next_run_at)
  WHERE status = 'active';

-- ============================================================
-- Function: compute_orion_task_next_run_at
--
-- Given a task type and config JSONB, returns the next time the
-- task should fire (based on `p_from`, typically NOW()).
--
-- market_research: p_from + frequency_minutes
-- daily_analysis:  next occurrence of run_time_utc (UTC)
-- weekly_review:   next occurrence of run_day at run_time_utc
-- monthly_rollup:  last day of this month at run_time_utc (or next month)
-- ============================================================
CREATE OR REPLACE FUNCTION public.compute_orion_task_next_run_at(
  p_task_type TEXT,
  p_config JSONB,
  p_from TIMESTAMPTZ
) RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_freq_minutes INT;
  v_run_time TEXT;
  v_run_day INT;
  v_hh INT;
  v_mm INT;
  v_candidate TIMESTAMPTZ;
BEGIN
  IF p_task_type = 'market_research' THEN
    v_freq_minutes := COALESCE((p_config->>'frequency_minutes')::INT, 30);
    RETURN p_from + make_interval(mins => v_freq_minutes);

  ELSIF p_task_type = 'daily_analysis' THEN
    v_run_time := COALESCE(p_config->>'run_time_utc', '21:00');
    v_hh := split_part(v_run_time, ':', 1)::INT;
    v_mm := split_part(v_run_time, ':', 2)::INT;
    v_candidate := date_trunc('day', p_from AT TIME ZONE 'UTC')
                   + make_interval(hours => v_hh, mins => v_mm);
    IF v_candidate <= p_from THEN
      v_candidate := v_candidate + INTERVAL '1 day';
    END IF;
    RETURN v_candidate;

  ELSIF p_task_type = 'weekly_review' THEN
    -- run_day: 0=Sunday, 6=Saturday (matches JS Date.getDay())
    v_run_day := COALESCE((p_config->>'run_day')::INT, 6);
    v_run_time := COALESCE(p_config->>'run_time_utc', '09:00');
    v_hh := split_part(v_run_time, ':', 1)::INT;
    v_mm := split_part(v_run_time, ':', 2)::INT;
    v_candidate := date_trunc('day', p_from AT TIME ZONE 'UTC')
                   + ((v_run_day - EXTRACT(DOW FROM p_from AT TIME ZONE 'UTC')::INT + 7) % 7)
                     * INTERVAL '1 day'
                   + make_interval(hours => v_hh, mins => v_mm);
    IF v_candidate <= p_from THEN
      v_candidate := v_candidate + INTERVAL '7 days';
    END IF;
    RETURN v_candidate;

  ELSIF p_task_type = 'monthly_rollup' THEN
    v_run_time := COALESCE(p_config->>'run_time_utc', '21:00');
    v_hh := split_part(v_run_time, ':', 1)::INT;
    v_mm := split_part(v_run_time, ':', 2)::INT;
    -- Last day of current month at run_time_utc
    v_candidate := (date_trunc('month', p_from AT TIME ZONE 'UTC')
                    + INTERVAL '1 month' - INTERVAL '1 day')
                   + make_interval(hours => v_hh, mins => v_mm);
    IF v_candidate <= p_from THEN
      -- Last day of next month
      v_candidate := (date_trunc('month', p_from AT TIME ZONE 'UTC')
                      + INTERVAL '2 months' - INTERVAL '1 day')
                     + make_interval(hours => v_hh, mins => v_mm);
    END IF;
    RETURN v_candidate;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Trigger: set_orion_task_next_run_at
--
-- Runs BEFORE INSERT or UPDATE on orion_tasks. Populates next_run_at
-- whenever the row is new, the config changes, or the task_type changes.
-- Does NOT fire when only last_run_at changes (that's the dispatcher's
-- bulk path, which sets next_run_at explicitly).
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_orion_task_next_run_at()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.config IS DISTINCT FROM OLD.config
     OR NEW.task_type IS DISTINCT FROM OLD.task_type THEN
    NEW.next_run_at := public.compute_orion_task_next_run_at(
      NEW.task_type::TEXT,
      NEW.config,
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orion_tasks_set_next_run_at_trigger ON public.orion_tasks;
CREATE TRIGGER orion_tasks_set_next_run_at_trigger
  BEFORE INSERT OR UPDATE ON public.orion_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_orion_task_next_run_at();

-- ============================================================
-- RPC: advance_orion_tasks_next_run_at
--
-- Bulk-advances last_run_at/next_run_at for a list of task IDs.
-- Called by the dispatcher after parallel-invoking run-orion-task.
-- Using an RPC so the dispatcher makes ONE round-trip instead of N.
-- ============================================================
CREATE OR REPLACE FUNCTION public.advance_orion_tasks_next_run_at(
  p_task_ids UUID[]
) RETURNS VOID AS $$
BEGIN
  UPDATE public.orion_tasks
     SET last_run_at = NOW(),
         next_run_at = public.compute_orion_task_next_run_at(
                         task_type::TEXT,
                         config,
                         NOW()
                       )
   WHERE id = ANY(p_task_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service_role only (dispatcher uses service key)
REVOKE ALL ON FUNCTION public.advance_orion_tasks_next_run_at(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.advance_orion_tasks_next_run_at(UUID[]) TO service_role;

-- ============================================================
-- Backfill: set next_run_at for any existing active rows
-- ============================================================
UPDATE public.orion_tasks
   SET next_run_at = public.compute_orion_task_next_run_at(
                       task_type::TEXT,
                       config,
                       NOW()
                     )
 WHERE status = 'active'
   AND next_run_at IS NULL;

COMMENT ON FUNCTION public.compute_orion_task_next_run_at(TEXT, JSONB, TIMESTAMPTZ) IS
  'Returns the next scheduled fire time for an Orion task based on task_type and config.';
COMMENT ON FUNCTION public.advance_orion_tasks_next_run_at(UUID[]) IS
  'Dispatcher helper: bulk-advances last_run_at and next_run_at for completed tasks.';
