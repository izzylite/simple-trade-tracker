# Supabase Edge Functions

This directory contains all Edge Functions for the Simple Trade Tracker application, migrated from Firebase Cloud Functions.

## Setup

### Prerequisites
- Deno 2.1+ installed
- Supabase CLI installed
- Docker (for local development)

### Environment Variables
1. Copy `.env.example` to `.env`
2. Fill in your Supabase project credentials
3. Set any additional API keys as needed

### Local Development

#### Start Supabase locally:
```bash
supabase start
```

#### Serve a specific function:
```bash
supabase functions serve function-name --no-verify-jwt
```

#### Test a function:
```bash
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/function-name' \
  --header 'Authorization: Bearer [token]' \
  --header 'Content-Type: application/json' \
  --data '{"key":"value"}'
```

## Function Structure

### Shared Utilities (`_shared/`)
- `supabase.ts` - Database client and authentication utilities
- `types.ts` - TypeScript interfaces and types
- `utils.ts` - Business logic helpers

### Functions Overview

#### Database Triggers
- `handle-trade-changes/` - Processes trade updates (replaces onTradeChangedV2)
- `cleanup-deleted-calendar/` - Handles calendar deletion cleanup

#### HTTP Endpoints (Callable Functions)
- `update-tag/` - Updates tags across calendar trades
- `process-economic-events/` - Processes economic calendar HTML data
- `refresh-economic-calendar/` - Manually refreshes economic data

#### Scheduled Functions
- `cleanup-expired-calendars/` - Daily cleanup of expired calendars
- `auto-refresh-economic-calendar/` - Periodic economic data refresh

#### Sharing Functions (Consolidated)
- `generate-share-link/` - Creates a share link for a trade, calendar, or note (auth required)
- `get-shared-link/` - Retrieves shared trade / calendar / note data for public viewing
- `deactivate-share-link/` - Clears share flags on a trade, calendar, or note (auth required)

All three accept a `type: 'trade' | 'calendar' | 'note'` discriminator in the JSON body.

## Deployment

### Deploy all functions:
```bash
supabase functions deploy
```

### Deploy specific function:
```bash
supabase functions deploy function-name
```

### Set environment variables:
```bash
supabase secrets set --env-file .env
```

## Database Triggers & Webhooks

DB triggers/webhooks live in `supabase/migrations/` — the source of truth. Do
**not** copy DDL out of this README and run it by hand; hand-maintained trigger
SQL drifts from the migrations (this section used to, and instructed recreating an
already-dropped trigger). Add a migration instead of hand-creating a trigger.

Current wiring:

- **Trade changes** → `trigger_trade_changes → notify_trade_changes()`
  (`012_setup_webhooks.sql`, hardened in `20260518000000_*`). POSTs to the
  `handle-trade-changes` edge function with an `X-Trade-Webhook-Secret` shared-secret
  header (the function is `verify_jwt = false`), and early-returns when the bulk
  guard `app.skip_trade_webhook = 'true'` is set.
  > The legacy duplicate `trade_changes_trigger → handle_trade_changes()` was
  > **dropped** 2026-05-31 (`20260531225101_*`) — do not recreate it. Note the name
  > collision: the DB trigger function is `notify_trade_changes`, *not* a
  > same-named `handle_trade_changes()`; the latter mirrored the `handle-trade-changes`
  > edge-function slug and was the duplicate that was removed.
- **Calendar changes** → `trigger_calendar_changes → notify_calendar_deletions()`
  → `handle-calendar-changes` edge function.
- **Year-stats reconciliation** → pg_cron `year-stats-sweep` → `reconcile-year-stats`
  edge function (backstops coalesced/failed `year_stats` recomputes).

## Scheduled Functions Setup

Configure cron jobs in the Supabase Dashboard:

1. Go to Database → Cron Jobs
2. Add new cron job:
   - **Name**: cleanup-expired-calendars
   - **Schedule**: `0 2 * * *` (daily at 2 AM)
   - **Command**: `SELECT net.http_post('https://[project-ref].supabase.co/functions/v1/cleanup-expired-calendars', '{"Authorization": "Bearer [service-key]"}')`

3. Add another cron job:
   - **Name**: auto-refresh-economic-calendar
   - **Schedule**: `*/30 * * * *` (every 30 minutes)
   - **Command**: `SELECT net.http_post('https://[project-ref].supabase.co/functions/v1/auto-refresh-economic-calendar', '{"Authorization": "Bearer [service-key]"}')`

## Testing

Each function directory contains test files. Run tests with:

```bash
cd function-directory
deno run --allow-all test.ts
```

## Migration Status

- ✅ Environment setup complete
- ✅ Shared utilities created
- ✅ Directory structure established
- ⏳ Individual functions implementation (in progress)
- ⏳ Database triggers setup
- ⏳ Scheduled functions configuration
- ⏳ Integration testing
