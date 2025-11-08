-- Migration: Add archive and pin functionality to notes table
-- Created: 2025-11-08
-- Description: Adds is_archived, is_pinned, and archived_at fields to support
--              organizing notes similar to Google Keep pattern

-- Add new columns
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Add comments for documentation
COMMENT ON COLUMN public.notes.is_archived IS 'Soft delete flag - archived notes are hidden from main view';
COMMENT ON COLUMN public.notes.is_pinned IS 'Pin flag - pinned notes appear at top of list';
COMMENT ON COLUMN public.notes.archived_at IS 'Timestamp when note was archived (null if not archived)';

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_notes_user_id_is_archived
  ON public.notes(user_id, is_archived)
  WHERE is_archived = false;

CREATE INDEX IF NOT EXISTS idx_notes_user_id_is_pinned
  ON public.notes(user_id, is_pinned, updated_at DESC)
  WHERE is_pinned = true;

CREATE INDEX IF NOT EXISTS idx_notes_user_id_updated_at
  ON public.notes(user_id, updated_at DESC)
  WHERE is_archived = false;

-- Add trigger to automatically set archived_at timestamp
CREATE OR REPLACE FUNCTION public.set_note_archived_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Set archived_at when archiving
  IF NEW.is_archived = true AND OLD.is_archived = false THEN
    NEW.archived_at = NOW();
  END IF;

  -- Clear archived_at when unarchiving
  IF NEW.is_archived = false AND OLD.is_archived = true THEN
    NEW.archived_at = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_note_archived_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_note_archived_at();

-- RLS policies remain unchanged (inherited from existing user_id check)
