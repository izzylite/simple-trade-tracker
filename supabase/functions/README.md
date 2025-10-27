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

#### Sharing Functions (Public Viewing Only)
- `get-shared-trade/` - Retrieves shared trade data for public viewing
- `get-shared-calendar/` - Retrieves shared calendar data for public viewing

**Note**: Share link generation and deactivation are now handled by ShareRepository in the frontend service layer

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

## Database Triggers Setup

After deploying Edge Functions, run these SQL commands in your Supabase SQL Editor:

```sql
-- Enable HTTP extension for webhooks
CREATE EXTENSION IF NOT EXISTS http;

-- Create trigger for trade changes
CREATE OR REPLACE FUNCTION handle_trade_changes()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://[your-project-ref].supabase.co/functions/v1/handle-trade-changes',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer [service-key]"}',
    body := json_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'old_record', row_to_json(OLD),
      'new_record', row_to_json(NEW)
    )::text
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trade_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON trades
  FOR EACH ROW EXECUTE FUNCTION handle_trade_changes();

-- Create trigger for calendar deletion
CREATE OR REPLACE FUNCTION handle_calendar_deletion()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://[your-project-ref].supabase.co/functions/v1/cleanup-deleted-calendar',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer [service-key]"}',
    body := json_build_object('calendar_id', OLD.id, 'user_id', OLD.user_id)::text
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calendar_deletion_trigger
  AFTER DELETE ON calendars
  FOR EACH ROW EXECUTE FUNCTION handle_calendar_deletion();
```

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
