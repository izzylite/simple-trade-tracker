# Session-Based Event Trade Filtering — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Filter trades shown for economic events by the trading session the event falls under, using the event's UTC timestamp.

**Architecture:** Add a pure utility function `getSessionForTimestamp` that maps a UTC timestamp to a trading session. Callers (dialog, drawer) compute the session and pass it to existing repository methods via a new optional `session` parameter. The Supabase query adds `.eq('session', session)` when provided.

**Tech Stack:** TypeScript, React, Supabase JS client, Jest

**Spec:** `docs/superpowers/specs/2026-03-19-session-based-event-trade-filtering-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/utils/sessionTimeUtils.ts` | Modify | Add `getSessionForTimestamp`, export `SESSION_COLORS` |
| `src/utils/__tests__/sessionTimeUtils.test.ts` | Create | Unit tests for `getSessionForTimestamp` |
| `src/services/repository/repositories/TradeRepository.ts` | Modify | Add optional `session` param to two methods |
| `src/components/economicCalendar/EconomicEventDetailDialog.tsx` | Modify | Compute session, pass to query, render chip |
| `src/components/economicCalendar/EconomicCalendarDrawer.tsx` | Modify | Pre-compute session, pass to count query |
| `src/components/charts/SessionPerformanceAnalysis.tsx` | Modify | Import shared `SESSION_COLORS` |

---

### Task 1: Add `SESSION_COLORS` constant and `getSessionForTimestamp` to `sessionTimeUtils.ts`

**Files:**
- Modify: `src/utils/sessionTimeUtils.ts`
- Test: `src/utils/__tests__/sessionTimeUtils.test.ts`

- [ ] **Step 1: Write failing tests for `getSessionForTimestamp`**

Create `src/utils/__tests__/sessionTimeUtils.test.ts`:

```typescript
import { getSessionForTimestamp } from '../sessionTimeUtils';

describe('getSessionForTimestamp', () => {
  // DST active (July) — EU DST: Asia 22-07, London 07-12, NY AM 12-17, NY PM 17-21
  describe('during DST (summer)', () => {
    it('returns Asia for 03:00 UTC in July', () => {
      expect(getSessionForTimestamp('2026-07-15T03:00:00Z')).toBe('Asia');
    });

    it('returns London for 10:00 UTC in July', () => {
      expect(getSessionForTimestamp('2026-07-15T10:00:00Z')).toBe('London');
    });

    it('returns NY AM for 14:00 UTC in July', () => {
      expect(getSessionForTimestamp('2026-07-15T14:00:00Z')).toBe('NY AM');
    });

    it('returns NY PM for 19:00 UTC in July', () => {
      expect(getSessionForTimestamp('2026-07-15T19:00:00Z')).toBe('NY PM');
    });
  });

  // Non-DST (January) — Asia 23-08, London 08-13, NY AM 13-18, NY PM 18-22
  describe('during non-DST (winter)', () => {
    it('returns Asia for 02:00 UTC in January', () => {
      expect(getSessionForTimestamp('2026-01-15T02:00:00Z')).toBe('Asia');
    });

    it('returns London for 10:00 UTC in January', () => {
      expect(getSessionForTimestamp('2026-01-15T10:00:00Z')).toBe('London');
    });

    it('returns NY AM for 15:00 UTC in January', () => {
      expect(getSessionForTimestamp('2026-01-15T15:00:00Z')).toBe('NY AM');
    });

    it('returns NY PM for 20:00 UTC in January', () => {
      expect(getSessionForTimestamp('2026-01-15T20:00:00Z')).toBe('NY PM');
    });
  });

  // Asia near midnight
  describe('Asia session near midnight', () => {
    it('returns Asia for 22:30 UTC in summer (DST)', () => {
      // Asia starts at 22:00 UTC during DST
      expect(getSessionForTimestamp('2026-07-15T22:30:00Z')).toBe('Asia');
    });

    it('returns Asia for 23:30 UTC in winter (non-DST)', () => {
      // Asia starts at 23:00 UTC during non-DST
      expect(getSessionForTimestamp('2026-01-15T23:30:00Z')).toBe('Asia');
    });
  });

  // DST transition window (US switched, EU hasn't yet — mid-March)
  describe('DST transition mismatch window', () => {
    it('handles mid-March when US is DST but EU is not', () => {
      // March 12, 2026: US DST active, EU still standard
      // London: 08-13 UTC (EU non-DST), NY AM: 12-17 UTC (US DST)
      // 14:00 UTC should be NY AM
      expect(getSessionForTimestamp('2026-03-12T14:00:00Z')).toBe('NY AM');
    });
  });

  // Boundary: later session wins
  describe('boundary behavior', () => {
    it('returns NY AM at exact London/NY AM boundary (12:00 UTC DST)', () => {
      expect(getSessionForTimestamp('2026-07-15T12:00:00Z')).toBe('NY AM');
    });

    it('returns London at exact Asia/London boundary (07:00 UTC DST)', () => {
      expect(getSessionForTimestamp('2026-07-15T07:00:00Z')).toBe('London');
    });
  });

  // Fallback
  describe('fallback to null', () => {
    it('returns null for invalid timestamp', () => {
      expect(getSessionForTimestamp('not-a-date')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(getSessionForTimestamp('')).toBeNull();
    });

    it('returns null for time in gap (22:30 UTC non-DST winter)', () => {
      // NY PM ends at 22:00 UTC, Asia starts at 23:00 UTC in winter
      expect(getSessionForTimestamp('2026-01-15T22:30:00Z')).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx react-scripts test --watchAll=false --testPathPattern="sessionTimeUtils"`
Expected: FAIL — `getSessionForTimestamp` is not exported

- [ ] **Step 3: Add `SESSION_COLORS` constant to `sessionTimeUtils.ts`**

Add at the top of `src/utils/sessionTimeUtils.ts`, after the type definitions (after line 12):

```typescript
/** Session-specific colors shared across components */
export const SESSION_COLORS: Record<TradingSession, string> = {
  'Asia': '#2962ff',
  'London': '#388e3c',
  'NY AM': '#f57c00',
  'NY PM': '#9c27b0'
};
```

- [ ] **Step 4: Implement `getSessionForTimestamp`**

Add at the end of `src/utils/sessionTimeUtils.ts`:

```typescript
/**
 * Determine which trading session a UTC timestamp falls under.
 * Iterates sessions so that on exact boundaries, the later session wins.
 * Returns null for invalid input or timestamps in gaps between sessions.
 */
export function getSessionForTimestamp(timeUtc: string): TradingSession | null {
  if (!timeUtc) return null;
  const date = new Date(timeUtc);
  if (isNaN(date.getTime())) return null;

  // Check sessions in reverse priority order; last match wins
  // so that on exact boundaries the later session takes priority
  const sessions: TradingSession[] = ['Asia', 'London', 'NY AM', 'NY PM'];
  let match: TradingSession | null = null;

  for (const session of sessions) {
    const range = getSessionTimeRange(session, date);

    if (session === 'Asia') {
      // Asia spans midnight: check previous-day start to trade-day end
      if (date >= range.start && date <= range.end) {
        match = session;
      }
    } else {
      if (date >= range.start && date <= range.end) {
        match = session;
      }
    }
  }

  return match;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx react-scripts test --watchAll=false --testPathPattern="sessionTimeUtils"`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/utils/sessionTimeUtils.ts src/utils/__tests__/sessionTimeUtils.test.ts
git commit -m "feat: add getSessionForTimestamp utility and SESSION_COLORS constant"
```

---

### Task 2: Update `SessionPerformanceAnalysis` to use shared `SESSION_COLORS`

**Files:**
- Modify: `src/components/charts/SessionPerformanceAnalysis.tsx:33-38`

- [ ] **Step 1: Replace local `SESSION_COLORS` with import**

In `src/components/charts/SessionPerformanceAnalysis.tsx`, add import:

```typescript
import { SESSION_COLORS } from '../../utils/sessionTimeUtils';
```

Then remove the local definition (lines 33-38):

```typescript
  // Define session-specific colors
  const SESSION_COLORS = {
    'Asia': '#2962ff',
    'London': '#388e3c',
    'NY AM': '#f57c00',
    'NY PM': '#9c27b0'
  };
```

- [ ] **Step 2: Verify build passes**

Run: `npx react-scripts build 2>&1 | tail -5`
Expected: "Compiled successfully."

- [ ] **Step 3: Commit**

```bash
git add src/components/charts/SessionPerformanceAnalysis.tsx
git commit -m "refactor: use shared SESSION_COLORS from sessionTimeUtils"
```

---

### Task 3: Add optional `session` param to `fetchTradesByEvent`

**Files:**
- Modify: `src/services/repository/repositories/TradeRepository.ts:203-238`

- [ ] **Step 1: Add `session` parameter and conditional filter**

In `src/services/repository/repositories/TradeRepository.ts`, update the `fetchTradesByEvent` method signature (line 203) and query:

Change from:
```typescript
  async fetchTradesByEvent(
    calendarId: string,
    cleanedEventName: string,
    currency: string,
    impact: string
  ): Promise<Trade[]> {
    try {
      const normalizedName = cleanedEventName.toLowerCase();

      // Query trades where economic_events JSONB array contains an object with matching:
      // - cleaned_name
      // - currency
      // - impact
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('calendar_id', calendarId)
        .not('economic_events', 'is', null)
        .filter('economic_events', 'cs', JSON.stringify([{
          cleaned_name: normalizedName,
          currency,
          impact
        }]))
        .order('trade_date', { ascending: false });
```

Change to:
```typescript
  async fetchTradesByEvent(
    calendarId: string,
    cleanedEventName: string,
    currency: string,
    impact: string,
    session?: string
  ): Promise<Trade[]> {
    try {
      const normalizedName = cleanedEventName.toLowerCase();

      // Query trades where economic_events JSONB array contains an object with matching:
      // - cleaned_name
      // - currency
      // - impact
      let query = supabase
        .from('trades')
        .select('*')
        .eq('calendar_id', calendarId)
        .not('economic_events', 'is', null)
        .filter('economic_events', 'cs', JSON.stringify([{
          cleaned_name: normalizedName,
          currency,
          impact
        }]));

      if (session) {
        query = query.eq('session', session);
      }

      const { data, error } = await query
        .order('trade_date', { ascending: false });
```

Everything else in the method stays the same.

- [ ] **Step 2: Verify build passes**

Run: `npx react-scripts build 2>&1 | tail -5`
Expected: "Compiled successfully."

- [ ] **Step 3: Commit**

```bash
git add src/services/repository/repositories/TradeRepository.ts
git commit -m "feat: add optional session filter to fetchTradesByEvent"
```

---

### Task 4: Add optional `session` param to `fetchTradeCountsByEvents`

**Files:**
- Modify: `src/services/repository/repositories/TradeRepository.ts:249-304`

- [ ] **Step 1: Update signature and query**

In the same file, update the `fetchTradeCountsByEvents` method.

Change signature (line 249-252) from:
```typescript
  async fetchTradeCountsByEvents(
    calendarId: string,
    events: Array<{ id: string; event_name: string; currency: string; impact: string }>
  ): Promise<Map<string, number>> {
```

Change to:
```typescript
  async fetchTradeCountsByEvents(
    calendarId: string,
    events: Array<{ id: string; event_name: string; currency: string; impact: string; session?: string }>
  ): Promise<Map<string, number>> {
```

Then update the query inside `countPromises` (around line 274-279). Change from:
```typescript
        const { count, error } = await supabase
          .from('trades')
          .select('*', { count: 'exact', head: true })
          .eq('calendar_id', calendarId)
          .not('economic_events', 'is', null)
          .filter('economic_events', 'cs', eventFilter);
```

Change to:
```typescript
        let query = supabase
          .from('trades')
          .select('*', { count: 'exact', head: true })
          .eq('calendar_id', calendarId)
          .not('economic_events', 'is', null)
          .filter('economic_events', 'cs', eventFilter);

        if (event.session) {
          query = query.eq('session', event.session);
        }

        const { count, error } = await query;
```

- [ ] **Step 2: Verify build passes**

Run: `npx react-scripts build 2>&1 | tail -5`
Expected: "Compiled successfully."

- [ ] **Step 3: Commit**

```bash
git add src/services/repository/repositories/TradeRepository.ts
git commit -m "feat: add optional session filter to fetchTradeCountsByEvents"
```

---

### Task 5: Integrate session filtering into `EconomicEventDetailDialog`

**Files:**
- Modify: `src/components/economicCalendar/EconomicEventDetailDialog.tsx`

- [ ] **Step 1: Add imports**

Add to the imports at the top of the file:

```typescript
import { getSessionForTimestamp, SESSION_COLORS } from '../../utils/sessionTimeUtils';
```

- [ ] **Step 2: Compute event session**

Inside the component, after the existing `useMemo` for `pinnedEventData` (around line 153), add:

```typescript
  // Determine which trading session this event falls under
  const eventSession = useMemo(
    () => event.is_all_day ? null : getSessionForTimestamp(event.time_utc),
    [event.time_utc, event.is_all_day]
  );
```

- [ ] **Step 3: Pass session to `fetchTradesByEvent`**

Update the `fetchTradesByEvent` call (line 97) from:

```typescript
        const trades = await calendarServiceModule.getTradeRepository().fetchTradesByEvent(
          calendarId,
          cleanedName,
          event.currency,
          event.impact
        );
```

To:

```typescript
        const trades = await calendarServiceModule.getTradeRepository().fetchTradesByEvent(
          calendarId,
          cleanedName,
          event.currency,
          event.impact,
          eventSession ?? undefined
        );
```

Also add `eventSession` to the `useEffect` dependency array (line 114):

```typescript
  }, [open, calendarId, event.event_name, event.currency, event.impact, eventSession]);
```

- [ ] **Step 4: Add session chip to dialog header**

In the dialog title JSX, after the impact `Chip` (around line 430), add the session chip:

```typescript
              {eventSession && (
                <Chip
                  label={eventSession}
                  size="small"
                  sx={{
                    height: 24,
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    backgroundColor: alpha(
                      SESSION_COLORS[eventSession] || theme.palette.info.main,
                      0.1
                    ),
                    color: SESSION_COLORS[eventSession] || theme.palette.info.main
                  }}
                />
              )}
```

- [ ] **Step 5: Verify build passes**

Run: `npx react-scripts build 2>&1 | tail -5`
Expected: "Compiled successfully."

- [ ] **Step 6: Commit**

```bash
git add src/components/economicCalendar/EconomicEventDetailDialog.tsx
git commit -m "feat: filter event trades by session and show session chip"
```

---

### Task 6: Integrate session filtering into `EconomicCalendarDrawer`

**Files:**
- Modify: `src/components/economicCalendar/EconomicCalendarDrawer.tsx:230-257`

- [ ] **Step 1: Add import**

Add to imports at the top of the file:

```typescript
import { getSessionForTimestamp } from '../../utils/sessionTimeUtils';
```

- [ ] **Step 2: Pass pre-computed session to `fetchTradeCountsByEvents`**

Update the event mapping in the `fetchTradeCounts` effect (around line 242). Change from:

```typescript
        const counts = await calendarServiceModule.getTradeRepository().fetchTradeCountsByEvents(
          calendar.id,
          mergedEvents.map(event => ({
            id: event.id,
            event_name: event.event_name,
            currency: event.currency,
            impact: event.impact
          }))
        );
```

To:

```typescript
        const counts = await calendarServiceModule.getTradeRepository().fetchTradeCountsByEvents(
          calendar.id,
          mergedEvents.map(event => ({
            id: event.id,
            event_name: event.event_name,
            currency: event.currency,
            impact: event.impact,
            session: event.is_all_day
              ? undefined
              : getSessionForTimestamp(event.time_utc) ?? undefined
          }))
        );
```

- [ ] **Step 3: Verify build passes**

Run: `npx react-scripts build 2>&1 | tail -5`
Expected: "Compiled successfully."

- [ ] **Step 4: Commit**

```bash
git add src/components/economicCalendar/EconomicCalendarDrawer.tsx
git commit -m "feat: pass session filter to trade count queries in calendar drawer"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run all tests**

Run: `npx react-scripts test --watchAll=false`
Expected: All tests pass

- [ ] **Step 2: Run production build**

Run: `npx react-scripts build`
Expected: "Compiled successfully."

- [ ] **Step 3: Manual smoke test**

1. Open the app, navigate to the economic calendar
2. Click on a timed event (e.g., FOMC) — verify the session chip appears (e.g., "NY AM")
3. Verify trade list shows only trades from that session
4. Click on an all-day/holiday event — verify no session chip, trades show normally
5. Verify trade count badges on the calendar view match the counts in the detail dialog

- [ ] **Step 4: Final commit (if any cleanup needed)**

Stage only the specific files that were changed, then commit:

```bash
git commit -m "chore: session-based event trade filtering complete"
```
