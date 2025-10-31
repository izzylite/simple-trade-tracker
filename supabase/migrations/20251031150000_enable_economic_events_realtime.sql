-- Fix realtime for economic_events table
-- The issue was that replica identity was set to DEFAULT (only sends primary key)
-- This caused channel errors because RLS policies couldn't properly evaluate permissions
--
-- Solution: Set replica identity to FULL to send all column values in realtime updates
-- This is required for realtime subscriptions to work properly with RLS policies

ALTER TABLE economic_events REPLICA IDENTITY FULL;

-- Add comment to document the realtime configuration
COMMENT ON TABLE economic_events IS 'Economic calendar events with realtime updates enabled. Replica identity set to FULL for RLS compatibility.';
