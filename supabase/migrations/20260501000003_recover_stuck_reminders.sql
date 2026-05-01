-- ============================================================
-- Recover stuck reminders
-- ============================================================
--
-- A reminder transitions pending -> firing via claim_reminder, and is
-- expected to land at fired/failed within seconds. If the edge function
-- crashes or times out (60s wall clock) between the claim and the final
-- status update, the row is stranded in `firing`. The dispatcher's query
-- (status='pending') won't pick it up, the user's panel filters
-- (status='pending') won't show it, and no other path recovers it.
--
-- This janitor flips rows that have been `firing` longer than 10 minutes
-- back to `pending` so the next dispatcher tick (or the browser local
-- timer on next mount) can re-claim and retry. 10 minutes is well past
-- the 60s function timeout while still being short enough that a missed
-- reminder fires within ~15 minutes of its trigger time worst-case.
--
-- Safe to run repeatedly: rows already `fired`/`failed`/`cancelled` are
-- ignored. Rows in `firing` younger than 10 minutes are ignored (still
-- in flight). The recovery itself is just an UPDATE — no new HTTP calls,
-- so it's cheap to run every 5 minutes.
-- ============================================================

CREATE OR REPLACE FUNCTION public.recover_stuck_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recovered INTEGER;
BEGIN
  WITH updated AS (
    UPDATE public.reminders
       SET status = 'pending',
           last_error = COALESCE(last_error, '') ||
                        CASE WHEN last_error IS NULL OR last_error = ''
                             THEN 'recovered_from_stuck_firing'
                             ELSE '; recovered_from_stuck_firing' END
     WHERE status = 'firing'
       AND updated_at < NOW() - INTERVAL '10 minutes'
     RETURNING 1
  )
  SELECT count(*) INTO recovered FROM updated;
  RETURN recovered;
END;
$$;

REVOKE ALL ON FUNCTION public.recover_stuck_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recover_stuck_reminders() TO service_role;

COMMENT ON FUNCTION public.recover_stuck_reminders() IS
  'Recovers reminders stuck in firing > 10 min back to pending so the next dispatcher tick retries them. Returns count recovered.';

-- Schedule the janitor every 5 minutes, 1-minute offset from the main
-- dispatcher cron so they don't both run at xx:x0/xx:x5 simultaneously.
SELECT cron.unschedule('reminders-janitor') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'reminders-janitor'
);

SELECT cron.schedule(
  'reminders-janitor',
  '1-59/5 * * * *',  -- every 5 min starting at xx:01
  $$ SELECT public.recover_stuck_reminders(); $$
);

SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'reminders-janitor';
