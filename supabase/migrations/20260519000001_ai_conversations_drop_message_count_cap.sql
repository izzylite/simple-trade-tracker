-- Drop the legacy `message_count <= 100` CHECK constraint on ai_conversations.
--
-- The cap is now enforced as `last_prompt_tokens < ORION_MAX_PROMPT_TOKENS`
-- (see 20260519000000_ai_conversations_last_prompt_tokens.sql). Leaving the
-- CHECK in place blocks every subsequent UPDATE on conversations that
-- already hit 100 messages — including the very edit-resend / new-turn we
-- now want to allow now that gating moved to tokens.
--
-- The column itself stays (telemetry, sidebar list count). Only the upper-
-- bound CHECK is removed; `message_count >= 0` remains via a fresh CHECK.

-- The original CHECK was declared inline in the column definition, so its
-- auto-generated name is `ai_conversations_message_count_check`. Drop it if
-- present (IF EXISTS keeps the migration idempotent across environments
-- where it may have already been dropped or renamed).
ALTER TABLE public.ai_conversations
  DROP CONSTRAINT IF EXISTS ai_conversations_message_count_check;

-- Re-add the lower-bound half so a corrupted writer can't drive the counter
-- negative. No upper bound — that's what `last_prompt_tokens` is for.
ALTER TABLE public.ai_conversations
  ADD CONSTRAINT ai_conversations_message_count_nonneg
  CHECK (message_count >= 0);

COMMENT ON COLUMN public.ai_conversations.message_count IS
  'Total number of messages in the conversation. Used for telemetry and sidebar list counts only. The hard cap is now token-based — see last_prompt_tokens.';
