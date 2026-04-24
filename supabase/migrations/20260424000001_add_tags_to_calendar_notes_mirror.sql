-- Migration: Extend calendar.notes JSONB mirror to include tags
-- The original mirror (see 20260405000000_add_notes_to_calendar.sql) stored
-- only {id, title}. The chat mention input needs to know each note's tags so
-- it can split slash-command-tagged notes from the rest — fetching the full
-- notes table at chat time is wasteful when the mirror is already maintained
-- per calendar.
--
-- Changes:
--   1. Rebuild rebuild_calendar_notes to emit {id, title, tags}.
--   2. Extend the trigger to re-fire when notes.tags changes.
--   3. Backfill all calendars.

-- 1. Rebuild function
CREATE OR REPLACE FUNCTION rebuild_calendar_notes(p_calendar_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE calendars SET notes = (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'title', title,
          'tags', COALESCE(tags, ARRAY[]::text[])
        )
        ORDER BY updated_at DESC
      ),
      '[]'::jsonb
    )
    FROM notes
    WHERE calendar_id = p_calendar_id
      AND is_archived = false
      AND by_assistant = false
  )
  WHERE id = p_calendar_id;
END;
$$;

-- 2. Extend trigger to watch tags too
DROP TRIGGER IF EXISTS notes_calendar_sync ON notes;
CREATE TRIGGER notes_calendar_sync
  AFTER INSERT OR UPDATE OF title, is_archived, by_assistant, calendar_id, tags OR DELETE ON notes
  FOR EACH ROW EXECUTE FUNCTION trigger_rebuild_calendar_notes();

-- 3. Backfill existing calendars
DO $$
DECLARE
  cal RECORD;
BEGIN
  FOR cal IN SELECT id FROM calendars LOOP
    PERFORM rebuild_calendar_notes(cal.id);
  END LOOP;
END;
$$;
