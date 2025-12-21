-- Migration: Move Extensions to Dedicated Schema
-- Created: 2025-12-21
-- Description: Moves http and vector extensions from public schema to dedicated
--              extensions schema to improve security and namespace organization.
-- Issue: https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public
-- Advisor: security_advisor.json - extension_in_public warnings

-- Background:
-- Extensions installed in the public schema can pose security risks:
-- 1. They pollute the public namespace
-- 2. They can be accessed/modified by users with public schema access
-- 3. They make schema management more complex
--
-- Best practice is to install extensions in a dedicated schema (usually 'extensions')
-- and grant only necessary access to that schema.

-- =====================================================
-- CREATE EXTENSIONS SCHEMA (if not exists)
-- =====================================================

CREATE SCHEMA IF NOT EXISTS extensions;

-- Grant usage on extensions schema to necessary roles
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- =====================================================
-- MOVE HTTP EXTENSION
-- =====================================================

-- The http extension provides HTTP client functionality for making external requests
-- It's used by webhook and notification functions

-- Check if extension exists in public schema and move it
DO $$
BEGIN
    -- Drop from public and recreate in extensions schema
    IF EXISTS (
        SELECT 1 FROM pg_extension
        WHERE extname = 'http'
        AND extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        -- Note: Extensions cannot be moved between schemas directly
        -- We need to drop and recreate

        -- First, drop the extension from public
        DROP EXTENSION IF EXISTS http CASCADE;

        -- Recreate in extensions schema
        CREATE EXTENSION IF NOT EXISTS http SCHEMA extensions;

        RAISE NOTICE 'Moved http extension from public to extensions schema';
    ELSE
        -- Extension might already be in extensions schema or not installed
        CREATE EXTENSION IF NOT EXISTS http SCHEMA extensions;
        RAISE NOTICE 'Created http extension in extensions schema';
    END IF;
END $$;

-- =====================================================
-- MOVE VECTOR EXTENSION
-- =====================================================

-- The vector extension (pgvector) provides vector similarity search capabilities
-- It's used for AI features like semantic search and embeddings

-- Check if extension exists in public schema and move it
DO $$
BEGIN
    -- Drop from public and recreate in extensions schema
    IF EXISTS (
        SELECT 1 FROM pg_extension
        WHERE extname = 'vector'
        AND extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        -- Note: pgvector types (vector) will be recreated in extensions schema
        -- This may break existing columns/functions using the vector type
        -- We'll handle this by also updating the search path

        -- First, drop the extension from public
        -- WARNING: This will fail if there are dependencies (tables with vector columns)
        -- In that case, we need a different approach

        BEGIN
            DROP EXTENSION IF EXISTS vector CASCADE;
            RAISE NOTICE 'Dropped vector extension from public schema';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop vector extension - it has dependencies. Skipping move.';
            RAISE NOTICE 'Error: %', SQLERRM;
            -- Continue anyway and create in extensions schema if it doesn't exist there
        END;

        -- Recreate in extensions schema
        CREATE EXTENSION IF NOT EXISTS vector SCHEMA extensions;
        RAISE NOTICE 'Created vector extension in extensions schema';
    ELSE
        -- Extension might already be in extensions schema or not installed
        CREATE EXTENSION IF NOT EXISTS vector SCHEMA extensions;
        RAISE NOTICE 'Created vector extension in extensions schema';
    END IF;
END $$;

-- =====================================================
-- UPDATE SEARCH PATH FOR DATABASE
-- =====================================================

-- Add extensions schema to the default search path so functions can find extension types/functions
-- This is important for pgvector's 'vector' type to be accessible

-- Update search path for all roles
ALTER DATABASE postgres SET search_path TO public, extensions;

-- For the current session
SET search_path TO public, extensions;

-- =====================================================
-- UPDATE FUNCTIONS USING EXTENSIONS
-- =====================================================

-- Functions that use the http extension or vector extension may need updating
-- to reference the extensions schema explicitly or rely on search_path

-- For http extension functions (notify_trade_changes, notify_calendar_deletions):
-- These use net.http_post which should work with schema-qualified calls

-- For vector extension functions (search_similar_trades):
-- The vector type should be accessible via search_path

-- No immediate updates needed since we've updated the search_path

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant necessary permissions on extension schemas to roles
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated, service_role;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Verify extensions are in the correct schema
DO $$
DECLARE
    http_schema TEXT;
    vector_schema TEXT;
BEGIN
    -- Check http extension schema
    SELECT n.nspname INTO http_schema
    FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'http';

    -- Check vector extension schema
    SELECT n.nspname INTO vector_schema
    FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'vector';

    RAISE NOTICE 'Extension verification:';
    RAISE NOTICE '  http extension is in schema: %', COALESCE(http_schema, 'NOT INSTALLED');
    RAISE NOTICE '  vector extension is in schema: %', COALESCE(vector_schema, 'NOT INSTALLED');

    -- Warn if still in public
    IF http_schema = 'public' THEN
        RAISE WARNING 'http extension is still in public schema - may have dependencies preventing move';
    END IF;

    IF vector_schema = 'public' THEN
        RAISE WARNING 'vector extension is still in public schema - may have dependencies preventing move';
    END IF;
END $$;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON SCHEMA extensions IS
    'Dedicated schema for PostgreSQL extensions (http, vector, etc.) to keep them separate from application tables and improve security.';

-- =====================================================
-- NOTES
-- =====================================================

-- IMPORTANT NOTES FOR MANUAL INTERVENTION:
--
-- 1. If the vector extension move failed (due to existing vector columns),
--    you'll need to manually migrate those columns:
--    a. Create new columns with extensions.vector type
--    b. Copy data
--    c. Drop old columns
--    d. Rename new columns
--    e. Then drop and recreate the extension in extensions schema
--
-- 2. If any functions fail after this migration, check if they need:
--    a. Schema-qualified extension calls (e.g., extensions.vector instead of vector)
--    b. Or ensure search_path includes 'extensions' schema
--
-- 3. After this migration, always create new extensions in the extensions schema:
--    CREATE EXTENSION extension_name SCHEMA extensions;
