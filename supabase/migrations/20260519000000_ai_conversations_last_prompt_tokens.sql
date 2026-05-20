-- Add server-side token-budget gate to replace the hardcoded message_count cap.
--
-- Frontend already runs a chars/4 + 258/image heuristic meter (commit 0a73bd5)
-- that locks the input at 80K user-content tokens. The backend was still
-- gating on `message_count < 100` in conversationStore.appendUserMessage and
-- `message_count >= 50` in the reminder fire path, so a long conversation
-- could be refused even when the client believed it was under budget.
--
-- This column stores Gemini's `usageMetadata.promptTokenCount` from the final
-- round of the most recent turn — the exact, server-measured size of the
-- accumulated context (system prompt + tool definitions + history + current
-- turn). It's written by the edge function after every successful turn and
-- read at turn-start to decide whether to accept a new message.
--
-- Default 0 means existing rows are treated as "fresh" and pass the gate until
-- their first post-migration turn writes a real value.

ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS last_prompt_tokens INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.ai_conversations.last_prompt_tokens IS
  'Gemini promptTokenCount from the final round of the most recent turn. Used as a server-side runaway guard — when this exceeds ORION_MAX_PROMPT_TOKENS (default 250000), new user messages and reminder fires are refused. Replaces the old message_count cap.';
