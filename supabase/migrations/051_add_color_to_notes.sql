-- Migration: Add color column to notes table
-- Created: 2025-12-14
-- Description: Adds color column to notes table to support custom background colors for notes/reminders.

-- Step 1: Add color column (TEXT, nullable)
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS color TEXT DEFAULT NULL;

-- Step 2: Add comment for documentation
COMMENT ON COLUMN public.notes.color IS 'Background color for the note (hex code or preset name). Used for visual distinction in calendar and lists.';
