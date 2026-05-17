-- Migration: ai-chat-images bucket + conversation-delete cleanup trigger
-- Created: 2026-05-17
-- Description: Storage bucket for AI-generated chart images (rehosted from
--              QuickChart so they outlive the source's short-URL TTL). Tied to
--              ai_conversations lifecycle via a BEFORE DELETE trigger that
--              enumerates ai-chat-images paths from messages JSONB and feeds
--              them into the existing storage_cleanup_queue.

-- =====================================================
-- BUCKET
-- =====================================================
-- Public so persisted message HTML can embed durable URLs without signed-URL
-- expiry. Writes are service-role only (the edge function uses the service
-- key; users never upload here directly).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'ai-chat-images',
    'ai-chat-images',
    true,
    5242880, -- 5 MB
    ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "ai-chat-images service write" ON storage.objects;
DROP POLICY IF EXISTS "ai-chat-images service update" ON storage.objects;
DROP POLICY IF EXISTS "ai-chat-images service delete" ON storage.objects;
DROP POLICY IF EXISTS "ai-chat-images public read" ON storage.objects;

-- Public read (bucket is public, but this makes intent explicit)
CREATE POLICY "ai-chat-images public read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'ai-chat-images');

-- Service role writes only (edge function ingests via service key)
CREATE POLICY "ai-chat-images service write"
    ON storage.objects FOR INSERT
    TO service_role
    WITH CHECK (bucket_id = 'ai-chat-images');

CREATE POLICY "ai-chat-images service update"
    ON storage.objects FOR UPDATE
    TO service_role
    USING (bucket_id = 'ai-chat-images')
    WITH CHECK (bucket_id = 'ai-chat-images');

CREATE POLICY "ai-chat-images service delete"
    ON storage.objects FOR DELETE
    TO service_role
    USING (bucket_id = 'ai-chat-images');

-- =====================================================
-- HELPER: Extract ai-chat-images paths from a single message
-- =====================================================
-- Scans messageHtml and content for ai-chat-images storage URLs and returns
-- the path portion (everything after the bucket name).

CREATE OR REPLACE FUNCTION extract_ai_chat_image_paths(msg JSONB)
RETURNS TEXT[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    haystack TEXT;
    paths TEXT[] := '{}';
    m TEXT[];
BEGIN
    haystack := coalesce(msg ->> 'messageHtml', '') || ' ' || coalesce(msg ->> 'content', '');
    IF haystack = ' ' THEN
        RETURN paths;
    END IF;

    FOR m IN
        SELECT regexp_matches(
            haystack,
            '/storage/v1/object/public/ai-chat-images/([^"\s)]+)',
            'g'
        )
    LOOP
        paths := array_append(paths, m[1]);
    END LOOP;

    RETURN paths;
END;
$$;

-- =====================================================
-- TRIGGER: Queue conversation images on delete
-- =====================================================
-- BEFORE DELETE so we still have OLD.messages to scan. Cascade from
-- users.id ON DELETE CASCADE means this also fires when a user is deleted.

CREATE OR REPLACE FUNCTION queue_ai_conversation_images_for_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    msg JSONB;
    p TEXT;
BEGIN
    IF OLD.messages IS NULL OR jsonb_array_length(OLD.messages) = 0 THEN
        RETURN OLD;
    END IF;

    FOR msg IN SELECT * FROM jsonb_array_elements(OLD.messages)
    LOOP
        FOREACH p IN ARRAY extract_ai_chat_image_paths(msg)
        LOOP
            INSERT INTO storage_cleanup_queue
                (bucket_id, file_path, user_id, source_table, source_id, reason)
            VALUES
                ('ai-chat-images', p, OLD.user_id, 'ai_conversations', OLD.id, 'record_deleted');
        END LOOP;
    END LOOP;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS ai_conversations_cleanup_images ON public.ai_conversations;
CREATE TRIGGER ai_conversations_cleanup_images
    BEFORE DELETE ON public.ai_conversations
    FOR EACH ROW
    EXECUTE FUNCTION queue_ai_conversation_images_for_deletion();

-- =====================================================
-- NOTES
-- =====================================================
-- Edit-resend (which truncates the messages array via appendUserMessage) is
-- NOT covered here — orphaned images age out only when the whole conversation
-- is deleted. Acceptable for v1. If eager cleanup is needed, add an
-- AFTER UPDATE trigger that diffs OLD.messages vs NEW.messages and queues
-- the removed paths.
--
-- The existing cleanup-scheduler edge function already reads bucket_id
-- per-row from storage_cleanup_queue (see line 85 of cleanup-scheduler/
-- index.ts), so it picks up ai-chat-images entries without modification.
