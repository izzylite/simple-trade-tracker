# Firebase to Supabase Edge Functions Mapping

## Overview
This document maps each Firebase Cloud Function to its Supabase Edge Function equivalent, detailing the implementation approach, required changes, and migration strategy.

## Current Supabase Setup Status
✅ **Database Schema**: PostgreSQL schema with proper relationships  
✅ **Authentication**: Supabase Auth with Google OAuth  
✅ **Storage**: Supabase Storage with RLS policies  
✅ **Vector Database**: pgvector extension for AI features  
✅ **Migration Scripts**: Data migration from Firebase completed  

## Function Mapping

### 1. Firestore Triggers → Database Webhooks

#### onTradeChangedV2 → Database Trigger + Edge Function
**Firebase Implementation:**
- Firestore trigger on `calendars/{calendarId}/years/{yearId}`
- Handles image cleanup, year changes, tag updates

**Supabase Implementation:**
```sql
-- Database trigger function
CREATE OR REPLACE FUNCTION handle_trade_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Call Edge Function via HTTP request
  PERFORM net.http_post(
    url := 'https://[project-ref].supabase.co/functions/v1/handle-trade-changes',
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

-- Trigger on trades table
CREATE TRIGGER trade_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON trades
  FOR EACH ROW EXECUTE FUNCTION handle_trade_changes();
```

**Edge Function:** `/supabase/functions/handle-trade-changes/index.ts`
- HTTP endpoint receiving webhook data
- Implements image cleanup logic
- Handles calendar tag synchronization
- Uses Supabase Storage API instead of Firebase Storage

#### cleanupDeletedCalendarV2 → Database Trigger + Edge Function
**Firebase Implementation:**
- Firestore trigger on `calendars/{calendarId}` deletion
- Recursive subcollection cleanup

**Supabase Implementation:**
```sql
-- Database trigger for calendar deletion
CREATE OR REPLACE FUNCTION handle_calendar_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- Call Edge Function for cleanup
  PERFORM net.http_post(
    url := 'https://[project-ref].supabase.co/functions/v1/cleanup-deleted-calendar',
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

**Edge Function:** `/supabase/functions/cleanup-deleted-calendar/index.ts`
- Cascading deletes using foreign key relationships
- Storage cleanup via Supabase Storage API
- Batch processing for large datasets

### 2. Callable Functions → HTTP Edge Functions

#### updateTagV2 → Edge Function
**Firebase Implementation:**
- HTTPS callable function with App Check
- Complex tag group logic
- Firestore transactions

**Supabase Implementation:**
**Edge Function:** `/supabase/functions/update-tag/index.ts`
```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  // JWT authentication
  const authHeader = req.headers.get('Authorization')
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader! } } }
  )

  // Verify user authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Process tag updates with PostgreSQL transactions
  const { calendarId, oldTag, newTag } = await req.json()
  
  // Implementation with proper transaction handling
  // ...
})
```

#### Economic Calendar Functions → Edge Functions
**Functions to migrate:**
- `processHtmlEconomicEvents` → `/supabase/functions/process-economic-events/index.ts`
- `refreshEconomicCalendar` → `/supabase/functions/refresh-economic-calendar/index.ts`

**Key Changes:**
- Replace `cheerio` with `deno-dom` for HTML parsing
- Use Deno's built-in `fetch` API
- PostgreSQL storage instead of Firestore

### 3. Scheduled Functions → Supabase Cron Edge Functions

#### cleanupExpiredCalendarsV2 → Scheduled Edge Function
**Firebase Implementation:**
- Cloud Scheduler: `0 2 * * *`
- Firestore queries and deletions

**Supabase Implementation (2025 Update):**
- **Native Cron Support**: Configure schedule directly in Supabase Dashboard or CLI
- **Cron Expression**: `0 2 * * *` (daily at 2 AM)
- **Function**: `/supabase/functions/cleanup-expired-calendars/index.ts`

```typescript
// Scheduled Edge Function - no HTTP trigger needed
Deno.serve(async (req: Request) => {
  // Scheduled functions receive standard HTTP requests
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // PostgreSQL queries with proper indexing
  const { data: expiredCalendars } = await supabase
    .from('calendars')
    .select('id, user_id')
    .eq('is_deleted', true)
    .lt('auto_delete_at', new Date().toISOString())

  // Batch processing with error handling
  // ...

  return new Response('Cleanup completed', { status: 200 })
})
```

#### autoRefreshEconomicCalendarV2 → Scheduled Edge Function
**Firebase Implementation:**
- Cloud Scheduler: `*/30 * * * *`
- MyFXBook API integration

**Supabase Implementation:**
- **Cron Expression**: `*/30 * * * *` (every 30 minutes)
- **Function**: `/supabase/functions/auto-refresh-economic-calendar/index.ts`
- **Background Tasks**: Use `EdgeRuntime.waitUntil` for long-running API calls

### 4. Sharing Functions → Edge Functions

#### Sharing Function Mapping
All sharing functions become HTTP Edge Functions:

1. `generateTradeShareLinkV2` → `/supabase/functions/generate-trade-share-link/index.ts`
2. `getSharedTradeV2` → `/supabase/functions/get-shared-trade/index.ts`
3. `deactivateSharedTradeV2` → `/supabase/functions/deactivate-shared-trade/index.ts`
4. `generateCalendarShareLinkV2` → `/supabase/functions/generate-calendar-share-link/index.ts`
5. `getSharedCalendarV2` → `/supabase/functions/get-shared-calendar/index.ts`
6. `deactivateSharedCalendarV2` → `/supabase/functions/deactivate-shared-calendar/index.ts`

**Key Changes:**
- PostgreSQL storage with proper RLS policies
- JWT authentication instead of Firebase Auth
- Maintain existing URL structure for compatibility

## Latest Supabase Features (2025)

### Native Cron Support
- **Dashboard Configuration**: Schedule Edge Functions directly in Supabase Dashboard
- **No SQL Cron Required**: Native scheduling without pg_cron extension
- **Flexible Limits**: 150 seconds (free tier), 400 seconds (paid plans)

### Background Tasks
- **EdgeRuntime.waitUntil**: Support for long-running background tasks
- **Non-blocking**: Process tasks without blocking HTTP responses
- **Use Cases**: File processing, batch operations, external API calls

### Enhanced Development Experience
- **Dashboard Editor**: Create and edit functions directly in browser
- **AI Assistance**: Inline code help and suggestions
- **Templates**: Pre-built templates for common use cases
- **Direct Download**: Export function code for version control

## Implementation Strategy

### Phase 1: Environment Setup
1. Install Supabase CLI and Deno 2.1+
2. Initialize Edge Functions directory structure: `/supabase/functions/`
3. Configure environment variables and secrets via CLI
4. Set up shared utilities in `_shared` folder

### Phase 2: Database Triggers & Webhooks
1. Create PostgreSQL trigger functions for data changes
2. Set up HTTP webhooks to Edge Functions using `net.http_post`
3. Implement Edge Functions to handle database events
4. Test trigger functionality with sample data

### Phase 3: HTTP Endpoints (Callable Functions)
1. Migrate Firebase callable functions to Edge Functions
2. Implement JWT authentication and CORS handling
3. Test API compatibility with existing client code
4. Update client-side function calls to new endpoints

### Phase 4: Scheduled Functions
1. Configure native Supabase Cron schedules in Dashboard
2. Create corresponding Edge Functions for scheduled tasks
3. Implement background task processing with `waitUntil`
4. Test scheduling and execution with proper error handling

### Phase 5: Integration & Testing
1. End-to-end testing of all migrated functions
2. Performance optimization and cold start mitigation
3. Comprehensive error handling and logging
4. Load testing and monitoring setup

## Key Differences and Considerations

### Runtime Environment
- **Node.js → Deno**: Different module system, built-in TypeScript
- **npm packages → Deno modules**: Use `https://esm.sh/` or `https://deno.land/x/`
- **File system**: Limited to `/tmp` directory for writes

### Database Operations
- **Firestore → PostgreSQL**: Relational model, SQL queries
- **Transactions**: PostgreSQL transaction semantics
- **Triggers**: Database-level triggers instead of Firestore triggers

### Authentication
- **Firebase Auth → Supabase Auth**: JWT token validation
- **App Check → Custom validation**: Implement alternative security
- **Service keys**: Use Supabase service role key

### Storage
- **Firebase Storage → Supabase Storage**: Different API, same functionality
- **File paths**: Maintain compatibility with existing structure
- **RLS policies**: Implement proper access control

### External APIs
- **MyFXBook integration**: Maintain existing API calls
- **HTML parsing**: Replace cheerio with deno-dom
- **HTTP requests**: Use Deno's built-in fetch API

## Next Steps
1. Set up Supabase Edge Functions development environment
2. Create directory structure for all functions
3. Begin implementation starting with simpler functions
4. Implement database triggers and webhooks
5. Test each function individually before integration
