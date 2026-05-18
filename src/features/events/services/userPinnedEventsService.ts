/**
 * User-level pinned economic events.
 *
 * Pins live on `users.pinned_events` (JSONB). Replaced the per-calendar
 * `calendars.pinned_events` arrangement so a trader's watchlist follows them
 * across calendars instead of fragmenting per strategy.
 */

import { supabase } from 'config/supabase';
import { PinnedEvent } from 'features/calendar/types/dualWrite';
import { logger } from 'utils/logger';

export async function getUserPinnedEvents(
  userId: string
): Promise<PinnedEvent[]> {
  const { data, error } = await supabase
    .from('users')
    .select('pinned_events')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    logger.error('getUserPinnedEvents failed', error);
    throw error;
  }
  const raw = (data as { pinned_events?: unknown } | null)?.pinned_events;
  return Array.isArray(raw) ? (raw as PinnedEvent[]) : [];
}

export async function setUserPinnedEvents(
  userId: string,
  events: PinnedEvent[]
): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({
      pinned_events: events,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
  if (error) {
    logger.error('setUserPinnedEvents failed', error);
    throw error;
  }
}

/**
 * Subscribe to realtime updates of the current user's pinned_events column.
 * Returns the unsubscribe function. Caller should invoke it on cleanup.
 */
export function subscribeToUserPinnedEvents(
  userId: string,
  callback: (events: PinnedEvent[]) => void
): () => void {
  const channel = supabase
    .channel(`user_pinned_events_${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'users',
        filter: `id=eq.${userId}`,
      },
      (payload) => {
        const next = (payload.new as { pinned_events?: unknown } | null)
          ?.pinned_events;
        if (Array.isArray(next)) callback(next as PinnedEvent[]);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
