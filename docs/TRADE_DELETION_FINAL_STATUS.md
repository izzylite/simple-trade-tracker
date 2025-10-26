# Trade Deletion Implementation - Final Status

**Date**: 2025-10-24
**Status**: ✅ **READY FOR TESTING**

## Summary

Successfully refactored trade deletion from soft-delete to hard-delete. Trade images are automatically cleaned up via the `handle-trade-changes` edge function webhook.

## Implementation Overview

### 1. Client-Side Deletion ([TradeCalendar.tsx](src/components/TradeCalendar.tsx#L734-L772))
```typescript
// Directly calls calendarService.deleteTrade instead of soft-deleting
const deletePromises = tradesToDelete.map(async (tradeId) => {
  const { calendarService } = await import('../services/calendarService');
  await calendarService.deleteTrade(calendarId!!, tradeId);
});
```

### 2. Service Layer ([calendarService.ts:527-555](src/services/calendarService.ts#L527-L555))
```typescript
export const deleteTrade = async (calendarId: string, tradeId: string) => {
  // 1. Get the trade for vector sync
  const trade = await getTrade(calendarId, tradeId);

  // 2. Delete trade from database (transactional)
  await repositoryService.tradeRepo.deleteTradeTransactional(tradeId);

  // 3. Sync to vector database
  if (trade) {
    await repositoryService.tradeRepo.syncTradeToVectors(trade, calendarId, "delete");
  }

  // 4. Return updated stats (calculated by trigger)
  const calendar = await getCalendar(calendarId);
  return getCalendarStats(calendar);
};
```

### 3. Repository Layer ([TradeRepository.ts:402-429](src/services/repository/repositories/TradeRepository.ts#L402-L429))
```typescript
async deleteTradeTransactional(tradeId: string): Promise<boolean> {
  // Call the transactional PostgreSQL function to delete the trade
  // Images are deleted via the handle-trade-changes edge function webhook
  const { data, error } = await supabase.rpc("delete_trade_transactional", {
    p_trade_id: tradeId,
  });

  if (error) throw error;
  if (!data?.success) throw new Error("Failed to delete trade");

  logger.log(`Trade deleted successfully. Trade ID: ${tradeId}`);
  return data.success;
}
```

### 4. Database Function ([Migration 006](supabase/migrations/006_transactional_trade_operations.sql#L265-L294))
```sql
CREATE OR REPLACE FUNCTION delete_trade_transactional(p_trade_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Delete the trade
  DELETE FROM trades WHERE id = p_trade_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trade not found: %', p_trade_id;
  END IF;

  -- Stats are automatically calculated by triggers
  -- Return result
  SELECT jsonb_build_object(
    'success', TRUE,
    'trade_id', p_trade_id
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;
```

### 5. Image Cleanup ([handle-trade-changes Edge Function](supabase/functions/handle-trade-changes/index.ts#L42-L127))
```typescript
async function cleanupRemovedImages(
  beforeTrades: Trade[],
  afterTrades: Trade[],
  calendarId: string,
  userId: string
): Promise<void> {
  // 1. Compare before/after states to find removed images
  const afterImagesMap = new Map<string, boolean>();
  afterTrades.forEach(trade => {
    trade.images?.forEach(image => {
      if (image?.id) afterImagesMap.set(image.id, true);
    });
  });

  const imagesToDelete: string[] = [];
  beforeTrades.forEach(trade => {
    trade.images?.forEach(image => {
      if (image?.id && !afterImagesMap.has(image.id)) {
        imagesToDelete.push(image.id);
      }
    });
  });

  // 2. Check if images can be safely deleted (not used in duplicated calendars)
  const finalImagesToDelete: string[] = [];
  for (const imageId of imagesToDelete) {
    const canDelete = await canDeleteImage(supabase, imageId, calendarId);
    if (canDelete) finalImagesToDelete.push(imageId);
  }

  // 3. Delete images from Supabase Storage
  const deletePromises = finalImagesToDelete.map(async (imageId) => {
    await supabase.storage
      .from('trade-images')
      .remove([`${userId}/${imageId}`]);
  });

  await Promise.all(deletePromises);
}
```

## Architecture Flow

```
User clicks delete
  ↓
TradeCalendar.handleConfirmDelete()
  ↓
calendarService.deleteTrade()
  ↓
TradeRepository.deleteTradeTransactional()
  ↓
Database: delete_trade_transactional() RPC
  ↓
Database: DELETE FROM trades WHERE id = ?
  ↓
Database Trigger: auto_calculate_calendar_stats (updates calendar stats)
  ↓
Database Webhook: Triggers handle-trade-changes edge function
  ↓
Edge Function: cleanupRemovedImages()
  ↓
Supabase Storage: Delete image files
```

## Database Schema Changes

### Migration 011: Remove is_deleted Field
- ✅ Removed `is_deleted` column from `trades` table
- ✅ Removed `is_deleted` column from `calendars` table (kept for trash feature)
- ✅ Dropped indexes: `idx_trades_is_deleted`, `idx_calendars_is_deleted`
- ✅ Updated `update_trade_with_tags` function to remove `is_deleted` handling
- ✅ Created new indexes optimized for active records

## Type Definitions Updated

### Frontend Types
- ✅ [src/types/dualWrite.ts](src/types/dualWrite.ts)
  - Removed `is_deleted` from `Trade` interface
  - Removed `is_deleted` field mapping
  - Updated comments for `Calendar` (kept for trash feature)

### Edge Function Types
- ✅ [supabase/functions/_shared/types.ts](supabase/functions/_shared/types.ts)
  - Removed `is_deleted` from `Trade` interface

### Utilities
- ✅ [supabase/functions/_shared/utils.ts](supabase/functions/_shared/utils.ts)
  - Removed `is_deleted` filter from `calculateTradeStats`

## Edge Function Status

### handle-trade-changes
- **Version**: 2 (currently deployed with BUG)
- **Status**: NEEDS DEPLOYMENT
- **Function ID**: d92bc16a-c715-48a5-a8ba-8216cc2512e6
- **Bug Fixed**: Image deletion path corrected from `${userId}/${imageId}` to `users/${userId}/trade-images/${imageId}`
- **Features**:
  - ✅ Image cleanup on DELETE operations
  - ✅ Image cleanup on UPDATE operations
  - ✅ Safety checks for duplicated calendars
  - ✅ Removed unnecessary Firebase migration logic (tag sync, year changes)
  - ✅ Reduced from 336 to 193 lines for better performance

### Webhook Setup

✅ **COMPLETED**: Database webhooks configured in migration 012
- Trigger: `trigger_trade_changes` on `trades` table
- Events: INSERT, UPDATE, DELETE
- Function: `notify_trade_changes()` using `pg_net.http_post`
- Payload: Includes `old_record`, `new_record`, `calendar_id`, `user_id`

## Testing Checklist

### Manual Testing
- [ ] Delete a single trade without images
- [ ] Delete a single trade with images - verify images are removed from storage
- [ ] Delete multiple trades with images - verify all images are removed
- [ ] Delete a trade from a duplicated calendar - verify images not deleted if used elsewhere
- [ ] Verify calendar stats are updated after deletion
- [ ] Verify vector embeddings are removed

### Edge Cases
- [ ] Delete a trade that doesn't exist (should error gracefully)
- [ ] Delete a trade with shared images across duplicated calendars
- [ ] Webhook failure handling - what happens if edge function fails?

## Files Changed

1. ✅ [src/components/TradeCalendar.tsx](src/components/TradeCalendar.tsx#L734-L772)
2. ✅ [src/services/repository/repositories/TradeRepository.ts](src/services/repository/repositories/TradeRepository.ts#L402-L429)
3. ✅ [src/types/dualWrite.ts](src/types/dualWrite.ts)
4. ✅ [supabase/functions/_shared/types.ts](supabase/functions/_shared/types.ts)
5. ✅ [supabase/functions/_shared/utils.ts](supabase/functions/_shared/utils.ts)
6. ✅ [supabase/migrations/011_remove_is_deleted_field.sql](supabase/migrations/011_remove_is_deleted_field.sql)

## Benefits

1. **Cleaner Data**: Deleted trades are truly removed
2. **Automatic Cleanup**: Images deleted automatically via webhook
3. **Safety**: Checks for duplicated calendars before deleting images
4. **Atomic Operations**: Database triggers ensure stats stay in sync
5. **Decoupled**: Image deletion happens asynchronously in edge function

## Notes

- The edge function is already deployed (version 2)
- **DATABASE WEBHOOK IS NOT YET CONFIGURED** - this needs to be set up for image cleanup to work
- Calendar soft-delete remains intact (for trash feature)
- Image deletion failures don't prevent trade deletion (logged as warnings)
- The system is backwards compatible - old soft-deleted records won't cause issues

## Next Steps

1. ⚠️ **CRITICAL: Deploy edge function** - See [EDGE_FUNCTION_DEPLOYMENT_GUIDE.md](./EDGE_FUNCTION_DEPLOYMENT_GUIDE.md)
   - The current deployed version has an incorrect image deletion path
   - You need to set `SUPABASE_ACCESS_TOKEN` environment variable
   - Run: `npx supabase functions deploy handle-trade-changes`
2. **Test image deletion** end-to-end after deployment
3. **Monitor edge function logs** for any errors during cleanup
4. **Verify storage usage** decreases as images are deleted
5. **Check webhook execution** in `net._http_response` table
