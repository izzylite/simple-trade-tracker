/**
 * useEventPinning Hook
 *
 * Back-compat wrapper around `useUserPinnedEvents`. Pinning moved from
 * per-calendar to per-user, so the `calendar` and `onUpdateCalendarProperty`
 * options are now ignored — kept on the type signature so existing call
 * sites compile while they are migrated to the new context directly.
 */

import { useCallback } from 'react';
import { Calendar } from '../types/calendar';
import { EconomicEvent } from '../types/economicCalendar';
import { useUserPinnedEvents } from '../contexts/UserPinnedEventsContext';

interface UseEventPinningOptions {
  /** @deprecated Pinning is user-level — this prop is ignored. */
  calendar?: Calendar;
  /** @deprecated Pinning is user-level — this prop is ignored. */
  onUpdateCalendarProperty?: (
    calendarId: string,
    updateFn: (calendar: Calendar) => Calendar
  ) => Promise<Calendar | undefined>;
}

interface UseEventPinningResult {
  pinningEventId: string | null;
  handlePinEvent: (event: EconomicEvent) => Promise<void>;
  handleUnpinEvent: (event: EconomicEvent) => Promise<void>;
  isEventCurrentlyPinned: (event: EconomicEvent) => boolean;
}

export function useEventPinning(
  _options: UseEventPinningOptions = {}
): UseEventPinningResult {
  const { pins, pinningEventId, pin, unpin } = useUserPinnedEvents();

  const isEventCurrentlyPinned = useCallback(
    (event: EconomicEvent): boolean => {
      // Inlined to avoid pulling isEventPinned import here; the context
      // already exposes an `isPinned` callback, but its identity changes on
      // every render. Recomputing against `pins` keeps the comparison stable.
      const cleaned = event.event_name.trim().toLowerCase();
      return pins.some((p) =>
        p.event_id
          ? p.event_id === event.id
          : p.event.toLowerCase() === cleaned
      );
    },
    [pins]
  );

  return {
    pinningEventId,
    handlePinEvent: pin,
    handleUnpinEvent: unpin,
    isEventCurrentlyPinned,
  };
}
