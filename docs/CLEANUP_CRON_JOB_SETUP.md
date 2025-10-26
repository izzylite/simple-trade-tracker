# Cleanup Expired Calendars Cron Job Setup

**Date**: 2025-10-24
**Edge Function**: `cleanup-expired-calendars`
**Schedule**: Every 15 minutes

## Overview

This document describes the setup of an automated cron job that runs the `cleanup-expired-calendars` edge function every 15 minutes to permanently delete calendars that have been in the trash for more than 30 days.

## Architecture

```
PostgreSQL pg_cron → HTTP POST (pg_net) → Edge Function → Delete Expired Calendars
     (every 15min)         (via vault secrets)        (cleanup logic)
```

## Setup Steps

### 1. Store Secrets in Vault

Before running the migration, you need to store your Supabase project URL and service role key in the Vault:

```sql
-- Run these commands in Supabase SQL Editor
SELECT vault.create_secret('https://gwubzauelilziaqnsfac.supabase.co', 'project_url');
SELECT vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'service_role_key');
```

**How to get your Service Role Key:**
1. Go to Supabase Dashboard → Project Settings → API
2. Copy the `service_role` key (NOT the `anon` key)
3. This key has admin privileges - keep it secure

### 2. Apply the Migration

```bash
# Apply the cron job migration
npx supabase db push

# Or apply specific migration
npx supabase migration up 013_setup_cleanup_cron_job
```

### 3. Verify the Cron Job

Check that the cron job was created successfully:

```sql
-- View all cron jobs
SELECT * FROM cron.job;

-- Should show:
-- jobid | schedule      | command                                  | nodename  | ...
-- 1     | */15 * * * *  | SELECT net.http_post(...)               | localhost | ...
```

### 4. Deploy the Edge Function

Make sure the `cleanup-expired-calendars` edge function is deployed:

```bash
npx supabase functions deploy cleanup-expired-calendars
```

## Migration Details

### File
[013_setup_cleanup_cron_job.sql](../supabase/migrations/013_setup_cleanup_cron_job.sql)

### What It Does

1. **Enables Extensions**:
   - `pg_cron` - PostgreSQL cron job scheduler
   - `pg_net` - HTTP client for making requests from PostgreSQL

2. **Creates Cron Job**:
   - Name: `cleanup-expired-calendars-every-15-min`
   - Schedule: `*/15 * * * *` (every 15 minutes)
   - Action: HTTP POST to edge function

3. **Security**:
   - Uses Vault to securely store and retrieve secrets
   - Service role key grants admin access for deletion operations
   - Secrets never exposed in migration files or logs

## Cron Schedule Format

The schedule uses standard cron syntax:
```
*/15 * * * *
│    │ │ │ │
│    │ │ │ └─── Day of week (0-7, 0 or 7 = Sunday)
│    │ │ └───── Month (1-12)
│    │ └─────── Day of month (1-31)
│    └───────── Hour (0-23)
└────────────── Minute (0-59)
```

**Examples**:
- `*/15 * * * *` - Every 15 minutes
- `0 2 * * *` - Daily at 2:00 AM
- `0 */6 * * *` - Every 6 hours
- `0 0 * * 0` - Weekly on Sunday at midnight

## Monitoring

### Check Recent Cron Executions

```sql
-- View cron job run history
SELECT
  runid,
  jobid,
  start_time,
  end_time,
  status,
  return_message
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-expired-calendars-every-15-min')
ORDER BY start_time DESC
LIMIT 10;
```

### Check HTTP Request Results

```sql
-- View recent HTTP POST requests made by the cron job
SELECT
  id,
  created_at,
  url,
  status_code,
  content,
  error_msg
FROM net._http_response
WHERE url LIKE '%cleanup-expired-calendars%'
ORDER BY created_at DESC
LIMIT 10;
```

### Check Edge Function Logs

1. Go to Supabase Dashboard → Edge Functions → cleanup-expired-calendars → Logs
2. Look for executions triggered by `"triggered_by": "cron"`

Expected log output:
```
✅ Cleanup expired calendars scheduled function triggered
✅ Starting cleanup of expired calendars
✅ Found N expired calendars to delete
✅ Processing expired calendar: {id} ({name})
✅ Successfully deleted expired calendar: {id}
✅ Cleanup completed: N calendars deleted
```

## Managing the Cron Job

### Disable the Cron Job

```sql
-- Disable without deleting
UPDATE cron.job
SET active = false
WHERE jobname = 'cleanup-expired-calendars-every-15-min';
```

### Re-enable the Cron Job

```sql
-- Re-enable
UPDATE cron.job
SET active = true
WHERE jobname = 'cleanup-expired-calendars-every-15-min';
```

### Delete the Cron Job

```sql
-- Permanently delete
SELECT cron.unschedule('cleanup-expired-calendars-every-15-min');
```

### Update the Schedule

```sql
-- Change to run daily at 2 AM instead of every 15 minutes
SELECT cron.schedule(
  'cleanup-expired-calendars-every-15-min',
  '0 2 * * *',
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
    timeout_milliseconds := 30000
  ) as request_id;
  $$
);
```

## Troubleshooting

### Cron Job Not Running

**Problem**: Cron job doesn't appear to be executing

**Solutions**:
1. Check if `pg_cron` extension is enabled:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```

2. Verify cron job exists and is active:
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'cleanup-expired-calendars-every-15-min';
   ```

3. Check for errors in cron job history:
   ```sql
   SELECT * FROM cron.job_run_details
   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-expired-calendars-every-15-min')
   ORDER BY start_time DESC LIMIT 5;
   ```

### HTTP Request Failing

**Problem**: Cron runs but HTTP request fails (status_code != 200)

**Solutions**:
1. Verify secrets are stored correctly:
   ```sql
   SELECT name FROM vault.decrypted_secrets WHERE name IN ('project_url', 'service_role_key');
   ```

2. Check if edge function is deployed:
   - Go to Supabase Dashboard → Edge Functions
   - Verify `cleanup-expired-calendars` is listed and active

3. Test edge function manually:
   ```bash
   curl -X POST 'https://gwubzauelilziaqnsfac.supabase.co/functions/v1/cleanup-expired-calendars' \
     -H 'Content-Type: application/json' \
     -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
     -d '{"time": "2025-10-24T00:00:00Z", "triggered_by": "manual"}'
   ```

### Edge Function Errors

**Problem**: Edge function receives request but encounters errors

**Solutions**:
1. Check edge function logs in Supabase Dashboard
2. Verify the function has proper permissions to:
   - Query `calendars` table
   - Call `cleanup-deleted-calendar` function
   - Delete calendar records

## Security Considerations

### Service Role Key

⚠️ **IMPORTANT**: The service role key has admin privileges
- Never commit it to version control
- Store it only in Vault
- Rotate it periodically
- Monitor its usage in logs

### Permissions

The cron job needs:
- `SELECT` on `vault.decrypted_secrets`
- `EXECUTE` on `net.http_post`
- Service role key grants edge function full database access

### Rate Limiting

Running every 15 minutes means:
- 96 executions per day
- ~2,880 executions per month
- Minimal impact on database resources
- Each execution processes only expired calendars

## Performance

### Expected Load

- **Frequency**: Every 15 minutes
- **Duration**: 1-5 seconds (depends on number of expired calendars)
- **Network**: One HTTP POST request per execution
- **Database**: Minimal queries (only fetch expired calendars)

### Optimization Tips

1. **Adjust Schedule**: If you have few calendars, run less frequently:
   ```sql
   -- Change to daily at 2 AM
   '0 2 * * *'
   ```

2. **Batch Processing**: The edge function already processes calendars in batches

3. **Timeout**: Current timeout is 30 seconds, adjust if needed:
   ```sql
   timeout_milliseconds := 60000 -- 1 minute
   ```

## Related Documentation

- [cleanup-expired-calendars Edge Function](../supabase/functions/cleanup-expired-calendars/index.ts)
- [Supabase pg_cron Documentation](https://supabase.com/docs/guides/database/extensions/pgcron)
- [Supabase Vault Documentation](https://supabase.com/docs/guides/database/vault)
- [Edge Function Scheduling Guide](https://supabase.com/docs/guides/functions/schedule-functions)

## Testing

### Manual Test

You can manually trigger the cleanup without waiting for cron:

```sql
-- Execute the cron job command manually
SELECT net.http_post(
  url := 'https://gwubzauelilziaqnsfac.supabase.co/functions/v1/cleanup-expired-calendars',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
  ),
  body := jsonb_build_object(
    'time', now(),
    'triggered_by', 'manual_test'
  ),
  timeout_milliseconds := 30000
) as request_id;
```

### Test with Expired Calendar

1. Create a test calendar
2. Soft delete it (`is_deleted = true`)
3. Set `auto_delete_at` to a past date:
   ```sql
   UPDATE calendars
   SET is_deleted = true,
       auto_delete_at = NOW() - INTERVAL '1 day'
   WHERE id = 'test-calendar-id';
   ```
4. Wait for next cron run (or trigger manually)
5. Verify calendar is permanently deleted

## Rollback

If you need to remove the cron job:

```sql
-- Unschedule the cron job
SELECT cron.unschedule('cleanup-expired-calendars-every-15-min');

-- Optionally, disable extensions (only if not used elsewhere)
-- DROP EXTENSION IF EXISTS pg_cron CASCADE;
-- DROP EXTENSION IF EXISTS pg_net CASCADE;
```

## Summary

✅ Cron job runs every 15 minutes
✅ Securely uses Vault for secrets
✅ Automatically cleans up expired calendars
✅ Non-blocking and efficient
✅ Fully monitored via logs and database queries
✅ Easy to adjust schedule or disable

The cron job is now configured and will automatically maintain your database by removing expired calendars.
