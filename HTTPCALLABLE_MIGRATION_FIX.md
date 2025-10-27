# Firebase httpsCallable Migration - Fixed ✅

## Problem
After the string-to-number conversion, the dev server threw a runtime error:

```
2025-10-27T13:57:08.140Z [TradeTracker] [ERROR] ❌ Error refreshing economic calendar data: 
ReferenceError: httpsCallable is not defined
    at EconomicEventWatcher.refreshCalendarData (economicEventWatcher.ts:164:1)
```

This was a leftover from the Firebase to Supabase migration. The `economicEventWatcher.ts` was still trying to use Firebase's `httpsCallable` function which was never imported.

## Root Cause
The `economicEventWatcher.ts` file had:
1. Commented out Firebase imports
2. Placeholder `functions: any = null`
3. Two methods still calling `httpsCallable(functions, 'refreshEconomicCalendar')`
4. No Supabase edge function calls

## Solution

### File: src/services/economicEventWatcher.ts

**Changes Made:**

1. **Updated Imports** (Lines 10-15)
   - Removed Firebase imports (already commented)
   - Added Supabase client import: `import { supabase } from '../config/supabase'`
   - Removed placeholder `functions: any = null`

2. **Fixed refreshCalendarData() Method** (Lines 150-190)
   - Changed from: `httpsCallable(functions, 'refreshEconomicCalendar')`
   - Changed to: `supabase.functions.invoke('refresh-economic-calendar', { body: {...} })`
   - Added proper error handling for Supabase response

3. **Fixed triggerEventGroupUpdate() Method** (Lines 402-435)
   - Same migration as above
   - Added type casting for currencies: `Array.from(currencySet) as Currency[]`
   - Updated error handling and logging

### Before
```typescript
const refreshEconomicCalendar = httpsCallable(functions, 'refreshEconomicCalendar');
const result = await refreshEconomicCalendar({
  targetDate,
  currencies
});
const responseData = result.data as any;
```

### After
```typescript
const { data, error: callError } = await supabase.functions.invoke('refresh-economic-calendar', {
  body: {
    targetDate,
    currencies
  }
});

if (callError) {
  logger.error('❌ Error calling refresh-economic-calendar function:', callError);
  return;
}

const responseData = data as any;
```

## Compilation Status

✅ **Build Successful**
- 0 TypeScript Errors
- 0 Compilation Errors
- Only ESLint warnings (unused imports, style issues - not blocking)
- Production build ready

✅ **Dev Server**
- App loads without runtime errors
- No `httpsCallable` errors
- Economic calendar watcher initializes correctly
- All functionality working

## Edge Functions Used

The fix now properly calls the Supabase edge function:
- **Function**: `refresh-economic-calendar`
- **Location**: `supabase/functions/refresh-economic-calendar/index.ts`
- **Purpose**: Fetches and updates economic calendar data from MyFXBook API

## Testing

- ✅ Dev server loads successfully
- ✅ No runtime errors in console
- ✅ Production build compiles without errors
- ✅ Economic calendar watcher initializes
- ✅ All components render correctly

## Summary

Successfully migrated the economic event watcher from Firebase Cloud Functions to Supabase Edge Functions. The `httpsCallable` error is completely resolved, and the system now properly uses Supabase's edge function invocation API.

**Status**: ✅ COMPLETE - Ready for deployment

