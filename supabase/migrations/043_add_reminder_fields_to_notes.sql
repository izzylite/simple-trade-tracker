-- Migration: Add reminder fields to notes table
-- This enables notes to function as reminders that can be shown on specific days

-- Add reminder fields to notes table
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS reminder_type TEXT CHECK (reminder_type IN ('none', 'once', 'weekly')) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS reminder_date DATE, -- For one-time reminders
  ADD COLUMN IF NOT EXISTS reminder_days TEXT[], -- For weekly: ['Mon', 'Tue', 'Wed', etc.]
  ADD COLUMN IF NOT EXISTS is_reminder_active BOOLEAN DEFAULT false;

-- Add comment describing the reminder system
COMMENT ON COLUMN public.notes.reminder_type IS 'Type of reminder: none (no reminder), once (specific date), weekly (recurring days)';
COMMENT ON COLUMN public.notes.reminder_date IS 'Date for one-time reminders (used when reminder_type = ''once'')';
COMMENT ON COLUMN public.notes.reminder_days IS 'Array of day abbreviations for weekly reminders: [''Mon'', ''Tue'', ''Wed'', ''Thu'', ''Fri'', ''Sat'', ''Sun'']';
COMMENT ON COLUMN public.notes.is_reminder_active IS 'Whether the reminder is currently active';

-- Create indexes for efficient reminder queries
-- Index for active reminders by calendar
CREATE INDEX IF NOT EXISTS idx_notes_reminder_active
  ON public.notes(calendar_id, is_reminder_active, reminder_type)
  WHERE is_reminder_active = true;

-- Index for one-time reminder date lookups
CREATE INDEX IF NOT EXISTS idx_notes_reminder_date
  ON public.notes(reminder_date)
  WHERE reminder_type = 'once' AND is_reminder_active = true;

-- GIN index for weekly reminder days array lookups
CREATE INDEX IF NOT EXISTS idx_notes_reminder_days
  ON public.notes USING GIN(reminder_days)
  WHERE reminder_type = 'weekly' AND is_reminder_active = true;

-- Composite index for efficient day-specific queries
CREATE INDEX IF NOT EXISTS idx_notes_calendar_reminder_days
  ON public.notes(calendar_id)
  WHERE reminder_type = 'weekly' AND is_reminder_active = true;
