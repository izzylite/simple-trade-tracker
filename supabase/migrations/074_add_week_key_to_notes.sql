-- Migration: Add week_key to notes for weekly note association
-- Description: Allows linking a note to a specific calendar week.
--   week_key format: 'yyyy-MM-dd' (Sunday of that week)
--   One note per week per calendar enforced by unique constraint.

-- Add the column (nullable -- only set for week notes)
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS week_key TEXT;

COMMENT ON COLUMN public.notes.week_key
  IS 'Week identifier (yyyy-MM-dd of week start Sunday). NULL for non-week notes.';

-- Unique constraint: one week note per calendar
CREATE UNIQUE INDEX IF NOT EXISTS idx_notes_calendar_week_key
  ON public.notes(calendar_id, week_key)
  WHERE week_key IS NOT NULL;

-- Index for fast lookup of week notes by calendar
CREATE INDEX IF NOT EXISTS idx_notes_calendar_id_week_key
  ON public.notes(calendar_id)
  WHERE week_key IS NOT NULL;
