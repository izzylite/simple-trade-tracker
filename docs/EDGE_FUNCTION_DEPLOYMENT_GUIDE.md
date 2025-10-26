# Edge Function Deployment Guide

**Date**: 2025-10-24
**Function**: `handle-trade-changes`
**Status**: Ready for deployment with critical path fix

## What Was Fixed

The edge function had an incorrect image deletion path that would prevent images from being deleted from Supabase Storage.

### Bug Fixed
- **Wrong Path**: `${userId}/${imageId}`
- **Correct Path**: `users/${userId}/trade-images/${imageId}`

### Location
[handle-trade-changes/index.ts:98](../supabase/functions/handle-trade-changes/index.ts#L98)

```typescript
// Path must match upload path: users/${userId}/trade-images/${filename}
const filePath = `users/${userId}/trade-images/${imageId}`
const { error } = await supabase.storage
  .from('trade-images')
  .remove([filePath])
```

## Deployment Steps

### Step 1: Set Up Supabase Access Token

You need to set the `SUPABASE_ACCESS_TOKEN` environment variable. You can get this token from:

1. Go to Supabase Dashboard → Account → Access Tokens
2. Create a new token or copy existing one
3. Set the environment variable:

**Windows (PowerShell)**:
```powershell
$env:SUPABASE_ACCESS_TOKEN = "your-token-here"
```

**Windows (CMD)**:
```cmd
set SUPABASE_ACCESS_TOKEN=your-token-here
```

**Linux/Mac**:
```bash
export SUPABASE_ACCESS_TOKEN=your-token-here
```

### Step 2: Link to Project

```bash
npx supabase link --project-ref gwubzauelilziaqnsfac
```

### Step 3: Deploy the Edge Function

```bash
npx supabase functions deploy handle-trade-changes
```

You should see output like:
```
Uploading asset (handle-trade-changes): supabase/functions/handle-trade-changes/deno.json
Uploading asset (handle-trade-changes): supabase/functions/handle-trade-changes/index.ts
Uploading asset (handle-trade-changes): supabase/functions/_shared/utils.ts
Uploading asset (handle-trade-changes): supabase/functions/_shared/types.ts
Uploading asset (handle-trade-changes): supabase/functions/_shared/supabase.ts
Deployed Function handle-trade-changes with version: 3
```

## Verification Steps

### 1. Check Function is Deployed

Go to Supabase Dashboard → Edge Functions and verify:
- Function name: `handle-trade-changes`
- Version: Should be 3 (or higher)
- Status: Active

### 2. Test Image Deletion

1. Create a test trade with an image
2. Delete the trade
3. Verify in Supabase Storage that the image file is removed
4. Check the path in Storage: `trade-images/users/{userId}/trade-images/`

### 3. Monitor Edge Function Logs

In Supabase Dashboard → Edge Functions → handle-trade-changes → Logs

Look for:
```
✅ Starting image cleanup process
✅ Found N images to potentially delete
✅ Image {imageId} can be safely deleted
✅ Successfully deleted image: {imageId}
✅ Image cleanup completed: N images deleted
```

### 4. Check Webhook Execution

Run this SQL query in Supabase SQL Editor:

```sql
SELECT
  id,
  created_at,
  url,
  status_code,
  content
FROM net._http_response
WHERE url LIKE '%handle-trade-changes%'
ORDER BY created_at DESC
LIMIT 10;
```

Successful webhooks should have `status_code = 200`.

## Current Edge Function Info

- **Function ID**: d92bc16a-c715-48a5-a8ba-8216cc2512e6
- **Current Version**: 2 (deployed with incorrect path)
- **New Version**: Will be 3 after deployment
- **Webhook**: Already configured in migration 012

## What the Edge Function Does

1. **On DELETE**: Deletes all images from the deleted trade
2. **On UPDATE**: Deletes images that were removed from the trade
3. **Safety Check**: Verifies images aren't used in duplicated calendars before deleting
4. **Non-blocking**: Image cleanup failures don't prevent trade deletion

## Files Involved

- [supabase/functions/handle-trade-changes/index.ts](../supabase/functions/handle-trade-changes/index.ts) - Main function (193 lines)
- [supabase/functions/_shared/supabase.ts](../supabase/functions/_shared/supabase.ts) - Shared utilities
- [supabase/functions/_shared/types.ts](../supabase/functions/_shared/types.ts) - Type definitions
- [supabase/functions/_shared/utils.ts](../supabase/functions/_shared/utils.ts) - Helper functions

## Troubleshooting

### 403 Error: Insufficient Privileges

**Problem**: `Your account does not have the necessary privileges to access this endpoint`

**Solution**: Make sure you're using a valid access token with admin privileges:
1. Go to Supabase Dashboard → Account → Access Tokens
2. Create a new token with **all scopes** enabled
3. Set it as `SUPABASE_ACCESS_TOKEN` environment variable

### Webhook Not Triggering

**Problem**: Edge function logs show no activity after deleting a trade

**Solution**: Check if webhook is configured:
```sql
SELECT * FROM pg_trigger WHERE tgname = 'trigger_trade_changes';
```

If missing, run migration 012:
```bash
npx supabase db push
```

### Images Not Being Deleted

**Problem**: Trade is deleted but images remain in storage

**Solution**:
1. Check edge function logs for errors
2. Verify the storage path matches: `users/{userId}/trade-images/{imageId}`
3. Check if service role key has storage permissions
4. Verify webhook execution in `net._http_response` table

## Post-Deployment Testing

Create a test checklist:

- [ ] Delete a single trade with one image - verify image removed from storage
- [ ] Delete a single trade with multiple images - verify all images removed
- [ ] Update a trade to remove an image - verify image removed
- [ ] Delete a trade from a duplicated calendar - verify images NOT deleted if used elsewhere
- [ ] Check edge function logs show successful cleanup
- [ ] Verify webhook execution in database
- [ ] Confirm calendar stats updated after deletion

## Rollback Plan

If the new version causes issues:

1. Go to Supabase Dashboard → Edge Functions → handle-trade-changes
2. Click "Versions"
3. Select version 2 (previous)
4. Click "Deploy this version"

However, note that version 2 has the incorrect path bug, so only rollback if there's a critical failure.

## Next Steps After Deployment

1. Monitor production for 24 hours
2. Check storage usage to verify images are being deleted
3. Review edge function logs for any errors
4. Update [TRADE_DELETION_FINAL_STATUS.md](./TRADE_DELETION_FINAL_STATUS.md) with deployment confirmation
5. Consider adding error alerting for edge function failures
