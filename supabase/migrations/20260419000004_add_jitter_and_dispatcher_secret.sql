-- ============================================================
-- (1) Add ±30-second jitter to market_research next_run_at
-- (2) Add HMAC-style shared-secret auth to the orion-dispatcher cron
-- ============================================================
--
-- Jitter: prevents thundering herd when many users are on the same
-- frequency (30 min default). Without jitter they all align on the
-- same 5-min dispatcher tick. Only market_research — daily/weekly/
-- monthly fire at user-configured exact times.
--
-- Dispatcher secret: stops unauthorised callers from triggering
-- dispatches. The secret is baked into the cron job command via a
-- literal. cron.job is only readable by service_role/postgres, so
-- the secret stays out of user-visible schemas.
--
-- IMPORTANT: replace the placeholder secret below with a real value
-- (e.g. `openssl rand -hex 32`) before running, and set the same
-- value as the ORION_DISPATCHER_SECRET env var on the dispatcher
-- edge function. The production DB already has a real value.
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
    -- Jitter: ±30 seconds to avoid thundering herd on shared schedules.
    RETURN p_from + make_interval(mins => v_freq_minutes)
                  + (random() * 60 - 30) * INTERVAL '1 second';

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
    v_candidate := (date_trunc('month', p_from AT TIME ZONE 'UTC')
                    + INTERVAL '1 month' - INTERVAL '1 day')
                   + make_interval(hours => v_hh, mins => v_mm);
    IF v_candidate <= p_from THEN
      v_candidate := (date_trunc('month', p_from AT TIME ZONE 'UTC')
                      + INTERVAL '2 months' - INTERVAL '1 day')
                     + make_interval(hours => v_hh, mins => v_mm);
    END IF;
    RETURN v_candidate;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Re-schedule the dispatcher cron with a secret header.
-- cron.job is only readable by postgres/service_role, so the literal
-- below is safe from normal user queries.
SELECT cron.unschedule('orion-dispatcher') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'orion-dispatcher'
);

SELECT cron.schedule(
  'orion-dispatcher',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://gwubzauelilziaqnsfac.supabase.co/functions/v1/dispatch-orion-tasks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Orion-Dispatcher-Secret', 'REPLACE_WITH_GENERATED_SECRET'
    ),
    body := '{}'::jsonb
  );
  $$
);
