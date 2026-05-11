/**
 * User-level pinned economic events provider.
 *
 * Centralizes read + mutate of `users.pinned_events` so every surface in the
 * app (Events page, calendar drawer, sticky reminder cards, pinned content
 * panel, trade detail) reads the same set. Optimistically updates local
 * state, then writes through to Supabase. Realtime subscription keeps the
 * cache in sync across tabs.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuthState } from './AuthStateContext';
import {
  getUserPinnedEvents,
  setUserPinnedEvents,
  subscribeToUserPinnedEvents,
} from '../services/userPinnedEventsService';
import { EconomicEvent } from '../types/economicCalendar';
import { PinnedEvent } from '../types/dualWrite';
import {
  cleanEventNameForPinning,
  isEventPinned,
} from '../utils/eventNameUtils';
import { logger } from '../utils/logger';

interface UserPinnedEventsValue {
  /** Authoritative pinned events for the current user. */
  pins: PinnedEvent[];
  /** Initial fetch in flight. */
  loading: boolean;
  /** Event currently being pinned/unpinned (drives spinner UI). */
  pinningEventId: string | null;
  /** Pin if absent. No-op when already pinned. */
  pin: (event: EconomicEvent) => Promise<void>;
  /** Unpin by event_id (or by cleaned event name when no id is present). */
  unpin: (event: EconomicEvent) => Promise<void>;
  /** Update the notes attached to an existing pin. */
  updateNotes: (eventId: string, notes: string) => Promise<void>;
  /** Sync helper: returns true when the given event is currently pinned. */
  isPinned: (event: EconomicEvent) => boolean;
}

const UserPinnedEventsContext =
  createContext<UserPinnedEventsValue | undefined>(undefined);

export const UserPinnedEventsProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { user } = useAuthState();
  const userId = user?.id ?? null;

  const [pins, setPins] = useState<PinnedEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [pinningEventId, setPinningEventId] = useState<string | null>(null);

  // Track latest pins synchronously so async writes don't read stale state.
  const pinsRef = useRef<PinnedEvent[]>([]);
  pinsRef.current = pins;

  // Fetch + subscribe whenever the user changes
  useEffect(() => {
    if (!userId) {
      setPins([]);
      return;
    }
    let alive = true;
    setLoading(true);
    getUserPinnedEvents(userId)
      .then((p) => {
        if (alive) setPins(p);
      })
      .catch((err) => logger.error('Failed to load user pinned events', err))
      .finally(() => {
        if (alive) setLoading(false);
      });
    const unsubscribe = subscribeToUserPinnedEvents(userId, (next) => {
      if (alive) setPins(next);
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [userId]);

  const writeThrough = useCallback(
    async (next: PinnedEvent[], previous: PinnedEvent[]) => {
      if (!userId) return;
      try {
        await setUserPinnedEvents(userId, next);
      } catch (err) {
        logger.error('User pin write failed; rolling back', err);
        setPins(previous);
      }
    },
    [userId]
  );

  const pin = useCallback(
    async (event: EconomicEvent) => {
      if (!userId) return;
      const current = pinsRef.current;
      if (isEventPinned(event, current)) return;
      const cleaned = cleanEventNameForPinning(event.event_name);
      const next: PinnedEvent[] = [
        ...current,
        {
          event: cleaned,
          event_id: event.id,
          notes: '',
          impact: event.impact,
          currency: event.currency,
          flag_url: event.flag_url,
          country: event.country,
        },
      ];
      setPinningEventId(event.id);
      setPins(next);
      try {
        await writeThrough(next, current);
      } finally {
        setPinningEventId(null);
      }
    },
    [userId, writeThrough]
  );

  const unpin = useCallback(
    async (event: EconomicEvent) => {
      if (!userId) return;
      const current = pinsRef.current;
      const cleanedName = cleanEventNameForPinning(
        event.event_name
      ).toLowerCase();
      const next = current.filter((p) =>
        p.event_id
          ? p.event_id !== event.id
          : p.event.toLowerCase() !== cleanedName
      );
      if (next.length === current.length) return;
      setPinningEventId(event.id);
      setPins(next);
      try {
        await writeThrough(next, current);
      } finally {
        setPinningEventId(null);
      }
    },
    [userId, writeThrough]
  );

  const updateNotes = useCallback(
    async (eventId: string, notes: string) => {
      if (!userId) return;
      const current = pinsRef.current;
      const next = current.map((p) =>
        p.event_id === eventId ? { ...p, notes } : p
      );
      setPins(next);
      await writeThrough(next, current);
    },
    [userId, writeThrough]
  );

  const isPinned = useCallback(
    (event: EconomicEvent) => isEventPinned(event, pins),
    [pins]
  );

  const value = useMemo<UserPinnedEventsValue>(
    () => ({ pins, loading, pinningEventId, pin, unpin, updateNotes, isPinned }),
    [pins, loading, pinningEventId, pin, unpin, updateNotes, isPinned]
  );

  return (
    <UserPinnedEventsContext.Provider value={value}>
      {children}
    </UserPinnedEventsContext.Provider>
  );
};

/**
 * Read user-level pinned events. Returns empty pins when no provider is
 * mounted (defensive — surfaces rendered for unauthenticated visitors, e.g.
 * shared links, should still render gracefully).
 */
export function useUserPinnedEvents(): UserPinnedEventsValue {
  const ctx = useContext(UserPinnedEventsContext);
  if (ctx) return ctx;
  return EMPTY_VALUE;
}

const noop = async () => {};
const EMPTY_VALUE: UserPinnedEventsValue = {
  pins: [],
  loading: false,
  pinningEventId: null,
  pin: noop,
  unpin: noop,
  updateNotes: noop,
  isPinned: () => false,
};
