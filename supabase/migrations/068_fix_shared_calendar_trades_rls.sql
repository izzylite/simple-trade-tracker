-- Fix RLS policy for shared calendar trades
-- Previously, trades required is_shared=true individually
-- Now, trades belonging to a shared calendar are also publicly readable
-- Also adds a function to increment view count for shared calendars
-- Created: 2025-12-28

-- =====================================================
-- ADD SHARE_VIEW_COUNT COLUMN TO CALENDARS
-- =====================================================
ALTER TABLE calendars ADD COLUMN IF NOT EXISTS share_view_count INTEGER DEFAULT 0;

-- =====================================================
-- UPDATE TRADES RLS POLICY FOR SHARED CALENDARS
-- =====================================================

-- Drop existing policy
DROP POLICY IF EXISTS "public_shared_trades_read" ON trades;

-- Create updated policy that allows:
-- 1. Individually shared trades (is_shared = true)
-- 2. Trades belonging to a shared calendar
CREATE POLICY "public_shared_trades_read" ON trades
  FOR SELECT
  USING (
    -- Individual trade is shared
    (is_shared = true AND share_id IS NOT NULL)
    OR
    -- Trade belongs to a shared calendar
    EXISTS (
      SELECT 1 FROM calendars
      WHERE calendars.id = trades.calendar_id
      AND calendars.is_shared = true
    )
  );

-- =====================================================
-- FUNCTION TO INCREMENT SHARED CALENDAR VIEW COUNT
-- =====================================================
-- Uses SECURITY DEFINER to allow unauthenticated users to increment view count

CREATE OR REPLACE FUNCTION increment_shared_calendar_view_count(p_share_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_calendar calendars%ROWTYPE;
  v_current_count INT;
BEGIN
  -- Find the shared calendar
  SELECT * INTO v_calendar
  FROM calendars
  WHERE share_id = p_share_id
    AND is_shared = true;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Shared calendar not found'
    );
  END IF;

  -- Get current view count (default to 0 if null)
  v_current_count := COALESCE(v_calendar.share_view_count, 0);

  -- Increment view count
  UPDATE calendars
  SET share_view_count = v_current_count + 1
  WHERE id = v_calendar.id;

  RETURN json_build_object(
    'success', true,
    'viewCount', v_current_count + 1,
    'calendarId', v_calendar.id
  );
END;
$$;

-- Grant execute permission to anon role (unauthenticated users)
GRANT EXECUTE ON FUNCTION increment_shared_calendar_view_count(TEXT) TO anon;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON POLICY "public_shared_trades_read" ON trades IS
  'Allow public read access to shared trades and trades belonging to shared calendars';

COMMENT ON FUNCTION increment_shared_calendar_view_count(TEXT) IS
  'Increment view count for shared calendars. Uses SECURITY DEFINER to allow public access.';
