import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { supabase } from '../config/supabase';
import { useAuthState } from './AuthStateContext';
import { AppNotification } from '../types/notification';
import {
  clearAllNotifications,
  dismissNotification as dismissNotificationApi,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationsRead,
} from '../services/notificationsService';
import { _internal as notificationsInternal } from '../services/notificationsService';
import { orionTaskService } from 'features/orion/services/orionTaskService';
import { isOrionTaskResultPayload } from '../types/notification';
import { logger } from '../utils/logger';

/**
 * A surface registers a route handler while it can intercept notification
 * clicks locally (e.g. the active calendar page swapping the open
 * conversation in its bottom-sheet rather than navigating to /assistant).
 * Return `true` if the handler accepted the notification — falsy means
 * "not mine, let the caller fall back to URL navigation".
 *
 * Handlers run in LIFO order (most-recently-registered first), so deeper
 * surfaces (modals, focused-trade overlays) win over their parent page.
 */
export type NotificationRouteHandler = (n: AppNotification) => boolean;

interface NotificationsContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsSeen: () => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  /**
   * Notifications visible as in-stream cards inside conversation X. Excludes
   * dismissed and excludes notifications whose payload.conversationId matches
   * the current conversation (those are already visible as messages).
   */
  crossSessionFor: (conversationId: string | null | undefined) => AppNotification[];
  /**
   * Mount-scoped handler registration. Returns an unregister fn — call it
   * inside the cleanup of the registering effect.
   */
  registerRouteHandler: (handler: NotificationRouteHandler) => () => void;
  /**
   * Try local handlers in LIFO order. Returns true if one claimed the
   * notification; the caller is responsible for the URL-navigation fallback
   * when this returns false.
   */
  tryRouteNotification: (n: AppNotification) => boolean;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuthState();
  const userId = user?.uid;

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const routeHandlersRef = useRef<NotificationRouteHandler[]>([]);

  const registerRouteHandler = useCallback(
    (handler: NotificationRouteHandler) => {
      routeHandlersRef.current.push(handler);
      return () => {
        routeHandlersRef.current = routeHandlersRef.current.filter(
          (h) => h !== handler
        );
      };
    },
    []
  );

  const tryRouteNotification = useCallback((n: AppNotification): boolean => {
    const stack = routeHandlersRef.current;
    for (let i = stack.length - 1; i >= 0; i--) {
      try {
        if (stack[i](n)) return true;
      } catch (err) {
        logger.warn('Notification route handler threw', err);
      }
    }
    return false;
  }, []);

  // Initial fetch on auth.
  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchNotifications(userId)
      .then((rows) => {
        if (!cancelled) setNotifications(rows);
      })
      .catch((err) => {
        logger.error('Initial notifications fetch failed', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Realtime subscription. Single user-scoped channel; postgres_changes
  // events on `notifications` filtered by user_id keep state in sync without
  // refetch. RLS already enforces ownership at the row level — the client
  // filter is for traffic shaping.
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const row = notificationsInternal.rowToNotification(
            payload.new as unknown as Parameters<typeof notificationsInternal.rowToNotification>[0]
          );
          setNotifications((prev) => {
            if (prev.some((n) => n.id === row.id)) return prev;
            return [row, ...prev].slice(0, 100);
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const row = notificationsInternal.rowToNotification(
            payload.new as unknown as Parameters<typeof notificationsInternal.rowToNotification>[0]
          );
          setNotifications((prev) =>
            prev.map((n) => (n.id === row.id ? row : n))
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload: { old: Record<string, unknown> }) => {
          const id = (payload.old as { id?: string })?.id;
          if (!id) return;
          setNotifications((prev) => prev.filter((n) => n.id !== id));
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [userId]);

  // Propagate read state to source records when relevant. Right now only
  // `orion_task_result` has a backing row (`orion_task_results.is_read`)
  // that the rest of the app cares about. Failures are non-fatal — the
  // notification row's read state is already persisted.
  const propagateRead = useCallback(
    async (notification: AppNotification | undefined) => {
      if (!notification) return;
      if (isOrionTaskResultPayload(notification)) {
        try {
          await orionTaskService.markResultRead(notification.payload.resultId);
        } catch (err) {
          logger.warn('Failed to propagate read to orion_task_results', err);
        }
      }
    },
    []
  );

  const markAsRead = useCallback(
    async (id: string) => {
      if (!userId) return;
      const target = notifications.find((n) => n.id === id);
      const now = new Date();
      setNotifications((prev) =>
        prev.map((n) => (n.id === id && !n.read_at ? { ...n, read_at: now } : n))
      );
      await markNotificationsRead(userId, [id]);
      void propagateRead(target);
    },
    [userId, notifications, propagateRead]
  );

  const markAllAsSeen = useCallback(async () => {
    if (!userId) return;
    const unread = notifications.filter((n) => !n.read_at);
    if (unread.length === 0) return;
    const now = new Date();
    setNotifications((prev) =>
      prev.map((n) => (n.read_at ? n : { ...n, read_at: now }))
    );
    await markAllNotificationsRead(userId);
    // Mark every unread task notification's source result read too. Done
    // in parallel; per-row failures are warned but don't block the bulk.
    await Promise.allSettled(unread.map((n) => propagateRead(n)));
  }, [userId, notifications, propagateRead]);

  const dismiss = useCallback(
    async (id: string) => {
      if (!userId) return;
      const target = notifications.find((n) => n.id === id);
      const now = new Date();
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, read_at: n.read_at ?? now, dismissed_at: now } : n
        )
      );
      await dismissNotificationApi(userId, id);
      void propagateRead(target);
    },
    [userId, notifications, propagateRead]
  );

  const clearAll = useCallback(async () => {
    if (!userId) return;
    setNotifications([]);
    try {
      await clearAllNotifications(userId);
    } catch (err) {
      logger.error('clearAll rollback: refetching notifications', err);
      try {
        const rows = await fetchNotifications(userId);
        setNotifications(rows);
      } catch {
        // already logged in fetchNotifications; leave list empty until next mount
      }
    }
  }, [userId]);

  const crossSessionFor = useCallback(
    (conversationId: string | null | undefined) => {
      return notifications.filter((n) => {
        if (n.dismissed_at) return false;
        if (n.type !== 'reminder_fired') return false;
        const payloadConvo = (n.payload as { conversationId?: string })?.conversationId;
        if (!payloadConvo) return false;
        if (conversationId && payloadConvo === conversationId) return false;
        return true;
      });
    },
    [notifications]
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read_at).length,
    [notifications]
  );

  const value: NotificationsContextValue = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      markAsRead,
      markAllAsSeen,
      dismiss,
      clearAll,
      crossSessionFor,
      registerRouteHandler,
      tryRouteNotification,
    }),
    [
      notifications,
      unreadCount,
      loading,
      markAsRead,
      markAllAsSeen,
      dismiss,
      clearAll,
      crossSessionFor,
      registerRouteHandler,
      tryRouteNotification,
    ]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationsProvider');
  }
  return ctx;
}

export function useNotificationsOptional(): NotificationsContextValue | null {
  return useContext(NotificationsContext);
}
