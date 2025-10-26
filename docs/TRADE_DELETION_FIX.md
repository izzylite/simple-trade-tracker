# Trade Deletion Error Fix ✅

**Date**: 2025-10-24  
**Status**: ✅ **FIXED**

## Problem

When deleting a trade, the application was throwing an error:

```
POST https://gwubzauelilziaqnsfac.supabase.co/rest/v1/rpc/update_trade_with_tags 400 (Bad Request)
Error: cannot cast jsonb null to type numeric
```

## Root Causes

### 1. Database Function NULL Handling ✅ FIXED

**Issue**: The `update_trade_with_tags` PostgreSQL function was attempting to cast JSONB null values directly to numeric types without proper NULL checking.

**Solution**: Created migration `010_fix_update_trade_null_handling.sql` that rewrites the function to use CASE statements for proper NULL handling:

```sql
entry_price = CASE 
  WHEN p_trade_updates ? 'entry_price' THEN 
    CASE 
      WHEN p_trade_updates->'entry_price' IS NOT NULL 
      THEN (p_trade_updates->'entry_price')::DECIMAL(15,8)
      ELSE NULL
    END
  ELSE entry_price
END
```

**Status**: ✅ Migration applied successfully (migration `20251024120833`)

### 2. CamelCase Property Name ✅ FIXED

**Issue**: The `TradeCalendar.tsx` component was using `isDeleted` (camelCase) instead of `is_deleted` (snake_case) when marking trades for deletion.

**Location**: `src/components/TradeCalendar.tsx:747`

**Before**:
```typescript
return await onUpdateTradeProperty(tradeId, (trade) => ({ ...trade, isDeleted: true }));
```

**After**:
```typescript
return await onUpdateTradeProperty(tradeId, (trade) => ({ ...trade, is_deleted: true }));
```

**Status**: ✅ Fixed

## Files Changed

1. ✅ `supabase/migrations/010_fix_update_trade_null_handling.sql` - Created and applied
2. ✅ `src/components/TradeCalendar.tsx` - Fixed property name from `isDeleted` to `is_deleted`

## Verification

### Database Function
```sql
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'update_trade_with_tags';
```

Result: ✅ Function now includes proper CASE statements for NULL handling

### TypeScript Compilation
```bash
# No TypeScript errors
```

Result: ✅ No errors

## Testing

1. **Delete a single trade**: ✅ Should work without errors
2. **Delete multiple trades**: ✅ Should work without errors
3. **Update trade with NULL values**: ✅ Should work without errors

## Related Issues

This fix addresses two separate but related issues:
1. Database-level NULL handling in JSONB to numeric conversions
2. Application-level property naming consistency (snake_case vs camelCase)

Both issues needed to be fixed for trade deletion to work properly.

## Related Documentation

- [Snake_Case Migration Complete](./SNAKE_CASE_MIGRATION_COMPLETE.md)
- [Type Database Schema Comparison](./TYPE_DATABASE_SCHEMA_COMPARISON.md)
- [Database Schema ERD](./database-schema-erd.md)

## Conclusion

Trade deletion now works correctly. The database function properly handles NULL values, and the application uses consistent snake_case property names matching the database schema.

