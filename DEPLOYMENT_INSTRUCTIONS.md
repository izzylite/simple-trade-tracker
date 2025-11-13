# Edge Functions Deployment Instructions

## Issue Summary

The economic event watcher is returning 0 events because:

1. **`process-economic-events` function** was not including the events array in its response
2. **`refresh-economic-calendar` function** had incorrect field matching logic

## Files That Need to Be Deployed

### 1. process-economic-events
**File:** `supabase/functions/process-economic-events/index.ts`

**Changes Made:**
- Line 458: Added `events: majorCurrencyEvents` to the response object
- This ensures the function returns the actual events, not just statistics

### 2. refresh-economic-calendar
**File:** `supabase/functions/refresh-economic-calendar/index.ts`

**Changes Made:**
- Line 242: Changed `event.external_id` to `event.id || event.external_id`
- Line 247: Changed matching logic to use `eventId` variable
- This fixes the event matching logic since MyFXBook events use `id` field

## Deployment Options

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to https://supabase.com/dashboard/project/gwubzauelilziaqnsfac
2. Navigate to **Edge Functions** in the left sidebar
3. For each function:
   - Click on the function name
   - Click **Edit Function**
   - Copy the entire content from the local file
   - Paste it into the editor
   - Click **Deploy**

### Option 2: Via Supabase CLI (If Permissions Fixed)

First, re-authenticate:
```bash
npx supabase login
```

Then deploy both functions:
```bash
npx supabase functions deploy process-economic-events
npx supabase functions deploy refresh-economic-calendar
```

## Testing After Deployment

Run the test script to verify the fix:
```bash
npx tsx test-refresh-calendar.ts
```

**Expected Results:**
- `foundEvents` should contain 1 event (the "Unemployment Rate Q3" event)
- `message` should say "Found 1/1 requested events"
- The event should have updated `actual` value if it changed

## What This Fixes

Once deployed, the economic event watcher will:
1. ✅ Receive actual events from the edge function (not empty arrays)
2. ✅ Correctly match requested events by ID
3. ✅ Detect when events have been updated with actual values
4. ✅ Trigger real-time updates in the UI

The log message will change from:
```
📊 Edge function returned 0 total events, 0 specifically requested events
```

To something like:
```
📊 Edge function returned 27 total events, 1 specifically requested events
```

