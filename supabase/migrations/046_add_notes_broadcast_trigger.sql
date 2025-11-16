-- =====================================================
-- Migration: Add Broadcast Trigger for Notes
-- =====================================================
-- This migration creates a broadcast trigger for the notes table
-- to enable realtime updates for note changes (INSERT/UPDATE/DELETE)
--
-- Topic format: calendar-reminders-{calendar_id}
-- This matches the channel name used in CalendarDayReminder component

-- =====================================================
-- 1. Create Broadcast Trigger Function for Notes
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_broadcast_note_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Broadcast note changes to realtime
  -- Topic format: calendar-reminders-{calendar_id}
  PERFORM realtime.broadcast_changes(
    'calendar-reminders-' || COALESCE(NEW.calendar_id, OLD.calendar_id)::text, -- topic
    TG_OP,                                                                       -- event (INSERT/UPDATE/DELETE)
    TG_OP,                                                                       -- operation
    TG_TABLE_NAME,                                                               -- table
    TG_TABLE_SCHEMA,                                                             -- schema
    NEW,                                                                         -- new record
    OLD                                                                          -- old record
  );
  RETURN NULL;
END;
$$;

-- =====================================================
-- 2. Create Trigger on Notes Table
-- =====================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS notes_broadcast_changes ON notes;

-- Create trigger on notes table
CREATE TRIGGER notes_broadcast_changes
  AFTER INSERT OR UPDATE OR DELETE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_broadcast_note_changes();

-- =====================================================
-- 3. Add Comments for Documentation
-- =====================================================

COMMENT ON FUNCTION trigger_broadcast_note_changes() IS 
  'Broadcasts note changes to realtime using realtime.broadcast_changes(). Topic: calendar-reminders-{calendar_id}';

COMMENT ON TRIGGER notes_broadcast_changes ON notes IS
  'Broadcasts INSERT/UPDATE/DELETE events to realtime subscribers on topic calendar-reminders-{calendar_id}';

-- =====================================================
-- 4. Set Replica Identity to DEFAULT
-- =====================================================
-- Ensure notes table uses DEFAULT replica identity (not FULL)
-- since we're using broadcast instead of postgres_changes

ALTER TABLE notes REPLICA IDENTITY DEFAULT;

COMMENT ON TABLE notes IS 'User notes with realtime broadcast updates enabled.';

-- =====================================================
-- 5. Verification Queries (commented out)
-- =====================================================

-- Verify replica identity is DEFAULT
-- SELECT relname, relreplident FROM pg_class WHERE relname = 'notes';
-- Expected: relreplident = 'd' (DEFAULT)

-- Verify trigger exists
-- SELECT tgname, tgrelid::regclass, tgfoid::regproc FROM pg_trigger WHERE tgname = 'notes_broadcast_changes';

-- Test broadcast by updating a note and checking realtime channel

