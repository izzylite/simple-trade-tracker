-- Raise ai_conversations.message_count cap from 50 to 100.
--
-- Frontend defaults (`useAIChat`, `AIChatInterface`, etc.) and the backend
-- atomic guard in `conversationStore.appendUserMessage` are bumped to 100 in
-- the same change. CHECK constraint must move with them or new turns fail.

ALTER TABLE public.ai_conversations
  DROP CONSTRAINT IF EXISTS ai_conversations_message_count_check;

ALTER TABLE public.ai_conversations
  ADD CONSTRAINT ai_conversations_message_count_check
  CHECK (message_count >= 0 AND message_count <= 100);

COMMENT ON COLUMN public.ai_conversations.message_count IS
  'Total number of messages in the conversation (max 100)';
