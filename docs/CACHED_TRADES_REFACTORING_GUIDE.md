# Cached Trades Refactoring Guide

## Problem

The application was storing `cached_trades` and `loaded_years` as properties of the `Calendar` type, but these fields don't exist in the database schema. This caused database update errors:

```
Error: Could not find the 'cached_trades' column of 'calendars' in the schema cache
```

## Solution

Separate `cached_trades` and `loaded_years` from the Calendar state into independent state variables.

## Changes Made

### 1. Updated Calendar Type (src/types/dualWrite.ts)

**Before:**
```typescript
export interface Calendar extends BaseEntity {
  // ... other fields
  
  // Runtime data (not persisted)
  cached_trades?: Trade[];
  loaded_years?: number[];
}
```

**After:**
```typescript
export interface Calendar extends BaseEntity {
  // ... other fields
  // (removed cached_trades and loaded_years)
}
```

### 2. Updated App.tsx State Management

**Before:**
```typescript
const [calendars, setCalendars] = useState<Calendar[]>([]);
```

**After:**
```typescript
const [calendars, setCalendars] = useState<Calendar[]>([]);
const [calendarTrades, setCalendarTrades] = useState<Record<string, Trade[]>>({});
const [loadedYears, setLoadedYears] = useState<Record<string, number[]>>({});
```

### 3. Helper Functions

Added helper functions to access and update trades:

```typescript
// Helper function to get trades for a calendar
const getCalendarTrades = (calendarId: string): Trade[] => {
  return calendarTrades[calendarId] || [];
};

// Helper function to update trades for a calendar
const updateCalendarTrades = (calendarId: string, trades: Trade[]) => {
  setCalendarTrades(prev => ({
    ...prev,
    [calendarId]: trades
  }));
};
```

### 4. Updated loadAllTrades Function

**Before:**
```typescript
setCalendars(prevCalendars => {
  return prevCalendars.map(cal => {
    if (cal.id === calendarId) {
      return {
        ...cal,
        loaded_years: uniqueYears,
        cached_trades: allTrades
      };
    }
    return cal;
  });
});
```

**After:**
```typescript
// Update trades in separate state
setCalendarTrades(prev => ({
  ...prev,
  [calendarId]: allTrades
}));

// Update loaded years in separate state
setLoadedYears(prev => ({
  ...prev,
  [calendarId]: uniqueYears
}));
```

### 5. Updated handleCreateCalendar

**Before:**
```typescript
setCalendars(prev => [...prev, { 
  ...newCalendar, 
  id: calendarId, 
  user_id: user.uid, 
  cached_trades: [], 
  loaded_years: [] 
}]);
```

**After:**
```typescript
setCalendars(prev => [...prev, { 
  ...newCalendar, 
  id: calendarId, 
  user_id: user.uid 
}]);

// Initialize empty trades and loaded years for new calendar
setCalendarTrades(prev => ({ ...prev, [calendarId]: [] }));
setLoadedYears(prev => ({ ...prev, [calendarId]: [] }));
```

### 6. Updated handleToggleDynamicRisk

**Before:**
```typescript
const trades = calendar.cached_trades || [];
// ... calculations
updateCalendarState(calendarId, {
  cached_trades: updatedTrades,
  ...stats
});
```

**After:**
```typescript
const trades = getCalendarTrades(calendarId);
// ... calculations
updateCalendarTrades(calendarId, updatedTrades);
updateCalendarState(calendarId, stats);
```

## Remaining Changes Needed

### CalendarRoute Component

**Props to Add:**
```typescript
interface CalendarRouteProps {
  calendars: Calendar[];
  calendarTrades: Record<string, Trade[]>;
  loadedYears: Record<string, number[]>;
  onUpdateCalendarTrades: (calendarId: string, trades: Trade[]) => void;
  // ... other props
}
```

**Usage Pattern:**
```typescript
const CalendarRoute: React.FC<CalendarRouteProps> = ({
  calendars,
  calendarTrades,
  loadedYears,
  onUpdateCalendarTrades,
  // ... other props
}) => {
  const { calendarId } = useParams<{ calendarId: string }>();
  const calendar = calendars.find((c: Calendar) => c.id === calendarId);
  const trades = calendarTrades[calendarId] || [];
  const years = loadedYears[calendarId] || [];
  
  // Use trades and years instead of calendar.cached_trades and calendar.loaded_years
};
```

### handleAddTrade

**Before:**
```typescript
const optimisticCachedTrades = [...(calendar.cached_trades || []), newTrade];
onUpdateStateCalendar(calendar.id, {
  cached_trades: optimisticCachedTrades
});
```

**After:**
```typescript
const currentTrades = calendarTrades[calendar.id] || [];
const optimisticTrades = [...currentTrades, newTrade];
onUpdateCalendarTrades(calendar.id, optimisticTrades);
```

### handleRemoveTrade

**Before:**
```typescript
onUpdateStateCalendar(calendar.id, {
  cached_trades: (calendar.cached_trades || []).filter(trade => !idsToDelete.includes(trade.id))
});
```

**After:**
```typescript
const currentTrades = calendarTrades[calendar.id] || [];
const updatedTrades = currentTrades.filter(trade => !idsToDelete.includes(trade.id));
onUpdateCalendarTrades(calendar.id, updatedTrades);
```

### handleUpdateTradeProperty

**Before:**
```typescript
const result = await calendarService.updateTrade(calendar.id, tradeId, calendar.cached_trades, updateCallback);
if (result) {
  const [updatedStats, updatedTrades] = result;
  onUpdateStateCalendar(calendar.id, {
    cached_trades: updatedTrades,
    ...updatedStats
  });
}
```

**After:**
```typescript
const currentTrades = calendarTrades[calendar.id] || [];
const result = await calendarService.updateTrade(calendar.id, tradeId, currentTrades, updateCallback);
if (result) {
  const [updatedStats, updatedTrades] = result;
  onUpdateCalendarTrades(calendar.id, updatedTrades);
  onUpdateStateCalendar(calendar.id, updatedStats);
}
```

### TradeCalendar Component

**Before:**
```typescript
<TradeCalendar
  trades={calendar.cached_trades || []}
  // ... other props
/>
```

**After:**
```typescript
<TradeCalendar
  trades={calendarTrades[calendar.id] || []}
  // ... other props
/>
```

### Real-time Subscription

**Before:**
```typescript
const cached_trades = calendar.cached_trades;
const loaded_years = calendar.loaded_years;
onUpdateStateCalendar(calendar.id, {
  ...updatedCalendarData,
  cached_trades,
  loaded_years
});
```

**After:**
```typescript
// Just update calendar data, trades and years are in separate state
onUpdateStateCalendar(calendar.id, {
  ...updatedCalendarData
});
```

### useEffect for Loading Trades

**Before:**
```typescript
if (calendar && calendar.loaded_years && calendar.loaded_years.length === 0 && !loadAttempted[calendar.id]) {
  loadAllTrades(calendar.id);
}
```

**After:**
```typescript
const years = loadedYears[calendar.id] || [];
if (calendar && years.length === 0 && !loadAttempted[calendar.id]) {
  loadAllTrades(calendar.id);
}
```

## Benefits

1. **Database Schema Alignment** - Calendar type matches database exactly
2. **No More Update Errors** - Can't accidentally send cache data to database
3. **Clear Separation** - Persistent vs. ephemeral data is explicit
4. **Better Performance** - No need to filter cache fields before updates
5. **Type Safety** - TypeScript enforces correct usage

## Testing Checklist

- [ ] Create new calendar - trades and years initialize correctly
- [ ] Load trades - trades populate in separate state
- [ ] Add trade - optimistic update works, database update succeeds
- [ ] Update trade - trade updates correctly
- [ ] Delete trade - trade removes correctly
- [ ] Duplicate calendar - new calendar has empty trades/years
- [ ] Calendar updates - database updates work without errors
- [ ] Real-time subscriptions - calendar updates don't affect trades
- [ ] Dynamic risk toggle - recalculation uses separate trade state
- [ ] Import trades - trades update in separate state
- [ ] Clear month trades - trades filter correctly

## Migration Status

- [x] Update Calendar type definition
- [x] Add separate state variables
- [x] Add helper functions
- [x] Update loadAllTrades
- [x] Update handleCreateCalendar
- [x] Update handleDuplicateCalendar
- [x] Update handleToggleDynamicRisk
- [ ] Update CalendarRoute props
- [ ] Update handleAddTrade
- [ ] Update handleRemoveTrade
- [ ] Update handleUpdateTradeProperty
- [ ] Update onTagUpdated
- [ ] Update handleImportTrades
- [ ] Update handleClearMonthTrades
- [ ] Update TradeCalendar usage
- [ ] Update real-time subscription
- [ ] Update useEffect for loading trades
- [ ] Update CalendarHome component
- [ ] Test all functionality

