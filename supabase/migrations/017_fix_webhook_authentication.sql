-- =====================================================
-- Migration: Fix Webhook Authentication
-- =====================================================
-- Issue: Webhooks are getting 401 errors because they don't have proper authentication
-- Fix: Use Supabase secrets to retrieve the service role key from environment variables

-- Note: Make sure SUPABASE_SERVICE_ROLE_KEY is set in Supabase Dashboard:
-- Project Settings > Edge Functions > Manage secrets
-- Add: SUPABASE_SERVICE_ROLE_KEY = <your-service-role-key>

-- Update notify_trade_changes to use the service role key from secrets
CREATE OR REPLACE FUNCTION notify_trade_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payload jsonb;
  v_edge_function_url text;
  v_service_role_key text;
BEGIN
  -- Get service role key from Supabase Vault
  SELECT decrypted_secret INTO v_service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';

  -- Edge function URL
  v_edge_function_url := 'https://gwubzauelilziaqnsfac.supabase.co/functions/v1/handle-trade-changes';

  -- Build the webhook payload based on operation type
  IF (TG_OP = 'DELETE') THEN
    v_payload := jsonb_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'old_record', row_to_json(OLD)::jsonb,
      'calendar_id', OLD.calendar_id,
      'user_id', OLD.user_id
    );
  ELSIF (TG_OP = 'UPDATE') THEN
    v_payload := jsonb_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'old_record', row_to_json(OLD)::jsonb,
      'new_record', row_to_json(NEW)::jsonb,
      'calendar_id', NEW.calendar_id,
      'user_id', NEW.user_id
    );
  ELSIF (TG_OP = 'INSERT') THEN
    v_payload := jsonb_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'new_record', row_to_json(NEW)::jsonb,
      'calendar_id', NEW.calendar_id,
      'user_id', NEW.user_id
    );
  END IF;

  -- Send HTTP POST request to edge function using pg_net
  PERFORM net.http_post(
    url := v_edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := v_payload
  );

  -- Return the appropriate record
  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Update notify_calendar_deletions to handle all operations (renamed for clarity but keeping function name for backward compatibility)
CREATE OR REPLACE FUNCTION notify_calendar_deletions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payload jsonb;
  v_edge_function_url text;
  v_service_role_key text;
BEGIN
  -- Get service role key from Supabase Vault
  SELECT decrypted_secret INTO v_service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';

  -- Edge function URL
  v_edge_function_url := 'https://gwubzauelilziaqnsfac.supabase.co/functions/v1/handle-calendar-changes';

  -- Build the webhook payload based on operation type
  IF (TG_OP = 'DELETE') THEN
    v_payload := jsonb_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'old_record', row_to_json(OLD)::jsonb,
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
      'new_record', row_to_json(NEW)::jsonb,
      'calendar_id', NEW.id,
      'user_id', NEW.user_id
    );
  END IF;

  -- Send HTTP POST request to edge function using pg_net
  PERFORM net.http_post(
    url := v_edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := v_payload
  );

  -- Return the appropriate record
  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Recreate triggers to ensure they handle INSERT, UPDATE, and DELETE
DROP TRIGGER IF EXISTS trigger_trade_changes ON trades;
CREATE TRIGGER trigger_trade_changes
  AFTER INSERT OR UPDATE OR DELETE ON trades
  FOR EACH ROW
  EXECUTE FUNCTION notify_trade_changes();

DROP TRIGGER IF EXISTS trigger_calendar_changes ON calendars;
DROP TRIGGER IF EXISTS calendar_deletion_trigger ON calendars;
CREATE TRIGGER trigger_calendar_changes
  AFTER INSERT OR UPDATE OR DELETE ON calendars
  FOR EACH ROW
  EXECUTE FUNCTION notify_calendar_deletions();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION notify_trade_changes() TO postgres, authenticated;
GRANT EXECUTE ON FUNCTION notify_calendar_deletions() TO postgres, authenticated;

COMMENT ON FUNCTION notify_trade_changes IS 'Webhook function that sends trade change events to the handle-trade-changes edge function with proper authentication using Supabase Vault';
COMMENT ON FUNCTION notify_calendar_deletions IS 'Webhook function that sends calendar change events to the handle-calendar-changes edge function with proper authentication using Supabase Vault';

COMMENT ON TRIGGER trigger_trade_changes ON trades IS 'Sends trade INSERT, UPDATE, and DELETE events to handle-trade-changes edge function';
COMMENT ON TRIGGER trigger_calendar_changes ON calendars IS 'Sends calendar INSERT, UPDATE, and DELETE events to handle-calendar-changes edge function';
