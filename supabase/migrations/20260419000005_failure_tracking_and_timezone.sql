-- ============================================================
-- Orion Tasks: failure tracking + timezone-aware scheduling
-- ============================================================

-- Failure tracking columns
ALTER TABLE public.orion_tasks
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consecutive_failures INT NOT NULL DEFAULT 0;

-- Enable realtime so UI can reflect failure state as it changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.orion_tasks;

-- ============================================================
-- Updated compute_orion_task_next_run_at: honor config->>'timezone'
--
-- Interprets run_time_utc as wall-clock time in the task's timezone
-- (defaults to 'UTC' when missing — backward compatible with existing rows).
-- DST is handled automatically by PostgreSQL's IANA tz database.
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
  v_tz TEXT;
  v_hh INT;
  v_mm INT;
  v_candidate TIMESTAMPTZ;
  v_naive TIMESTAMP;
BEGIN
  IF p_task_type = 'market_research' THEN
    v_freq_minutes := COALESCE((p_config->>'frequency_minutes')::INT, 30);
    -- Jitter: ±30s to prevent thundering herd (see plan 6 for rationale).
    RETURN p_from + make_interval(mins => v_freq_minutes)
                  + (random() * 60 - 30) * INTERVAL '1 second';

  ELSIF p_task_type = 'daily_analysis' THEN
    v_tz       := COALESCE(p_config->>'timezone', 'UTC');
    v_run_time := COALESCE(p_config->>'run_time_utc', '21:00');
    v_hh       := split_part(v_run_time, ':', 1)::INT;
    v_mm       := split_part(v_run_time, ':', 2)::INT;
    -- Wall-clock: "today at HH:MM in v_tz"
    v_naive := date_trunc('day', p_from AT TIME ZONE v_tz)
               + make_interval(hours => v_hh, mins => v_mm);
    v_candidate := v_naive AT TIME ZONE v_tz;
    IF v_candidate <= p_from THEN
      v_candidate := (v_naive + INTERVAL '1 day') AT TIME ZONE v_tz;
    END IF;
    RETURN v_candidate;

  ELSIF p_task_type = 'weekly_review' THEN
    v_tz       := COALESCE(p_config->>'timezone', 'UTC');
    v_run_day  := COALESCE((p_config->>'run_day')::INT, 6);
    v_run_time := COALESCE(p_config->>'run_time_utc', '09:00');
    v_hh       := split_part(v_run_time, ':', 1)::INT;
    v_mm       := split_part(v_run_time, ':', 2)::INT;
    v_naive := date_trunc('day', p_from AT TIME ZONE v_tz)
               + ((v_run_day - EXTRACT(DOW FROM p_from AT TIME ZONE v_tz)::INT + 7) % 7)
                 * INTERVAL '1 day'
               + make_interval(hours => v_hh, mins => v_mm);
    v_candidate := v_naive AT TIME ZONE v_tz;
    IF v_candidate <= p_from THEN
      v_candidate := (v_naive + INTERVAL '7 days') AT TIME ZONE v_tz;
    END IF;
    RETURN v_candidate;

  ELSIF p_task_type = 'monthly_rollup' THEN
    v_tz       := COALESCE(p_config->>'timezone', 'UTC');
    v_run_time := COALESCE(p_config->>'run_time_utc', '21:00');
    v_hh       := split_part(v_run_time, ':', 1)::INT;
    v_mm       := split_part(v_run_time, ':', 2)::INT;
    -- Last day of current month in v_tz at HH:MM
    v_naive := (date_trunc('month', p_from AT TIME ZONE v_tz)
                + INTERVAL '1 month' - INTERVAL '1 day')
               + make_interval(hours => v_hh, mins => v_mm);
    v_candidate := v_naive AT TIME ZONE v_tz;
    IF v_candidate <= p_from THEN
      v_naive := (date_trunc('month', p_from AT TIME ZONE v_tz)
                  + INTERVAL '2 months' - INTERVAL '1 day')
                 + make_interval(hours => v_hh, mins => v_mm);
      v_candidate := v_naive AT TIME ZONE v_tz;
    END IF;
    RETURN v_candidate;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.compute_orion_task_next_run_at(TEXT, JSONB, TIMESTAMPTZ) IS
  'Returns next fire time. For time-based task types, interprets run_time_utc as wall-clock time in config.timezone (IANA, default UTC).';
COMMENT ON COLUMN public.orion_tasks.consecutive_failures IS
  'Reset to 0 on successful run, incremented on handler error. Drives UI warning badge.';
