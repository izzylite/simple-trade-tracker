/**
 * Reminders service: read/cancel operations for chat-driven reminders.
 *
 * The browser local-timer scheduler (useReminderScheduler) and the reminders
 * panel UI (RemindersPanel) both consume this service so their view of
 * reminder state stays consistent. Realtime subscriptions are handled directly
 * by those callers via useRealtimeSubscription. The cron-based fallback
 * (dispatch-reminders edge function) is the only other writer.
 *
 * Note: there is no client-side claimReminder — claim_reminder() is a
 * service-role-only RPC. The browser fires reminders by POSTing to the
 * ai-trading-agent edge function in mode='reminder'; the edge function
 * performs the atomic claim internally. Single chokepoint, least-privilege.
 */
import { supabase } from '../config/supabase';

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
  /**
   * Shared UUID across reminders inserted in one manage_reminder(set) call.
   * NULL for solo reminders. Used by the UI to group polling loops and
   * multi-event batches into a single card.
   */
  batch_id: string | null;
  // Joined when fetched via getReminders()
  conversation_title?: string;
}

/** Fetch all of the user's pending reminders, joined with conversation title. */
export async function getReminders(): Promise<Reminder[]> {
  const { data, error } = await supabase
    .from('reminders')
    .select(`
      id, user_id, conversation_id, trigger_at, instructions, description,
      status, fired_at, last_error, created_at, updated_at, batch_id,
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

/**
 * Cancel every pending reminder sharing this batch_id atomically. Returns the
 * cancelled rows (may be empty if none were still pending). RLS scopes the
 * UPDATE to the current user, so cross-user batch cancels are impossible.
 */
export async function cancelReminderBatch(batchId: string): Promise<Reminder[]> {
  const { data, error } = await supabase
    .from('reminders')
    .update({ status: 'cancelled' })
    .eq('batch_id', batchId)
    .eq('status', 'pending')
    .select();
  if (error) throw error;
  return (data as Reminder[]) ?? [];
}
