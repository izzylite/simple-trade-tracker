/**
 * Conversation persistence helpers for the chat-mode handler.
 *
 * Backend owns turn-time writes to `ai_conversations.messages`. The frontend
 * keeps its optimistic streaming UI; these helpers are what makes the DB the
 * source of truth so tools that need the conversation row (e.g. set_reminder)
 * succeed on the very first turn of a new conversation.
 *
 * Reminder mode (handleReminderRequest in index.ts) does its own append; we
 * could unify with these helpers later, but that file uses additional
 * fields (claim_reminder coordination, fired-at marking) that don't belong
 * in a generic chat-message store.
 */

import { createServiceClient, log } from '../_shared/supabase.ts';

export type AppendUserMessageResult =
  | { ok: true; conversationId: string }
  | { ok: false; code: 'message_limit_reached' | 'forbidden' | 'unknown'; message?: string };

/**
 * Persist the user's message at turn start.
 *
 * On first turn of a new conversation the row may not exist yet — UPSERT it
 * with `ignoreDuplicates: true` so subsequent turns are a no-op. Then append
 * the message via the same atomic `message_count < 50` guard the reminder
 * fire path uses, so two-tab races can't blow past the cap.
 *
 * On edit-resend, the existing messages array is truncated at `editingMessageId`
 * (inclusive) before append. Mirrors the frontend's `messages.slice(0, idx)`
 * behavior — without it the DB accumulates orphan turns and they reappear on
 * next reload.
 *
 * Returns one of:
 *   { ok: true, conversationId }            — message persisted
 *   { ok: false, code: 'message_limit_reached' }
 *   { ok: false, code: 'forbidden' }        — row exists but belongs to another user
 *   { ok: false, code: 'unknown', message } — DB error
 */
export async function appendUserMessage(
  serviceClient: ReturnType<typeof createServiceClient>,
  params: {
    conversationId: string;
    userId: string;
    calendarId: string | null;
    tradeId?: string | null;
    userMessage: { id: string; role: 'user'; content: string; timestamp: string; status?: string };
    titleFallback: string;
    editingMessageId?: string;
  }
): Promise<AppendUserMessageResult> {
  const { conversationId, userId, calendarId, tradeId, userMessage, titleFallback, editingMessageId } = params;

  // Step A: upsert the row. ignoreDuplicates means we never overwrite an
  // existing row's title/messages — only insert when the id is new.
  const { error: upsertErr } = await serviceClient
    .from('ai_conversations')
    .upsert(
      {
        id: conversationId,
        user_id: userId,
        calendar_id: calendarId,
        trade_id: tradeId ?? null,
        title: titleFallback.slice(0, 100),
        messages: [],
        message_count: 0,
      },
      { onConflict: 'id', ignoreDuplicates: true }
    );
  if (upsertErr) {
    log('appendUserMessage upsert failed', 'error', { conversationId, error: upsertErr.message });
    return { ok: false, code: 'unknown', message: upsertErr.message };
  }

  // Step B: read the row to confirm ownership and get the current messages.
  const { data: convo, error: readErr } = await serviceClient
    .from('ai_conversations')
    .select('id, user_id, messages, message_count')
    .eq('id', conversationId)
    .single();
  if (readErr || !convo) {
    return { ok: false, code: 'unknown', message: readErr?.message ?? 'convo not found after upsert' };
  }
  if (convo.user_id !== userId) {
    log('appendUserMessage cross-tenant attempt blocked', 'warn', {
      conversationId,
      rowUserId: convo.user_id,
      callerUserId: userId,
    });
    return { ok: false, code: 'forbidden' };
  }

  // Step C: build the next messages array. On edit-resend, truncate at the
  // edited message's id so old turns are dropped server-side. Otherwise just
  // append. Atomic UPDATE guarded by `message_count < 50` so two-tab races
  // can't blow past the cap; if a parallel turn raced us to the cap this
  // UPDATE matches 0 rows and we return the cap error.
  const existingRaw = Array.isArray(convo.messages) ? convo.messages : [];
  const truncatedExisting = editingMessageId
    ? (() => {
        const idx = existingRaw.findIndex(
          // deno-lint-ignore no-explicit-any
          (m: any) => m && typeof m === 'object' && m.id === editingMessageId
        );
        return idx >= 0 ? existingRaw.slice(0, idx) : existingRaw;
      })()
    : existingRaw;
  const nextMessages = [...truncatedExisting, userMessage];

  const { data: updated, error: updateErr } = await serviceClient
    .from('ai_conversations')
    .update({
      messages: nextMessages,
      message_count: nextMessages.length,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)
    .eq('user_id', userId)
    .lt('message_count', 50)
    .select('id')
    .maybeSingle();
  if (updateErr) {
    return { ok: false, code: 'unknown', message: updateErr.message };
  }
  if (!updated) {
    return { ok: false, code: 'message_limit_reached' };
  }

  return { ok: true, conversationId };
}

/**
 * Persist the assistant's reply at turn end.
 *
 * Always UPDATE (never UPSERT) — if the user hit /clear mid-turn and deleted
 * the row, this becomes a no-op rather than resurrecting it. We don't enforce
 * the message_count cap here: the user-message append already gated entry to
 * the turn, so worst case we land at count = 51 (cap + assistant), which is
 * acceptable.
 */
export async function appendAssistantMessage(
  serviceClient: ReturnType<typeof createServiceClient>,
  params: {
    conversationId: string;
    userId: string;
    assistantMessage: Record<string, unknown>;
  }
): Promise<{ ok: boolean; deleted?: boolean; error?: string }> {
  const { conversationId, userId, assistantMessage } = params;

  const { data: convo, error: readErr } = await serviceClient
    .from('ai_conversations')
    .select('id, user_id, messages, message_count')
    .eq('id', conversationId)
    .maybeSingle();
  if (readErr) {
    log('appendAssistantMessage read failed', 'error', { conversationId, error: readErr.message });
    return { ok: false, error: readErr.message };
  }
  if (!convo) {
    // Row was deleted (likely /clear during turn). No-op is correct.
    return { ok: true, deleted: true };
  }
  if (convo.user_id !== userId) {
    log('appendAssistantMessage cross-tenant attempt blocked', 'warn', { conversationId });
    return { ok: false, error: 'forbidden' };
  }

  const existing = Array.isArray(convo.messages) ? convo.messages : [];
  const next = [...existing, assistantMessage];
  const currentCount = Number(convo.message_count ?? 0);

  const { error: updateErr } = await serviceClient
    .from('ai_conversations')
    .update({
      messages: next,
      message_count: currentCount + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)
    .eq('user_id', userId);
  if (updateErr) {
    log('appendAssistantMessage update failed', 'error', { conversationId, error: updateErr.message });
    return { ok: false, error: updateErr.message };
  }
  return { ok: true };
}
