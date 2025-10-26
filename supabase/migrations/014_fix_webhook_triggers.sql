-- Migration: Fix Webhook Triggers to Handle All Operations
-- Description: Updates trade and calendar webhook triggers to fire on INSERT, UPDATE, and DELETE
--              The edge functions will handle the operation type logic
-- Date: 2025-10-24

-- ============================================
-- 1. Fix Trade Webhook Trigger
-- ============================================

-- Drop existing trigger (currently only handles INSERT)
DROP TRIGGER IF EXISTS trigger_trade_changes ON trades;

-- Recreate trigger to handle INSERT, UPDATE, and DELETE
CREATE TRIGGER trigger_trade_changes
  AFTER INSERT OR UPDATE OR DELETE ON trades
  FOR EACH ROW
  EXECUTE FUNCTION notify_trade_changes();

COMMENT ON TRIGGER trigger_trade_changes ON trades IS
'Webhook trigger that calls handle-trade-changes edge function on INSERT, UPDATE, and DELETE operations. The edge function decides how to handle each operation type.';

-- ============================================
-- 2. Update Calendar Webhook Function
-- ============================================

-- Update the function to handle INSERT, UPDATE, and DELETE
CREATE OR REPLACE FUNCTION public.notify_calendar_deletions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_payload jsonb;
  v_edge_function_url text;
  v_service_role_key text;
BEGIN
  -- Get edge function URL and service role key
  v_edge_function_url := current_setting('app.settings.edge_function_url', true);
  v_service_role_key := current_setting('app.settings.service_role_key', true);

  -- Default URL for handle-calendar-changes edge function
  IF v_edge_function_url IS NULL THEN
    v_edge_function_url := 'https://gwubzauelilziaqnsfac.supabase.co/functions/v1/handle-calendar-changes';
  END IF;

  -- Build payload based on operation type
  IF (TG_OP = 'DELETE') THEN
    v_payload := jsonb_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'old_record', row_to_json(OLD)::jsonb,
      'new_record', NULL,
      'calendar_id', OLD.id,
      'user_id', OLD.user_id
    );
  ELSIF (TG_OP = 'UPDATE') THEN
    v_payload := jsonb_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'old_record', row_to_json(OLD)::jsonb,
      'new_record', row_to_json(NEW)::jsonb,
      'calendar_id', NEW.id,
      'user_id', NEW.user_id
    );
  ELSIF (TG_OP = 'INSERT') THEN
    v_payload := jsonb_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'old_record', NULL,
      'new_record', row_to_json(NEW)::jsonb,
      'calendar_id', NEW.id,
      'user_id', NEW.user_id
    );
  END IF;

  -- Send HTTP POST request
  PERFORM net.http_post(
    url := v_edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(v_service_role_key, current_setting('request.jwt.claim.sub', true))
    ),
    body := v_payload
  );

  -- Return appropriate record
  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$;

-- ============================================
-- 3. Fix Calendar Webhook Trigger
-- ============================================

-- Drop existing trigger (currently only handles DELETE)
DROP TRIGGER IF EXISTS trigger_calendar_deletions ON calendars;

-- Recreate trigger to handle INSERT, UPDATE, and DELETE
-- Renamed to reflect it handles all changes, not just deletions
CREATE TRIGGER trigger_calendar_changes
  AFTER INSERT OR UPDATE OR DELETE ON calendars
  FOR EACH ROW
  EXECUTE FUNCTION notify_calendar_deletions();

COMMENT ON TRIGGER trigger_calendar_changes ON calendars IS
'Webhook trigger that calls handle-calendar-changes edge function on INSERT, UPDATE, and DELETE operations. The edge function decides how to handle each operation type.';

-- Note: The function is still named notify_calendar_deletions for backward compatibility
-- but now handles all operations

-- ============================================
-- 4. Verify Triggers Were Created
-- ============================================

-- Query to verify both triggers exist and are enabled
DO $$
DECLARE
  trade_trigger_count INTEGER;
  calendar_trigger_count INTEGER;
BEGIN
  -- Check trade trigger
  SELECT COUNT(*) INTO trade_trigger_count
  FROM pg_trigger
  WHERE tgname = 'trigger_trade_changes'
    AND tgrelid = 'trades'::regclass
    AND tgenabled = 'O';

  IF trade_trigger_count = 0 THEN
    RAISE EXCEPTION 'Trade webhook trigger was not created correctly';
  END IF;

  -- Check calendar trigger
  SELECT COUNT(*) INTO calendar_trigger_count
  FROM pg_trigger
  WHERE tgname = 'trigger_calendar_changes'
    AND tgrelid = 'calendars'::regclass
    AND tgenabled = 'O';

  IF calendar_trigger_count = 0 THEN
    RAISE EXCEPTION 'Calendar webhook trigger was not created correctly';
  END IF;

  RAISE NOTICE 'Webhook triggers successfully created and enabled';
  RAISE NOTICE 'Trade trigger: % (handles INSERT, UPDATE, DELETE)', trade_trigger_count;
  RAISE NOTICE 'Calendar trigger: % (handles INSERT, UPDATE, DELETE)', calendar_trigger_count;
END $$;

-- ============================================
-- 5. Add Documentation Comments
-- ============================================

COMMENT ON FUNCTION notify_trade_changes() IS
'Webhook function that sends trade changes (INSERT, UPDATE, DELETE) to handle-trade-changes edge function via pg_net. The function builds a payload with operation type, old_record, and new_record, allowing the edge function to handle each operation appropriately.';

COMMENT ON FUNCTION notify_calendar_deletions() IS
'Webhook function that sends calendar changes (INSERT, UPDATE, DELETE) to handle-calendar-changes edge function via pg_net. Despite the name suggesting only deletions, this function now handles all operations. The edge function receives the operation type and decides how to process it.';
