-- =====================================================
-- ADD STOP LOSS AND TAKE PROFIT FIELDS
-- =====================================================
-- This migration adds stop_loss and take_profit fields to the trades table

-- Add stop_loss and take_profit columns
ALTER TABLE trades
ADD COLUMN stop_loss DECIMAL(15,8),
ADD COLUMN take_profit DECIMAL(15,8);

-- Add comments for documentation
COMMENT ON COLUMN trades.stop_loss IS 'Stop loss price for the trade';
COMMENT ON COLUMN trades.take_profit IS 'Take profit price for the trade';

