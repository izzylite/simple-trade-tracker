# Manual Deployment Guide for Edge Functions

## ⚠️ CLI Deployment Issue

The Supabase CLI is returning a 403 error:
```
Your account does not have the necessary privileges to access this endpoint
```

This means your account doesn't have Owner/Admin role on the Supabase project. You'll need to deploy manually via the dashboard.

## 📋 Step-by-Step Deployment via Dashboard

### 1. Deploy `process-economic-events`

1. Go to: https://supabase.com/dashboard/project/gwubzauelilziaqnsfac/functions
2. Click on **`process-economic-events`** function
3. Click **Edit Function** or **Deploy New Version**
4. Copy the ENTIRE content from: `supabase/functions/process-economic-events/index.ts`
5. Paste it into the editor
6. Click **Deploy**

**Key Change to Verify:**
Look for line ~458 in the deployed code. It should have:
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
  events: majorCurrencyEvents // ← THIS LINE MUST BE PRESENT
}
```

### 2. Deploy `refresh-economic-calendar`

1. Still in: https://supabase.com/dashboard/project/gwubzauelilziaqnsfac/functions
2. Click on **`refresh-economic-calendar`** function
3. Click **Edit Function** or **Deploy New Version**
4. Copy the ENTIRE content from: `supabase/functions/refresh-economic-calendar/index.ts`
5. Paste it into the editor
6. Click **Deploy**

**Key Changes to Verify:**
Look for line ~242 and ~247. They should have:
```typescript
// Line ~242
foundEvents = allEventsForDate.filter((event) => 
  requestedEventIds.includes(event.id || event.external_id) // ← Check both id and external_id
);

// Line ~247
const eventId = foundEvent.id || foundEvent.external_id; // ← Get the correct ID
const originalEvent = requestedEvents.find((e) => 
  (e as Record<string, unknown>).external_id === eventId
);
```

## ✅ Testing After Deployment

Once both functions are deployed, run the test:

```bash
npx tsx test-refresh-calendar.ts
```

**Expected Output:**
```
📊 Edge function returned 27 total events, 1 specifically requested events
✅ Found Events (matching requested):
  Event 1:
    - Name: Unemployment Rate Q3
    - Currency: EUR
    - Actual: 7.7%
```

## 🔧 Alternative: Request Admin Access

If you need to deploy via CLI frequently, ask the project owner to:
1. Go to: https://supabase.com/dashboard/project/gwubzauelilziaqnsfac/settings/general
2. Navigate to **Team Settings**
3. Change your role to **Owner** or **Admin**

Then you'll be able to use:
```bash
npx supabase functions deploy process-economic-events
npx supabase functions deploy refresh-economic-calendar
```

## 📝 Files to Copy

The files you need to copy are located at:
- `supabase/functions/process-economic-events/index.ts`
- `supabase/functions/refresh-economic-calendar/index.ts`

Both files have been updated with the fixes and are ready to deploy!

