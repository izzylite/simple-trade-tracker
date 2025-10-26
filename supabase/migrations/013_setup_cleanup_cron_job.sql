-- Migration: Setup Cron Job for Cleanup Expired Calendars
-- Description: Creates a cron job that runs every 15 minutes to clean up expired calendars
-- Date: 2025-10-24

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Store Supabase project URL and service role key in vault for secure access
-- Note: You need to replace these values with actual secrets using:
-- SELECT vault.create_secret('https://gwubzauelilziaqnsfac.supabase.co', 'project_url');
-- SELECT vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'service_role_key');

-- Create the cron job to invoke cleanup-expired-calendars edge function every 15 minutes
SELECT cron.schedule(
  'cleanup-expired-calendars-every-15-min',
  '*/15 * * * *', -- Runs every 15 minutes
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/cleanup-expired-calendars',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := jsonb_build_object(
      'time', now(),
      'triggered_by', 'cron'
    ),
    timeout_milliseconds := 30000 -- 30 second timeout
  ) as request_id;
  $$
);

-- Grant necessary permissions to execute the cron job
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Verify the cron job was created
-- You can check active cron jobs with: SELECT * FROM cron.job;

COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL - used for cleanup-expired-calendars';
