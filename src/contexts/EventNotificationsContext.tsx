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
import { useTradesContext } from './TradesContext';
import { playNotificationSound } from '../utils/notificationSound';
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
  // Hold the latest notificationsEnabled flag in a ref so the
  // useEconomicEventsUpdates callback (registered once) reads the live value
  // without re-subscribing on every flag flip.
  const notificationsEnabledRef = useRef<boolean>(true);
  useEffect(() => {
    notificationsEnabledRef.current =
      calendar?.economic_calendar_filters?.notificationsEnabled ?? true;
  }, [calendar?.economic_calendar_filters?.notificationsEnabled]);

  const pushNotification = useCallback((event: EconomicEvent) => {
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
        setTimeout(() => {
          setNotifications((cur) => cur.filter((n) => n.id !== oldest.id));
          setRemovingIds((curr) => {
            const next = new Set(curr);
            next.delete(oldest.id);
            return next;
          });
        }, 300);
      }
      return [...prev, event];
    });
  }, []);

  useEconomicEventsUpdates((updatedEvents, _allEvents, updatedCalendarId) => {
    if (!calendarId || updatedCalendarId !== calendarId) return;
    if (!notificationsEnabledRef.current) return;
    updatedEvents.forEach(pushNotification);
  });

  const closeNotification = useCallback((id: string) => {
    setRemovingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 300);
  }, []);

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
