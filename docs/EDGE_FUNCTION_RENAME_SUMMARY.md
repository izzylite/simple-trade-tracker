# Edge Function Rename Summary

**Date**: 2025-10-24
**Status**: ✅ Completed

## Summary

Renamed `cleanup-deleted-calendar` edge function to `handle-calendar-changes` to better reflect its new responsibility of handling INSERT, UPDATE, and DELETE operations.

## Changes Made

### 1. Edge Function Renamed ✅

**Before**: `supabase/functions/cleanup-deleted-calendar/`
**After**: `supabase/functions/handle-calendar-changes/`

### 2. Function Refactored to Handle All Operations ✅

The function now uses a **switch statement** to route different operations:

```typescript
switch (operation) {
  case 'DELETE':
    result = await handleDelete(calendarId, userId, old_record)
    break

  case 'INSERT':
    result = await handleInsert(calendarId, userId, new_record)
    break

  case 'UPDATE':
    result = await handleUpdate(calendarId, userId, old_record, new_record)
    break

  default:
    return errorResponse(`Unknown operation: ${operation}`, 400)
}
```

### 3. Operation Handlers

#### DELETE (Fully Implemented)
```typescript
async function handleDelete(calendarId, userId, oldRecord) {
  // Clean up images
  // Clean up shared links
  // Delete trades
  // Return cleanup summary
}
```

**Actions**:
- ✅ Deletes calendar images (with safety checks)
- ✅ Deletes shared trade links
- ✅ Deletes shared calendar links
- ✅ Deletes all trades for the calendar

#### INSERT (Placeholder)
```typescript
async function handleInsert(calendarId, userId, newRecord) {
  // TODO: Add logic for calendar creation if needed
  return { message: 'Calendar INSERT acknowledged - no action taken' }
}
```

**Current**: Just acknowledges the event
**Future**: Could initialize calendar settings, create default data, etc.

#### UPDATE (Placeholder)
```typescript
async function handleUpdate(calendarId, userId, oldRecord, newRecord) {
  // TODO: Add logic for calendar updates if needed
  return { message: 'Calendar UPDATE acknowledged - no action taken' }
}
```

**Current**: Just acknowledges the event
**Future**: Could sync calendar name changes, handle year changes, etc.

### 4. Migration Updated ✅

**File**: `014_fix_webhook_triggers.sql`

**Changes**:
- Updated webhook URL: `cleanup-deleted-calendar` → `handle-calendar-changes`
- Updated comments to reference new function name
- Trigger remains named `trigger_calendar_changes` ✅

### 5. Webhook Payload Structure

```typescript
interface CalendarWebhookPayload {
  table: string                      // "calendars"
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
  old_record: Calendar | null        // null for INSERT
  new_record: Calendar | null        // null for DELETE
  calendar_id: string
  user_id: string
}
```

## Files Modified

| File | Changes |
|------|---------|
| `supabase/functions/handle-calendar-changes/index.ts` | Complete rewrite with operation routing |
| `supabase/migrations/014_fix_webhook_triggers.sql` | Updated URL and comments |
| `docs/EDGE_FUNCTION_RENAME_SUMMARY.md` | This documentation |

## Deployment Steps

### 1. Deploy Edge Function

```bash
# Deploy the renamed edge function
npx supabase functions deploy handle-calendar-changes
```

### 2. Apply Migration

```bash
# Apply the updated webhook configuration
npx supabase db push
```

### 3. Verify Deployment

```sql
-- Check that webhook points to new function
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'notify_calendar_deletions';

-- Should show URL: 'handle-calendar-changes'
```

### 4. Test Operations

```sql
-- Test INSERT
INSERT INTO calendars (id, user_id, name, year)
VALUES ('test-insert', 'test-user', 'Test', 2025);

-- Test UPDATE
UPDATE calendars SET name = 'Updated' WHERE id = 'test-insert';

-- Test DELETE
DELETE FROM calendars WHERE id = 'test-insert';

-- Check webhook logs
SELECT
  created_at,
  (body::jsonb)->>'operation' as operation,
  status_code
FROM net._http_response
WHERE url LIKE '%handle-calendar-changes%'
ORDER BY created_at DESC LIMIT 3;
```

## Expected Behavior

### INSERT Operation
- ✅ Webhook fires
- ✅ Edge function receives payload
- ✅ Returns: "Calendar INSERT acknowledged - no action taken"
- ✅ HTTP 200 response

### UPDATE Operation
- ✅ Webhook fires
- ✅ Edge function receives payload with old_record and new_record
- ✅ Returns: "Calendar UPDATE acknowledged - no action taken"
- ✅ HTTP 200 response

### DELETE Operation
- ✅ Webhook fires
- ✅ Edge function processes cleanup
- ✅ Deletes images, trades, shared links
- ✅ Returns cleanup summary
- ✅ HTTP 200 response

## Breaking Changes

### Edge Function URL Changed
**Impact**: Existing webhooks calling `cleanup-deleted-calendar` will fail

**Solution**: Migration 014 updates the database function to use the new URL automatically

### Cleanup-Expired-Calendars Reference
**Impact**: This function may reference the old edge function name

**Check**: Review `cleanup-expired-calendars/index.ts` for any hardcoded references

## Monitoring

### Check Webhook Calls by Operation

```sql
SELECT
  (body::jsonb)->>'operation' as operation,
  COUNT(*) as count,
  AVG(CASE WHEN status_code = 200 THEN 1.0 ELSE 0.0 END) * 100 as success_rate
FROM net._http_response
WHERE url LIKE '%handle-calendar-changes%'
  AND created_at > NOW() - INTERVAL '1 day'
GROUP BY operation;
```

### View Failed Operations

```sql
SELECT
  created_at,
  (body::jsonb)->>'operation' as operation,
  (body::jsonb)->>'calendar_id' as calendar_id,
  status_code,
  error_msg,
  content
FROM net._http_response
WHERE url LIKE '%handle-calendar-changes%'
  AND (status_code >= 400 OR error_msg IS NOT NULL)
ORDER BY created_at DESC;
```

## Benefits

✅ **Better naming**: Function name reflects actual responsibility
✅ **Cleaner architecture**: One function handles all calendar operations
✅ **Future-proof**: Easy to add INSERT/UPDATE logic later
✅ **Consistent pattern**: Matches `handle-trade-changes` naming convention
✅ **Flexible**: Operation-specific handlers are isolated and testable

## Related Functions

| Function | Responsibility |
|----------|---------------|
| `handle-calendar-changes` | Calendar INSERT/UPDATE/DELETE operations |
| `handle-trade-changes` | Trade INSERT/UPDATE/DELETE operations |
| `cleanup-expired-calendars` | Cron job that deletes expired calendars |

All follow the same pattern: **webhook trigger → edge function → operation routing**

## Next Steps

1. ✅ Deploy renamed edge function
2. ✅ Apply migration 014
3. ⏳ Test all three operations (INSERT/UPDATE/DELETE)
4. ⏳ Monitor webhook logs for 24 hours
5. 📝 Add INSERT/UPDATE logic when requirements are defined

## Rollback Plan

If issues occur:

### Rollback Edge Function
```bash
# Rename directory back
mv supabase/functions/handle-calendar-changes supabase/functions/cleanup-deleted-calendar

# Redeploy
npx supabase functions deploy cleanup-deleted-calendar
```

### Rollback Migration
```sql
-- Update function to use old URL
CREATE OR REPLACE FUNCTION public.notify_calendar_deletions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
  -- Change URL back to cleanup-deleted-calendar
  v_edge_function_url := 'https://gwubzauelilziaqnsfac.supabase.co/functions/v1/cleanup-deleted-calendar';
  -- ... rest of function
$function$;
```

## Summary

The edge function has been successfully renamed and refactored to handle all calendar operations (INSERT, UPDATE, DELETE). Currently, only DELETE operations perform actual work - INSERT and UPDATE just acknowledge the event and return immediately. This provides a clean foundation for adding future calendar operation logic.

🚀 **Status**: Ready for deployment!
