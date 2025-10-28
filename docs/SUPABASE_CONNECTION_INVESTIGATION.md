# Supabase Connection Investigation & Solution

## Problem Statement

User reported: "i notice sometimes supabase completely looses connection. ill have to reload the page to get it working again."

## Investigation Process

### 1. Research Official Supabase Documentation

Searched official Supabase documentation for connection management best practices:
- https://supabase.com/docs/guides/realtime/postgres-changes

**Key Findings:**
- Supabase does **NOT** provide built-in automatic reconnection for Realtime subscriptions
- Developers must implement their own reconnection logic
- The `.subscribe()` callback receives status updates: `SUBSCRIBED`, `CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED`
- No official documentation on automatic reconnection strategies

### 2. Community Research

Searched GitHub discussions and community solutions:
- GitHub Discussion #27513 shows similar issues
- Community consensus: Manual reconnection with exponential backoff
- Common pattern: Remove old channel before creating new one using `removeChannel()`
- Page visibility monitoring is recommended to prevent connection drops when tab is hidden

### 3. Root Causes Identified

1. **No connection state monitoring** - Application has no visibility into connection health
2. **No automatic reconnection** - When subscriptions fail, they don't attempt to reconnect
3. **Missing error callbacks** - Subscription errors are not caught or handled
4. **Browser tab throttling** - Connections drop when browser tab goes to background (after ~3 seconds)
5. **No cleanup before reconnection** - Creating multiple subscriptions without removing old ones

## Solution Implemented

### 1. Created `useRealtimeSubscription` Hook

**File:** `src/hooks/useRealtimeSubscription.ts`

A React hook that follows official Supabase patterns while adding automatic reconnection:

**Features:**
- ✅ Status monitoring (SUBSCRIBED, CHANNEL_ERROR, TIMED_OUT, CLOSED)
- ✅ Exponential backoff reconnection (1s, 2s, 4s, 8s, 16s)
- ✅ Proper cleanup using `removeChannel()` before creating new subscriptions
- ✅ Page visibility monitoring (pause/resume on tab hidden/visible)
- ✅ Network awareness (online/offline event handling)
- ✅ Max reconnection attempts to prevent infinite loops
- ✅ Detailed logging for debugging

**Usage:**
```typescript
const { createChannel } = useRealtimeSubscription({
  channelName: 'my-channel',
  enabled: true,
  onSubscribed: () => console.log('Connected!'),
  onError: (error) => console.error(error),
  maxReconnectAttempts: 5,
  reconnectDelay: 1000,
});
```

### 2. Updated Supabase Configuration

**File:** `src/config/supabase.ts`

Removed custom realtime configuration that wasn't documented in official Supabase docs:
- Removed `realtime.params.eventsPerSecond` (not in official docs)
- Removed `global.headers` (not necessary for connection management)
- Kept standard auth configuration (persistSession, autoRefreshToken, detectSessionInUrl)

### 3. Created Documentation

**File:** `docs/REALTIME_CONNECTION_MANAGEMENT.md`

Comprehensive documentation covering:
- Official Supabase approach to connection management
- Our implementation details
- Common issues and solutions
- Best practices
- Configuration options
- Reconnection strategy
- Migration guide from direct `.subscribe()` calls

### 4. Created Example Components

**File:** `src/examples/RealtimeSubscriptionExample.tsx`

Multiple examples showing:
- Basic calendar subscription with reconnection
- Multi-table subscriptions
- Conditional subscriptions (enable/disable)
- Critical subscriptions with custom settings

## How It Works

### Reconnection Flow

```
1. Subscription created → Status: SUBSCRIBED
2. Connection drops → Status: CHANNEL_ERROR or TIMED_OUT
3. Hook detects error → Starts reconnection attempt 1
4. Wait 1 second (exponential backoff)
5. Remove old channel using removeChannel()
6. Create new channel → Status: SUBSCRIBED
7. If fails → Attempt 2 with 2 second delay
8. Continue up to maxReconnectAttempts (default: 5)
```

### Page Visibility Handling

```
1. Tab becomes hidden → Log "Page hidden, pausing subscription"
2. Browser throttles background tab
3. Tab becomes visible → Check connection state
4. If connection is errored/closed → Trigger reconnection
5. Connection restored
```

### Network Awareness

```
1. Network goes offline → Log "Network offline"
2. Call onError callback to notify user
3. Network comes online → Trigger reconnection
4. Connection restored
```

## Testing Recommendations

To verify the solution works:

1. **Test connection drop:**
   - Open browser DevTools → Network tab
   - Set throttling to "Offline"
   - Wait a few seconds
   - Set back to "Online"
   - Check console logs for reconnection

2. **Test page visibility:**
   - Switch to another tab for 10+ seconds
   - Switch back
   - Check console logs for reconnection

3. **Test browser sleep:**
   - Put computer to sleep
   - Wake up after a few minutes
   - Check if connection restores automatically

4. **Monitor console logs:**
   - Look for: 📡 📊 🔄 ❌ 👁️ 🌐 🧹 emojis
   - Verify reconnection attempts and success

## Migration Path

### Current Code (Before)

```typescript
useEffect(() => {
  const channel = supabase
    .channel('calendar-123')
    .on('postgres_changes', { ... }, (payload) => { ... })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

### New Code (After)

```typescript
const { createChannel } = useRealtimeSubscription({
  channelName: 'calendar-123',
  onSubscribed: () => console.log('Connected'),
  onError: (error) => console.error(error),
});

useEffect(() => {
  const ch = createChannel();
  if (!ch) return;

  ch.on('postgres_changes', { ... }, (payload) => { ... });
  // Cleanup handled automatically by the hook
}, [createChannel]);
```

## Files Modified

1. ✅ Created `src/hooks/useRealtimeSubscription.ts` - Main hook implementation
2. ✅ Updated `src/config/supabase.ts` - Removed non-standard config
3. ✅ Created `docs/REALTIME_CONNECTION_MANAGEMENT.md` - Comprehensive documentation
4. ✅ Created `src/examples/RealtimeSubscriptionExample.tsx` - Usage examples
5. ✅ Created `docs/SUPABASE_CONNECTION_INVESTIGATION.md` - This document

## Files Removed

1. ❌ Deleted `src/services/supabaseConnectionManager.ts` - Too complex, not aligned with Supabase patterns
2. ❌ Deleted `src/hooks/useSupabaseConnection.ts` - Replaced with simpler useRealtimeSubscription
3. ❌ Deleted `src/components/common/ConnectionStatusIndicator.tsx` - Can be added later if needed

## Next Steps

1. **Update existing subscriptions** to use the new hook:
   - `src/App.tsx` - Calendar subscription (line ~508)
   - `src/services/economicCalendarService.ts` - Economic events subscription (line ~166)
   - Any other components using direct `.subscribe()` calls

2. **Test thoroughly** in development:
   - Verify reconnection works
   - Check console logs
   - Test with network throttling
   - Test with page visibility changes

3. **Monitor in production:**
   - Watch for connection errors
   - Track reconnection success rate
   - Gather user feedback

4. **Optional enhancements:**
   - Add connection status indicator UI component
   - Add user notifications for connection issues
   - Add metrics/analytics for connection health

## References

- [Supabase Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Supabase GitHub Discussion #27513](https://github.com/supabase/supabase/discussions/27513)
- [Supabase Realtime Troubleshooting](https://supabase.com/docs/guides/realtime/troubleshooting)

## Conclusion

The solution follows official Supabase documentation patterns while adding automatic reconnection logic based on community best practices. The implementation is simpler and more maintainable than the initial approach, and aligns with how Supabase expects developers to handle connection management.

The hook provides a clean, reusable pattern for all Realtime subscriptions in the application, with proper error handling, reconnection logic, and debugging capabilities.

