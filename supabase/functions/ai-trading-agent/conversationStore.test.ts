/**
 * Pure-logic tests for the priorHistory derivation inside appendUserMessage.
 *
 * We don't spin up a real Supabase client — we mock the minimum surface
 * (`from().upsert/select/update/eq/...`) so the function runs through its
 * branching paths against in-memory state. Each test asserts the
 * `priorHistory` slice matches what the agent loop should feed to Gemini.
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { appendUserMessage } from './conversationStore.ts';

type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: { triggered_by?: string };
};

function makeMockClient(initialMessages: Message[], userId: string) {
  const row = {
    id: 'conv-1',
    user_id: userId,
    messages: initialMessages,
    message_count: initialMessages.length,
    last_prompt_tokens: 0,
  };

  // Minimal builder that returns the same shape Supabase-js does. Every
  // method returns `this` so chains compose; terminal methods (`single`,
  // `maybeSingle`) resolve with `{ data, error }`.
  // deno-lint-ignore no-explicit-any
  const builder: any = {
    _table: '',
    _update: null as Record<string, unknown> | null,
    from(table: string) { this._table = table; return this; },
    // deno-lint-ignore no-explicit-any
    upsert(_payload: any, _opts: any) { return Promise.resolve({ error: null }); },
    select(_cols?: string) { return this; },
    // deno-lint-ignore no-explicit-any
    update(payload: any) { this._update = payload; return this; },
    // Atomic append RPC: the normal (non-truncate) path now appends via
    // append_conversation_message instead of a read-modify-write UPDATE. The
    // real RPC appends server-side and does NOT mutate the array the function
    // already read, so the mock must not either — it just reports success
    // (token gate passes). `priorHistory` is derived from the pre-append read.
    // deno-lint-ignore no-explicit-any
    rpc(_fn: string, _params: any) {
      return Promise.resolve({ data: true, error: null });
    },
    // Used by deleteAllChunks on the edit-resend truncate path. The chain is
    // awaited as `{ error } = await from().delete().eq()`; returning `this`
    // (no `error` prop) yields a clean result.
    delete() { return this; },
    // deno-lint-ignore no-explicit-any
    eq(_col: string, _val: any) { return this; },
    // deno-lint-ignore no-explicit-any
    lt(_col: string, _val: any) { return this; },
    // deno-lint-ignore no-explicit-any
    is(_col: string, _val: any) { return this; },
    maybeSingle() {
      if (this._update) {
        // Simulate the conditional UPDATE succeeding (token gate passes).
        Object.assign(row, this._update);
        this._update = null;
        return Promise.resolve({ data: { id: row.id }, error: null });
      }
      return Promise.resolve({ data: row, error: null });
    },
    single() {
      return Promise.resolve({ data: row, error: null });
    },
  };
  return { client: builder, row };
}

Deno.test('priorHistory is empty on first turn', async () => {
  const { client } = makeMockClient([], 'user-1');
  // deno-lint-ignore no-explicit-any
  const result = await appendUserMessage(client as any, {
    conversationId: 'conv-1',
    userId: 'user-1',
    calendarId: null,
    userMessage: { id: 'm1', role: 'user', content: 'hi', timestamp: 'now', status: 'sent' },
    titleFallback: 'hi',
  });
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result)}`);
  assertEquals(result.priorHistory, []);
});

Deno.test('priorHistory returns existing user+assistant pairs on normal send', async () => {
  const existing: Message[] = [
    { id: 'a', role: 'user', content: 'q1' },
    { id: 'b', role: 'assistant', content: 'r1' },
    { id: 'c', role: 'user', content: 'q2' },
    { id: 'd', role: 'assistant', content: 'r2' },
  ];
  const { client } = makeMockClient(existing, 'user-1');
  // deno-lint-ignore no-explicit-any
  const result = await appendUserMessage(client as any, {
    conversationId: 'conv-1',
    userId: 'user-1',
    calendarId: null,
    userMessage: { id: 'e', role: 'user', content: 'q3', timestamp: 'now', status: 'sent' },
    titleFallback: 'x',
  });
  if (!result.ok) throw new Error('expected ok');
  assertEquals(result.priorHistory, [
    { role: 'user', content: 'q1' },
    { role: 'assistant', content: 'r1' },
    { role: 'user', content: 'q2' },
    { role: 'assistant', content: 'r2' },
  ]);
});

Deno.test('priorHistory drops system messages and non-string content', async () => {
  const existing: Message[] = [
    { id: 'a', role: 'user', content: 'q1' },
    { id: 'sys', role: 'system', content: 'never to gemini' },
    { id: 'b', role: 'assistant', content: 'r1' },
    // non-string content (e.g. legacy structured message) — skipped
    { id: 'c', role: 'user', content: null as unknown as string },
  ];
  const { client } = makeMockClient(existing, 'user-1');
  // deno-lint-ignore no-explicit-any
  const result = await appendUserMessage(client as any, {
    conversationId: 'conv-1',
    userId: 'user-1',
    calendarId: null,
    userMessage: { id: 'e', role: 'user', content: 'q2', timestamp: 'now', status: 'sent' },
    titleFallback: 'x',
  });
  if (!result.ok) throw new Error('expected ok');
  assertEquals(result.priorHistory, [
    { role: 'user', content: 'q1' },
    { role: 'assistant', content: 'r1' },
  ]);
});

Deno.test('priorHistory truncates at editingMessageId on edit-resend', async () => {
  const existing: Message[] = [
    { id: 'a', role: 'user', content: 'q1' },
    { id: 'b', role: 'assistant', content: 'r1' },
    { id: 'c', role: 'user', content: 'q2-old' },   // edited
    { id: 'd', role: 'assistant', content: 'r2-old' }, // dropped
  ];
  const { client } = makeMockClient(existing, 'user-1');
  // deno-lint-ignore no-explicit-any
  const result = await appendUserMessage(client as any, {
    conversationId: 'conv-1',
    userId: 'user-1',
    calendarId: null,
    userMessage: { id: 'c', role: 'user', content: 'q2-new', timestamp: 'now', status: 'sent' },
    titleFallback: 'x',
    editingMessageId: 'c',
  });
  if (!result.ok) throw new Error('expected ok');
  assertEquals(result.priorHistory, [
    { role: 'user', content: 'q1' },
    { role: 'assistant', content: 'r1' },
  ]);
});

Deno.test('priorHistory excludes preserved reminder fires (they are UI-only on edit-resend)', async () => {
  const existing: Message[] = [
    { id: 'a', role: 'user', content: 'q1' },
    { id: 'b', role: 'assistant', content: 'r1' },
    { id: 'c', role: 'user', content: 'q2-old' }, // edited
    { id: 'd', role: 'assistant', content: 'r2-old' },
    { id: 'fire1', role: 'assistant', content: 'reminder text', metadata: { triggered_by: 'reminder:abc' } },
  ];
  const { client } = makeMockClient(existing, 'user-1');
  // deno-lint-ignore no-explicit-any
  const result = await appendUserMessage(client as any, {
    conversationId: 'conv-1',
    userId: 'user-1',
    calendarId: null,
    userMessage: { id: 'c', role: 'user', content: 'q2-new', timestamp: 'now', status: 'sent' },
    titleFallback: 'x',
    editingMessageId: 'c',
  });
  if (!result.ok) throw new Error('expected ok');
  // The reminder fire was preserved into the persisted messages array
  // (UI continuity) but it MUST NOT enter Gemini's history — it's not
  // part of the chronological turn tree being replayed from the edit point.
  assertEquals(result.priorHistory, [
    { role: 'user', content: 'q1' },
    { role: 'assistant', content: 'r1' },
  ]);
});
