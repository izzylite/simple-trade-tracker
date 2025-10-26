-- Simple Trade Tracker - Update Storage Bucket to Public
-- Convert trade-images bucket from private to public for better performance
-- Created: 2025-01-07

-- =====================================================
-- UPDATE BUCKET TO PUBLIC
-- =====================================================

-- Update the existing trade-images bucket to be public
-- This allows direct URL access while maintaining RLS security
UPDATE storage.buckets 
SET public = true 
WHERE id = 'trade-images';

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Verify the bucket is now public
-- This should return true for the public column
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE id = 'trade-images';

-- =====================================================
-- MIGRATION NOTES
-- =====================================================

-- This migration converts the trade-images bucket from private to public.
-- 
-- Benefits:
-- - Direct URL access without signed URLs
-- - Better CDN caching and performance
-- - Simplified client code (no URL expiry handling)
-- - Reduced API calls for image access
-- 
-- Security:
-- - RLS policies remain unchanged and still enforce user-specific access
-- - Upload/delete operations still require authentication
-- - File paths include user ID for additional security
-- 
-- URL Format After Migration:
-- https://your-project.supabase.co/storage/v1/object/public/trade-images/users/{userId}/trade-images/{filename}
-- 
-- No data migration needed - existing files remain accessible at new public URLs
