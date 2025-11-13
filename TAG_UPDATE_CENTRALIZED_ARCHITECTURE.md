# Tag Update Centralized Architecture

## Overview

Tag update functionality now uses the Supabase Edge Function `update-tag` as the **single source of truth**. The edge function is called from `useCalendarTrades` hook, and all components use this centralized handler via the `onTagUpdated` prop.

## Architecture

```
User Action (TagEditDialog)
    ↓
onTagUpdated prop (passed from parent)
    ↓
useCalendarTrades.onTagUpdated()
    ↓
Supabase Edge Function: update-tag
    ↓
Database Updates (trades + calendar metadata)
    ↓
Broadcast Trigger (realtime.broadcast_changes)
    ↓
All Connected Clients Updated
```

## Implementation

### ✅ Centralized Tag Updates

**File:** `src/hooks/useCalendarTrades.ts`

```typescript
const onTagUpdated = useCallback(async (
  oldTag: string,
  newTag: string,
): Promise<{ success: boolean; tradesUpdated: number }> => {
  // Call Supabase Edge Function to update tag
  const { data, error } = await supabase.functions.invoke('update-tag', {
    body: {
      calendar_id: calendarId,
      old_tag: oldTag,
      new_tag: newTag
    }
  });
  
  return { success: data?.success, tradesUpdated: data?.tradesUpdated || 0 };
}, [calendarId]);
```

### ✅ Component Prop Chain

**TradeCalendarPage** → **TradeFormDialog** → **TradeForm** → **TagsInput** → **TagEditDialog**

All components receive and pass `onTagUpdated` prop down the chain.

## How It Works

### Tag Update Flow

1. **User edits tag** in `TagEditDialog`
2. **TagEditDialog** calls `onTagUpdated(oldTag, newTag)`
3. **Prop chain** passes call up to `TradeCalendarPage.handleTagUpdated`
4. **useCalendarTrades.onTagUpdated** calls edge function
5. **Edge function** updates trades + calendar metadata
6. **Database trigger** broadcasts changes
7. **All connected clients** receive broadcast and update UI

### Tag Delete Flow

Same as update, but `new_tag` is empty string:
```typescript
onTagUpdated(deletedTag, ''); // Delete tag
```

## Benefits

✅ **Single Source of Truth** - All tag operations go through one function  
✅ **Server-Side Validation** - Edge function validates and processes updates  
✅ **Automatic Broadcasts** - Database triggers notify all clients  
✅ **Batch Processing** - Edge function handles 100 trades per batch  
✅ **Consistent Behavior** - Same logic for all components  
✅ **Better Error Handling** - Centralized error handling in hook  
✅ **Easier Testing** - Mock one function instead of many  
✅ **Cleaner Code** - No duplicate edge function calls in components  

## Files Modified

- `src/hooks/useCalendarTrades.ts` - Added centralized `onTagUpdated` function
- `src/pages/TradeCalendarPage.tsx` - Pass `handleTagUpdated` to components
- `src/components/TagEditDialog.tsx` - Use `onTagUpdated` prop
- `src/components/TagManagementDrawer.tsx` - Receive and pass `onTagUpdated`
- `src/components/TagManagementDialog.tsx` - Receive and pass `onTagUpdated`
- `src/components/trades/TagsInput.tsx` - Receive and pass `onTagUpdated`
- `src/components/trades/TradeFormDialog.tsx` - Receive and pass `onTagUpdated`
- `src/components/trades/TradeForm.tsx` - Receive and pass `onTagUpdated`

## Testing Checklist

- [ ] Edit tag from TagManagementDrawer
- [ ] Edit tag from TagManagementDialog
- [ ] Edit tag from TradeForm (TagsInput)
- [ ] Delete tag from any component
- [ ] Change tag group name (e.g., "Strategy:Old" → "Strategy:New")
- [ ] Verify all trades update in real-time
- [ ] Verify calendar metadata updates
- [ ] Open multiple browser tabs and verify all update simultaneously

