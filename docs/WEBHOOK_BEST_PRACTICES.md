# Supabase Webhook Best Practices

**Date**: 2025-10-24
**Project**: Simple Trade Tracker

## Question: Database Triggers vs UI Webhooks?

You asked whether we should use **SQL database triggers** (current approach) or **UI-configured webhooks** (Supabase Dashboard → Database Webhooks).

## Answer: Both Are Valid, But Use SQL Triggers for Production

### Current Approach: ✅ **CORRECT for Production**

Your current implementation using SQL triggers in migrations is **the recommended best practice** for production applications.

## Comparison

| Feature | SQL Triggers (Current) | UI Webhooks |
|---------|----------------------|-------------|
| **Version Control** | ✅ In git migrations | ❌ UI-only, not in git |
| **Deployment** | ✅ Automatic with migrations | ❌ Manual recreation |
| **Team Collaboration** | ✅ Code review possible | ❌ No review process |
| **Consistency** | ✅ Same across environments | ❌ Must recreate each env |
| **Flexibility** | ✅ Full SQL control | ⚠️ Limited to UI options |
| **Visibility** | ❌ Not in dashboard | ✅ Visible in UI |
| **Ease of Use** | ⚠️ Requires SQL knowledge | ✅ No-code friendly |
| **Debugging** | ⚠️ Check function definitions | ✅ UI shows status |
| **Documentation** | ✅ Lives with code | ❌ Separate from code |

## Supabase Official Recommendation

From Supabase docs: Both approaches create the same underlying PostgreSQL triggers. The UI is a convenience wrapper.

**For production apps**: Use SQL migrations
**For prototyping**: UI webhooks are fine

## Current Webhooks in Your Project

### 1. Trade Changes Webhook

**File**: Created via SQL (not found in migrations - needs to be added)

**Current Status**: ⚠️ **Incomplete**
```sql
-- Current trigger (ONLY handles INSERT)
CREATE TRIGGER trigger_trade_changes
  AFTER INSERT ON trades
  FOR EACH ROW
  EXECUTE FUNCTION notify_trade_changes();
```

**Issue**: The function `notify_trade_changes()` supports INSERT, UPDATE, DELETE but the trigger only fires on INSERT!

**Should Be**:
```sql
CREATE TRIGGER trigger_trade_changes
  AFTER INSERT OR UPDATE OR DELETE ON trades
  FOR EACH ROW
  EXECUTE FUNCTION notify_trade_changes();
```

### 2. Calendar Deletion Webhook

**File**: Created via SQL (not found in migrations - needs to be added)

**Current Status**: ✅ **Correct**
```sql
CREATE TRIGGER trigger_calendar_deletions
  AFTER DELETE ON calendars
  FOR EACH ROW
  EXECUTE FUNCTION notify_calendar_deletions();
```

## Recommended Actions

### 1. ✅ Keep Using SQL Triggers (Current Approach)

Your current approach is correct! Continue using SQL migrations for webhooks.

### 2. 🔧 Fix the Trade Webhook

Update the trigger to handle UPDATE and DELETE events:

**Create migration**: `014_fix_trade_webhook.sql`

```sql
-- Drop existing incomplete trigger
DROP TRIGGER IF EXISTS trigger_trade_changes ON trades;

-- Recreate trigger with all events
CREATE TRIGGER trigger_trade_changes
  AFTER INSERT OR UPDATE OR DELETE ON trades
  FOR EACH ROW
  EXECUTE FUNCTION notify_trade_changes();
```

### 3. 📝 Document Current Webhooks

Create a migration that documents existing webhooks (they may have been created manually):

**Create migration**: `015_document_existing_webhooks.sql`

```sql
-- This migration documents existing webhook triggers and functions
-- If they don't exist, they will be created

-- ============================================
-- Trade Changes Webhook
-- ============================================

-- Function: notify_trade_changes
-- Already exists, verify it's correct
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'notify_trade_changes'
  ) THEN
    RAISE EXCEPTION 'notify_trade_changes function does not exist - must be created first';
  END IF;
END $$;

-- Trigger: trigger_trade_changes
-- Drop and recreate to ensure correct events
DROP TRIGGER IF EXISTS trigger_trade_changes ON trades;

CREATE TRIGGER trigger_trade_changes
  AFTER INSERT OR UPDATE OR DELETE ON trades
  FOR EACH ROW
  EXECUTE FUNCTION notify_trade_changes();

-- ============================================
-- Calendar Deletion Webhook
-- ============================================

-- Function: notify_calendar_deletions
-- Already exists, verify it's correct
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'notify_calendar_deletions'
  ) THEN
    RAISE EXCEPTION 'notify_calendar_deletions function does not exist - must be created first';
  END IF;
END $$;

-- Trigger: trigger_calendar_deletions
-- Should already exist, verify
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_calendar_deletions'
  ) THEN
    CREATE TRIGGER trigger_calendar_deletions
      AFTER DELETE ON calendars
      FOR EACH ROW
      EXECUTE FUNCTION notify_calendar_deletions();
  END IF;
END $$;

-- ============================================
-- Add comments for documentation
-- ============================================

COMMENT ON TRIGGER trigger_trade_changes ON trades IS
'Webhook that calls handle-trade-changes edge function on INSERT, UPDATE, DELETE';

COMMENT ON TRIGGER trigger_calendar_deletions ON calendars IS
'Webhook that calls cleanup-deleted-calendar edge function on DELETE';

COMMENT ON FUNCTION notify_trade_changes() IS
'Webhook function that sends trade changes to handle-trade-changes edge function via pg_net';

COMMENT ON FUNCTION notify_calendar_deletions() IS
'Webhook function that sends calendar deletions to cleanup-deleted-calendar edge function via pg_net';
```

### 4. 📊 Add Monitoring

Create a helper function to view webhook execution logs:

```sql
-- View recent webhook executions
CREATE OR REPLACE FUNCTION get_webhook_logs(
  function_name text DEFAULT NULL,
  limit_count integer DEFAULT 50
)
RETURNS TABLE (
  id bigint,
  created_at timestamptz,
  url text,
  status_code integer,
  content text,
  error_msg text,
  timed_out boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.created_at,
    r.url,
    r.status_code,
    r.content::text,
    r.error_msg,
    r.timed_out
  FROM net._http_response r
  WHERE
    (function_name IS NULL OR r.url LIKE '%' || function_name || '%')
  ORDER BY r.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usage examples:
-- SELECT * FROM get_webhook_logs(); -- All webhooks
-- SELECT * FROM get_webhook_logs('handle-trade-changes'); -- Specific function
-- SELECT * FROM get_webhook_logs(NULL, 100); -- Last 100 executions
```

## Why SQL Triggers Are Better for Your Project

### 1. **Version Control**
```bash
git log supabase/migrations/
# Shows complete history of webhook changes
```

### 2. **Deployment Automation**
```bash
npx supabase db push
# Automatically creates webhooks on new environment
```

### 3. **Team Collaboration**
```bash
# PR review shows webhook changes
git diff supabase/migrations/014_fix_trade_webhook.sql
```

### 4. **Environment Consistency**
```
Development → Staging → Production
All have identical webhook configuration
```

## When to Use UI Webhooks

### ✅ Good Use Cases:
- Quick prototyping of webhook ideas
- Temporary webhooks for testing
- One-off webhooks that won't be long-term
- Teams without SQL expertise

### ❌ Avoid For:
- Production applications
- Team projects (not version controlled)
- Critical business logic
- Webhooks that need to be identical across environments

## Monitoring Your Webhooks

### Check Webhook Status

```sql
-- List all webhook triggers
SELECT
  t.tgname as trigger_name,
  t.tgrelid::regclass as table_name,
  p.proname as function_name,
  CASE t.tgenabled
    WHEN 'O' THEN 'enabled'
    WHEN 'D' THEN 'disabled'
    ELSE 'unknown'
  END as status
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE p.proname IN ('notify_trade_changes', 'notify_calendar_deletions')
ORDER BY table_name, trigger_name;
```

### Check Recent Webhook Calls

```sql
-- View recent webhook HTTP requests
SELECT
  created_at,
  url,
  status_code,
  CASE
    WHEN status_code = 200 THEN '✅ Success'
    WHEN status_code >= 400 THEN '❌ Error'
    ELSE '⚠️ Unknown'
  END as result,
  content::text as response
FROM net._http_response
WHERE url LIKE '%/functions/v1/%'
ORDER BY created_at DESC
LIMIT 20;
```

### Check Webhook Errors

```sql
-- View failed webhook calls
SELECT
  created_at,
  url,
  status_code,
  error_msg,
  timed_out
FROM net._http_response
WHERE url LIKE '%/functions/v1/%'
  AND (status_code >= 400 OR error_msg IS NOT NULL OR timed_out = true)
ORDER BY created_at DESC;
```

## Edge Function URLs

Your webhooks call these edge functions:

| Trigger | Edge Function | URL |
|---------|--------------|-----|
| `trigger_trade_changes` | handle-trade-changes | `https://gwubzauelilziaqnsfac.supabase.co/functions/v1/handle-trade-changes` |
| `trigger_calendar_deletions` | cleanup-deleted-calendar | `https://gwubzauelilziaqnsfac.supabase.co/functions/v1/cleanup-deleted-calendar` |

## Testing Webhooks

### Test Trade Webhook

```sql
-- Insert a test trade (should trigger webhook)
INSERT INTO trades (calendar_id, user_id, trade_date, symbol)
VALUES ('test-cal-id', 'test-user-id', NOW(), 'TEST');

-- Check if webhook was called
SELECT * FROM net._http_response
WHERE url LIKE '%handle-trade-changes%'
ORDER BY created_at DESC LIMIT 1;
```

### Test Calendar Webhook

```sql
-- Create and delete a test calendar
INSERT INTO calendars (id, user_id, name, year)
VALUES ('test-cal', 'test-user', 'Test Calendar', 2025);

DELETE FROM calendars WHERE id = 'test-cal';

-- Check if webhook was called
SELECT * FROM net._http_response
WHERE url LIKE '%cleanup-deleted-calendar%'
ORDER BY created_at DESC LIMIT 1;
```

## Summary

### ✅ Your Current Approach is Correct!

Using SQL triggers in migrations is the **best practice** for production apps.

### 🔧 Action Items:

1. **Fix trade webhook** - Add UPDATE and DELETE events
2. **Create migration to document webhooks** - Ensure they exist in version control
3. **Add monitoring helper functions** - Make debugging easier
4. **Don't use UI webhooks** - Stick with SQL migrations

### 📚 Related Documentation

- [Supabase Database Webhooks](https://supabase.com/docs/guides/database/webhooks)
- [PostgreSQL Triggers](https://supabase.com/docs/guides/database/postgres/triggers)
- [pg_net Extension](https://supabase.com/docs/guides/database/extensions/pg_net)

---

**Bottom Line**: Keep using SQL triggers. The UI webhooks feature is just a convenience wrapper that creates the same underlying triggers. For production apps with version control and team collaboration, SQL migrations are superior.
