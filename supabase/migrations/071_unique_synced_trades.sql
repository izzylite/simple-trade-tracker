-- =====================================================
-- Migration: Unique Constraint for Synced Trades
-- =====================================================
-- Prevents duplicate synced trades if webhook fires multiple times
-- Only one synced copy per source trade per target calendar

-- Create unique partial index (only for synced trades)
CREATE UNIQUE INDEX IF NOT EXISTS idx_trades_source_calendar_unique
ON trades(source_trade_id, calendar_id)
WHERE source_trade_id IS NOT NULL;

COMMENT ON INDEX idx_trades_source_calendar_unique IS
  'Ensures only one synced copy of a trade exists per target calendar. Prevents duplicates from webhook race conditions.';
