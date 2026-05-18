import { supabase } from 'config/supabase';
import { AppNotification } from 'types/notification';
import { logger } from 'utils/logger';

const NOTIFICATIONS_PAGE_SIZE = 100;

interface RawNotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  payload: unknown;
  created_at: string;
  read_at: string | null;
  dismissed_at: string | null;
}

function rowToNotification(row: RawNotificationRow): AppNotification {
  return {
    id: row.id,
    user_id: row.user_id,
    type: row.type,
    title: row.title,
    payload: (row.payload as AppNotification['payload']) ?? {},
    created_at: new Date(row.created_at),
    read_at: row.read_at ? new Date(row.read_at) : null,
    dismissed_at: row.dismissed_at ? new Date(row.dismissed_at) : null,
  };
}

export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(NOTIFICATIONS_PAGE_SIZE);
  if (error) {
    logger.error('fetchNotifications failed', error);
    throw error;
  }
  return (data ?? []).map(rowToNotification);
}

export async function markNotificationsRead(
  userId: string,
  notificationIds: string[]
): Promise<void> {
  if (notificationIds.length === 0) return;
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: nowIso })
    .eq('user_id', userId)
    .in('id', notificationIds)
    .is('read_at', null);
  if (error) {
    logger.warn('markNotificationsRead failed', error);
  }
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: nowIso })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) {
    logger.warn('markAllNotificationsRead failed', error);
  }
}

export async function dismissNotification(
  userId: string,
  notificationId: string
): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: nowIso, dismissed_at: nowIso })
    .eq('user_id', userId)
    .eq('id', notificationId);
  if (error) {
    logger.warn('dismissNotification failed', error);
  }
}

export async function clearAllNotifications(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', userId);
  if (error) {
    logger.error('clearAllNotifications failed', error);
    throw error;
  }
}

export const _internal = { rowToNotification };
