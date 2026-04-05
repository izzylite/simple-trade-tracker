-- Migration: Add broadcast trigger for calendars table
-- When calendars.notes (or any other calendar field) is updated,
-- broadcast the change so the frontend can update its local state.

CREATE OR REPLACE FUNCTION trigger_broadcast_calendar_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'calendar-' || NEW.id::text,
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS calendars_broadcast_changes ON calendars;
CREATE TRIGGER calendars_broadcast_changes
  AFTER UPDATE OF notes ON calendars
  FOR EACH ROW EXECUTE FUNCTION trigger_broadcast_calendar_changes();

COMMENT ON FUNCTION trigger_broadcast_calendar_changes() IS
  'Broadcasts calendar UPDATE events to realtime. Topic: calendar-{id}';

COMMENT ON TRIGGER calendars_broadcast_changes ON calendars IS
  'Broadcasts UPDATE OF notes events to realtime subscribers on topic calendar-{id}';
