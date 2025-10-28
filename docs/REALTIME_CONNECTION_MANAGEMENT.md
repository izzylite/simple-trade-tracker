# Supabase Realtime Connection Management

## Overview

This document explains how we handle Supabase Realtime connection management based on official Supabase documentation and community best practices.

## Official Supabase Approach

According to the [official Supabase documentation](https://supabase.com/docs/guides/realtime/postgres-changes), Supabase does **NOT** provide built-in automatic reconnection for Realtime subscriptions. Developers must implement their own reconnection logic.

### Subscription Status States

The `.subscribe()` callback receives these status updates:

- `SUBSCRIBED` - Successfully connected
- `CHANNEL_ERROR` - Connection error occurred
- `TIMED_OUT` - Connection attempt timed out
- `CLOSED` - Connection was closed

### Official Example

```typescript
const channel = supabase
  .channel('db-changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, (payload) => {
    console.log(payload);
  })
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('Connected!');
    } else if (status === 'CHANNEL_ERROR') {
      console.error('Connection error');
    } else if (status === 'TIMED_OUT') {
      console.warn('Connection timed out');
    }
  });
```

## Our Implementation

We've created a `useRealtimeSubscription` hook that follows Supabase's patterns while adding automatic reconnection logic.

### Key Features

1. **Status Monitoring** - Tracks all subscription states
2. **Exponential Backoff** - Reconnects with increasing delays (1s, 2s, 4s, 8s, 16s)
3. **Proper Cleanup** - Uses `removeChannel()` before creating new subscriptions
4. **Page Visibility** - Pauses/resumes subscriptions when tab is hidden/visible
5. **Network Awareness** - Handles online/offline events
6. **Max Attempts** - Prevents infinite reconnection loops

### Usage Example

```typescript
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';

function MyComponent() {
  const { channel, createChannel } = useRealtimeSubscription({
    channelName: 'my-channel',
    enabled: true,
    onSubscribed: () => console.log('Connected!'),
    onError: (error) => console.error('Connection error:', error),
    maxReconnectAttempts: 5,
    reconnectDelay: 1000,
  });

  useEffect(() => {
    if (!calendar) return;

    const ch = createChannel();
    if (!ch) return;

    ch.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'calendars',
        filter: `id=eq.${calendar.id}`,
      },
      (payload) => {
        // Handle the update
        console.log('Calendar updated:', payload.new);
      }
    );

    // The hook handles subscription and cleanup automatically
  }, [calendar?.id, createChannel]);

  return <div>My Component</div>;
}
```

## Common Issues and Solutions

### Issue: Connection Drops After Tab Goes to Background

**Cause:** Browsers throttle background tabs, causing Supabase connections to timeout.

**Solution:** The hook automatically handles page visibility changes. When the tab becomes visible again, it checks the connection state and reconnects if needed.

### Issue: Multiple Subscriptions to Same Channel

**Cause:** Creating multiple subscriptions without cleaning up the old ones.

**Solution:** Always use `removeChannel()` before creating a new subscription. The hook handles this automatically.

### Issue: Infinite Reconnection Loops

**Cause:** Attempting to reconnect indefinitely without a maximum limit.

**Solution:** Set `maxReconnectAttempts` (default: 5) to prevent infinite loops.

### Issue: Connection Errors Not Handled

**Cause:** Not monitoring subscription status or handling error states.

**Solution:** Use the `onError` callback to handle connection errors and notify users.

## Best Practices

1. **Always cleanup subscriptions** - Use `removeChannel()` in cleanup functions
2. **Monitor subscription status** - Handle all status states (SUBSCRIBED, CHANNEL_ERROR, TIMED_OUT, CLOSED)
3. **Use exponential backoff** - Don't reconnect immediately; use increasing delays
4. **Limit reconnection attempts** - Prevent infinite loops with max attempts
5. **Handle page visibility** - Pause/resume subscriptions based on tab visibility
6. **Provide user feedback** - Show connection status to users when appropriate

## Configuration

The `useRealtimeSubscription` hook accepts these options:

```typescript
interface UseRealtimeSubscriptionOptions {
  channelName: string;              // Unique channel identifier
  enabled?: boolean;                // Enable/disable subscription (default: true)
  onSubscribed?: () => void;        // Called when successfully connected
  onError?: (error: string) => void; // Called on connection errors
  maxReconnectAttempts?: number;    // Max reconnection attempts (default: 5)
  reconnectDelay?: number;          // Base delay in ms (default: 1000)
}
```

## Reconnection Strategy

The hook uses exponential backoff for reconnection:

```
Attempt 1: 1 second delay
Attempt 2: 2 seconds delay
Attempt 3: 4 seconds delay
Attempt 4: 8 seconds delay
Attempt 5: 16 seconds delay
```

Formula: `delay = reconnectDelay * Math.pow(2, attemptNumber - 1)`

## References

- [Supabase Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Supabase GitHub Discussion #27513](https://github.com/supabase/supabase/discussions/27513) - Community solutions for reconnection
- [Supabase Realtime Troubleshooting](https://supabase.com/docs/guides/realtime/troubleshooting)

## Migration Guide

If you're currently using direct `.subscribe()` calls, here's how to migrate:

### Before

```typescript
useEffect(() => {
  const channel = supabase
    .channel('my-channel')
    .on('postgres_changes', { ... }, (payload) => { ... })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

### After

```typescript
const { createChannel } = useRealtimeSubscription({
  channelName: 'my-channel',
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

## Monitoring and Debugging

Enable detailed logging by checking the browser console. The hook logs:

- 📡 Channel creation
- 📊 Status changes
- 🔄 Reconnection attempts
- ❌ Errors
- 👁️ Page visibility changes
- 🌐 Network status changes
- 🧹 Channel cleanup

Example log output:

```
📡 Creating realtime channel: calendar-123
📊 Channel calendar-123 status: SUBSCRIBED
👁️ Page hidden, pausing calendar-123 subscription
👁️ Page visible, resuming calendar-123 subscription
🔄 Reconnecting calendar-123 (attempt 1/5) in 1000ms
📊 Channel calendar-123 status: SUBSCRIBED
```

