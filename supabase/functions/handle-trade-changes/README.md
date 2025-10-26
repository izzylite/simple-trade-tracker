# Handle Trade Changes Edge Function

This Edge Function replaces the Firebase `onTradeChangedV2` trigger and handles trade modifications through database webhooks.

## Purpose

Processes trade changes and performs:
- **Image cleanup** - Removes unused trade images from storage
- **Year changes** - Handles trade date changes (adapted for PostgreSQL schema)
- **Tag synchronization** - Updates calendar-level tag lists when trade tags change

## Trigger Setup

This function is triggered by PostgreSQL database webhooks. Set up the trigger with this SQL:

```sql
-- Enable HTTP extension for webhooks
CREATE EXTENSION IF NOT EXISTS http;

-- Create trigger function
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
      'new_record', row_to_json(NEW),
      'calendar_id', COALESCE(NEW.calendar_id, OLD.calendar_id),
      'user_id', COALESCE(NEW.user_id, OLD.user_id)
    )::text
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger on trades table
CREATE TRIGGER trade_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON trades
  FOR EACH ROW EXECUTE FUNCTION handle_trade_changes();
```

## Request Format

The function expects a webhook payload with:

```typescript
{
  table: 'trades',
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  old_record?: Trade,      // Required for UPDATE and DELETE
  new_record?: Trade,      // Required for INSERT and UPDATE
  calendar_id?: string,    // Extracted from records
  user_id?: string        // Extracted from records
}
```

## Response Format

Success response:
```json
{
  "success": true,
  "message": "Trade changes processed successfully",
  "calendar_id": "uuid",
  "operation": "UPDATE"
}
```

Error response:
```json
{
  "success": false,
  "error": "Error message"
}
```

## Operations Handled

### INSERT Operations
- No cleanup needed
- Returns success immediately

### UPDATE Operations
- Compares before/after trade states
- Removes unused images from storage
- Updates calendar tags if trade tags changed
- Handles year changes (adapted for PostgreSQL)

### DELETE Operations
- Processes image cleanup for deleted trade
- Updates calendar tags to remove unused tags
- Handles cascading effects

## Image Cleanup Logic

1. **Identify removed images** - Compare before/after image lists
2. **Safety check** - Verify images aren't used in other trades or duplicated calendars
3. **Storage deletion** - Remove safe-to-delete images from Supabase Storage

## Tag Synchronization

1. **Detect changes** - Compare before/after tag sets
2. **Rebuild tag list** - Query all trades in calendar for complete tag list
3. **Update calendar** - Store updated tags array in calendar record

## Testing

Run the test suite:
```bash
deno run --allow-all test.ts
```

Tests cover:
- ✅ CORS handling
- ✅ Valid INSERT/UPDATE/DELETE operations
- ✅ Error handling for invalid payloads
- ✅ Missing required fields validation

## Deployment

Deploy this function:
```bash
supabase functions deploy handle-trade-changes
```

## Environment Variables

Required:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database operations

## Migration Notes

**From Firebase onTradeChangedV2:**
- ✅ Image cleanup logic migrated
- ✅ Tag synchronization migrated  
- ⚠️ Year changes adapted for PostgreSQL (no subcollections)
- ✅ Error handling and logging improved
- ✅ CORS support added for webhook calls

**Key Differences:**
- Uses HTTP webhooks instead of Firestore triggers
- PostgreSQL transactions instead of Firestore transactions
- Supabase Storage API instead of Firebase Storage
- Direct database queries instead of subcollection operations
