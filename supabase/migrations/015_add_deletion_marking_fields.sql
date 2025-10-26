-- Migration: Add Deletion Marking Fields
-- Description: Adds mark_for_deletion and deletion_date fields to enable safe, retryable calendar deletion
-- Date: 2025-10-24
--
-- Problem: Direct DELETE causes orphaned data if cleanup fails
-- Solution: Mark for deletion, cleanup, then delete (transactional + retryable)

-- ============================================
-- 1. Add Deletion Marking Fields
-- ============================================

-- Add mark_for_deletion field (boolean flag)
ALTER TABLE calendars
ADD COLUMN IF NOT EXISTS mark_for_deletion BOOLEAN DEFAULT FALSE;

-- Add deletion_date field (timestamp when marked for deletion)
ALTER TABLE calendars
ADD COLUMN IF NOT EXISTS deletion_date TIMESTAMPTZ;

-- Add index for efficient querying of calendars marked for deletion
CREATE INDEX IF NOT EXISTS idx_calendars_marked_for_deletion
ON calendars(mark_for_deletion, deletion_date)
WHERE mark_for_deletion = TRUE;

-- ============================================
-- 2. Add Comments
-- ============================================

COMMENT ON COLUMN calendars.mark_for_deletion IS
'Flag indicating calendar is marked for deletion. When true, the next update to deletion_date will trigger cleanup process.';

COMMENT ON COLUMN calendars.deletion_date IS
'Timestamp when calendar was marked for deletion. Changes to this field trigger the cleanup and deletion process in handle-calendar-changes edge function.';

COMMENT ON INDEX idx_calendars_marked_for_deletion IS
'Index for efficiently finding calendars marked for deletion. Used by cleanup-expired-calendars cron job.';

-- ============================================
-- 3. Create Helper Function to Mark Calendar for Deletion
-- ============================================

CREATE OR REPLACE FUNCTION mark_calendar_for_deletion(
  p_calendar_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_affected_rows INTEGER;
BEGIN
  -- Mark calendar for deletion and set deletion_date
  UPDATE calendars
  SET
    mark_for_deletion = TRUE,
    deletion_date = NOW()
  WHERE id = p_calendar_id
    AND is_deleted = TRUE  -- Only mark if already in trash
    AND auto_delete_at < NOW();  -- Only mark if past auto-delete date

  GET DIAGNOSTICS v_affected_rows = ROW_COUNT;

  RETURN v_affected_rows > 0;
END;
$$;

COMMENT ON FUNCTION mark_calendar_for_deletion IS
'Helper function to mark a calendar for deletion. Sets mark_for_deletion=true and deletion_date=NOW(). This triggers the UPDATE webhook which processes cleanup and final deletion.';

-- ============================================
-- 4. Migrate Existing is_deleted Calendars
-- ============================================

-- Update existing soft-deleted calendars that are past auto_delete_at
-- These will be picked up by the next cron run
UPDATE calendars
SET
  mark_for_deletion = TRUE,
  deletion_date = NOW()
WHERE
  is_deleted = TRUE
  AND auto_delete_at IS NOT NULL
  AND auto_delete_at < NOW()
  AND mark_for_deletion = FALSE;

-- ============================================
-- 5. Verify Migration
-- ============================================

DO $$
DECLARE
  v_mark_for_deletion_exists BOOLEAN;
  v_deletion_date_exists BOOLEAN;
  v_index_exists BOOLEAN;
  v_marked_count INTEGER;
BEGIN
  -- Check if columns exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendars' AND column_name = 'mark_for_deletion'
  ) INTO v_mark_for_deletion_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendars' AND column_name = 'deletion_date'
  ) INTO v_deletion_date_exists;

  -- Check if index exists
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_calendars_marked_for_deletion'
  ) INTO v_index_exists;

  -- Count marked calendars
  SELECT COUNT(*) INTO v_marked_count
  FROM calendars
  WHERE mark_for_deletion = TRUE;

  -- Verify all components
  IF NOT v_mark_for_deletion_exists THEN
    RAISE EXCEPTION 'Column mark_for_deletion was not created';
  END IF;

  IF NOT v_deletion_date_exists THEN
    RAISE EXCEPTION 'Column deletion_date was not created';
  END IF;

  IF NOT v_index_exists THEN
    RAISE EXCEPTION 'Index idx_calendars_marked_for_deletion was not created';
  END IF;

  RAISE NOTICE 'Migration successful!';
  RAISE NOTICE 'Columns created: mark_for_deletion, deletion_date';
  RAISE NOTICE 'Index created: idx_calendars_marked_for_deletion';
  RAISE NOTICE 'Calendars marked for deletion: %', v_marked_count;
END $$;
