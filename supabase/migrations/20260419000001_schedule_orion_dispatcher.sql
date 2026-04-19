-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop existing cron job if it exists (for re-running migration)
SELECT cron.unschedule('orion-dispatcher') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'orion-dispatcher'
);

-- Schedule the dispatcher to fire every 5 minutes.
-- This is the ONLY cron row for the Orion task system — it scales with users
-- via rows in `orion_tasks`, not rows in `cron.job`.
SELECT cron.schedule(
  'orion-dispatcher',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://gwubzauelilziaqnsfac.supabase.co/functions/v1/dispatch-orion-tasks',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- Confirm the cron job was created
SELECT
  jobname,
  schedule,
  active,
  jobid
FROM cron.job
WHERE jobname = 'orion-dispatcher';
