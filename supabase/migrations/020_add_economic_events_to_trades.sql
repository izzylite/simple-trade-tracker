-- Add economic_events column to trades table
-- This stores a denormalized copy of economic events for quick access
-- The canonical source remains the trade_economic_events junction table
-- Created: 2025-10-27

-- =====================================================
-- ADD ECONOMIC_EVENTS COLUMN
-- =====================================================
-- Add JSONB column to store economic events array
ALTER TABLE trades
ADD COLUMN IF NOT EXISTS economic_events JSONB DEFAULT '[]'::jsonb;

-- =====================================================
-- ADD INDEX FOR ECONOMIC EVENTS QUERIES
-- =====================================================
-- Add GIN index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_trades_economic_events ON trades USING GIN (economic_events);

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON COLUMN trades.economic_events IS 'Denormalized array of economic events for quick access. Canonical source is trade_economic_events junction table.';
COMMENT ON INDEX idx_trades_economic_events IS 'GIN index for efficient JSONB queries on economic_events column';

