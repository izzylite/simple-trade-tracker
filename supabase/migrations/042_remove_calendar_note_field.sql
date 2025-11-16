-- Migration: Remove note field from calendars table
-- Since we now have a dedicated notes table with calendar_id reference,
-- the calendar.note field is no longer needed

-- Drop the note column from calendars table
ALTER TABLE calendars DROP COLUMN IF EXISTS note;
