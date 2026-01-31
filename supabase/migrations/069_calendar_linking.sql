-- =====================================================
-- Migration: Calendar Linking
-- =====================================================
-- Adds one-way calendar linking for automatic trade sync
-- Trades created in source calendar are copied to target calendar
-- Sync window: 24 hours (after that, target trade becomes independent)

-- Add linking field to calendars table
ALTER TABLE calendars
ADD COLUMN IF NOT EXISTS linked_to_calendar_id UUID REFERENCES calendars(id) ON DELETE SET NULL;

-- Prevent self-linking (drop first if exists to make migration idempotent)
ALTER TABLE calendars DROP CONSTRAINT IF EXISTS no_self_link;
ALTER TABLE calendars
ADD CONSTRAINT no_self_link CHECK (linked_to_calendar_id IS NULL OR linked_to_calendar_id != id);

-- Add sync tracking fields to trades table
ALTER TABLE trades
ADD COLUMN IF NOT EXISTS source_trade_id UUID REFERENCES trades(id) ON DELETE SET NULL;

ALTER TABLE trades
ADD COLUMN IF NOT EXISTS is_synced_copy BOOLEAN DEFAULT false;

-- Index for finding synced trades by source
CREATE INDEX IF NOT EXISTS idx_trades_source_trade_id
ON trades(source_trade_id)
WHERE source_trade_id IS NOT NULL;

-- Index for finding calendars with links
CREATE INDEX IF NOT EXISTS idx_calendars_linked_to
ON calendars(linked_to_calendar_id)
WHERE linked_to_calendar_id IS NOT NULL;

COMMENT ON COLUMN calendars.linked_to_calendar_id IS
  'Target calendar ID for one-way trade sync. Trades created here are copied to the linked calendar.';

COMMENT ON COLUMN trades.source_trade_id IS
  'Reference to original trade if this is a synced copy. Used for update/delete propagation within 24hr window.';

COMMENT ON COLUMN trades.is_synced_copy IS
  'True if this trade was auto-created by calendar linking. Prevents sync loops.';
