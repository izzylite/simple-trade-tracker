-- Supabase Edge Functions Database Triggers Setup
-- Run this SQL in your Supabase SQL Editor after deploying Edge Functions

-- Enable HTTP extension for webhooks
CREATE EXTENSION IF NOT EXISTS http;

-- =============================================================================
-- TRADE CHANGES TRIGGER
-- =============================================================================

-- Create trigger function for trade changes
CREATE OR REPLACE FUNCTION handle_trade_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Call Edge Function via HTTP request
  PERFORM net.http_post(
    url := 'https://gwubzauelilziaqnsfac.supabase.co/functions/v1/handle-trade-changes',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key', true) || '"}',
    body := json_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'old_record', CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
      'new_record', CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN row_to_json(NEW) ELSE NULL END,
      'calendar_id', COALESCE(NEW.calendar_id, OLD.calendar_id),
      'user_id', COALESCE(NEW.user_id, OLD.user_id)
    )::text
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger on trades table
DROP TRIGGER IF EXISTS trade_changes_trigger ON trades;
CREATE TRIGGER trade_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON trades
  FOR EACH ROW EXECUTE FUNCTION handle_trade_changes();

-- =============================================================================
-- CALENDAR DELETION TRIGGER
-- =============================================================================

-- Create trigger function for calendar deletion
CREATE OR REPLACE FUNCTION handle_calendar_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- Call Edge Function for cleanup
  PERFORM net.http_post(
    url := 'https://gwubzauelilziaqnsfac.supabase.co/functions/v1/cleanup-deleted-calendar',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key', true) || '"}',
    body := json_build_object(
      'calendar_id', OLD.id,
      'user_id', OLD.user_id,
      'calendar_data', row_to_json(OLD)
    )::text
  );
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on calendars table
DROP TRIGGER IF EXISTS calendar_deletion_trigger ON calendars;
CREATE TRIGGER calendar_deletion_trigger
  AFTER DELETE ON calendars
  FOR EACH ROW EXECUTE FUNCTION handle_calendar_deletion();

-- =============================================================================
-- CONFIGURATION SETTINGS
-- =============================================================================

-- Set service role key for triggers (replace with your actual service role key)
-- This should be set as a database setting for security
-- ALTER DATABASE postgres SET app.service_role_key = 'your-service-role-key-here';

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Verify triggers are created
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
  AND trigger_name IN ('trade_changes_trigger', 'calendar_deletion_trigger')
ORDER BY trigger_name;

-- Verify functions are created
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('handle_trade_changes', 'handle_calendar_deletion')
ORDER BY routine_name;

-- =============================================================================
-- TESTING TRIGGERS (Optional - for development/testing)
-- =============================================================================

-- Test trade changes trigger (uncomment to test)
/*
-- Insert a test trade
INSERT INTO trades (id, calendar_id, user_id, symbol, direction, entry_price, quantity, date, status, tags, created_at, updated_at)
VALUES (
  'test-trade-' || gen_random_uuid(),
  'your-calendar-id-here',
  'your-user-id-here',
  'EUR/USD',
  'long',
  1.1000,
  1.0,
  CURRENT_DATE,
  'closed',
  ARRAY['Strategy:Test'],
  NOW(),
  NOW()
);

-- Update the test trade
UPDATE trades 
SET tags = ARRAY['Strategy:Updated'] 
WHERE id LIKE 'test-trade-%';

-- Delete the test trade
DELETE FROM trades WHERE id LIKE 'test-trade-%';
*/

-- =============================================================================
-- CLEANUP (if needed)
-- =============================================================================

-- To remove triggers and functions (uncomment if needed)
/*
DROP TRIGGER IF EXISTS trade_changes_trigger ON trades;
DROP TRIGGER IF EXISTS calendar_deletion_trigger ON calendars;
DROP FUNCTION IF EXISTS handle_trade_changes();
DROP FUNCTION IF EXISTS handle_calendar_deletion();
*/

-- =============================================================================
-- NOTES
-- =============================================================================

/*
IMPORTANT SETUP STEPS:

1. Replace the Supabase project URL in the trigger functions:
   - Change 'gwubzauelilziaqnsfac.supabase.co' to your actual project URL

2. Set the service role key as a database setting:
   ALTER DATABASE postgres SET app.service_role_key = 'your-actual-service-role-key';

3. Ensure the http extension is enabled:
   CREATE EXTENSION IF NOT EXISTS http;

4. Test the triggers with sample data to ensure they work correctly

5. Monitor the Edge Functions logs in Supabase dashboard to verify triggers are firing

6. Consider adding error handling and retry logic for webhook failures if needed

SECURITY CONSIDERATIONS:
- The service role key should be stored securely as a database setting
- Webhook URLs should use HTTPS
- Consider implementing webhook signature verification for additional security
- Monitor webhook calls for unusual activity

PERFORMANCE CONSIDERATIONS:
- Triggers fire synchronously, so Edge Functions should respond quickly
- Consider using background tasks for heavy operations
- Monitor database performance impact of triggers
- Add appropriate indexes on frequently queried columns
*/
