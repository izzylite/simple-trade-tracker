-- =====================================================
-- Migration: Setup Database Webhooks
-- =====================================================
-- Creates webhooks to trigger edge functions on database changes
-- Requires pg_net extension for HTTP requests

-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =====================================================
-- WEBHOOK: Trade Changes
-- =====================================================
-- Triggers the handle-trade-changes edge function when trades are modified

-- Create a function to send webhook payload to edge function
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
  -- Get edge function URL and service role key from environment
  -- These should be set in Supabase Dashboard -> Project Settings -> Edge Functions
  v_edge_function_url := current_setting('app.settings.edge_function_url', true);
  v_service_role_key := current_setting('app.settings.service_role_key', true);

  -- If environment variables are not set, use a default URL pattern
  -- Format: https://<project-ref>.supabase.co/functions/v1/handle-trade-changes
  IF v_edge_function_url IS NULL THEN
    v_edge_function_url := 'https://gwubzauelilziaqnsfac.supabase.co/functions/v1/handle-trade-changes';
  END IF;

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
  -- This is asynchronous and won't block the database operation
  PERFORM net.http_post(
    url := v_edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(v_service_role_key, current_setting('request.jwt.claim.sub', true))
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

-- Create trigger for trade changes
DROP TRIGGER IF EXISTS trigger_trade_changes ON trades;

CREATE TRIGGER trigger_trade_changes
  AFTER INSERT OR UPDATE OR DELETE ON trades
  FOR EACH ROW
  EXECUTE FUNCTION notify_trade_changes();

COMMENT ON TRIGGER trigger_trade_changes ON trades IS
  'Webhook trigger that sends trade change events to the handle-trade-changes edge function for image cleanup and tag synchronization';

-- =====================================================
-- WEBHOOK: Calendar Deletions (Optional)
-- =====================================================
-- Triggers cleanup when calendars are deleted
-- This can be used for cleaning up calendar-specific resources

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
  -- Get edge function URL and service role key
  v_edge_function_url := current_setting('app.settings.edge_function_url', true);
  v_service_role_key := current_setting('app.settings.service_role_key', true);

  -- Default URL for cleanup-deleted-calendar edge function
  IF v_edge_function_url IS NULL THEN
    v_edge_function_url := 'https://gwubzauelilziaqnsfac.supabase.co/functions/v1/cleanup-deleted-calendar';
  END IF;

  -- Only trigger on DELETE operations for calendars
  IF (TG_OP = 'DELETE') THEN
    v_payload := jsonb_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'old_record', row_to_json(OLD)::jsonb,
      'calendar_id', OLD.id,
      'user_id', OLD.user_id
    );

    -- Send HTTP POST request
    PERFORM net.http_post(
      url := v_edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(v_service_role_key, current_setting('request.jwt.claim.sub', true))
      ),
      body := v_payload
    );
  END IF;

  RETURN OLD;
END;
$$;

-- Create trigger for calendar deletions
DROP TRIGGER IF EXISTS trigger_calendar_deletions ON calendars;

CREATE TRIGGER trigger_calendar_deletions
  AFTER DELETE ON calendars
  FOR EACH ROW
  EXECUTE FUNCTION notify_calendar_deletions();

COMMENT ON TRIGGER trigger_calendar_deletions ON calendars IS
  'Webhook trigger that sends calendar deletion events to the cleanup-deleted-calendar edge function';

-- =====================================================
-- Grant Permissions
-- =====================================================

-- Grant execute permissions on webhook functions
GRANT EXECUTE ON FUNCTION notify_trade_changes() TO postgres, authenticated;
GRANT EXECUTE ON FUNCTION notify_calendar_deletions() TO postgres, authenticated;

-- =====================================================
-- Notes and Configuration
-- =====================================================
--
-- To configure the edge function URLs via environment variables:
--
-- 1. In Supabase Dashboard, go to Project Settings > Custom Domains
-- 2. Set the following custom configurations:
--    - app.settings.edge_function_url = https://<your-project-ref>.supabase.co/functions/v1/handle-trade-changes
--    - app.settings.service_role_key = <your-service-role-key>
--
-- Alternatively, you can update the function URLs directly in the functions above.
--
-- The edge functions should be deployed and active:
-- - handle-trade-changes: Handles image cleanup and tag sync
-- - cleanup-deleted-calendar: Handles calendar resource cleanup
--
