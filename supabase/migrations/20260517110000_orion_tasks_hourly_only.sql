-- Downshift any market_research tasks with sub-hourly frequency to 60 min.
--
-- Context: catalog-driven refactor removed 15/30 min options from the task
-- editor because the previous 5-min cache TTL never hit across runs spaced
-- 15+ min apart, killing cross-user cache reuse. Hourly cron + 1h TTL is
-- now the only supported cadence (see AlertFrequency in types/orionTask.ts).
-- This migration brings legacy rows in line so the next handler invocation
-- doesn't see a stale 15/30 in the config.
--
-- Idempotent: only touches rows where frequency_minutes is strictly less
-- than 60. Safe to re-run.
UPDATE public.orion_tasks
SET
  config = jsonb_set(config, '{frequency_minutes}', '60'::jsonb, true),
  updated_at = now()
WHERE
  task_type = 'market_research'
  AND (config->>'frequency_minutes')::int < 60;
