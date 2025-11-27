-- Migration: Storage Cleanup Triggers for Notes
-- Created: 2025-11-27
-- Description: Creates triggers to automatically cleanup orphaned images from
--              Supabase Storage when notes are deleted or images are removed from content

-- =====================================================
-- STORAGE CLEANUP QUEUE TABLE
-- =====================================================
-- Queue table to store files that need to be deleted from storage
-- An edge function will process this queue periodically

CREATE TABLE IF NOT EXISTS storage_cleanup_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bucket_id TEXT NOT NULL DEFAULT 'trade-images',
    file_path TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_table TEXT NOT NULL, -- 'notes', 'trades', etc.
    source_id UUID, -- ID of the deleted/updated record
    reason TEXT NOT NULL, -- 'record_deleted', 'image_removed'
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    retry_count INTEGER DEFAULT 0
);

-- Index for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_storage_cleanup_queue_status
    ON storage_cleanup_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_storage_cleanup_queue_user_id
    ON storage_cleanup_queue(user_id);

-- =====================================================
-- HELPER FUNCTION: Extract image URLs from Draft.js content
-- =====================================================
-- Parses Draft.js JSON content and extracts all image URLs
-- from IMAGE entities in the entityMap

CREATE OR REPLACE FUNCTION extract_image_urls_from_draftjs(content TEXT)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    content_json JSONB;
    entity_map JSONB;
    entity_key TEXT;
    entity_data JSONB;
    image_urls TEXT[] := '{}';
    image_src TEXT;
BEGIN
    -- Return empty array if content is null or empty
    IF content IS NULL OR content = '' THEN
        RETURN image_urls;
    END IF;

    -- Try to parse as JSON
    BEGIN
        content_json := content::JSONB;
    EXCEPTION WHEN OTHERS THEN
        -- Not valid JSON, return empty array
        RETURN image_urls;
    END;

    -- Get the entityMap from Draft.js content
    entity_map := content_json -> 'entityMap';

    IF entity_map IS NULL THEN
        RETURN image_urls;
    END IF;

    -- Iterate through all entities in the entityMap
    FOR entity_key IN SELECT jsonb_object_keys(entity_map)
    LOOP
        entity_data := entity_map -> entity_key;

        -- Check if this is an IMAGE entity
        IF entity_data ->> 'type' = 'IMAGE' THEN
            image_src := entity_data -> 'data' ->> 'src';

            -- Only include URLs from our storage bucket
            IF image_src IS NOT NULL AND image_src LIKE '%/storage/v1/object/public/trade-images/%' THEN
                image_urls := array_append(image_urls, image_src);
            END IF;
        END IF;
    END LOOP;

    RETURN image_urls;
END;
$$;

-- =====================================================
-- HELPER FUNCTION: Extract file path from storage URL
-- =====================================================
-- Converts a public storage URL to the file path used by Storage API

CREATE OR REPLACE FUNCTION extract_storage_path_from_url(url TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    path_start INTEGER;
    file_path TEXT;
BEGIN
    IF url IS NULL THEN
        RETURN NULL;
    END IF;

    -- Find the path after 'trade-images/'
    path_start := position('/storage/v1/object/public/trade-images/' IN url);

    IF path_start = 0 THEN
        RETURN NULL;
    END IF;

    -- Extract the file path (everything after 'trade-images/')
    file_path := substring(url FROM path_start + length('/storage/v1/object/public/trade-images/'));

    RETURN file_path;
END;
$$;

-- =====================================================
-- FUNCTION: Queue images for deletion
-- =====================================================
-- Adds image paths to the cleanup queue

CREATE OR REPLACE FUNCTION queue_images_for_deletion(
    p_image_urls TEXT[],
    p_user_id UUID,
    p_source_table TEXT,
    p_source_id UUID,
    p_reason TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    url TEXT;
    file_path TEXT;
    queued_count INTEGER := 0;
BEGIN
    IF p_image_urls IS NULL OR array_length(p_image_urls, 1) IS NULL THEN
        RETURN 0;
    END IF;

    FOREACH url IN ARRAY p_image_urls
    LOOP
        file_path := extract_storage_path_from_url(url);

        IF file_path IS NOT NULL THEN
            -- Insert into queue, ignore duplicates
            INSERT INTO storage_cleanup_queue (
                bucket_id,
                file_path,
                user_id,
                source_table,
                source_id,
                reason
            )
            VALUES (
                'trade-images',
                file_path,
                p_user_id,
                p_source_table,
                p_source_id,
                p_reason
            )
            ON CONFLICT DO NOTHING;

            queued_count := queued_count + 1;
        END IF;
    END LOOP;

    RETURN queued_count;
END;
$$;

-- =====================================================
-- TRIGGER FUNCTION: Handle note deletion
-- =====================================================
-- When a note is deleted, queue all its images for cleanup

CREATE OR REPLACE FUNCTION handle_note_delete_storage_cleanup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    image_urls TEXT[];
    cover_image_url TEXT;
BEGIN
    -- Extract image URLs from the deleted note's content
    image_urls := extract_image_urls_from_draftjs(OLD.content);

    -- Also check for cover_image
    cover_image_url := OLD.cover_image;
    IF cover_image_url IS NOT NULL AND cover_image_url LIKE '%/storage/v1/object/public/trade-images/%' THEN
        image_urls := array_append(image_urls, cover_image_url);
    END IF;

    -- Queue images for deletion
    IF array_length(image_urls, 1) > 0 THEN
        PERFORM queue_images_for_deletion(
            image_urls,
            OLD.user_id,
            'notes',
            OLD.id,
            'record_deleted'
        );
    END IF;

    RETURN OLD;
END;
$$;

-- =====================================================
-- TRIGGER FUNCTION: Handle note update (image removal)
-- =====================================================
-- When a note is updated, detect removed images and queue them for cleanup

CREATE OR REPLACE FUNCTION handle_note_update_storage_cleanup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    old_image_urls TEXT[];
    new_image_urls TEXT[];
    removed_urls TEXT[];
    url TEXT;
BEGIN
    -- Extract image URLs from old and new content
    old_image_urls := extract_image_urls_from_draftjs(OLD.content);
    new_image_urls := extract_image_urls_from_draftjs(NEW.content);

    -- Check for cover_image changes
    IF OLD.cover_image IS NOT NULL
       AND OLD.cover_image LIKE '%/storage/v1/object/public/trade-images/%'
       AND (NEW.cover_image IS NULL OR NEW.cover_image != OLD.cover_image) THEN
        old_image_urls := array_append(old_image_urls, OLD.cover_image);
    END IF;

    -- Find images that were in old content but not in new content
    removed_urls := '{}';
    IF old_image_urls IS NOT NULL THEN
        FOREACH url IN ARRAY old_image_urls
        LOOP
            IF NOT (url = ANY(COALESCE(new_image_urls, '{}'))) THEN
                removed_urls := array_append(removed_urls, url);
            END IF;
        END LOOP;
    END IF;

    -- Queue removed images for deletion
    IF array_length(removed_urls, 1) > 0 THEN
        PERFORM queue_images_for_deletion(
            removed_urls,
            NEW.user_id,
            'notes',
            NEW.id,
            'image_removed'
        );
    END IF;

    RETURN NEW;
END;
$$;

-- =====================================================
-- CREATE TRIGGERS
-- =====================================================

-- Trigger for note deletion
DROP TRIGGER IF EXISTS trigger_note_delete_storage_cleanup ON notes;
CREATE TRIGGER trigger_note_delete_storage_cleanup
    BEFORE DELETE ON notes
    FOR EACH ROW
    EXECUTE FUNCTION handle_note_delete_storage_cleanup();

-- Trigger for note update
DROP TRIGGER IF EXISTS trigger_note_update_storage_cleanup ON notes;
CREATE TRIGGER trigger_note_update_storage_cleanup
    BEFORE UPDATE OF content, cover_image ON notes
    FOR EACH ROW
    WHEN (OLD.content IS DISTINCT FROM NEW.content OR OLD.cover_image IS DISTINCT FROM NEW.cover_image)
    EXECUTE FUNCTION handle_note_update_storage_cleanup();

-- =====================================================
-- RLS POLICIES FOR CLEANUP QUEUE
-- =====================================================

ALTER TABLE storage_cleanup_queue ENABLE ROW LEVEL SECURITY;

-- Users can view their own queue entries (for debugging/transparency)
CREATE POLICY "Users can view their own cleanup queue entries"
    ON storage_cleanup_queue
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Only service role can insert/update/delete (via edge functions)
CREATE POLICY "Service role can manage cleanup queue"
    ON storage_cleanup_queue
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE storage_cleanup_queue IS 'Queue for files that need to be deleted from Supabase Storage';
COMMENT ON FUNCTION extract_image_urls_from_draftjs IS 'Extracts image URLs from Draft.js JSON content';
COMMENT ON FUNCTION extract_storage_path_from_url IS 'Converts storage public URL to file path';
COMMENT ON FUNCTION queue_images_for_deletion IS 'Adds file paths to the storage cleanup queue';
COMMENT ON FUNCTION handle_note_delete_storage_cleanup IS 'Trigger function to cleanup images when note is deleted';
COMMENT ON FUNCTION handle_note_update_storage_cleanup IS 'Trigger function to cleanup images when removed from note content';
