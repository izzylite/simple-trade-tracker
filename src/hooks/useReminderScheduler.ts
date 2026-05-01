/**
 * useReminderScheduler — schedules browser-local timers for the user's
 * pending reminders and triggers the fire path when they're due.
 *
 * The atomic claim happens server-side inside ai-trading-agent's reminder
 * mode; this hook just decides WHEN to POST. If a tab races with the
 * cron dispatcher, ai-trading-agent's claim_reminder RPC resolves it and
 * the loser receives `{claimed: false}` (silently a no-op).
 *
 * Constraints:
 * - setTimeout overflows past ~24.8 days (32-bit signed ms). We only
 *   schedule reminders due within MAX_LOCAL_HORIZON_MS; the cron handles
 *   longer-horizon ones until they re-enter the window on next mount.
 * - Background tabs throttle setTimeout to ~1 min. Cron is the safety net.
 * - Realtime subscription handled by useRealtimeSubscription (auto-reconnect
 *   + backoff) so the timer set survives transient network blips.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, supabaseUrl } from '../config/supabase';
import {
  getReminders,
  type Reminder,
} from '../services/remindersService';
import { useRealtimeSubscription } from './useRealtimeSubscription';
import { logger } from '../utils/logger';

// 24 days, safely under setTimeout's ~24.8-day signed-32-bit-ms cap.
const MAX_LOCAL_HORIZON_MS = 24 * 24 * 60 * 60 * 1000;

export function useReminderScheduler(enabled: boolean = true): void {
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const cancelTimer = useCallback((id: string): void => {
    const handle = timersRef.current.get(id);
    if (handle) {
      clearTimeout(handle);
      timersRef.current.delete(id);
    }
  }, []);

  const scheduleTimer = useCallback(
    (r: Reminder): void => {
      cancelTimer(r.id); // idempotent on UPDATE
      if (r.status !== 'pending') return;
      const delay = new Date(r.trigger_at).getTime() - Date.now();
      if (delay > MAX_LOCAL_HORIZON_MS) return; // out of horizon; cron handles it
      const safeDelay = Math.max(0, delay);
      const handle = setTimeout(() => {
        void fireLocally(r);
        timersRef.current.delete(r.id);
      }, safeDelay);
      timersRef.current.set(r.id, handle);
    },
    [cancelTimer],
  );

  // Initial backfill on mount.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void getReminders()
      .then((rows) => {
        if (cancelled) return;
        for (const r of rows) scheduleTimer(r);
      })
      .catch((err) => {
        logger.error('Failed to backfill reminders on mount:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, scheduleTimer]);

  // Stable handler identities so useRealtimeSubscription's createChannel
  // deps don't churn on every parent re-render (e.g. chat input typing).
  const handleChannelCreated = useCallback(
    (channel: RealtimeChannel) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reminders' },
        (payload) => {
          const evtType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
          if (evtType === 'INSERT' && payload.new) {
            scheduleTimer(payload.new as Reminder);
          } else if (evtType === 'UPDATE' && payload.new) {
            const next = payload.new as Reminder;
            if (next.status === 'pending') scheduleTimer(next);
            else cancelTimer(next.id);
          } else if (evtType === 'DELETE' && payload.old) {
            cancelTimer((payload.old as Reminder).id);
          }
        },
      );
    },
    [scheduleTimer, cancelTimer],
  );

  const handleSubscribed = useCallback(() => {
    // After (re)connecting, refresh from DB in case we missed events
    // during the disconnect window.
    void getReminders()
      .then((rows) => {
        // Cancel anything no longer pending; (re)schedule current ones.
        const stillPending = new Set(rows.map((r) => r.id));
        for (const id of Array.from(timersRef.current.keys())) {
          if (!stillPending.has(id)) cancelTimer(id);
        }
        for (const r of rows) scheduleTimer(r);
      })
      .catch((err) => {
        logger.error('Failed to resync reminders on reconnect:', err);
      });
  }, [scheduleTimer, cancelTimer]);

  // Realtime subscription with reconnect/backoff.
  useRealtimeSubscription({
    channelName: 'reminders-scheduler',
    enabled,
    privateChannel: false,
    onChannelCreated: handleChannelCreated,
    onSubscribed: handleSubscribed,
  });

  // Cleanup all timers on unmount.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const handle of Array.from(timers.values())) clearTimeout(handle);
      timers.clear();
    };
  }, []);
}

async function fireLocally(r: Reminder): Promise<void> {
  // No client-side claim — ai-trading-agent's reminder mode performs the
  // atomic claim internally. If the cron beat us, the edge function will
  // return {claimed: false} and bail without running the agent loop.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return; // shouldn't happen — RLS would have blocked us already
  if (!supabaseUrl) return;

  try {
    await fetch(`${supabaseUrl}/functions/v1/ai-trading-agent`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'reminder',
        userId: r.user_id,
        conversationId: r.conversation_id,
        reminderId: r.id,
        reminderDescription: r.description ?? undefined,
        message: r.instructions,
      }),
    });
  } catch (err) {
    // Network error: cron will retry within 5 min. Swallow so we don't
    // throw inside a setTimeout callback.
    logger.warn('Local reminder fire failed; cron will retry:', err);
  }
}
