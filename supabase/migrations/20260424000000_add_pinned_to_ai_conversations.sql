-- Add pinned column to ai_conversations so users can pin important chats
-- Pinned conversations are ordered first in history views and filterable.

ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: defensively set pinned = false on every existing row so
-- filter-by-pinned queries return consistent results for old conversations
-- (covers the case where the column pre-existed nullable for any reason).
UPDATE public.ai_conversations
  SET pinned = FALSE
  WHERE pinned IS DISTINCT FROM FALSE AND pinned IS NOT TRUE;

-- Index supports "pinned first" ordering and filter-by-pinned queries.
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_pinned_updated
  ON public.ai_conversations(user_id, pinned DESC, updated_at DESC);

COMMENT ON COLUMN public.ai_conversations.pinned IS
  'When true, conversation is pinned by the user and surfaces first in history lists.';
