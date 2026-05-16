-- Migration: Add user-level economic filter settings.
--
-- Mirrors users.pinned_events: a JSONB column on users that stores the
-- trader's preferred Events page filters (impact, currencies, upcoming
-- only). Replaces per-calendar filter persistence for the Events page.
-- Defaults are applied client-side when the column is empty.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS economic_filter_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN users.economic_filter_settings IS
  'User-level Events page filter preferences. Schema: '
  '{ impactFilter?: "High"|"Medium"|"Low"|"all", currencies?: Currency[], onlyUpcoming?: boolean }.';
