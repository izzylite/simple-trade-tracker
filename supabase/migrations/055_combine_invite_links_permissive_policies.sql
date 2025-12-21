-- Migration: Combine Multiple Permissive Policies on invite_links
-- Created: 2025-12-21
-- Description: Combines duplicate permissive RLS policies on invite_links table
--              to improve query performance by reducing policy evaluation overhead.
-- Issue: https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies
-- Advisor: performance_advisor.json - multiple_permissive_policies warnings

-- Background:
-- The invite_links table currently has two permissive SELECT policies:
-- 1. "Anyone can read active invite links" - allows reading active, non-expired invites
-- 2. "Creators can manage their invite links" - allows creators to manage their invites
--
-- Having multiple permissive policies for the same role and action causes each policy
-- to be evaluated for every query, which is suboptimal for performance.
--
-- Solution:
-- Combine both policies into a single policy using OR conditions.

-- =====================================================
-- DROP EXISTING POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Anyone can read active invite links" ON public.invite_links;
DROP POLICY IF EXISTS "Creators can manage their invite links" ON public.invite_links;

-- =====================================================
-- CREATE COMBINED POLICIES
-- =====================================================

-- Combined SELECT policy: Allows reading active invites OR invites created by the user
CREATE POLICY "Read invite links"
    ON public.invite_links
    FOR SELECT
    USING (
        -- Anyone can read active, non-expired, available invite links
        (
            is_active = true
            AND (expires_at IS NULL OR expires_at > NOW())
            AND (uses_remaining IS NULL OR uses_remaining > 0)
        )
        OR
        -- Authenticated users can read their own invite links (even if inactive/expired)
        (
            auth.uid() IS NOT NULL
            AND created_by = (SELECT auth.uid())
        )
    );

-- Separate policies for INSERT, UPDATE, DELETE (only for creators)
-- These are restrictive policies that only apply to authenticated creators

CREATE POLICY "Insert invite links"
    ON public.invite_links
    FOR INSERT
    WITH CHECK (created_by = (SELECT auth.uid()));

CREATE POLICY "Update invite links"
    ON public.invite_links
    FOR UPDATE
    USING (created_by = (SELECT auth.uid()))
    WITH CHECK (created_by = (SELECT auth.uid()));

CREATE POLICY "Delete invite links"
    ON public.invite_links
    FOR DELETE
    USING (created_by = (SELECT auth.uid()));

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON POLICY "Read invite links" ON public.invite_links IS
    'Combined permissive policy for SELECT: allows reading active invites (anyone) OR own invites (creator). Optimized to prevent multiple policy evaluations.';

COMMENT ON POLICY "Insert invite links" ON public.invite_links IS
    'Restrictive policy for INSERT: only authenticated users can create invites with their own user ID.';

COMMENT ON POLICY "Update invite links" ON public.invite_links IS
    'Restrictive policy for UPDATE: only creators can update their own invite links.';

COMMENT ON POLICY "Delete invite links" ON public.invite_links IS
    'Restrictive policy for DELETE: only creators can delete their own invite links.';

-- =====================================================
-- VERIFICATION
-- =====================================================

-- This migration reduces the number of permissive policies from 2 to 1 for SELECT operations,
-- which should improve query performance while maintaining the same security guarantees:
--
-- Before:
-- - Policy 1: SELECT where (is_active AND not expired AND uses_remaining > 0)
-- - Policy 2: SELECT where (created_by = auth.uid())
-- Both policies evaluated for EVERY query (OR behavior)
--
-- After:
-- - Single Policy: SELECT where (active conditions) OR (created_by = auth.uid())
-- Single policy evaluation per query
--
-- The behavior remains identical, but performance is improved.
