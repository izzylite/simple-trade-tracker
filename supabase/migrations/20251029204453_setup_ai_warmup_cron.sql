-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop existing cron job if it exists (for re-running migration)
SELECT cron.unschedule('warmup-ai-agent') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'warmup-ai-agent'
);

-- Create cron job to warmup AI agent every 4 minutes
-- This keeps the edge function warm and maintains the tool cache
SELECT cron.schedule(
  'warmup-ai-agent',           -- Job name
  '*/4 * * * *',                -- Every 4 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://gwubzauelilziaqnsfac.supabase.co/functions/v1/warmup-ai-agent',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- View the created cron job
SELECT
  jobname,
  schedule,
  active,
  jobid
FROM cron.job
WHERE jobname = 'warmup-ai-agent';
