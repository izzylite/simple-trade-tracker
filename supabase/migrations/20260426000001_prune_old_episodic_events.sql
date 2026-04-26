-- Memory v2: 180-day pruning for the episodic event log.
--
-- agent_memory_events is append-only and grows ~50 events/day/calendar at
-- the soft cap. Without pruning, a heavy user accumulates ~18k rows/year/
-- calendar — manageable but unbounded over time. The episodic memory model
-- assumes events older than 180 days are either:
--   • already consolidated into core AGENT_MEMORY (so the fact still lives
--     in the trader profile, just without the timestamp), or
--   • genuinely no longer relevant to current trading.
--
-- We use a SECURITY DEFINER function rather than dropping the DELETE inline
-- so the cron call site stays small and we get a single audit point if the
-- retention window ever changes.

CREATE OR REPLACE FUNCTION public.prune_old_episodic_events()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM public.agent_memory_events
  WHERE occurred_at < NOW() - INTERVAL '180 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.prune_old_episodic_events IS
  'Deletes agent_memory_events rows older than 180 days. Returns the row count.';

-- Schedule: daily at 03:17 UTC. Off-hours of any major market session,
-- and prime numbers in the schedule reduce the chance of clashing with
-- other crons on the same minute.
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule('prune-episodic-events') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'prune-episodic-events'
);

SELECT cron.schedule(
  'prune-episodic-events',
  '17 3 * * *',
  $$ SELECT public.prune_old_episodic_events(); $$
);

-- Confirm registration
SELECT jobname, schedule, active, jobid
FROM cron.job
WHERE jobname = 'prune-episodic-events';
