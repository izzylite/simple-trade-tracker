-- Migration: Create invite links system for user registration control
-- Description: Adds invite_links table with RLS policies for secure invite verification
-- Author: System
-- Date: 2025-11-08

-- ============================================================================
-- INVITE LINKS TABLE
-- ============================================================================

-- Create invite_links table for managing registration invitations
CREATE TABLE IF NOT EXISTS public.invite_links (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Invite code (unique, indexed)
    code TEXT UNIQUE NOT NULL,

    -- Link ownership and permissions
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Usage tracking
    uses_remaining INTEGER DEFAULT 1,  -- NULL = unlimited uses
    max_uses INTEGER DEFAULT 1,        -- NULL = unlimited
    used_count INTEGER DEFAULT 0,

    -- Status flags
    is_active BOOLEAN DEFAULT true,

    -- Expiration
    expires_at TIMESTAMPTZ,

    -- Audit timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,

    -- Track which users used this invite
    used_by_users TEXT[] DEFAULT '{}',

    -- Constraints
    CONSTRAINT invite_code_format CHECK (code ~ '^[A-Za-z0-9_-]+$'),
    CONSTRAINT uses_remaining_positive CHECK (uses_remaining IS NULL OR uses_remaining >= 0),
    CONSTRAINT max_uses_positive CHECK (max_uses IS NULL OR max_uses >= 1)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index on code for fast lookups (only active invites)
CREATE INDEX idx_invite_links_code
    ON public.invite_links(code)
    WHERE is_active = true;

-- Index on creator for management queries
CREATE INDEX idx_invite_links_created_by
    ON public.invite_links(created_by);

-- Index on expiration for cleanup operations
CREATE INDEX idx_invite_links_expires_at
    ON public.invite_links(expires_at)
    WHERE is_active = true;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on invite_links table
ALTER TABLE public.invite_links ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read active, non-expired, available invite links
-- This is necessary for pre-authentication invite verification
CREATE POLICY "Anyone can read active invite links"
    ON public.invite_links
    FOR SELECT
    USING (
        is_active = true
        AND (expires_at IS NULL OR expires_at > NOW())
        AND (uses_remaining IS NULL OR uses_remaining > 0)
    );

-- Policy: Only authenticated users who created the invite can manage it
CREATE POLICY "Creators can manage their invite links"
    ON public.invite_links
    FOR ALL
    USING (created_by = auth.uid());

-- Policy: Service role can do everything (for edge functions)
-- Note: This is implicitly allowed by Supabase service role

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function: Cleanup expired invites (to be called by cron or manually)
CREATE OR REPLACE FUNCTION public.cleanup_expired_invites()
RETURNS INTEGER AS $$
DECLARE
    affected_rows INTEGER;
BEGIN
    -- Deactivate expired invites
    UPDATE public.invite_links
    SET is_active = false
    WHERE is_active = true
      AND expires_at IS NOT NULL
      AND expires_at < NOW();

    GET DIAGNOSTICS affected_rows = ROW_COUNT;

    RETURN affected_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UPDATE USERS TABLE
-- ============================================================================

-- Add invite_code_used column to track which invite was used during registration
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS invite_code_used TEXT;

-- Create index on invite_code_used for analytics
CREATE INDEX IF NOT EXISTS idx_users_invite_code_used
    ON public.users(invite_code_used)
    WHERE invite_code_used IS NOT NULL;

-- ============================================================================
-- TABLE COMMENTS
-- ============================================================================

COMMENT ON TABLE public.invite_links IS
    'Invite link verification system for controlling user registration. '
    'Supports single-use and multi-use invites with expiration dates.';

COMMENT ON COLUMN public.invite_links.code IS
    'Unique invite code (alphanumeric, dash, underscore). Used for verification.';

COMMENT ON COLUMN public.invite_links.uses_remaining IS
    'Number of uses remaining. NULL = unlimited. Decremented on each consumption.';

COMMENT ON COLUMN public.invite_links.max_uses IS
    'Maximum number of times this invite can be used. NULL = unlimited.';

COMMENT ON COLUMN public.invite_links.used_by_users IS
    'Array of user IDs who have used this invite. Prevents duplicate usage.';

COMMENT ON FUNCTION public.cleanup_expired_invites() IS
    'Deactivates invite links that have passed their expiration date. '
    'Returns the number of invites that were deactivated.';
