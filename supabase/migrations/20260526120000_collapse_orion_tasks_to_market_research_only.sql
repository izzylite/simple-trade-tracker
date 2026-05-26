-- 2026-05-26: Collapse orion_tasks to market_research only.
--
-- Removes the three non-scalable task types (daily_analysis, weekly_review,
-- monthly_rollup), recreates the enum with a single value, adds a unique
-- index enforcing one MR task per (user, calendar), and simplifies the
-- scheduler function.
--
-- Rollback: NONE. Hard delete is irreversible by design (spec: scaling-first).

BEGIN;

-- 1. Drop deprecated results first (results may FK to tasks; safe either way
--    but matches deletion intent).
DELETE FROM public.orion_task_results
 WHERE task_type IN ('daily_analysis', 'weekly_review', 'monthly_rollup');

-- 2. Drop deprecated tasks.
DELETE FROM public.orion_tasks
 WHERE task_type IN ('daily_analysis', 'weekly_review', 'monthly_rollup');

-- 3. Sanity guard: no deprecated rows must remain.
DO $$
DECLARE
  task_leftover INT;
  result_leftover INT;
BEGIN
  SELECT count(*) INTO task_leftover
    FROM public.orion_tasks
   WHERE task_type::TEXT <> 'market_research';
  SELECT count(*) INTO result_leftover
    FROM public.orion_task_results
   WHERE task_type::TEXT <> 'market_research';

  IF task_leftover > 0 OR result_leftover > 0 THEN
    RAISE EXCEPTION
      'Refusing to recreate enum: % deprecated task rows, % deprecated result rows still present',
      task_leftover, result_leftover;
  END IF;
END $$;

-- 4. Detach columns from the old enum so we can drop it.
--    Pre-flight finding (2026-05-26): orion_tasks has TWO triggers that fire
--    on UPDATE (update_orion_tasks_updated_at_trigger,
--    orion_tasks_set_next_run_at_trigger). The session_replication_role wrap
--    is REQUIRED to prevent timestamp scramble and to avoid the scheduler
--    trigger running against the soon-to-be-rewritten function.
SET LOCAL session_replication_role = replica;
ALTER TABLE public.orion_tasks         ALTER COLUMN task_type TYPE TEXT;
ALTER TABLE public.orion_task_results  ALTER COLUMN task_type TYPE TEXT;

-- 5. Drop the old enum (now unreferenced).
DROP TYPE public.orion_task_type;

-- 6. Recreate with a single value.
CREATE TYPE public.orion_task_type AS ENUM ('market_research');

-- 7. Re-attach columns. USING cast is total because step 3 verified all rows
--    are 'market_research'.
ALTER TABLE public.orion_tasks
  ALTER COLUMN task_type TYPE public.orion_task_type
  USING task_type::public.orion_task_type;

ALTER TABLE public.orion_task_results
  ALTER COLUMN task_type TYPE public.orion_task_type
  USING task_type::public.orion_task_type;

SET LOCAL session_replication_role = origin;

-- 8. Enforce the new invariant: at most one MR task per (user, calendar).
--    Partial index keyed on task_type so adding a future scalable type
--    doesn't conflict with the constraint.
CREATE UNIQUE INDEX IF NOT EXISTS orion_tasks_one_per_user_calendar
  ON public.orion_tasks (user_id, calendar_id)
  WHERE task_type = 'market_research';

COMMENT ON INDEX public.orion_tasks_one_per_user_calendar IS
  'Post-collapse (2026-05-26): one market_research task per (user, calendar). '
  'Partial-keyed on task_type so future scalable types can add their own constraints.';

-- 9. Rewrite the scheduler. Only market_research remains.
CREATE OR REPLACE FUNCTION public.compute_next_orion_task_run_at(
  p_task_type TEXT,
  p_config    JSONB
) RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  freq_minutes INT;
BEGIN
  IF p_task_type = 'market_research' THEN
    freq_minutes := COALESCE((p_config->>'frequency_minutes')::INT, 60);
    -- Jitter 0-4 min so 1k users on the same cadence don't fire in lockstep.
    RETURN NOW() + (freq_minutes + FLOOR(RANDOM() * 5)::INT) * INTERVAL '1 minute';
  END IF;
  RAISE EXCEPTION 'Unsupported orion task_type: %', p_task_type;
END;
$$;

COMMENT ON FUNCTION public.compute_next_orion_task_run_at(TEXT, JSONB) IS
  'Returns the next scheduled fire time for an Orion task. '
  'Post-collapse (2026-05-26): only market_research is supported.';

-- 10. Final assertion: enum has exactly one value.
DO $$
DECLARE
  label_count INT;
  the_label TEXT;
BEGIN
  SELECT count(*), max(enumlabel) INTO label_count, the_label
    FROM pg_enum
   WHERE enumtypid = 'public.orion_task_type'::regtype;

  IF label_count <> 1 OR the_label <> 'market_research' THEN
    RAISE EXCEPTION
      'orion_task_type enum check failed: % labels (%)', label_count, the_label;
  END IF;
END $$;

COMMIT;
