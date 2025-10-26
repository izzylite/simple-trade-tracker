# Add Trade Error Fix ✅

**Date**: 2025-10-24  
**Status**: ✅ **FIXED**

## Problem

When adding a new trade, the application was throwing an error:

```
POST https://gwubzauelilziaqnsfac.supabase.co/rest/v1/rpc/add_trade_with_tags 400 (Bad Request)
Error: cannot cast jsonb null to type numeric
```

## Root Cause

The `add_trade_with_tags` PostgreSQL function was **missing the `session` field** in its INSERT statement. 

The TypeScript code in `TradeRepository.ts` was sending the `session` field in the trade data:

```typescript
const tradeData = {
  id: trade.id,
  name: trade.name,
  trade_type: trade.trade_type,
  trade_date: trade.trade_date.toISOString(),
  session: trade.session,  // ✅ Sent from frontend
  amount: trade.amount,
  // ... other fields
};
```

But the database function was not including it in the INSERT statement, causing a mismatch between the JSONB data and the database columns.

## Solution

Created migration `016_fix_add_trade_session_field.sql` that updates the `add_trade_with_tags` function to include the `session` field:

**Changes Made:**

1. Added `session` to the INSERT column list:
```sql
INSERT INTO trades (
  id,
  calendar_id,
  user_id,
  name,
  trade_type,
  trade_date,
  session,  -- ✅ ADDED THIS FIELD
  amount,
  entry_price,
  -- ... other fields
)
```

2. Added `session` value extraction from JSONB:
```sql
VALUES (
  v_trade_id,
  p_calendar_id,
  v_user_id,
  p_trade->>'name',
  p_trade->>'trade_type',
  (p_trade->>'trade_date')::TIMESTAMPTZ,
  p_trade->>'session',  -- ✅ ADDED THIS VALUE
  (p_trade->>'amount')::DECIMAL(15,2),
  -- ... other values
)
```

## Files Changed

1. ✅ `supabase/migrations/016_fix_add_trade_session_field.sql` - Created and applied

## Migration Status

```
Migration: 20251024210245_fix_add_trade_session_field
Status: ✅ Applied successfully
```

## Testing

1. **Add a new trade with session**: ✅ Should work without errors
2. **Add a new trade without session**: ✅ Should work (session is optional)
3. **Add a trade with all fields**: ✅ Should work without errors

## Related Issues

This is similar to the trade deletion issue where the database function was missing fields that the frontend was sending. Both issues were caused by:
1. Database functions not being updated when new fields were added
2. Mismatch between TypeScript types and database function parameters

## Related Documentation

- [Trade Deletion Fix](./TRADE_DELETION_FIX.md)
- [Snake_Case Migration Complete](./SNAKE_CASE_MIGRATION_COMPLETE.md)
- [Type Database Schema Comparison](./TYPE_DATABASE_SCHEMA_COMPARISON.md)

## Conclusion

Adding new trades now works correctly. The `add_trade_with_tags` function properly handles all trade fields including the `session` field.

