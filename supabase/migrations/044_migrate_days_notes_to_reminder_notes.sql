-- Migration: Migrate days_notes from calendars to notes table
-- This converts the legacy calendar.days_notes JSONB structure to individual reminder notes

-- Migrate days_notes from calendars to notes table
-- For each calendar with days_notes, create weekly reminder notes
DO $$
DECLARE
  migration_count INTEGER := 0;
BEGIN
  -- Insert reminder notes from days_notes
  WITH migrated_notes AS (
    INSERT INTO public.notes (
      user_id,
      calendar_id,
      title,
      content,
      reminder_type,
      reminder_days,
      is_reminder_active,
      by_assistant,
      created_at,
      updated_at
    )
    SELECT
      c.user_id::uuid,
      c.id AS calendar_id,
      days.day_key || ' Game Plan' AS title,
      days.day_value AS content,
      'weekly' AS reminder_type,
      ARRAY[days.day_key] AS reminder_days,
      true AS is_reminder_active,
      false AS by_assistant,
      NOW() AS created_at,
      NOW() AS updated_at
    FROM calendars c,
    LATERAL jsonb_each_text(c.days_notes) AS days(day_key, day_value)
    WHERE c.days_notes IS NOT NULL
      AND c.days_notes != '{}'::jsonb
      AND days.day_value IS NOT NULL
      AND days.day_value != ''
      AND TRIM(days.day_value) != ''
    RETURNING *
  )
  SELECT COUNT(*) INTO migration_count FROM migrated_notes;

  -- Log the migration result
  RAISE NOTICE 'Successfully migrated % day notes to reminder notes', migration_count;
END $$;

-- Add a comment to document this migration
COMMENT ON TABLE public.notes IS 'Notes table - stores user and AI-created notes with optional reminder functionality. Migrated from calendar.days_notes in migration 044.';
