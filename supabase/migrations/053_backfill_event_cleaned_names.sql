-- Migration: Backfill cleaned_name field in economic_events JSONB array
-- This adds a cleaned_name field to each economic event stored in trades
-- The cleaned_name removes date suffixes (like "(May)", "(Jun)") for efficient querying

-- Create a function to clean event names (matches cleanEventNameForPinning logic)
CREATE OR REPLACE FUNCTION clean_event_name(event_name TEXT)
RETURNS TEXT AS $$
BEGIN
  IF event_name IS NULL OR event_name = '' THEN
    RETURN event_name;
  END IF;

  -- Remove parentheses and their content
  event_name := TRIM(REGEXP_REPLACE(event_name, '\s*\([^)]*\)\s*', ' ', 'g'));

  -- Remove multiple spaces
  event_name := TRIM(REGEXP_REPLACE(event_name, '\s+', ' ', 'g'));

  -- Remove leading/trailing special characters
  event_name := TRIM(REGEXP_REPLACE(event_name, '^[^\w]+|[^\w]+$', '', 'g'));

  -- Get base event name (remove date patterns at the end)
  -- Remove dates in parentheses like (May), (Jan), (2024)
  event_name := REGEXP_REPLACE(event_name, '\s*\((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\)', '', 'gi');
  event_name := REGEXP_REPLACE(event_name, '\s*\(\d{4}\)', '', 'g');

  -- Remove month abbreviations at the end like "Sep", "Oct25", "Feb25"
  event_name := REGEXP_REPLACE(event_name, '\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\d{2}$', '', 'i');
  event_name := REGEXP_REPLACE(event_name, '\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$', '', 'i');

  -- Remove year patterns at the end like "2024"
  event_name := REGEXP_REPLACE(event_name, '\s+\d{4}$', '', 'g');

  -- Remove date patterns like "01/15/2024"
  event_name := REGEXP_REPLACE(event_name, '\s+\d{1,2}/\d{1,2}/\d{2,4}$', '', 'g');

  RETURN TRIM(LOWER(event_name));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update all trades that have economic_events
DO $$
DECLARE
  trade_record RECORD;
  updated_events JSONB;
  event_item JSONB;
  event_array JSONB[];
  i INTEGER;
BEGIN
  -- Loop through all trades that have economic_events
  FOR trade_record IN
    SELECT id, economic_events
    FROM trades
    WHERE economic_events IS NOT NULL
      AND economic_events != 'null'::jsonb
      AND jsonb_array_length(economic_events) > 0
  LOOP
    -- Initialize array
    event_array := ARRAY[]::JSONB[];

    -- Process each event in the array
    FOR i IN 0..(jsonb_array_length(trade_record.economic_events) - 1) LOOP
      event_item := trade_record.economic_events->i;

      -- Add cleaned_name field to each event
      event_item := event_item || jsonb_build_object(
        'cleaned_name',
        clean_event_name(event_item->>'name')
      );

      event_array := array_append(event_array, event_item);
    END LOOP;

    -- Convert array back to JSONB and update the trade
    updated_events := to_jsonb(event_array);

    UPDATE trades
    SET economic_events = updated_events,
        updated_at = NOW()
    WHERE id = trade_record.id;
  END LOOP;

  RAISE NOTICE 'Backfilled cleaned_name for all economic events';
END $$;

-- Create an index on the cleaned_name field within the JSONB array for faster queries
-- This uses GIN index on the JSONB path for efficient querying
CREATE INDEX IF NOT EXISTS idx_trades_economic_events_cleaned_name
ON trades USING GIN ((economic_events) jsonb_path_ops);

-- Add a comment explaining the migration
COMMENT ON FUNCTION clean_event_name(TEXT) IS
'Cleans economic event names by removing date suffixes and normalizing.
Matches the cleanEventNameForPinning function in eventNameUtils.ts';
