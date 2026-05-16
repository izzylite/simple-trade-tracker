-- Migration: Drop calendars.pinned_events column.
--
-- Pinned events moved to users.pinned_events in the previous migration.
-- All client + edge-function code now reads/writes through that column,
-- so calendars.pinned_events is dead weight.
--
-- IRREVERSIBLE. Backup recovered via prior migration's backfill if needed.

ALTER TABLE calendars DROP COLUMN IF EXISTS pinned_events;
