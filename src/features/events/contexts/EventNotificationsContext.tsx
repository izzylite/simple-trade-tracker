import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  useEconomicEventWatcher,
  useEconomicEventsUpdates,
} from '../hooks/useEconomicEventWatcher';
import { useTradesContext } from 'contexts/TradesContext';
import { playNotificationSound } from 'utils/notificationSound';
import type { EconomicEvent } from '../types/economicCalendar';

/**
 * App-level controller for economic event notifications. Owns the watcher
 * subscription and the slider-stack state so notifications fire and render
 * from any route — not just /calendar.
 *
 * Per-calendar `economic_calendar_filters.notificationsEnabled` gates whether
 * incoming event updates push slider cards. The watcher itself stays mounted
 * regardless so the next page-mount can read up-to-date state.
 */
interface EventNotificationsContextValue {
  notifications: EconomicEvent[];
  removingIds: Set<string>;
  closeNotification: (id: string) => void;
}

const EventNotificationsContext =
  createContext<EventNotificationsContextValue | null>(null);

export const EventNotificationsProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { calendar, calendarId } = useTradesContext();

  // Mount the watcher whenever we have a calendar. Keying on calendarId
  // tears down the prior subscription and re-attaches the new filters.
  useEconomicEventWatcher({
    calendarId,
    economic_calendar_filters: calendar?.economic_calendar_filters,
    isActive: !!calendarId,
  });

  const [notifications, setNotifications] = useState<EconomicEvent[]>([]);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  // Hold the latest notificationsEnabled flag + calendarId in refs so the
  // useEconomicEventsUpdates callback (memoized once) reads live values
  // without re-subscribing on every flag flip / calendar switch.
  // Initialize with the current calendar setting so the very first event
  // before the sync effect fires honors the saved state (not the literal
  // `true` default).
  const notificationsEnabledRef = useRef<boolean>(
    calendar?.economic_calendar_filters?.notificationsEnabled ?? true
  );
  useEffect(() => {
    notificationsEnabledRef.current =
      calendar?.economic_calendar_filters?.notificationsEnabled ?? true;
  }, [calendar?.economic_calendar_filters?.notificationsEnabled]);
  const calendarIdRef = useRef<string>(calendarId);
  useEffect(() => {
    calendarIdRef.current = calendarId;
  }, [calendarId]);
  // Live filter snapshot so the notification gate re-checks impact/currency
  // against the *current* settings — MQL5 refresh in the watcher can mutate
  // an event's impact after it passed the DB-level filter, so the queue is
  // not a sufficient guarantee on its own.
  const filtersRef = useRef(calendar?.economic_calendar_filters);
  useEffect(() => {
    filtersRef.current = calendar?.economic_calendar_filters;
  }, [calendar?.economic_calendar_filters]);

  // Track timers so we can cancel them on unmount and avoid setState on
  // a torn-down provider during the 300ms exit animations.
  const timerRefs = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  useEffect(() => {
    const timers = timerRefs.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);
  const scheduleRemoval = useCallback((cb: () => void) => {
    const t = setTimeout(() => {
      timerRefs.current.delete(t);
      cb();
    }, 300);
    timerRefs.current.add(t);
  }, []);

  const pushNotification = useCallback(
    (event: EconomicEvent) => {
      playNotificationSound().catch(() => {
        /* Sound failure is non-fatal */
      });
      setNotifications((prev) => {
        if (prev.length >= 3) {
          const oldest = prev[0];
          setRemovingIds((curr) => {
            const next = new Set(curr);
            next.add(oldest.id);
            return next;
          });
          scheduleRemoval(() => {
            setNotifications((cur) => cur.filter((n) => n.id !== oldest.id));
            setRemovingIds((curr) => {
              const next = new Set(curr);
              next.delete(oldest.id);
              return next;
            });
          });
        }
        return [...prev, event];
      });
    },
    [scheduleRemoval]
  );

  const handleEventsUpdate = useCallback(
    (
      updatedEvents: EconomicEvent[],
      _allEvents: EconomicEvent[],
      updatedCalendarId: string
    ) => {
      const activeId = calendarIdRef.current;
      if (!activeId || updatedCalendarId !== activeId) return;
      if (!notificationsEnabledRef.current) return;

      const filters = filtersRef.current;
      const allowedImpacts = filters?.impacts;
      const allowedCurrencies = filters?.currencies;

      updatedEvents.forEach((evt) => {
        if (
          allowedImpacts &&
          allowedImpacts.length > 0 &&
          evt.impact &&
          !allowedImpacts.includes(evt.impact)
        ) {
          return;
        }
        if (
          allowedCurrencies &&
          allowedCurrencies.length > 0 &&
          evt.currency &&
          !allowedCurrencies.includes(evt.currency)
        ) {
          return;
        }
        pushNotification(evt);
      });
    },
    [pushNotification]
  );
  useEconomicEventsUpdates(handleEventsUpdate);

  const closeNotification = useCallback(
    (id: string) => {
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      scheduleRemoval(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        setRemovingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      });
    },
    [scheduleRemoval]
  );

  const value = useMemo<EventNotificationsContextValue>(
    () => ({ notifications, removingIds, closeNotification }),
    [notifications, removingIds, closeNotification]
  );

  return (
    <EventNotificationsContext.Provider value={value}>
      {children}
    </EventNotificationsContext.Provider>
  );
};

export const useEventNotifications = (): EventNotificationsContextValue => {
  const ctx = useContext(EventNotificationsContext);
  if (!ctx)
    throw new Error(
      'useEventNotifications must be used within EventNotificationsProvider'
    );
  return ctx;
};
