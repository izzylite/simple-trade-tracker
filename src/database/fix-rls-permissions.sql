-- Fix RLS and Permissions for Trade Embeddings
-- Run this script if you're having permission issues with vector operations

-- Disable RLS (since we're using Firebase auth, not Supabase auth)
ALTER TABLE trade_embeddings DISABLE ROW LEVEL SECURITY;
ALTER TABLE embedding_metadata DISABLE ROW LEVEL SECURITY;

-- Drop existing RLS policies if they exist
DROP POLICY IF EXISTS "Users can view their own trade embeddings" ON trade_embeddings;
DROP POLICY IF EXISTS "Users can insert their own trade embeddings" ON trade_embeddings;
DROP POLICY IF EXISTS "Users can update their own trade embeddings" ON trade_embeddings;
DROP POLICY IF EXISTS "Users can delete their own trade embeddings" ON trade_embeddings;
DROP POLICY IF EXISTS "Users can view their own embedding metadata" ON embedding_metadata;
DROP POLICY IF EXISTS "Users can insert their own embedding metadata" ON embedding_metadata;
DROP POLICY IF EXISTS "Users can update their own embedding metadata" ON embedding_metadata;

-- Grant necessary permissions for authenticated users
GRANT ALL ON trade_embeddings TO authenticated;
GRANT ALL ON embedding_metadata TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant permissions for anon role (used by our Supabase client)
GRANT ALL ON trade_embeddings TO anon;
GRANT ALL ON embedding_metadata TO anon;

-- Verify table ownership
SELECT
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE tablename IN ('trade_embeddings', 'embedding_metadata');

-- Check if RLS is disabled
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('trade_embeddings', 'embedding_metadata');

-- Check permissions for authenticated and anon roles
SELECT
  grantee,
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE table_name IN ('trade_embeddings', 'embedding_metadata')
  AND grantee IN ('authenticated', 'anon')
ORDER BY table_name, grantee, privilege_type;

-- Success message
SELECT 'RLS permissions fixed successfully!' as status;
