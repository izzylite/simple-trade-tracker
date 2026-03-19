# Session-Based Event Trade Filtering

## Summary

Enhance trade-event correlation by filtering trades based on the trading session an economic event falls under. When viewing an event like FOMC, the system determines which session (Asia, London, NY AM, NY PM) the event occurs in using its UTC timestamp, then filters trades to only show those taken during that session.

## Problem

Currently `fetchTradesByEvent` matches trades solely by JSONB containment on `economic_events` (cleaned_name + currency + impact). This returns all trades tagged with an event regardless of when they were taken. A trader viewing FOMC (which occurs during NY AM) sees trades from all sessions, diluting the signal.

## Approach

**Query-side filtering (Approach A)** — add an optional `session` parameter to `fetchTradesByEvent`. The caller determines the session from the event's `time_utc` using existing DST-aware session time ranges, then passes it to the repository. The Supabase query adds `.eq('session', session)` when provided.

## Design

### 1. New Utility: `getSessionForTimestamp`

**File:** `src/utils/sessionTimeUtils.ts`

```typescript
export function getSessionForTimestamp(timeUtc: string): TradingSession | null
```

- Parses the ISO timestamp into a Date; returns `null` for invalid/unparseable input
- Iterates sessions in order: `Asia`, `London`, `NY AM`, `NY PM`. On exact boundary matches, the later session wins (e.g., 12:00 UTC during DST matches NY AM, not London)
- For each, calls existing `getSessionTimeRange(session, date)` and checks if the timestamp falls within the range
- Returns the matching `TradingSession` or `null` if no match (all-day events, gap hours)
- Pure function, no side effects, uses existing DST-aware logic

### 2. Repository: `fetchTradesByEvent` Change

**File:** `src/services/repository/repositories/TradeRepository.ts`

Add optional `session` parameter:

```typescript
async fetchTradesByEvent(
  calendarId: string,
  cleanedEventName: string,
  currency: string,
  impact: string,
  session?: string  // NEW
): Promise<Trade[]>
```

When `session` is provided, add `.eq('session', session)` to the query chain between `.filter('economic_events', 'cs', ...)` and `.order(...)`. When `null`/`undefined`, query stays unchanged (fallback behavior).

### 3. Repository: `fetchTradeCountsByEvents` Change

**File:** `src/services/repository/repositories/TradeRepository.ts`

Add optional `session` field to the events array type:

```typescript
async fetchTradeCountsByEvents(
  calendarId: string,
  events: Array<{
    id: string;
    event_name: string;
    currency: string;
    impact: string;
    session?: string  // NEW - pre-computed by caller
  }>
): Promise<Map<string, number>>
```

When `session` is provided on an event, add `.eq('session', session)` to the count query. The caller (EconomicCalendarDrawer) pre-computes the session via `getSessionForTimestamp` before passing it in. This keeps session time logic out of the repository layer, consistent with the pattern in `fetchTradesByEvent`.

### 4. Dialog: `EconomicEventDetailDialog` Changes

**File:** `src/components/economicCalendar/EconomicEventDetailDialog.tsx`

**Determine session on render:**
```typescript
const eventSession = useMemo(
  () => getSessionForTimestamp(event.time_utc),
  [event.time_utc]
);
```

**Pass to query:** Update the `fetchTradesByEvent` call (line ~97) to pass `eventSession ?? undefined` as the 5th argument.

**Display session chip:** Add a chip next to the existing currency/impact chips in the dialog header. Only rendered when `eventSession` is not null. Session colors are defined as a shared constant (extracted from the local `SESSION_COLORS` in `SessionPerformanceAnalysis.tsx` into `sessionTimeUtils.ts` so both files can share it).

### 5. Calendar Drawer: `EconomicCalendarDrawer` Changes

**File:** `src/components/economicCalendar/EconomicCalendarDrawer.tsx`

Pre-compute the session for each event and pass it to `fetchTradeCountsByEvents`:

```typescript
mergedEvents.map(event => ({
  id: event.id,
  event_name: event.event_name,
  currency: event.currency,
  impact: event.impact,
  session: getSessionForTimestamp(event.time_utc) ?? undefined  // NEW
}))
```

## Fallback Behavior

When `getSessionForTimestamp` returns `null` (all-day events, holidays, timestamps falling in DST transition gaps), no session filter is applied. The query behaves exactly as it does today — matching only on event name, currency, and impact.

## Session Time Ranges (existing, no changes)

| Session   | DST (summer)       | Non-DST (winter)   |
|-----------|--------------------|---------------------|
| Asia      | 22:00-07:00 UTC    | 23:00-08:00 UTC     |
| London    | 07:00-12:00 UTC    | 08:00-13:00 UTC     |
| NY AM     | 12:00-17:00 UTC    | 13:00-18:00 UTC     |
| NY PM     | 17:00-21:00 UTC    | 18:00-22:00 UTC     |

Sessions are contiguous. On exact boundaries (e.g., 12:00 UTC during DST), the later session takes priority.

## Files Changed

| File | Change |
|------|--------|
| `src/utils/sessionTimeUtils.ts` | Add `getSessionForTimestamp` function, export `SESSION_COLORS` constant |
| `src/components/charts/SessionPerformanceAnalysis.tsx` | Import shared `SESSION_COLORS` instead of local definition |
| `src/services/repository/repositories/TradeRepository.ts` | Add optional `session` param to `fetchTradesByEvent` and `fetchTradeCountsByEvents` |
| `src/components/economicCalendar/EconomicEventDetailDialog.tsx` | Determine session, pass to query, display session chip |
| `src/components/economicCalendar/EconomicCalendarDrawer.tsx` | Pass `time_utc` to `fetchTradeCountsByEvents` |

## Known Limitations

- **DST transition gaps:** During the ~2-3 week period each year when US and EU DST transitions don't align, there may be small gaps between sessions. Events falling in these gaps get no session filter (fallback behavior).
- **`is_all_day` events:** The caller should skip calling `getSessionForTimestamp` when `event.is_all_day` is true, passing no session to the query.

## What This Does NOT Change

- Trade creation/editing flow (session is already a required field on trades)
- Session time ranges (uses existing hardcoded DST-aware ranges)
- No new database columns, migrations, or calendar settings
- No new settings dialog needed (uses existing ranges from `sessionTimeUtils.ts`)
