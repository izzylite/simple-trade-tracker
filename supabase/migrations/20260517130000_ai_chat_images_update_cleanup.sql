-- Migration: AFTER UPDATE cleanup for ai_conversations
-- Created: 2026-05-17
-- Description: Edit-resend truncates the messages JSONB array via
--              appendUserMessage. Messages dropped from the tail may
--              reference ai-chat-images storage objects that now have no
--              referrer. This trigger diffs OLD.messages vs NEW.messages on
--              every messages-changing UPDATE and queues the orphaned paths
--              for deletion by cleanup-scheduler.
--
--              Complements the BEFORE DELETE trigger from migration
--              20260517120000_ai_chat_images_bucket.sql which handles whole-
--              conversation deletes. Together they cover every path that
--              removes an image from the active message set.

CREATE OR REPLACE FUNCTION queue_ai_conversation_images_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    msg JSONB;
    p TEXT;
    old_paths TEXT[] := '{}';
    new_paths TEXT[] := '{}';
    removed_paths TEXT[];
BEGIN
    -- Collect ai-chat-images paths from OLD.messages
    IF OLD.messages IS NOT NULL AND jsonb_array_length(OLD.messages) > 0 THEN
        FOR msg IN SELECT * FROM jsonb_array_elements(OLD.messages)
        LOOP
            old_paths := old_paths || extract_ai_chat_image_paths(msg);
        END LOOP;
    END IF;

    -- Short-circuit: if OLD had no images, nothing to clean up.
    IF old_paths IS NULL OR array_length(old_paths, 1) IS NULL THEN
        RETURN NEW;
    END IF;

    -- Collect ai-chat-images paths from NEW.messages
    IF NEW.messages IS NOT NULL AND jsonb_array_length(NEW.messages) > 0 THEN
        FOR msg IN SELECT * FROM jsonb_array_elements(NEW.messages)
        LOOP
            new_paths := new_paths || extract_ai_chat_image_paths(msg);
        END LOOP;
    END IF;

    -- Set difference: paths present in OLD but not in NEW.
    -- Same path appearing in both (e.g. user re-uploaded identical content,
    -- producing the same content-hash filename) is correctly NOT queued.
    SELECT array(
        SELECT DISTINCT p_old
        FROM unnest(old_paths) AS p_old
        WHERE p_old <> ALL(new_paths)
    ) INTO removed_paths;

    IF removed_paths IS NULL OR array_length(removed_paths, 1) IS NULL THEN
        RETURN NEW;
    END IF;

    FOREACH p IN ARRAY removed_paths
    LOOP
        INSERT INTO storage_cleanup_queue
            (bucket_id, file_path, user_id, source_table, source_id, reason)
        VALUES
            ('ai-chat-images', p, NEW.user_id, 'ai_conversations', NEW.id, 'image_removed');
    END LOOP;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_conversations_cleanup_images_on_update ON public.ai_conversations;

-- Guard the trigger two ways:
--   1. AFTER UPDATE OF messages — Postgres skips the trigger entirely when
--      the UPDATE statement doesn't touch the messages column (e.g. pin
--      toggle, title rename, message_count bump alone).
--   2. WHEN (OLD.messages IS DISTINCT FROM NEW.messages) — extra belt-and-
--      braces for the rare case where messages is in the SET list but the
--      value didn't actually change (no-op write).
CREATE TRIGGER ai_conversations_cleanup_images_on_update
    AFTER UPDATE OF messages ON public.ai_conversations
    FOR EACH ROW
    WHEN (OLD.messages IS DISTINCT FROM NEW.messages)
    EXECUTE FUNCTION queue_ai_conversation_images_on_update();
