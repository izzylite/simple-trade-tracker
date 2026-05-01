-- ============================================================
-- Reminders dispatcher cron — fires every 5 minutes
-- ============================================================
-- Fallback path for the browser local timer. Catches reminders due
-- while the app is closed, when tabs are throttled, or whenever the
-- local timer misses. Both paths funnel through the atomic-claim RPC
-- inside ai-trading-agent so there's no double-fire risk.
--
-- The dispatch-reminders edge function authenticates this caller via
-- the X-Reminders-Dispatcher-Secret header. cron.job is only readable
-- by service_role/postgres, so the literal in the cron command stays
-- out of user-visible schemas. The migration ships with a placeholder;
-- the real secret is substituted at apply time so it never lands in
-- git history.
--
-- IMPORTANT: replace the placeholder secret below with the real value
-- (matching the REMINDERS_DISPATCHER_SECRET env var on the function)
-- before running. The production DB has the real value applied via MCP.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule('reminders-dispatcher') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'reminders-dispatcher'
);

SELECT cron.schedule(
  'reminders-dispatcher',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://gwubzauelilziaqnsfac.supabase.co/functions/v1/dispatch-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Reminders-Dispatcher-Secret', 'REPLACE_WITH_GENERATED_SECRET'
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT jobname, schedule, active
FROM cron.job
WHERE jobname = 'reminders-dispatcher';
