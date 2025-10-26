# Cleanup Deleted Calendar Edge Function

This Edge Function replaces the Firebase `cleanupDeletedCalendarV2` trigger and handles comprehensive cleanup when calendars are deleted.

## Purpose

Performs complete cleanup when a calendar is deleted:
- **Image cleanup** - Removes trade images with safety checks for duplicated calendars
- **Trade deletion** - Removes all associated trades (with CASCADE support)
- **Shared links cleanup** - Removes shared trade and calendar links
- **Data consistency** - Ensures no orphaned data remains

## Trigger Setup

This function is triggered by PostgreSQL database webhooks. Set up the trigger with this SQL:

```sql
-- Enable HTTP extension for webhooks
CREATE EXTENSION IF NOT EXISTS http;

-- Create trigger function
CREATE OR REPLACE FUNCTION handle_calendar_deletion()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://[your-project-ref].supabase.co/functions/v1/cleanup-deleted-calendar',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer [service-key]"}',
    body := json_build_object(
      'calendar_id', OLD.id,
      'user_id', OLD.user_id,
      'calendar_data', row_to_json(OLD)
    )::text
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on calendars table
CREATE TRIGGER calendar_deletion_trigger
  AFTER DELETE ON calendars
  FOR EACH ROW EXECUTE FUNCTION handle_calendar_deletion();
```

## Request Format

The function expects a webhook payload with:

```typescript
{
  calendar_id: string,        // Required: ID of deleted calendar
  user_id: string,           // Required: Owner user ID
  calendar_data?: Calendar   // Optional: Full calendar data for context
}
```

## Response Format

Success response:
```json
{
  "success": true,
  "message": "Calendar cleanup completed successfully",
  "calendar_id": "uuid",
  "cleanup_summary": {
    "images_deleted": 5,
    "trades_deleted": 23,
    "shared_links_deleted": 2
  }
}
```

Error response:
```json
{
  "success": false,
  "error": "Error message"
}
```

## Cleanup Operations

### 1. Image Cleanup
- **Extract image IDs** from all trades in the calendar
- **Safety validation** using `canDeleteImage()` utility
- **Duplicate calendar check** - Don't delete images used in source/duplicated calendars
- **Storage deletion** from Supabase Storage bucket

### 2. Trade Deletion
- **Cascade delete** all trades associated with the calendar
- **Count tracking** for cleanup summary
- **Error handling** for partial failures

### 3. Shared Links Cleanup
- **Shared trades** - Remove from `shared_trades` table
- **Shared calendars** - Remove from `shared_calendars` table
- **Parallel processing** for efficiency

## Safety Features

### Duplicated Calendar Handling
- **Source calendar protection** - Images in source calendars are preserved
- **Cross-reference checking** - Images used in other duplicated calendars are preserved
- **Comprehensive validation** using shared utility functions

### Error Resilience
- **Parallel processing** with `Promise.allSettled()`
- **Partial failure handling** - Continue cleanup even if some operations fail
- **Detailed logging** for debugging and monitoring
- **Graceful degradation** - Return success with summary of completed operations

## Testing

Run the test suite:
```bash
deno run --allow-all test.ts
```

Tests cover:
- ✅ CORS handling
- ✅ Cleanup logic validation (image ID extraction)
- ✅ Valid calendar deletion (regular and duplicated)
- ✅ Minimal payload handling
- ✅ Error scenarios (missing fields, invalid JSON)

## Deployment

Deploy this function:
```bash
supabase functions deploy cleanup-deleted-calendar
```

## Environment Variables

Required:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database operations

## Migration Notes

**From Firebase cleanupDeletedCalendarV2:**
- ✅ Image cleanup logic migrated with safety checks
- ✅ Comprehensive error handling and logging
- ✅ CORS support for webhook calls
- ⚠️ No year subcollections (adapted for PostgreSQL flat structure)
- ✅ Shared links cleanup added (not in original Firebase version)
- ✅ Parallel processing for better performance

**Key Improvements:**
- **Better error handling** - Partial failures don't stop entire cleanup
- **More comprehensive** - Includes shared links cleanup
- **Performance optimized** - Parallel processing where safe
- **Better logging** - Detailed operation tracking
- **Type safety** - Full TypeScript implementation
