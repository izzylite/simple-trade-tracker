# Edge Function Deployment Guide

## Issue Fixed
The `process-economic-events` edge function was not returning the events array, causing the economic event watcher to receive 0 events.

## Changes Made
Modified `supabase/functions/process-economic-events/index.ts` line 459 to include the events in the response:

```typescript
const response: ProcessEconomicEventsResponse = {
  success: true,
  events_processed: events.length,
  events_stored: upserted,
  parsed_total: events.length,
  existing_count: existing,
  inserted_count: inserted,
  upserted_count: upserted,
  message: `Processed ${events.length} events; upserted=${upserted}, existing=${existing}, inserted=${inserted}`,
  events: majorCurrencyEvents // ✅ NEW: Include the actual events in the response
}
```

## Manual Deployment via Supabase Dashboard

Since the CLI is having authentication issues, please deploy manually:

### Steps:

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/gwubzauelilziaqnsfac

2. **Navigate to Edge Functions**
   - Click on "Edge Functions" in the left sidebar
   - Find "process-economic-events" in the list

3. **Deploy the Updated Function**
   - Click on the function name
   - Click "Deploy new version" or "Edit"
   - The function code is located at: `supabase/functions/process-economic-events/index.ts`
   - Copy the entire contents of the file
   - Paste it into the editor
   - Click "Deploy"

4. **Verify Deployment**
   - After deployment, the function should show a new version number
   - Check the deployment logs for any errors

## Testing After Deployment

Run the test script to verify the fix:

```bash
npx tsx test-refresh-calendar.ts
```

Expected output:
```
📊 Edge function returned 27 total events, 1 specifically requested events
```

Instead of the previous:
```
📊 Edge function returned 0 total events, 0 specifically requested events
```

## Alternative: CLI Deployment (if authentication is fixed)

```bash
npx supabase login
npx supabase functions deploy process-economic-events
```

## Files Modified
- `supabase/functions/process-economic-events/index.ts` (line 459)

