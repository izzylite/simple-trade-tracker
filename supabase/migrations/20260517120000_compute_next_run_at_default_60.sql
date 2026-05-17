-- Align compute_orion_task_next_run_at's defensive COALESCE default with
-- the new supported minimum cadence.
--
-- Background: AlertFrequency was tightened in the catalog-driven refactor to
-- 60 | 120 | 180 | 240 | 360 | 1440. The function still defaulted a missing
-- frequency_minutes field to 30, which is now an unsupported value. In
-- practice this fallback never fires (every existing row has the field set
-- by either the form or the prior hourly-only migration), but the stale
-- default could schedule a corrupted/manually-inserted row at 30 min and
-- trip the staleness guard in market-research.ts. Aligning to 60 keeps the
-- defensive path consistent with the new minimum.
--
-- Single-line change inside the function body; everything else preserved
-- verbatim from migration 20260419000000.

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
    -- Default aligned with AlertFrequency minimum (60). Was 30 pre-refactor.
    v_freq_minutes := COALESCE((p_config->>'frequency_minutes')::INT, 60);
    -- Jitter: ±30 seconds of random offset to prevent thundering herd.
    -- All users on the same frequency would otherwise align on the same
    -- clock boundary and hit the dispatcher in the same 5-min tick.
    -- Only applied to market_research — daily/weekly/monthly fire at
    -- user-configured exact times and should not be randomized.
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
