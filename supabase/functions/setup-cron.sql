-- Supabase Edge Functions Cron Jobs Setup
-- Run this SQL in your Supabase SQL Editor after deploying Edge Functions

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =============================================================================
-- CLEANUP EXPIRED CALENDARS (Daily at 2 AM UTC)
-- =============================================================================

-- Remove existing job if it exists
SELECT cron.unschedule('cleanup-expired-calendars');

-- Schedule cleanup of expired calendars
SELECT cron.schedule(
  'cleanup-expired-calendars',
  '0 2 * * *',  -- Daily at 2 AM UTC
  $$
  SELECT net.http_post(
    url := 'https://gwubzauelilziaqnsfac.supabase.co/functions/v1/cleanup-expired-calendars',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key', true) || '"}'
  );
  $$
);

-- =============================================================================
-- AUTO REFRESH ECONOMIC CALENDAR (Every 30 minutes)
-- =============================================================================

-- Remove existing job if it exists
SELECT cron.unschedule('auto-refresh-economic-calendar');

-- Schedule auto refresh of economic calendar
SELECT cron.schedule(
  'auto-refresh-economic-calendar',
  '*/30 * * * *',  -- Every 30 minutes
  $$
  SELECT net.http_post(
    url := 'https://gwubzauelilziaqnsfac.supabase.co/functions/v1/auto-refresh-economic-calendar',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key', true) || '"}'
  );
  $$
);

-- =============================================================================
-- CONFIGURATION SETTINGS
-- =============================================================================

-- Set service role key for cron jobs (replace with your actual service role key)
-- This should be set as a database setting for security
-- ALTER DATABASE postgres SET app.service_role_key = 'your-service-role-key-here';

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- View all scheduled cron jobs
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobname
FROM cron.job 
WHERE jobname IN ('cleanup-expired-calendars', 'auto-refresh-economic-calendar')
ORDER BY jobname;

-- View cron job run history (last 10 runs)
SELECT 
  runid,
  jobid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details 
WHERE jobid IN (
  SELECT jobid FROM cron.job 
  WHERE jobname IN ('cleanup-expired-calendars', 'auto-refresh-economic-calendar')
)
ORDER BY start_time DESC 
LIMIT 10;

-- =============================================================================
-- MANUAL TESTING
-- =============================================================================

-- Test cleanup expired calendars function manually
/*
SELECT net.http_post(
  url := 'https://gwubzauelilziaqnsfac.supabase.co/functions/v1/cleanup-expired-calendars',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer your-service-role-key-here"}'
);
*/

-- Test auto refresh economic calendar function manually
/*
SELECT net.http_post(
  url := 'https://gwubzauelilziaqnsfac.supabase.co/functions/v1/auto-refresh-economic-calendar',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer your-service-role-key-here"}'
);
*/

-- =============================================================================
-- MONITORING QUERIES
-- =============================================================================

-- Check if cron jobs are running successfully
SELECT 
  j.jobname,
  j.schedule,
  j.active,
  jr.status,
  jr.return_message,
  jr.start_time,
  jr.end_time
FROM cron.job j
LEFT JOIN LATERAL (
  SELECT * FROM cron.job_run_details jrd 
  WHERE jrd.jobid = j.jobid 
  ORDER BY start_time DESC 
  LIMIT 1
) jr ON true
WHERE j.jobname IN ('cleanup-expired-calendars', 'auto-refresh-economic-calendar')
ORDER BY j.jobname;

-- Check for failed cron job runs in the last 24 hours
SELECT 
  j.jobname,
  jr.status,
  jr.return_message,
  jr.start_time,
  jr.end_time
FROM cron.job j
JOIN cron.job_run_details jr ON j.jobid = jr.jobid
WHERE j.jobname IN ('cleanup-expired-calendars', 'auto-refresh-economic-calendar')
  AND jr.start_time > NOW() - INTERVAL '24 hours'
  AND jr.status != 'succeeded'
ORDER BY jr.start_time DESC;

-- =============================================================================
-- CLEANUP (if needed)
-- =============================================================================

-- To remove cron jobs (uncomment if needed)
/*
SELECT cron.unschedule('cleanup-expired-calendars');
SELECT cron.unschedule('auto-refresh-economic-calendar');
*/

-- =============================================================================
-- ALTERNATIVE: SUPABASE DASHBOARD CRON SETUP
-- =============================================================================

/*
If you prefer to set up cron jobs through the Supabase Dashboard:

1. Go to your Supabase project dashboard
2. Navigate to Database → Cron Jobs
3. Click "Create a new cron job"

For cleanup-expired-calendars:
- Name: cleanup-expired-calendars
- Schedule: 0 2 * * * (daily at 2 AM)
- SQL Command:
  SELECT net.http_post(
    'https://gwubzauelilziaqnsfac.supabase.co/functions/v1/cleanup-expired-calendars',
    '{"Authorization": "Bearer [service-key]"}'
  );

For auto-refresh-economic-calendar:
- Name: auto-refresh-economic-calendar  
- Schedule: */30 * * * * (every 30 minutes)
- SQL Command:
  SELECT net.http_post(
    'https://gwubzauelilziaqnsfac.supabase.co/functions/v1/auto-refresh-economic-calendar',
    '{"Authorization": "Bearer [service-key]"}'
  );
*/

-- =============================================================================
-- NOTES
-- =============================================================================

/*
IMPORTANT SETUP STEPS:

1. Replace the Supabase project URL in the cron jobs:
   - Change 'gwubzauelilziaqnsfac.supabase.co' to your actual project URL

2. Set the service role key as a database setting:
   ALTER DATABASE postgres SET app.service_role_key = 'your-actual-service-role-key';

3. Ensure required extensions are enabled:
   CREATE EXTENSION IF NOT EXISTS pg_cron;
   CREATE EXTENSION IF NOT EXISTS http;

4. Test the cron jobs manually before relying on the schedule

5. Monitor cron job execution using the provided monitoring queries

6. Set up alerts for failed cron job runs if needed

TIMEZONE CONSIDERATIONS:
- All times are in UTC
- Adjust schedules based on your preferred timezone
- Consider daylight saving time changes

PERFORMANCE CONSIDERATIONS:
- Economic calendar refresh every 30 minutes may be frequent for some use cases
- Adjust frequency based on your application's needs
- Monitor database performance impact of scheduled jobs

SECURITY CONSIDERATIONS:
- Store service role key securely as database setting
- Use HTTPS for all webhook URLs
- Monitor cron job execution logs for unusual activity
- Consider implementing rate limiting on Edge Functions
*/
