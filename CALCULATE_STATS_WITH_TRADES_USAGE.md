# Calculate Calendar Stats with Trades Parameter

## Overview

The `calculate_calendar_stats` RPC function has been updated to accept an optional `p_trades` JSONB parameter. This allows you to calculate calendar statistics on-demand using hypothetical trade data without querying the database.

## Use Cases

1. **Dynamic Risk Toggle**: Calculate stats with recalculated trade amounts when toggling dynamic risk
2. **What-If Analysis**: Preview stats before committing changes
3. **Import Preview**: Show stats for imported trades before saving
4. **Bulk Updates**: Calculate stats after bulk trade modifications

## Migration

**File**: `supabase/migrations/037_update_calculate_stats_with_trades_param.sql`

The migration:
- Updates `calculate_calendar_stats` to accept optional `p_trades JSONB` parameter
- When `p_trades` is `NULL`, uses default behavior (queries from database)
- When `p_trades` is provided, uses those trades for all calculations
- Updates the trigger function to pass `NULL` for automatic calculations

## API

### CalendarRepository Method

```typescript
/**
 * Calculate calendar statistics with optional trades parameter
 * 
 * @param calendarId - Calendar ID to calculate stats for
 * @param trades - Optional array of trades to use for calculation
 */
async calculateStats(calendarId: string, trades?: any[]): Promise<void>
```

### CalendarService Method

```typescript
/**
 * Calculate calendar statistics with optional trades parameter
 * 
 * @param calendarId - Calendar ID to calculate stats for
 * @param trades - Optional array of trades to use for calculation
 */
export const calculateCalendarStats = async (
  calendarId: string,
  trades?: Trade[]
): Promise<void>
```

## Usage Examples

### Example 1: Default Behavior (Query from Database)

```typescript
import { calculateCalendarStats } from '../services/calendarService';

// Calculate stats using current database trades
await calculateCalendarStats(calendarId);
```

### Example 2: Calculate Stats with Hypothetical Trades

```typescript
import { calculateCalendarStats } from '../services/calendarService';

// Get current trades
const currentTrades = await getTradesForCalendar(calendarId);

// Modify trades (e.g., recalculate amounts with dynamic risk)
const updatedTrades = currentTrades.map(trade => ({
  ...trade,
  amount: calculateNewAmount(trade) // Your calculation logic
}));

// Calculate stats with the modified trades
await calculateCalendarStats(calendarId, updatedTrades);
```

### Example 3: Using in handleToggleDynamicRisk

Here's how to integrate it into the `handleToggleDynamicRisk` function in `useCalendarTrades.ts`:

```typescript
const handleToggleDynamicRisk = useCallback(async (
  useActualAmounts: boolean,
) => {
  if (!calendar) return;

  // If using actual amounts, reload the original trades and recalculate stats
  if (useActualAmounts) {
    console.log("Resetting to actual trade amounts...");
    await fetchTrades();
    // Stats will be automatically recalculated by the database trigger
    return;
  }

  // Recalculate ALL trade amounts based on risk to reward
  if (!calendar.risk_per_trade || !trades.length) {
    return;
  }

  console.log("Recalculating trades with dynamic risk...");

  // Sort trades by date
  const sortedTrades = [...trades].sort((a, b) =>
    new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()
  );

  let cumulativePnL = 0;

  // Recalculate trade amounts
  const updatedTrades = sortedTrades.map((trade, index) => {
    if (!trade.risk_to_reward || trade.trade_type === "breakeven") {
      cumulativePnL += trade.amount;
      return trade;
    }

    const dynamicRiskSettings: DynamicRiskSettings = {
      account_balance: calendar.account_balance,
      risk_per_trade: calendar.risk_per_trade,
      dynamic_risk_enabled: calendar.dynamic_risk_enabled,
      increased_risk_percentage: calendar.increased_risk_percentage,
      profit_threshold_percentage: calendar.profit_threshold_percentage,
    };

    const effectiveRisk = calculateEffectiveRiskPercentage(
      new Date(trade.trade_date),
      sortedTrades.slice(0, index),
      dynamicRiskSettings,
    );

    const riskAmount = calculateRiskAmount(
      effectiveRisk,
      calendar.account_balance,
      cumulativePnL,
    );

    let newAmount = 0;
    if (trade.trade_type === "win") {
      newAmount = Math.round(riskAmount * trade.risk_to_reward);
    } else if (trade.trade_type === "loss") {
      newAmount = -Math.round(riskAmount);
    }

    cumulativePnL += newAmount;

    return {
      ...trade,
      amount: newAmount,
    };
  });

  // Update local state with recalculated trades
  setTrades(updatedTrades);

  // Calculate stats using the recalculated trades
  // This will update the calendar stats in the database
  await calculateCalendarStats(calendarId, updatedTrades);

  // Refresh calendar to get updated stats
  const updatedCalendar = await getCalendar(calendarId);
  if (updatedCalendar) {
    setCalendar(updatedCalendar);
  }
}, [calendar, calendarId, trades, fetchTrades]);
```

### Example 4: Import Preview

```typescript
const handleImportPreview = async (importedTrades: Partial<Trade>[]) => {
  // Calculate stats with imported trades to show preview
  await calculateCalendarStats(calendarId, importedTrades as Trade[]);
  
  // Get updated calendar with preview stats
  const previewCalendar = await getCalendar(calendarId);
  
  // Show preview to user
  showPreview(previewCalendar);
};
```

## Benefits

1. **Performance**: No need to update trades in database for what-if calculations
2. **Flexibility**: Calculate stats with any hypothetical trade data
3. **Consistency**: Uses the same calculation logic as automatic triggers
4. **Real-time**: Get instant stats updates without database writes
5. **Backward Compatible**: Existing code continues to work (NULL parameter = default behavior)

## Database Function Signature

```sql
CREATE OR REPLACE FUNCTION calculate_calendar_stats(
  p_calendar_id UUID,
  p_trades JSONB DEFAULT NULL
)
RETURNS void
```

## Trade Data Format

When providing trades, they should be in JSONB format with these fields:

```typescript
{
  id: string;
  calendar_id: string;
  user_id: string;
  amount: number;
  trade_type: 'win' | 'loss' | 'breakeven';
  trade_date: string; // ISO timestamp
  created_at: string; // ISO timestamp
  // ... other trade fields
}
```

The function will extract:
- `amount` - For P&L calculations
- `trade_date` - For period-based calculations (weekly, monthly, yearly)
- `created_at` - For drawdown calculations (ordering)

## Notes

- The function updates the `calendars` table with calculated stats
- Stats are persisted to the database even when using hypothetical trades
- To revert to actual stats, call the function without the trades parameter
- The trigger function always passes `NULL` for automatic calculations

