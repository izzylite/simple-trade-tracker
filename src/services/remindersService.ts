/**
 * Reminders service: CRUD + realtime subscription for chat-driven reminders.
 *
 * The browser local-timer scheduler (useReminderScheduler) and the reminders
 * panel UI (RemindersPanel) both consume this service so their view of
 * reminder state stays consistent. The cron-based fallback (dispatch-reminders
 * edge function) is the only other writer.
 *
 * Note: there is no client-side claimReminder — claim_reminder() is a
 * service-role-only RPC. The browser fires reminders by POSTing to the
 * ai-trading-agent edge function in mode='reminder'; the edge function
 * performs the atomic claim internally. Single chokepoint, least-privilege.
 */
import { supabase } from '../config/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type ReminderStatus =
  | 'pending'
  | 'firing'
  | 'fired'
  | 'failed'
  | 'cancelled';

export interface Reminder {
  id: string;
  user_id: string;
  conversation_id: string;
  trigger_at: string;
  instructions: string;
  description: string | null;
  status: ReminderStatus;
  fired_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  // Joined when fetched via getReminders()
  conversation_title?: string;
}

/** Fetch all of the user's pending reminders, joined with conversation title. */
export async function getReminders(): Promise<Reminder[]> {
  const { data, error } = await supabase
    .from('reminders')
    .select(`
      id, user_id, conversation_id, trigger_at, instructions, description,
      status, fired_at, last_error, created_at, updated_at,
      ai_conversations!inner(title)
    `)
    .eq('status', 'pending')
    .order('trigger_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => {
    const conv = (row as { ai_conversations: { title?: string } | { title?: string }[] | null })
      .ai_conversations;
    const title = Array.isArray(conv) ? conv[0]?.title : conv?.title;
    return { ...row, conversation_title: title } as Reminder;
  });
}

/** Cancel a pending reminder. Returns the cancelled row, or null if not found / not pending. */
export async function cancelReminder(id: string): Promise<Reminder | null> {
  const { data, error } = await supabase
    .from('reminders')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('status', 'pending')
    .select()
    .maybeSingle();
  if (error) throw error;
  return (data as Reminder) ?? null;
}

export interface ReminderEvent {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  newRow: Reminder | null;
  oldRow: Reminder | null;
}

/**
 * Subscribe to changes on the user's reminders. The user filter is enforced
 * by RLS — the realtime stream only emits rows visible to the current auth.
 *
 * Returns an unsubscribe function.
 */
export function subscribeToReminders(
  onEvent: (event: ReminderEvent) => void,
): () => void {
  const channel: RealtimeChannel = supabase
    .channel('reminders-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'reminders' },
      (payload) => {
        onEvent({
          type: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
          newRow: (payload.new as Reminder | null) ?? null,
          oldRow: (payload.old as Reminder | null) ?? null,
        });
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
