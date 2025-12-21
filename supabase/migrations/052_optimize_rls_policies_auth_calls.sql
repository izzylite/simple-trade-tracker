-- Migration: Optimize RLS Policies - Auth Function Calls
-- Created: 2025-12-21
-- Description: Optimizes RLS policies by wrapping auth.uid() calls in subqueries
--              to prevent re-evaluation for each row, improving query performance at scale.
-- Issue: https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan
-- Advisor: performance_advisor.json - auth_rls_initplan warnings

-- =====================================================
-- USERS TABLE RLS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;

CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (firebase_uid = (SELECT auth.uid()::text));

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (firebase_uid = (SELECT auth.uid()::text));

CREATE POLICY "Users can insert own profile" ON users
    FOR INSERT WITH CHECK (firebase_uid = (SELECT auth.uid()::text));

-- =====================================================
-- CALENDARS TABLE RLS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view own calendars" ON calendars;
DROP POLICY IF EXISTS "Users can create own calendars" ON calendars;
DROP POLICY IF EXISTS "Users can update own calendars" ON calendars;
DROP POLICY IF EXISTS "Users can delete own calendars" ON calendars;

CREATE POLICY "Users can view own calendars" ON calendars
    FOR SELECT USING (user_id = (SELECT auth.uid()::text));

CREATE POLICY "Users can create own calendars" ON calendars
    FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()::text));

CREATE POLICY "Users can update own calendars" ON calendars
    FOR UPDATE USING (user_id = (SELECT auth.uid()::text));

CREATE POLICY "Users can delete own calendars" ON calendars
    FOR DELETE USING (user_id = (SELECT auth.uid()::text));

-- =====================================================
-- TRADES TABLE RLS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view own trades" ON trades;
DROP POLICY IF EXISTS "Users can create own trades" ON trades;
DROP POLICY IF EXISTS "Users can update own trades" ON trades;
DROP POLICY IF EXISTS "Users can delete own trades" ON trades;

CREATE POLICY "Users can view own trades" ON trades
    FOR SELECT USING (user_id = (SELECT auth.uid()::text));

CREATE POLICY "Users can create own trades" ON trades
    FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()::text));

CREATE POLICY "Users can update own trades" ON trades
    FOR UPDATE USING (user_id = (SELECT auth.uid()::text));

CREATE POLICY "Users can delete own trades" ON trades
    FOR DELETE USING (user_id = (SELECT auth.uid()::text));

-- =====================================================
-- NOTES TABLE RLS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view notes from their calendars" ON notes;
DROP POLICY IF EXISTS "Users can create notes in their calendars" ON notes;
DROP POLICY IF EXISTS "Users can update notes in their calendars" ON notes;
DROP POLICY IF EXISTS "Users can delete notes from their calendars" ON notes;

CREATE POLICY "Users can view notes from their calendars"
  ON notes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM calendars
      WHERE calendars.id = notes.calendar_id
      AND calendars.user_id = (SELECT auth.uid()::text)
    )
  );

CREATE POLICY "Users can create notes in their calendars"
  ON notes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM calendars
      WHERE calendars.id = notes.calendar_id
      AND calendars.user_id = (SELECT auth.uid()::text)
    )
    AND user_id = (SELECT auth.uid()::text)
  );

CREATE POLICY "Users can update notes in their calendars"
  ON notes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM calendars
      WHERE calendars.id = notes.calendar_id
      AND calendars.user_id = (SELECT auth.uid()::text)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM calendars
      WHERE calendars.id = notes.calendar_id
      AND calendars.user_id = (SELECT auth.uid()::text)
    )
  );

CREATE POLICY "Users can delete notes from their calendars"
  ON notes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM calendars
      WHERE calendars.id = notes.calendar_id
      AND calendars.user_id = (SELECT auth.uid()::text)
    )
  );

-- =====================================================
-- AI_CONVERSATIONS TABLE RLS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view their own conversations" ON ai_conversations;
DROP POLICY IF EXISTS "Users can create their own conversations" ON ai_conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON ai_conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON ai_conversations;

CREATE POLICY "Users can view their own conversations"
    ON ai_conversations
    FOR SELECT
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can create their own conversations"
    ON ai_conversations
    FOR INSERT
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update their own conversations"
    ON ai_conversations
    FOR UPDATE
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete their own conversations"
    ON ai_conversations
    FOR DELETE
    USING (user_id = (SELECT auth.uid()));

-- =====================================================
-- INVITE_LINKS TABLE RLS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Creators can manage their invite links" ON invite_links;

CREATE POLICY "Creators can manage their invite links"
    ON invite_links
    FOR ALL
    USING (created_by = (SELECT auth.uid()));

-- =====================================================
-- TAG_DEFINITIONS TABLE RLS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view own tag definitions" ON tag_definitions;
DROP POLICY IF EXISTS "Users can insert own tag definitions" ON tag_definitions;
DROP POLICY IF EXISTS "Users can update own tag definitions" ON tag_definitions;
DROP POLICY IF EXISTS "Users can delete own tag definitions" ON tag_definitions;

CREATE POLICY "Users can view own tag definitions" ON tag_definitions
    FOR SELECT USING (user_id = (SELECT auth.uid()::text));

CREATE POLICY "Users can insert own tag definitions" ON tag_definitions
    FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()::text));

CREATE POLICY "Users can update own tag definitions" ON tag_definitions
    FOR UPDATE USING (user_id = (SELECT auth.uid()::text));

CREATE POLICY "Users can delete own tag definitions" ON tag_definitions
    FOR DELETE USING (user_id = (SELECT auth.uid()::text));

-- =====================================================
-- STORAGE_CLEANUP_QUEUE TABLE RLS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view their own cleanup queue entries" ON storage_cleanup_queue;

CREATE POLICY "Users can view their own cleanup queue entries" ON storage_cleanup_queue
    FOR SELECT USING (user_id = (SELECT auth.uid()));

-- =====================================================
-- ECONOMIC_EVENTS TABLE RLS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can view economic events" ON economic_events;

-- Using auth.role() is generally safe, but for consistency we'll still optimize it
CREATE POLICY "Authenticated users can view economic events" ON economic_events
    FOR SELECT USING ((SELECT auth.role()) = 'authenticated');

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON POLICY "Users can view own profile" ON users IS
    'Optimized RLS policy using subquery wrapper around auth.uid() to prevent per-row re-evaluation';

COMMENT ON POLICY "Users can view own calendars" ON calendars IS
    'Optimized RLS policy using subquery wrapper around auth.uid() to prevent per-row re-evaluation';

COMMENT ON POLICY "Users can view own trades" ON trades IS
    'Optimized RLS policy using subquery wrapper around auth.uid() to prevent per-row re-evaluation';

COMMENT ON POLICY "Users can view notes from their calendars" ON notes IS
    'Optimized RLS policy using subquery wrapper around auth.uid() to prevent per-row re-evaluation';

COMMENT ON POLICY "Users can view their own conversations" ON ai_conversations IS
    'Optimized RLS policy using subquery wrapper around auth.uid() to prevent per-row re-evaluation';
