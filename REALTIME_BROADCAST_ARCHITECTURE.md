# Realtime Broadcast Architecture

This document describes the realtime update architecture using Supabase's recommended **broadcast** approach instead of `postgres_changes`.

## Overview

The application uses Supabase Realtime Broadcast for all real-time database updates. This is the **recommended approach** by Supabase for the following reasons:

1. **Works seamlessly with RLS policies** - No complex workarounds needed
2. **No REPLICA IDENTITY FULL required** - Uses DEFAULT replica identity
3. **More reliable and performant** - Designed specifically for this use case
4. **Better control** - Explicit control over what data is broadcast

## Architecture

### Database Layer

#### Broadcast Trigger Functions

Three trigger functions broadcast changes to realtime subscribers:

1. **`trigger_broadcast_calendar_changes()`** - Broadcasts calendar UPDATE events
   - Topic: `calendar-{calendar_id}`
   - Events: UPDATE only (stats recalculation)

2. **`trigger_broadcast_trade_changes()`** - Broadcasts trade INSERT/UPDATE/DELETE events
   - Topic: `trades-{calendar_id}`
   - Events: INSERT, UPDATE, DELETE

3. **`trigger_broadcast_economic_event_changes()`** - Broadcasts economic event changes
   - Topic: `economic-events`
   - Events: INSERT, UPDATE, DELETE

#### Payload Structure

All broadcast payloads follow this structure:

```typescript
{
  event: "INSERT" | "UPDATE" | "DELETE",
  type: "broadcast",
  payload: {
    id: string,              // Unique message ID
    record: {...},           // NEW record (for INSERT/UPDATE)
    old_record: {...},       // OLD record (for UPDATE/DELETE)
    table: string,           // Table name
    schema: string,          // Schema name
    operation: string        // Operation type
  }
}
```

### Frontend Layer

#### Realtime Subscription Hook

`useRealtimeSubscription` manages Supabase realtime channels with:
- Automatic reconnection with exponential backoff
- Private channel configuration for broadcast authorization
- Auth token management via `supabase.realtime.setAuth()`
- Proper cleanup using `removeChannel()`

#### Trade Subscriptions

**Hook:** `useCalendarTrades`

**Channels:**
1. `calendar-{calendarId}` - Calendar stats updates
   - Listens to: UPDATE events
   - Updates: Calendar state with new statistics

2. `trades-{calendarId}` - Trade changes
   - Listens to: INSERT, UPDATE, DELETE events
   - Updates: Trades array with optimistic updates

**Example:**
```typescript
useRealtimeSubscription({
  channelName: `trades-${calendarId}`,
  enabled: enableRealtime && !!calendarId,
  onChannelCreated: (channel) => {
    channel.on("broadcast", { event: "INSERT" }, (payload) => {
      const newTrade = payload.payload.record as Trade;
      setTrades((prev) => [...prev, newTrade]);
    });
    
    channel.on("broadcast", { event: "UPDATE" }, (payload) => {
      const updatedTrade = payload.payload.record as Trade;
      setTrades((prev) => prev.map(t => t.id === updatedTrade.id ? updatedTrade : t));
    });
    
    channel.on("broadcast", { event: "DELETE" }, (payload) => {
      const deletedTrade = payload.payload.old_record as Trade;
      setTrades((prev) => prev.filter(t => t.id !== deletedTrade.id));
    });
  }
});
```

#### Economic Events Subscriptions

**Component:** `EconomicCalendarDrawer`

**Channel:** `economic-events`
- Listens to: INSERT, UPDATE, DELETE events
- Updates: Refetches events for current date range

## Database Migrations

### Migration 039: Migrate to Broadcast

**File:** `supabase/migrations/039_migrate_to_broadcast_realtime.sql`

This migration:
1. Creates broadcast trigger functions for all tables
2. Creates triggers on trades, calendars, and economic_events tables
3. Verifies RLS policies on `realtime.messages` table
4. Reverts REPLICA IDENTITY back to DEFAULT (no longer needed)

### RLS Policies for Broadcast

Required policies on `realtime.messages` table:

```sql
-- Allow authenticated users to receive broadcasts
CREATE POLICY "Authenticated users can receive broadcasts"
ON "realtime"."messages"
FOR SELECT
TO authenticated
USING (true);

-- Allow system to send broadcasts
CREATE POLICY "System can send broadcasts"
ON "realtime"."messages"
FOR INSERT
TO authenticated
WITH CHECK (true);
```

## Benefits Over postgres_changes

| Feature | postgres_changes | Broadcast |
|---------|-----------------|-----------|
| RLS Compatibility | ⚠️ Requires workarounds | ✅ Works seamlessly |
| Replica Identity | ❌ Requires FULL | ✅ Uses DEFAULT |
| Performance | ⚠️ Can be slow with RLS | ✅ Optimized |
| Control | ❌ Automatic | ✅ Explicit |
| Recommended | ❌ No | ✅ Yes |

## Testing

### Manual Testing

1. **Trade Operations:**
   - Create a trade → Should appear in UI immediately
   - Update a trade → Should update in UI immediately
   - Delete a trade → Should disappear from UI and update calendar stats

2. **Calendar Stats:**
   - Delete a trade → Calendar `total_pnl`, `total_trades`, `win_rate` should update
   - Add a trade → Calendar stats should recalculate

3. **Economic Events:**
   - Open Economic Calendar drawer
   - Events should load and update in real-time

### Verification Queries

```sql
-- Verify triggers exist
SELECT tgname, tgrelid::regclass, tgfoid::regproc 
FROM pg_trigger 
WHERE tgname LIKE '%broadcast%';

-- Verify replica identity is DEFAULT
SELECT relname, relreplident 
FROM pg_class 
WHERE relname IN ('trades', 'calendars', 'economic_events');
-- Expected: relreplident = 'd' (DEFAULT)

-- Verify RLS policies
SELECT * FROM pg_policies 
WHERE schemaname = 'realtime' AND tablename = 'messages';
```

## Troubleshooting

### Broadcasts not received

1. **Check auth token:**
   ```typescript
   const session = await supabase.auth.getSession();
   await supabase.realtime.setAuth(session.data.session.access_token);
   ```

2. **Check channel config:**
   ```typescript
   const channel = supabase.channel(channelName, {
     config: { private: true } // Required for broadcast
   });
   ```

3. **Check RLS policies:**
   ```sql
   SELECT * FROM pg_policies 
   WHERE schemaname = 'realtime' AND tablename = 'messages';
   ```

### Duplicate events

- Ensure you're not subscribing to the same channel multiple times
- Check that `useRealtimeSubscription` is properly cleaning up channels

### Stale data

- Verify triggers are firing: Check Supabase logs
- Verify payload structure: Log `payload.payload.record` in frontend
- Verify state updates: Check React DevTools

## References

- [Supabase Realtime Broadcast Documentation](https://supabase.com/docs/guides/realtime/broadcast)
- [Supabase Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization)
- [PostgreSQL Triggers](https://www.postgresql.org/docs/current/sql-createtrigger.html)

