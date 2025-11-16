-- Migration: Add by_assistant field to notes table
-- Created: 2025-11-16
-- Description: Adds by_assistant boolean field to distinguish AI-created notes from user-created notes.
--              AI agent can create, update, and delete its own notes (by_assistant=true).
--              Existing notes are automatically set to by_assistant=false (user-created).

-- Step 1: Add by_assistant column with default false
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS by_assistant BOOLEAN DEFAULT false NOT NULL;

-- Step 2: Add comment for documentation
COMMENT ON COLUMN public.notes.by_assistant IS 'Indicates if note was created by AI assistant (true) or user (false). AI can only modify its own notes.';

-- Step 3: Create index for filtering AI-created notes by calendar
CREATE INDEX IF NOT EXISTS idx_notes_calendar_id_by_assistant
  ON public.notes(calendar_id, by_assistant, updated_at DESC)
  WHERE by_assistant = true;

-- Step 4: Create index for querying AI notes for specific calendar (for AI context)
CREATE INDEX IF NOT EXISTS idx_notes_calendar_assistant
  ON public.notes(calendar_id, updated_at DESC)
  WHERE by_assistant = true AND is_archived = false;
