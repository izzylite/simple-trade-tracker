-- Migration: Add storage policies for note-images folder
-- Created: 2025-11-27
-- Description: Extends storage policies to allow users to upload/access note images
--              in addition to trade images

-- =====================================================
-- UPDATE STORAGE POLICIES FOR NOTE IMAGES
-- =====================================================

-- Drop existing policies to recreate with updated paths
DROP POLICY IF EXISTS "Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can download their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

-- Policy: Allow authenticated users to upload files to their own folders
-- Supports both trade-images and note-images subfolders
CREATE POLICY "Users can upload to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'trade-images'
    AND (
        storage.objects.name LIKE 'users/' || auth.uid()::text || '/trade-images/%'
        OR storage.objects.name LIKE 'users/' || auth.uid()::text || '/note-images/%'
    )
);

-- Policy: Allow authenticated users to view/download only their own files
CREATE POLICY "Users can download their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'trade-images'
    AND (
        storage.objects.name LIKE 'users/' || auth.uid()::text || '/trade-images/%'
        OR storage.objects.name LIKE 'users/' || auth.uid()::text || '/note-images/%'
    )
);

-- Policy: Allow authenticated users to update only their own files
CREATE POLICY "Users can update their own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'trade-images'
    AND (
        storage.objects.name LIKE 'users/' || auth.uid()::text || '/trade-images/%'
        OR storage.objects.name LIKE 'users/' || auth.uid()::text || '/note-images/%'
    )
);

-- Policy: Allow authenticated users to delete only their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'trade-images'
    AND (
        storage.objects.name LIKE 'users/' || auth.uid()::text || '/trade-images/%'
        OR storage.objects.name LIKE 'users/' || auth.uid()::text || '/note-images/%'
    )
);

-- =====================================================
-- SERVICE ROLE POLICY FOR CLEANUP
-- =====================================================
-- Allow service role to delete any files (for cleanup function)

CREATE POLICY "Service role can delete any files"
ON storage.objects
FOR DELETE
TO service_role
USING (bucket_id = 'trade-images');

-- Note: Storage cleanup is handled by the existing cleanup-expired-calendars edge function
-- which already runs on a cron schedule (every 15 minutes). No additional cron job needed.
