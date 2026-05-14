export type NotificationType = 'reminder_fired' | 'orion_task_result';

export interface ReminderFiredPayload {
  calendarId: string | null;
  conversationId: string;
  reminderId: string;
  messageId: string;
  preview: string;
  // Present when this reminder was scheduled as part of a multi-fire batch
  // (polling loop or grouped events). Used by the UI to collapse sibling
  // fires into a single grouped notification card. Pre-batch-id notifications
  // omit this field entirely (treated as solo at the UI layer).
  batchId?: string | null;
}

export interface OrionTaskResultPayload {
  taskId: string;
  resultId: string;
  taskType: string;
  significance: 'high' | 'medium' | 'low' | null;
  isError: boolean;
  preview: string;
}

export type NotificationPayload =
  | ReminderFiredPayload
  | OrionTaskResultPayload
  | Record<string, unknown>;

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType | string;
  title: string;
  payload: NotificationPayload;
  created_at: Date;
  read_at: Date | null;
  dismissed_at: Date | null;
}

export function isReminderFiredPayload(
  notification: AppNotification
): notification is AppNotification & { payload: ReminderFiredPayload } {
  if (notification.type !== 'reminder_fired') return false;
  const p = notification.payload as Partial<ReminderFiredPayload>;
  return typeof p?.conversationId === 'string' && typeof p?.reminderId === 'string';
}

export function isOrionTaskResultPayload(
  notification: AppNotification
): notification is AppNotification & { payload: OrionTaskResultPayload } {
  if (notification.type !== 'orion_task_result') return false;
  const p = notification.payload as Partial<OrionTaskResultPayload>;
  return typeof p?.taskId === 'string' && typeof p?.resultId === 'string';
}
