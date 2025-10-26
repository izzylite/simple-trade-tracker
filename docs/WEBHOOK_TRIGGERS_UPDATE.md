# Webhook Triggers Update

**Date**: 2025-10-24
**Migration**: `014_fix_webhook_triggers.sql`
**Status**: Ready to Deploy

## Summary

Updated both database webhook triggers to fire on **INSERT, UPDATE, and DELETE** operations. The edge functions will handle the logic for each operation type.

## Changes Made

### 1. Trade Webhook Trigger ✅

**Before**:
```sql
-- Only triggered on INSERT
CREATE TRIGGER trigger_trade_changes
  AFTER INSERT ON trades
  FOR EACH ROW
  EXECUTE FUNCTION notify_trade_changes();
```

**After**:
```sql
-- Now triggers on INSERT, UPDATE, and DELETE
CREATE TRIGGER trigger_trade_changes
  AFTER INSERT OR UPDATE OR DELETE ON trades
  FOR EACH ROW
  EXECUTE FUNCTION notify_trade_changes();
```

**Function Status**: ✅ Already supported all operations (no changes needed)

### 2. Calendar Webhook Trigger ✅

**Before**:
```sql
-- Only triggered on DELETE
CREATE TRIGGER trigger_calendar_deletions
  AFTER DELETE ON calendars
  FOR EACH ROW
  EXECUTE FUNCTION notify_calendar_deletions();
```

**After**:
```sql
-- Renamed and now triggers on INSERT, UPDATE, and DELETE
CREATE TRIGGER trigger_calendar_changes
  AFTER INSERT OR UPDATE OR DELETE ON calendars
  FOR EACH ROW
  EXECUTE FUNCTION notify_calendar_deletions();
```

**Function Update**: ✅ Updated to handle INSERT and UPDATE operations

## Webhook Payload Structure

Both webhooks now send consistent payloads:

```typescript
{
  table: string;              // "trades" or "calendars"
  operation: "INSERT" | "UPDATE" | "DELETE";
  old_record: Record | null;  // Previous state (null for INSERT)
  new_record: Record | null;  // New state (null for DELETE)
  calendar_id: string;
  user_id: string;
}
```

### Operation-Specific Payloads

#### INSERT
```json
{
  "table": "trades",
  "operation": "INSERT",
  "old_record": null,
  "new_record": { "id": "...", "symbol": "AAPL", ... },
  "calendar_id": "cal_123",
  "user_id": "user_456"
}
```

#### UPDATE
```json
{
  "table": "trades",
  "operation": "UPDATE",
  "old_record": { "id": "...", "symbol": "AAPL", "pnl": 100 },
  "new_record": { "id": "...", "symbol": "AAPL", "pnl": 150 },
  "calendar_id": "cal_123",
  "user_id": "user_456"
}
```

#### DELETE
```json
{
  "table": "trades",
  "operation": "DELETE",
  "old_record": { "id": "...", "symbol": "AAPL", ... },
  "new_record": null,
  "calendar_id": "cal_123",
  "user_id": "user_456"
}
```

## Edge Functions Responsibilities

### handle-trade-changes

Will receive webhooks for:
- ✅ **INSERT**: New trade created
- ✅ **UPDATE**: Trade modified (handle image changes)
- ✅ **DELETE**: Trade deleted (clean up orphaned images)

**Current Implementation**: Already handles all three operations correctly

### cleanup-deleted-calendar

Will receive webhooks for:
- 🆕 **INSERT**: New calendar created (can ignore or add logic later)
- 🆕 **UPDATE**: Calendar modified (can ignore or add logic later)
- ✅ **DELETE**: Calendar deleted (cleanup trades, images, shared links)

**Required Update**: Edge function should check `operation` type and only process DELETE

## Migration File

**File**: [014_fix_webhook_triggers.sql](../supabase/migrations/014_fix_webhook_triggers.sql)

**What it does**:
1. Updates `trigger_trade_changes` to fire on INSERT, UPDATE, DELETE
2. Updates `notify_calendar_deletions()` function to handle all operations
3. Recreates `trigger_calendar_deletions` as `trigger_calendar_changes` with all operations
4. Adds verification checks to ensure triggers are created correctly
5. Adds documentation comments

## Deployment

### Apply Migration

```bash
# Apply the migration to your database
npx supabase db push
```

### Verify Triggers

```sql
-- Check that both triggers exist and handle all operations
SELECT
  t.tgname as trigger_name,
  t.tgrelid::regclass as table_name,
  p.proname as function_name,
  pg_get_triggerdef(t.oid) as definition
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgname IN ('trigger_trade_changes', 'trigger_calendar_changes')
ORDER BY table_name;
```

Expected output:
```
trigger_name              | table_name | function_name              | definition
--------------------------|------------|----------------------------|------------------
trigger_trade_changes     | trades     | notify_trade_changes       | ... AFTER INSERT OR UPDATE OR DELETE ...
trigger_calendar_changes  | calendars  | notify_calendar_deletions  | ... AFTER INSERT OR UPDATE OR DELETE ...
```

## Edge Function Updates Needed

### cleanup-deleted-calendar

The edge function should check the operation type:

```typescript
// In cleanup-deleted-calendar/index.ts
const payload = await parseJsonBody(req);

// Only process DELETE operations
if (payload.operation !== 'DELETE') {
  log(`Ignoring ${payload.operation} operation for calendar ${payload.calendar_id}`);
  return successResponse({
    message: `Operation ${payload.operation} ignored - only DELETE is processed`,
    operation: payload.operation
  });
}

// Continue with cleanup logic for DELETE...
```

### handle-trade-changes

Already handles all operations correctly - no changes needed!

## Testing

### Test Trade Webhook

```sql
-- Test INSERT
INSERT INTO trades (calendar_id, user_id, trade_date, symbol)
VALUES ('test-cal', 'test-user', NOW(), 'TEST');

-- Test UPDATE
UPDATE trades SET pnl = 100 WHERE symbol = 'TEST';

-- Test DELETE
DELETE FROM trades WHERE symbol = 'TEST';

-- Check webhook calls
SELECT
  created_at,
  url,
  status_code,
  (body::jsonb)->>'operation' as operation
FROM net._http_response
WHERE url LIKE '%handle-trade-changes%'
ORDER BY created_at DESC LIMIT 3;
```

### Test Calendar Webhook

```sql
-- Test INSERT
INSERT INTO calendars (id, user_id, name, year)
VALUES ('test-cal-2', 'test-user', 'Test Calendar', 2025);

-- Test UPDATE
UPDATE calendars SET name = 'Updated Calendar' WHERE id = 'test-cal-2';

-- Test DELETE
DELETE FROM calendars WHERE id = 'test-cal-2';

-- Check webhook calls
SELECT
  created_at,
  url,
  status_code,
  (body::jsonb)->>'operation' as operation
FROM net._http_response
WHERE url LIKE '%cleanup-deleted-calendar%'
ORDER BY created_at DESC LIMIT 3;
```

## Monitoring

### View All Webhook Executions

```sql
SELECT
  created_at,
  CASE
    WHEN url LIKE '%handle-trade-changes%' THEN 'Trade Webhook'
    WHEN url LIKE '%cleanup-deleted-calendar%' THEN 'Calendar Webhook'
    ELSE 'Unknown'
  END as webhook_type,
  (body::jsonb)->>'operation' as operation,
  (body::jsonb)->>'table' as table_name,
  status_code,
  CASE
    WHEN status_code = 200 THEN '✅ Success'
    WHEN status_code >= 400 THEN '❌ Error'
    ELSE '⚠️ Unknown'
  END as result
FROM net._http_response
WHERE url LIKE '%/functions/v1/%'
ORDER BY created_at DESC
LIMIT 20;
```

### View Failed Webhooks

```sql
SELECT
  created_at,
  url,
  (body::jsonb)->>'operation' as operation,
  status_code,
  error_msg,
  content
FROM net._http_response
WHERE url LIKE '%/functions/v1/%'
  AND (status_code >= 400 OR error_msg IS NOT NULL)
ORDER BY created_at DESC;
```

## Breaking Changes

### None for Trade Webhook
The `handle-trade-changes` edge function already handles all operations, so no breaking changes.

### Potential Issue for Calendar Webhook
The `cleanup-deleted-calendar` edge function currently only expects DELETE operations. After this migration, it will also receive INSERT and UPDATE operations.

**Solution**: Update the edge function to check `payload.operation` and only process DELETE (see code example above).

## Rollback Plan

If issues occur, rollback the migration:

```sql
-- Rollback trade trigger to INSERT only
DROP TRIGGER IF EXISTS trigger_trade_changes ON trades;
CREATE TRIGGER trigger_trade_changes
  AFTER INSERT ON trades
  FOR EACH ROW
  EXECUTE FUNCTION notify_trade_changes();

-- Rollback calendar trigger to DELETE only
DROP TRIGGER IF EXISTS trigger_calendar_changes ON calendars;
CREATE TRIGGER trigger_calendar_deletions
  AFTER DELETE ON calendars
  FOR EACH ROW
  EXECUTE FUNCTION notify_calendar_deletions();
```

## Benefits

✅ **Consistent behavior**: Both triggers now work the same way
✅ **Future-proof**: Edge functions can add logic for INSERT/UPDATE later
✅ **Better monitoring**: Can track all operations in webhook logs
✅ **Flexibility**: Edge functions decide which operations to process
✅ **Cleaner architecture**: Trigger handles routing, function handles logic

## Related Documentation

- [Webhook Best Practices](./WEBHOOK_BEST_PRACTICES.md)
- [handle-trade-changes Edge Function](../supabase/functions/handle-trade-changes/index.ts)
- [cleanup-deleted-calendar Edge Function](../supabase/functions/cleanup-deleted-calendar/index.ts)
- [Migration File](../supabase/migrations/014_fix_webhook_triggers.sql)

## Summary

Both webhook triggers now fire on **INSERT, UPDATE, and DELETE**. The edge functions will check the `operation` field in the payload and decide how to handle each operation type. This provides maximum flexibility and follows the principle of separation of concerns.

🚀 **Ready to deploy!**
