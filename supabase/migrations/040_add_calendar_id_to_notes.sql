-- Migration: Add calendar_id to notes table for calendar association
-- Created: 2025-11-16
-- Description: Associates notes with specific calendars instead of being user-scoped only.
--              Notes will now belong to a calendar and be deleted when calendar is deleted.

-- Step 1: Add calendar_id column (initially nullable for backfill)
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS calendar_id UUID REFERENCES public.calendars(id) ON DELETE CASCADE;

-- Step 2: Backfill existing notes with user's first calendar
-- This ensures existing notes get assigned to a calendar
DO $$
DECLARE
  note_record RECORD;
  user_first_calendar UUID;
BEGIN
  -- For each note that doesn't have a calendar_id
  FOR note_record IN
    SELECT id, user_id
    FROM public.notes
    WHERE calendar_id IS NULL
  LOOP
    -- Get the user's first calendar (ordered by created_at)
    SELECT id INTO user_first_calendar
    FROM public.calendars
    WHERE user_id = note_record.user_id
    ORDER BY created_at ASC
    LIMIT 1;

    -- If user has a calendar, assign the note to it
    IF user_first_calendar IS NOT NULL THEN
      UPDATE public.notes
      SET calendar_id = user_first_calendar
      WHERE id = note_record.id;
    ELSE
      -- If user has no calendars, delete the orphaned note
      DELETE FROM public.notes WHERE id = note_record.id;
    END IF;
  END LOOP;
END $$;

-- Step 3: Make calendar_id NOT NULL now that all notes are backfilled
ALTER TABLE public.notes
  ALTER COLUMN calendar_id SET NOT NULL;

-- Step 4: Add comment for documentation
COMMENT ON COLUMN public.notes.calendar_id IS 'Foreign key to calendar - notes belong to a specific calendar and are deleted when calendar is deleted';

-- Step 5: Create index for filtering notes by calendar
CREATE INDEX IF NOT EXISTS idx_notes_calendar_id
  ON public.notes(calendar_id, updated_at DESC)
  WHERE is_archived = false;

-- Step 6: Create index for archived notes by calendar
CREATE INDEX IF NOT EXISTS idx_notes_calendar_id_archived
  ON public.notes(calendar_id, archived_at DESC)
  WHERE is_archived = true;

-- Step 7: Create index for pinned notes by calendar
CREATE INDEX IF NOT EXISTS idx_notes_calendar_id_pinned
  ON public.notes(calendar_id, is_pinned, updated_at DESC)
  WHERE is_pinned = true;

-- Step 8: Update RLS policies to check calendar ownership
-- Drop old user-based policies
DROP POLICY IF EXISTS "Users can view their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can create their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can delete their own notes" ON public.notes;

-- Create new calendar-aware RLS policies
CREATE POLICY "Users can view notes from their calendars"
  ON public.notes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.calendars
      WHERE calendars.id = notes.calendar_id
      AND calendars.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create notes in their calendars"
  ON public.notes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.calendars
      WHERE calendars.id = notes.calendar_id
      AND calendars.user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can update notes in their calendars"
  ON public.notes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.calendars
      WHERE calendars.id = notes.calendar_id
      AND calendars.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.calendars
      WHERE calendars.id = notes.calendar_id
      AND calendars.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete notes from their calendars"
  ON public.notes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.calendars
      WHERE calendars.id = notes.calendar_id
      AND calendars.user_id = auth.uid()
    )
  );
