# Economic Events Repository Layer Refactoring

## Overview

This document describes the refactoring of economic events fetching logic from the UI layer (TradeFormDialog) to the repository layer (TradeRepository). This change follows the repository pattern and improves code organization, reusability, and maintainability.

## Problem Statement

Previously, the economic events fetching logic was scattered across the UI layer:

1. **TradeFormDialog.tsx** - Fetched events during trade creation in `createFinalTradeData()`
2. **TradeFormDialog.tsx** - Fetched events during trade editing in `handleEditTrade()`
3. **calendarService.ts** - Fetched events during trade import in `importTrades()`

This violated the separation of concerns principle and made the code harder to maintain.

## Solution

Moved the economic events fetching logic to the **TradeRepository** layer, where it's automatically handled during trade creation and updates.

### Key Changes

#### 1. TradeRepository.ts - New Helper Method

Added a private helper method `fetchEconomicEventsForTrade()` that:
- Accepts trade date, session, tags, and existing events
- Returns existing events if already provided (avoids redundant fetching)
- Extracts currencies from trade tags using `getRelevantCurrenciesFromTags()`
- Calls `tradeEconomicEventService.fetchEventsForTrade()` with proper parameters
- Returns empty array on error (doesn't block trade operations)

```typescript
private async fetchEconomicEventsForTrade(
  tradeDate: Date,
  session?: string,
  tags?: string[],
  existingEvents?: TradeEconomicEvent[]
): Promise<TradeEconomicEvent[]>
```

#### 2. TradeRepository.ts - Updated createInSupabase()

Modified to automatically fetch economic events before creating a trade:

```typescript
protected async createInSupabase(entity: Omit<Trade, 'id' | 'created_at' | 'updated_at'>): Promise<Trade> {
  // ... authentication logic ...

  // Fetch economic events for this trade if not already provided
  const economicEvents = await this.fetchEconomicEventsForTrade(
    entity.trade_date,
    entity.session,
    entity.tags,
    entity.economic_events
  );

  // Create complete trade object with economic events
  const completeTrade: Trade = {
    ...entity,
    id: tradeId,
    user_id: user.id,
    economic_events: economicEvents,
    created_at: new Date(),
    updated_at: new Date()
  } as Trade;

  // ... rest of creation logic ...
}
```

#### 3. TradeRepository.ts - Updated updateInSupabase()

Modified to automatically fetch economic events when relevant fields change:

```typescript
protected async updateInSupabase(id: string, updates: Partial<Trade>): Promise<Trade> {
  // ... get existing trade ...

  // Determine if we need to fetch new economic events
  const shouldFetchEvents = 
    (updates.session && updates.session !== existingTrade.session) ||
    (updates.trade_date && updates.trade_date.getTime() !== existingTrade.trade_date.getTime()) ||
    (updates.tags && JSON.stringify(updates.tags) !== JSON.stringify(existingTrade.tags)) ||
    (!existingTrade.economic_events || existingTrade.economic_events.length === 0);

  // Fetch economic events if needed
  let economicEvents = updates.economic_events || existingTrade.economic_events;
  if (shouldFetchEvents) {
    const tradeDate = updates.trade_date || existingTrade.trade_date;
    const session = updates.session || existingTrade.session;
    const tags = updates.tags || existingTrade.tags;

    economicEvents = await this.fetchEconomicEventsForTrade(
      tradeDate,
      session,
      tags,
      updates.economic_events
    );
  }

  // ... rest of update logic ...
}
```

#### 4. TradeRepository.ts - Updated RPC Functions

Added `economic_events` field to both `addTradeWithTags()` and `updateTradeWithTags()`:

```typescript
const tradeData = {
  // ... other fields ...
  economic_events: trade.economic_events || [],
  // ... other fields ...
};
```

#### 5. TradeFormDialog.tsx - Simplified

Removed all economic events fetching logic:

**Before:**
```typescript
// Fetch economic events for this trade session
let economicEvents = newTrade.economic_events || [];

if (economicEvents.length === 0 && newTrade.session) {
  try {
    economicEvents = await tradeEconomicEventService.fetchEventsForTrade(
      tradeDate,
      newTrade.session,
      getRelevantCurrenciesFromTags(newTrade!.tags)
    );
    logger.log(`📊 Fetched ${economicEvents.length} economic events`);
  } catch (error) {
    logger.error('Failed to fetch economic events:', error);
  }
}
```

**After:**
```typescript
// Note: Economic events are now automatically fetched by the TradeRepository layer
// during trade creation/update based on session, date, and tags
```

Removed imports:
```typescript
// REMOVED: import { getRelevantCurrenciesFromTags, tradeEconomicEventService } from '../../services/tradeEconomicEventService';
```

## Benefits

### 1. **Separation of Concerns**
- UI layer focuses on user interaction and validation
- Repository layer handles data operations and business logic
- Service layer provides reusable utilities

### 2. **Code Reusability**
- Economic events fetching logic is now in one place
- Automatically applied to all trade creation/update operations
- No need to duplicate logic across components

### 3. **Consistency**
- All trades get economic events fetched the same way
- Reduces risk of inconsistent behavior
- Easier to maintain and update

### 4. **Automatic Updates**
- Events are automatically refreshed when:
  - Session changes
  - Trade date changes
  - Tags (currency pairs) change
  - Trade has no existing events

### 5. **Error Handling**
- Centralized error handling in repository layer
- Errors don't block trade operations
- Consistent logging and error messages

### 6. **Performance**
- Avoids redundant fetching (checks for existing events)
- Only fetches when necessary (smart change detection)
- Async operations don't block UI

## Migration Notes

### For Developers

1. **No changes required** in components that create/update trades
2. Economic events are **automatically handled** by the repository
3. To **override** automatic fetching, pass `economic_events` in the trade data
4. To **force** fetching, pass `undefined` or empty array for `economic_events`

### For Testing

1. Test trade creation with session → should have economic events
2. Test trade creation without session → should have no economic events
3. Test trade update with session change → should fetch new events
4. Test trade update with date change → should fetch new events
5. Test trade update with tag change → should fetch new events
6. Test trade update with no changes → should keep existing events

## Files Modified

1. **src/services/repository/repositories/TradeRepository.ts**
   - Added `fetchEconomicEventsForTrade()` helper method
   - Updated `createInSupabase()` to fetch events
   - Updated `updateInSupabase()` to fetch events when needed
   - Updated `addTradeWithTags()` to include economic_events
   - Updated `updateTradeWithTags()` to include economic_events

2. **src/components/trades/TradeFormDialog.tsx**
   - Removed economic events fetching from `createFinalTradeData()`
   - Removed economic events fetching from `handleEditTrade()`
   - Removed unused imports

3. **src/components/economicCalendar/EconomicEventListItem.tsx**
   - Added trade count badge feature (separate enhancement)

4. **src/components/economicCalendar/EconomicCalendarDrawer.tsx**
   - Added trade count calculation (separate enhancement)

## Future Enhancements

1. **Caching**: Add caching layer for economic events to reduce API calls
2. **Batch Processing**: Optimize bulk trade imports with batch event fetching
3. **Event Matching**: Improve event matching algorithm for better accuracy
4. **User Preferences**: Allow users to configure which events to fetch (impact levels, currencies)

## Conclusion

This refactoring successfully moves economic events fetching logic to the repository layer, following best practices for clean architecture and separation of concerns. The change is backward compatible and requires no modifications to existing components.

