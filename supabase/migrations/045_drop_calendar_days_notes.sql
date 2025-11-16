-- Migration: Drop days_notes field from calendars table
-- This field has been replaced by the reminder system in the notes table

-- Drop the GIN index on days_notes first (if it exists)
DROP INDEX IF EXISTS idx_calendars_days_notes;

-- Drop the days_notes column from calendars table
ALTER TABLE public.calendars DROP COLUMN IF EXISTS days_notes;

-- Add comment to document the removal
COMMENT ON TABLE public.calendars IS 'Calendars table - core trading calendar data. The days_notes field was removed in migration 045 and replaced with the reminder system in the notes table.';
