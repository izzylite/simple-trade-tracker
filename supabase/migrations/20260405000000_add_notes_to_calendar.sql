-- Migration: Add notes field to calendars
-- Stores active, user-created note references {id, title} for each calendar.
-- Maintained by trigger on notes table so no on-demand query is needed.

-- 1. Add the column
ALTER TABLE calendars ADD COLUMN IF NOT EXISTS notes JSONB DEFAULT '[]'::jsonb;

-- 2. Rebuild function: queries active user notes and overwrites calendar.notes
CREATE OR REPLACE FUNCTION rebuild_calendar_notes(p_calendar_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE calendars SET notes = (
    SELECT COALESCE(
      jsonb_agg(jsonb_build_object('id', id, 'title', title) ORDER BY updated_at DESC),
      '[]'::jsonb
    )
    FROM notes
    WHERE calendar_id = p_calendar_id
      AND is_archived = false
      AND by_assistant = false
  )
  WHERE id = p_calendar_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger function: fires after any notes row change
CREATE OR REPLACE FUNCTION trigger_rebuild_calendar_notes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.calendar_id IS NOT NULL THEN
      PERFORM rebuild_calendar_notes(OLD.calendar_id);
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.calendar_id IS NOT NULL THEN
      PERFORM rebuild_calendar_notes(NEW.calendar_id);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.calendar_id IS NOT NULL THEN
      PERFORM rebuild_calendar_notes(NEW.calendar_id);
    END IF;
    -- Note moved to a different calendar: rebuild old calendar too
    IF OLD.calendar_id IS DISTINCT FROM NEW.calendar_id AND OLD.calendar_id IS NOT NULL THEN
      PERFORM rebuild_calendar_notes(OLD.calendar_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Attach trigger to notes table
DROP TRIGGER IF EXISTS notes_calendar_sync ON notes;
CREATE TRIGGER notes_calendar_sync
  AFTER INSERT OR UPDATE OR DELETE ON notes
  FOR EACH ROW EXECUTE FUNCTION trigger_rebuild_calendar_notes();

-- 5. Backfill existing calendars
DO $$
DECLARE
  cal RECORD;
BEGIN
  FOR cal IN SELECT id FROM calendars LOOP
    PERFORM rebuild_calendar_notes(cal.id);
  END LOOP;
END;
$$;
