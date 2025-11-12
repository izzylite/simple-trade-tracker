-- =====================================================
-- Migration: Migrate from postgres_changes to Broadcast
-- =====================================================
-- Supabase recommends using broadcast for realtime updates instead of postgres_changes
-- This migration creates broadcast triggers for trades and economic_events tables
--
-- Benefits of broadcast approach:
-- 1. Works seamlessly with RLS policies
-- 2. No need for REPLICA IDENTITY FULL
-- 3. More reliable and performant
-- 4. Recommended by Supabase documentation
--
-- References:
-- - https://supabase.com/docs/guides/realtime/broadcast
-- - https://supabase.com/docs/guides/realtime/postgres-changes

-- =====================================================
-- 1. Create Broadcast Trigger for Trades
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_broadcast_trade_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Broadcast trade changes to realtime
  -- Topic format: trades-{calendar_id}
  PERFORM realtime.broadcast_changes(
    'trades-' || COALESCE(NEW.calendar_id, OLD.calendar_id)::text, -- topic
    TG_OP,                                                          -- event (INSERT/UPDATE/DELETE)
    TG_OP,                                                          -- operation
    TG_TABLE_NAME,                                                  -- table
    TG_TABLE_SCHEMA,                                                -- schema
    NEW,                                                            -- new record
    OLD                                                             -- old record
  );
  RETURN NULL;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trades_broadcast_changes ON trades;

-- Create trigger on trades table
CREATE TRIGGER trades_broadcast_changes
  AFTER INSERT OR UPDATE OR DELETE ON trades
  FOR EACH ROW
  EXECUTE FUNCTION trigger_broadcast_trade_changes();

COMMENT ON FUNCTION trigger_broadcast_trade_changes() IS 
  'Broadcasts trade changes to realtime using realtime.broadcast_changes(). Topic: trades-{calendar_id}';

COMMENT ON TRIGGER trades_broadcast_changes ON trades IS
  'Broadcasts INSERT/UPDATE/DELETE events to realtime subscribers on topic trades-{calendar_id}';

-- =====================================================
-- 2. Create Broadcast Trigger for Economic Events
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_broadcast_economic_event_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Broadcast economic event changes to realtime
  -- Topic format: economic-events (global topic for all events)
  PERFORM realtime.broadcast_changes(
    'economic-events',  -- topic (global for all economic events)
    TG_OP,              -- event (INSERT/UPDATE/DELETE)
    TG_OP,              -- operation
    TG_TABLE_NAME,      -- table
    TG_TABLE_SCHEMA,    -- schema
    NEW,                -- new record
    OLD                 -- old record
  );
  RETURN NULL;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS economic_events_broadcast_changes ON economic_events;

-- Create trigger on economic_events table
CREATE TRIGGER economic_events_broadcast_changes
  AFTER INSERT OR UPDATE OR DELETE ON economic_events
  FOR EACH ROW
  EXECUTE FUNCTION trigger_broadcast_economic_event_changes();

COMMENT ON FUNCTION trigger_broadcast_economic_event_changes() IS 
  'Broadcasts economic event changes to realtime using realtime.broadcast_changes(). Topic: economic-events';

COMMENT ON TRIGGER economic_events_broadcast_changes ON economic_events IS
  'Broadcasts INSERT/UPDATE/DELETE events to realtime subscribers on topic economic-events';

-- =====================================================
-- 3. Verify Broadcast Authorization Policies
-- =====================================================
-- These policies were created in enable_realtime_broadcast_authorization.sql
-- Verify they exist:

DO $$
BEGIN
  -- Check if policies exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'realtime' 
    AND tablename = 'messages' 
    AND policyname = 'Authenticated users can receive broadcasts'
  ) THEN
    RAISE NOTICE 'Creating RLS policy: Authenticated users can receive broadcasts';
    EXECUTE 'CREATE POLICY "Authenticated users can receive broadcasts"
      ON "realtime"."messages"
      FOR SELECT
      TO authenticated
      USING (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'realtime' 
    AND tablename = 'messages' 
    AND policyname = 'System can send broadcasts'
  ) THEN
    RAISE NOTICE 'Creating RLS policy: System can send broadcasts';
    EXECUTE 'CREATE POLICY "System can send broadcasts"
      ON "realtime"."messages"
      FOR INSERT
      TO authenticated
      WITH CHECK (true)';
  END IF;
END $$;

-- =====================================================
-- 4. Revert REPLICA IDENTITY to DEFAULT
-- =====================================================
-- Since we're using broadcast instead of postgres_changes,
-- we no longer need REPLICA IDENTITY FULL

ALTER TABLE trades REPLICA IDENTITY DEFAULT;
ALTER TABLE calendars REPLICA IDENTITY DEFAULT;
ALTER TABLE economic_events REPLICA IDENTITY DEFAULT;

-- Update table comments
COMMENT ON TABLE trades IS 'Trading records with realtime broadcast updates enabled.';
COMMENT ON TABLE calendars IS 'Trading calendars with realtime broadcast updates enabled.';
COMMENT ON TABLE economic_events IS 'Economic calendar events with realtime broadcast updates enabled.';

-- =====================================================
-- 5. Verification Queries
-- =====================================================

-- Verify replica identity is back to DEFAULT
-- SELECT relname, relreplident FROM pg_class WHERE relname IN ('trades', 'calendars', 'economic_events');
-- Expected: relreplident = 'd' (DEFAULT) for all tables

-- Verify triggers exist
-- SELECT tgname, tgrelid::regclass, tgfoid::regproc FROM pg_trigger WHERE tgname LIKE '%broadcast%';

-- Verify RLS policies on realtime.messages
-- SELECT * FROM pg_policies WHERE schemaname = 'realtime' AND tablename = 'messages';

