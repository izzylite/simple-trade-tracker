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
import { deleteAllChunks } from './tools/recall-chunks.ts';

// NOTE: `maybeUpdateEmbedding` (the turn-end re-embed gate) used to live
// here but was moved to `tools/recall-conversations.ts` — it's part of the
// recall feature, not core message persistence. This file now only handles
// conversation row append/truncate logic.

/**
 * Server-side context-budget cap. Gated on Gemini's `promptTokenCount` from
 * the final round of the previous turn — exact, includes system prompt +
 * tool defs + history.
 *
 * Default 250K is ~2-3× the client meter's 80K user-content threshold (the
 * client doesn't count system+tools, which are large for Orion). The client
 * lock kicks in first for normal use; this server cap is a runaway guard
 * against a buggy client or pathological input. Override via env.
 */
export const MAX_PROMPT_TOKENS: number = (() => {
  const v = Number(Deno.env.get('ORION_MAX_PROMPT_TOKENS'));
  return Number.isFinite(v) && v > 0 ? v : 250_000;
})();

/**
 * UX-level "you're getting close" threshold. Below this the meter is green,
 * past it the input locks client-side. Distinct from `MAX_PROMPT_TOKENS`
 * which is the runaway-guard hard cap enforced by the DB UPDATE in
 * `appendUserMessage`. Override via env.
 *
 * Default 80K matches the previous client-side `estimateConversationTokens`
 * budget — chosen because Gemini attention measurably degrades well before
 * the 1M context limit and 80K is generous enough that most chats never
 * hit it.
 */
export const SOFT_PROMPT_TOKENS: number = (() => {
  const v = Number(Deno.env.get('ORION_SOFT_PROMPT_TOKENS'));
  return Number.isFinite(v) && v > 0 ? v : 80_000;
})();

/**
 * Gate progress published to the client. `used` is the SERVER-MEASURED
 * `last_prompt_tokens` value (Gemini's promptTokenCount from the final
 * round of the last turn — exact, includes system + tools + history).
 * `softLimit` is what the UI locks against; `hardLimit` is what the DB
 * UPDATE gates against. `pct` is `used/softLimit * 100` clamped to 0-100
 * so the meter never overruns the bar visually.
 */
export interface ConversationGate {
  used: number;
  softLimit: number;
  hardLimit: number;
  pct: number;
}

export function buildGate(used: number): ConversationGate {
  const safeUsed = Math.max(0, Math.floor(used));
  const pct = Math.min(100, Math.round((safeUsed / SOFT_PROMPT_TOKENS) * 100));
  return {
    used: safeUsed,
    softLimit: SOFT_PROMPT_TOKENS,
    hardLimit: MAX_PROMPT_TOKENS,
    pct,
  };
}

export type AppendUserMessageResult =
  | {
      ok: true;
      conversationId: string;
      /**
       * Prior history slice the agent loop must feed to Gemini as
       * `conversationHistory`. Mirrors what the DB row contained BEFORE
       * the new user message was appended (and, on edit-resend, AFTER
       * truncation at `editingMessageId`). Filtered to `{role, content}`
       * pairs Gemini's contents-builder accepts.
       *
       * Always returned even on first-turn (empty array) so callers don't
       * branch on presence.
       */
      priorHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
    }
  | { ok: false; code: 'token_budget_exceeded' | 'forbidden' | 'unknown'; message?: string };

/**
 * Persist the user's message at turn start.
 *
 * On first turn of a new conversation the row may not exist yet — UPSERT it
 * with `ignoreDuplicates: true` so subsequent turns are a no-op. Then append
 * the message via an atomic `last_prompt_tokens < MAX_PROMPT_TOKENS` guard so
 * two-tab races can't blow past the cap.
 *
 * On edit-resend, the existing messages array is truncated at `editingMessageId`
 * (inclusive) before append. Mirrors the frontend's `messages.slice(0, idx)`
 * behavior — without it the DB accumulates orphan turns and they reappear on
 * next reload.
 *
 * Returns one of:
 *   { ok: true, conversationId }            — message persisted
 *   { ok: false, code: 'token_budget_exceeded' }
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
    .select('id, user_id, messages, message_count, last_prompt_tokens')
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
  // append. Atomic UPDATE guarded by `last_prompt_tokens < MAX_PROMPT_TOKENS`
  // so two-tab races can't blow past the cap; if a parallel turn raced us to
  // the cap this UPDATE matches 0 rows and we return the cap error.
  //
  // Reminder-fired messages (metadata.triggered_by starts with "reminder:")
  // are INDEPENDENT events, not turn-tree replies. They MUST survive an
  // edit-resend — losing them silently destroys the user's history of
  // every reminder fire after the edited message. We preserve any such
  // messages from the post-truncation tail and re-attach them after the
  // new user message.
  const existingRaw = Array.isArray(convo.messages) ? convo.messages : [];
  // deno-lint-ignore no-explicit-any
  const isReminderFire = (m: any): boolean =>
    !!m && typeof m === 'object' &&
    typeof m.metadata?.triggered_by === 'string' &&
    m.metadata.triggered_by.startsWith('reminder:');
  let truncatedExisting: unknown[] = existingRaw;
  let preservedFires: unknown[] = [];
  let truncated = false;
  if (editingMessageId) {
    const idx = existingRaw.findIndex(
      // deno-lint-ignore no-explicit-any
      (m: any) => m && typeof m === 'object' && m.id === editingMessageId
    );
    if (idx >= 0) {
      truncatedExisting = existingRaw.slice(0, idx);
      // Reminder fires from the discarded tail survive verbatim.
      preservedFires = existingRaw.slice(idx).filter(isReminderFire);
      truncated = true;
    }
  }
  const nextMessages = [...truncatedExisting, userMessage, ...preservedFires];

  // On edit-resend (truncation), the existing embedding represents content
  // that no longer exists in the conversation. If we leave
  // `embedded_at_message_count` pointing at the pre-truncate count, the
  // delta gate (messages.length - embedded_at_message_count >= N) goes
  // NEGATIVE and the embedding never refreshes — stale forever. Reset to
  // 0 so the next assistant-message persist triggers a fresh embed once
  // messages.length crosses the threshold. Also NULL the embedding itself
  // so search doesn't surface stale results in the interim.
  // `last_message_preview` is a denormalized snapshot of the last message's
  // content (≤200 chars) so the history list query can drop the full
  // `messages` JSONB blob. Source it from the actual last entry in
  // nextMessages — for normal sends that's the user message, but on
  // edit-resend with preserved reminder fires the last entry is the
  // most recent reminder fire instead.
  const lastMsg = nextMessages[nextMessages.length - 1] as { content?: unknown } | undefined;
  const lastContent = typeof lastMsg?.content === 'string' ? lastMsg.content : '';
  const updatePayload: Record<string, unknown> = {
    messages: nextMessages,
    message_count: nextMessages.length,
    last_message_preview: lastContent ? lastContent.slice(0, 200) : null,
    updated_at: new Date().toISOString(),
  };
  if (truncated) {
    updatePayload.embedding = null;
    updatePayload.embedded_at_message_count = 0;
  }

  const { data: updated, error: updateErr } = await serviceClient
    .from('ai_conversations')
    .update(updatePayload)
    .eq('id', conversationId)
    .eq('user_id', userId)
    .lt('last_prompt_tokens', MAX_PROMPT_TOKENS)
    .select('id')
    .maybeSingle();
  if (updateErr) {
    return { ok: false, code: 'unknown', message: updateErr.message };
  }
  if (!updated) {
    return { ok: false, code: 'token_budget_exceeded' };
  }

  // On edit-resend, drop the window-level chunks too. We've already NULLed
  // the conv-level embedding and reset embedded_at_message_count above —
  // those alone are enough to make the conversation invisible to semantic
  // recall until the next gate fires. But window chunks live in a sibling
  // table and aren't touched by the UPDATE; without this explicit DELETE
  // they would survive and `match_conversations` could still return chunk
  // hints pointing at messages that no longer exist (the LATERAL chunk
  // join runs even when the parent's embedding is NULL? No — the parent's
  // `embedding IS NOT NULL` filter scopes it out. But a brief window
  // between this UPDATE and the next gate fire could still surface stale
  // chunks for other RPCs we add later. Best to keep the invariant simple:
  // truncation = no chunks until regenerated). Fire-and-forget — if it
  // fails, the next gate's `planChunkRegen` with lastEmbedCount=0 will
  // overwrite from chunk_idx=0 anyway.
  if (truncated) {
    await deleteAllChunks(serviceClient, conversationId);
  }

  // Build the priorHistory slice for the caller. `truncatedExisting` is
  // the pre-existing messages array AFTER edit-truncation but BEFORE we
  // appended this turn's user message + preserved fires — i.e. the exact
  // history Gemini should see. Filter to user/assistant text messages
  // only; system frames and non-string content don't belong in the
  // contents-builder input.
  const priorHistory = truncatedExisting
    .filter(
      // deno-lint-ignore no-explicit-any
      (m: any) =>
        m && typeof m === 'object' &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string',
    )
    // deno-lint-ignore no-explicit-any
    .map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content as string,
    }));

  return { ok: true, conversationId, priorHistory };
}

/**
 * Persist the assistant's reply at turn end.
 *
 * Always UPDATE (never UPSERT) — if the user hit /clear mid-turn and deleted
 * the row, this becomes a no-op rather than resurrecting it. We don't enforce
 * the cap here: the user-message append already gated entry to the turn, so
 * worst case we land slightly past the cap (cap + assistant), which is
 * acceptable.
 *
 * When `promptTokenCount` is provided, persist it as `last_prompt_tokens` in
 * the same UPDATE — this is the next turn's gate input. Pass the
 * `promptTokenCount` from the FINAL Gemini round (not the cumulative sum
 * across rounds); each round's value already includes the full accumulated
 * context Gemini just processed.
 */
export async function appendAssistantMessage(
  serviceClient: ReturnType<typeof createServiceClient>,
  params: {
    conversationId: string;
    userId: string;
    assistantMessage: Record<string, unknown>;
    promptTokenCount?: number;
  }
): Promise<{ ok: boolean; deleted?: boolean; error?: string }> {
  const { conversationId, userId, assistantMessage, promptTokenCount } = params;

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

  const assistantContent = typeof assistantMessage.content === 'string'
    ? assistantMessage.content
    : '';
  const updatePayload: Record<string, unknown> = {
    messages: next,
    message_count: currentCount + 1,
    last_message_preview: assistantContent ? assistantContent.slice(0, 200) : null,
    updated_at: new Date().toISOString(),
  };
  if (typeof promptTokenCount === 'number' && promptTokenCount > 0) {
    updatePayload.last_prompt_tokens = promptTokenCount;
  }

  const { error: updateErr } = await serviceClient
    .from('ai_conversations')
    .update(updatePayload)
    .eq('id', conversationId)
    .eq('user_id', userId);
  if (updateErr) {
    log('appendAssistantMessage update failed', 'error', { conversationId, error: updateErr.message });
    return { ok: false, error: updateErr.message };
  }
  return { ok: true };
}

// maybeUpdateEmbedding moved to tools/recall-conversations.ts (write side of
// the recall feature). Keep it imported from there by the persist sites in
// index.ts — this file no longer owns embedding logic.
