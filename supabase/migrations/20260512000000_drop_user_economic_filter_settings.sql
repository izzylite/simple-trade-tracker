-- Migration: Drop user-level economic filter settings.
--
-- Reverts 20260508000003. With the calendar-picker removed and the Events
-- page scoped to the currently-selected calendar, filter preferences belong
-- on the calendar row (calendars.economic_calendar_filters) so the Events
-- page and the Home page panel/drawer share a single source of truth.
-- No data is preserved — defaults reapply on first read.

ALTER TABLE users
  DROP COLUMN IF EXISTS economic_filter_settings;
