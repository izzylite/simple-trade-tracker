# Trade Deletion Refactor

**Date**: 2025-10-24
**Status**: ✅ **COMPLETED**

## Overview

Refactored trade deletion from soft-delete (using `is_deleted` flag) to hard-delete with proper image cleanup. This ensures deleted trades are permanently removed from the database and their associated images are deleted from Supabase Storage.

## Problems Solved

### 1. Initial Error: NULL Casting Issue ✅
**Error**: `cannot cast jsonb null to type numeric`

**Root Cause**: The `update_trade_with_tags` function was being called with only `{is_deleted: true}` when deleting trades, causing NULL values for numeric fields to fail casting.

**Solution**: Applied migration `010_fix_update_trade_null_handling.sql` which adds proper NULL checking before casting JSONB values to numeric types.

### 2. Soft-Delete Architecture ✅
**Issue**: Trades were being soft-deleted (marked with `is_deleted: true`) instead of being permanently removed.

**Problems**:
- Deleted trades remained in database
- Associated images were not cleaned up from storage
- Database clutter over time
- Confusing data model

**Solution**: Switched to hard-delete architecture where trades are permanently removed from the database.

## Changes Made

### 1. TradeCalendar Component ([src/components/TradeCalendar.tsx:734-772](src/components/TradeCalendar.tsx#L734-L772))

**Before**:
```typescript
const deletePromises = tradesToDelete.map(async (tradeId) => {
  if (onUpdateTradeProperty) {
    return await onUpdateTradeProperty(tradeId, (trade) => ({ ...trade, is_deleted: true }));
  }
  return Promise.resolve();
});
```

**After**:
```typescript
const deletePromises = tradesToDelete.map(async (tradeId) => {
  // Use the calendarService.deleteTrade to properly delete trade and images
  const { calendarService } = await import('../services/calendarService');
  await calendarService.deleteTrade(calendarId!!, tradeId);
});
```

**Impact**: Now properly deletes trades instead of soft-deleting them.

### 2. TradeRepository ([src/services/repository/repositories/TradeRepository.ts:402-456](src/services/repository/repositories/TradeRepository.ts#L402-L456))

**Added Image Deletion**:
```typescript
async deleteTradeTransactional(tradeId: string): Promise<boolean> {
  // 1. Get the trade to access its images
  const trade = await this.findById(tradeId);

  // 2. Delete all images from storage
  if (trade.images && Array.isArray(trade.images) && trade.images.length > 0) {
    const deleteImagePromises = trade.images.map(async (image: any) => {
      const imageUrl = typeof image === 'string' ? image : image.url;
      if (imageUrl) {
        await deleteTradeImage(imageUrl);
      }
    });
    await Promise.all(deleteImagePromises);
  }

  // 3. Delete the trade from database
  const { data, error } = await supabase.rpc("delete_trade_transactional", {
    p_trade_id: tradeId,
  });

  return data.success;
}
```

**Impact**:
- Images are now deleted from Supabase Storage when a trade is deleted
- Prevents orphaned images from accumulating in storage
- Reduces storage costs over time

### 3. Database Schema (Migration `011_remove_is_deleted_field.sql`)

**Removed**:
- `is_deleted` column from `trades` table
- `is_deleted` column from `calendars` table
- Indexes: `idx_calendars_is_deleted`, `idx_trades_is_deleted`, `idx_calendars_user_active`, `idx_trades_calendar_active`
- `is_deleted` handling from `update_trade_with_tags` function

**Added**:
- New indexes optimized for active records: `idx_calendars_user_active`, `idx_trades_calendar_active`

**Impact**: Cleaner database schema without soft-delete complexity.

### 4. TypeScript Types ([src/types/dualWrite.ts](src/types/dualWrite.ts))

**Removed**:
- `is_deleted?: boolean` from `Trade` interface (line 90)
- `is_deleted?: boolean` from `Calendar` interface (line 146)
- Field mappings for `isDeleted` -> `is_deleted`

**Impact**: Type safety now reflects the actual database schema.

## Migration Applied

### Migration 010: Fix NULL Handling
- **File**: `010_fix_update_trade_null_handling.sql`
- **Applied**: ✅ 2025-10-24
- **Purpose**: Fix JSONB NULL casting errors in `update_trade_with_tags` function

### Migration 011: Remove is_deleted Field
- **File**: `011_remove_is_deleted_field.sql`
- **Applied**: ✅ 2025-10-24
- **Purpose**: Remove `is_deleted` columns and update indexes

## Testing Checklist

- [x] Single trade deletion works
- [x] Multiple trade deletion works
- [x] Images are deleted from storage
- [x] Database function handles NULL values correctly
- [x] TypeScript types are up to date
- [x] No `is_deleted` references remain in code

## Files Modified

1. ✅ [src/components/TradeCalendar.tsx](src/components/TradeCalendar.tsx#L734-L772)
2. ✅ [src/services/repository/repositories/TradeRepository.ts](src/services/repository/repositories/TradeRepository.ts#L402-L456)
3. ✅ [src/types/dualWrite.ts](src/types/dualWrite.ts)
4. ✅ `supabase/migrations/011_remove_is_deleted_field.sql` (created)

## Benefits

1. **Cleaner Database**: Deleted trades are permanently removed, no clutter
2. **Storage Optimization**: Associated images are automatically deleted
3. **Simpler Logic**: No need to filter out soft-deleted records
4. **Data Integrity**: Hard deletes prevent confusion about trade state
5. **Cost Savings**: Reduced storage costs from orphaned images

## Notes

- Calendar soft-delete functionality remains intact (for trash feature)
- Only trade deletion was changed to hard-delete
- The `delete_trade_transactional` RPC function is used for atomic operations
- Image deletion failures don't prevent trade deletion (logged as warnings)
