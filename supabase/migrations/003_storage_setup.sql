-- Simple Trade Tracker - Storage Setup
-- Create storage buckets and policies for trade images
-- Created: 2025-08-23

-- =====================================================
-- STORAGE BUCKET CREATION
-- =====================================================

-- Create a private bucket for trade images
-- Private buckets enforce RLS policies for all operations
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'trade-images',
    'trade-images', 
    false, -- Private bucket to enforce RLS
    52428800, -- 50MB file size limit
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
);

-- =====================================================
-- STORAGE RLS POLICIES
-- =====================================================

-- Enable RLS on storage.objects (should already be enabled by default)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to upload files only to their own folder
CREATE POLICY "Users can upload to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'trade-images'
    AND (storage.objects.name LIKE 'users/' || auth.uid()::text || '/trade-images/%')
);

-- Policy: Allow authenticated users to view/download only their own files
CREATE POLICY "Users can download their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'trade-images'
    AND (storage.objects.name LIKE 'users/' || auth.uid()::text || '/trade-images/%')
);

-- Policy: Allow authenticated users to update only their own files
CREATE POLICY "Users can update their own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'trade-images'
    AND (storage.objects.name LIKE 'users/' || auth.uid()::text || '/trade-images/%')
);

-- Policy: Allow authenticated users to delete only their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'trade-images'
    AND (storage.objects.name LIKE 'users/' || auth.uid()::text || '/trade-images/%')
);

-- =====================================================
-- HELPER FUNCTIONS FOR STORAGE OPERATIONS
-- =====================================================

-- Function to get the storage path for a user's trade image
CREATE OR REPLACE FUNCTION get_trade_image_path(user_id UUID, filename TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Ensure the user can only get paths for their own files
    IF auth.uid()::text != (SELECT firebase_uid FROM users WHERE id = user_id) THEN
        RAISE EXCEPTION 'Access denied: Cannot generate path for other users';
    END IF;
    
    RETURN 'users/' || auth.uid()::text || '/trade-images/' || filename;
END;
$$;

-- Function to validate if a storage path belongs to the current user
CREATE OR REPLACE FUNCTION validate_user_storage_path(storage_path TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN storage_path LIKE 'users/' || auth.uid()::text || '/trade-images/%';
END;
$$;

-- =====================================================
-- STORAGE BUCKET CONFIGURATION COMMENTS
-- =====================================================

-- Bucket Configuration Summary:
-- - Bucket Name: 'trade-images'
-- - Type: Private (RLS enforced)
-- - File Size Limit: 50MB per file
-- - Allowed MIME Types: JPEG, JPG, PNG, GIF, WebP
-- - Folder Structure: users/{userId}/trade-images/{filename}
-- 
-- Security Features:
-- - Users can only access files in their own folder
-- - All operations (upload, download, update, delete) are restricted by RLS
-- - Helper functions provide additional validation
-- 
-- Usage Example:
-- - Upload path: users/3d72a36e-ce9a-4531-a1ee-5eb4b815ada1/trade-images/screenshot.png
-- - The userId must match the authenticated user's auth.uid()
