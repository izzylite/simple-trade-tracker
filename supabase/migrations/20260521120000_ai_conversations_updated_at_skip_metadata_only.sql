-- Fix: prevent internal-metadata writes from scrambling the
-- ai_conversations history-list sort order.
--
-- BUG: the BEFORE UPDATE trigger update_ai_conversations_updated_at
-- fires on EVERY update and unconditionally stamps NEW.updated_at = NOW().
-- Two paths abuse this:
--
--  1. match_conversations RPC (semantic recall) contains a bulk UPDATE
--     that bumps last_accessed_at on every match >= 0.5 similarity in ONE
--     statement. The BEFORE UPDATE FOR EACH ROW trigger stamps every
--     affected row's updated_at to the same NOW(), and since the history
--     list sorts by updated_at DESC, 6-9 unrelated old conversations
--     jump to the top of the sidebar after every recall_conversations
--     call.
--
--  2. touch_ai_conversation RPC bumps last_accessed_at for a single
--     opened conversation; the trigger then bumps updated_at, so simply
--     OPENING a conversation re-sorts it to the top — sidebar order
--     no longer reflects when content actually changed.
--
-- FIX: bump updated_at only when a user-visible column changes
-- (title/messages/message_count/pinned/last_message_preview/searchable/
-- calendar_id/trade_id). Pure-metadata writes (last_accessed_at,
-- last_prompt_tokens, embedding, embedded_at_message_count) and explicit
-- updated_at restores both preserve the value the caller passed.
--
-- This file is the final/simplified form. An earlier two-branch version
-- shipped first via MCP and was superseded — both end at the same
-- behavior; this is the canonical source-of-truth.

CREATE OR REPLACE FUNCTION public.update_ai_conversations_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  -- Bump only when something the user can see changed. Everything else
  -- (last_accessed_at, last_prompt_tokens, embedding,
  -- embedded_at_message_count, or an explicit updated_at restore)
  -- preserves whatever NEW.updated_at the caller passed.
  IF NEW.title                IS DISTINCT FROM OLD.title
     OR NEW.messages          IS DISTINCT FROM OLD.messages
     OR NEW.message_count     IS DISTINCT FROM OLD.message_count
     OR NEW.pinned            IS DISTINCT FROM OLD.pinned
     OR NEW.last_message_preview IS DISTINCT FROM OLD.last_message_preview
     OR NEW.searchable        IS DISTINCT FROM OLD.searchable
     OR NEW.calendar_id       IS DISTINCT FROM OLD.calendar_id
     OR NEW.trade_id          IS DISTINCT FROM OLD.trade_id
  THEN
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.update_ai_conversations_updated_at() IS
  'Bumps updated_at only when a user-visible column changes
   (title/messages/message_count/pinned/last_message_preview/searchable/
   calendar_id/trade_id). Pure-metadata writes (last_accessed_at from
   touch/match_conversations, last_prompt_tokens from gate,
   embedding/embedded_at_message_count from semantic recall) and explicit
   updated_at restores both preserve the value the caller passed.';
