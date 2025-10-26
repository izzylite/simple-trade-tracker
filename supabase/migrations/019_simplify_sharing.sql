-- Simplify Sharing Architecture
-- Drop shared_trades and shared_calendars tables since we now store share info directly on main tables
-- Created: 2025-10-25

-- =====================================================
-- DROP SHARED TABLES (No longer needed)
-- =====================================================
-- Share information is now stored directly on calendars and trades tables using:
-- - share_id: Unique identifier for the share link
-- - share_link: The full URL of the share link
-- - is_shared: Boolean flag indicating if the item is currently shared
-- - shared_at: Timestamp of when sharing was activated

DROP TABLE IF EXISTS shared_trades CASCADE;
DROP TABLE IF EXISTS shared_calendars CASCADE;

-- =====================================================
-- ADD INDEXES FOR SHARE LOOKUPS
-- =====================================================
-- Add indexes on share_id fields for faster public lookups
CREATE INDEX IF NOT EXISTS idx_calendars_share_id ON calendars(share_id) WHERE share_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trades_share_id ON trades(share_id) WHERE share_id IS NOT NULL;

-- Add index for active shares
CREATE INDEX IF NOT EXISTS idx_calendars_is_shared ON calendars(is_shared) WHERE is_shared = true;
CREATE INDEX IF NOT EXISTS idx_trades_is_shared ON trades(is_shared) WHERE is_shared = true;

-- =====================================================
-- RLS POLICIES FOR PUBLIC SHARED ACCESS
-- =====================================================
-- Allow public (unauthenticated) read access to shared calendars and trades

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "public_shared_calendars_read" ON calendars;
DROP POLICY IF EXISTS "public_shared_trades_read" ON trades;

-- Create new policies for public read access to shared items
-- Public can read shared calendars
CREATE POLICY "public_shared_calendars_read" ON calendars
  FOR SELECT
  USING (
    is_shared = true
    AND share_id IS NOT NULL
  );

-- Public can read shared trades
CREATE POLICY "public_shared_trades_read" ON trades
  FOR SELECT
  USING (
    is_shared = true
    AND share_id IS NOT NULL
  );

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON INDEX idx_calendars_share_id IS 'Index for fast lookups of shared calendars by share_id';
COMMENT ON INDEX idx_trades_share_id IS 'Index for fast lookups of shared trades by share_id';
COMMENT ON INDEX idx_calendars_is_shared IS 'Index for filtering shared calendars';
COMMENT ON INDEX idx_trades_is_shared IS 'Index for filtering shared trades';

COMMENT ON POLICY "public_shared_calendars_read" ON calendars IS 'Allow public read access to shared calendars';
COMMENT ON POLICY "public_shared_trades_read" ON trades IS 'Allow public read access to shared trades';
