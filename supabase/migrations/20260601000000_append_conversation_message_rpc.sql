-- Migration: append_conversation_message_rpc
-- Adds a SECURITY DEFINER RPC that atomically appends a single message object
-- to ai_conversations.messages (jsonb array) without a read-modify-write cycle.
--
-- This fixes the lost-update race where two concurrent writers both read the
-- current messages array, both append in application code, and the second
-- UPDATE silently overwrites the first writer's message.
--
-- The function takes an advisory row lock via the WHERE clause (the UPDATE
-- itself acquires a row-level lock on the matching row), so two concurrent
-- calls for the same conversation_id are serialised automatically by Postgres.
--
-- updated_at: NOT set explicitly here. The existing BEFORE UPDATE trigger
-- (update_ai_conversations_updated_at) includes 'messages', 'message_count',
-- and 'last_message_preview' in its bump-allowlist, so every successful call
-- to this function will advance updated_at automatically via the trigger.
-- This is the desired behaviour — the history-list sidebar sorts by updated_at.
--
-- Return value:
--   TRUE  — row was found and updated (message appended)
--   FALSE — no matching row: either (a) the row does not exist / belongs to a
--           different user_id, or (b) p_cap was not NULL and
--           last_prompt_tokens >= p_cap (token cap hit).
--   Callers that need to distinguish (a) from (b) should perform a prior read.

CREATE OR REPLACE FUNCTION public.append_conversation_message(
  p_id              uuid,
  p_user_id         uuid,
  p_message         jsonb,    -- a SINGLE message object; appended as one array element
  p_cap             integer,  -- token cap; NULL = skip the cap guard
  p_prompt_tokens   integer,  -- next-turn prompt estimate; NULL or <= 0 = leave last_prompt_tokens unchanged
  p_preview         text      -- last_message_preview (already truncated by caller); may be NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  UPDATE public.ai_conversations
  SET
    -- Append the single message object to the jsonb array.
    -- COALESCE guards against a NULL messages column (should never happen given
    -- the NOT NULL default of '[]', but defensive).
    messages             = COALESCE(messages, '[]'::jsonb) || p_message,

    message_count        = COALESCE(message_count, 0) + 1,

    last_message_preview = p_preview,

    -- Only advance last_prompt_tokens when a valid (> 0) estimate is supplied.
    -- Passing NULL or 0 preserves the current value (assistant appends do not
    -- know the next-turn token cost yet).
    last_prompt_tokens   = CASE
                             WHEN p_prompt_tokens IS NOT NULL AND p_prompt_tokens > 0
                             THEN p_prompt_tokens
                             ELSE last_prompt_tokens
                           END
  WHERE id        = p_id
    AND user_id   = p_user_id   -- tenancy guard: defence-in-depth against cross-user writes
    AND (
      p_cap IS NULL             -- cap guard omitted (e.g. assistant appends)
      OR last_prompt_tokens < p_cap
    );

  RETURN FOUND;
END;
$$;

-- Grant execute to authenticated users only (the function enforces user_id
-- tenancy itself; anon should not be able to write conversation messages).
REVOKE ALL ON FUNCTION public.append_conversation_message(uuid, uuid, jsonb, integer, integer, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.append_conversation_message(uuid, uuid, jsonb, integer, integer, text)
  TO authenticated;

COMMENT ON FUNCTION public.append_conversation_message(uuid, uuid, jsonb, integer, integer, text) IS
  'Atomically appends a single message object to ai_conversations.messages. '
  'Eliminates the lost-update race from concurrent read-append-write patterns. '
  'Returns TRUE when the row was updated, FALSE when the row was not found or '
  'the token cap (p_cap) was exceeded. updated_at is bumped by the existing '
  'BEFORE UPDATE trigger (messages column is in the trigger allowlist).';
