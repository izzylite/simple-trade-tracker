-- Migration: Add year_stats JSONB field to calendars table
-- Purpose: Store pre-calculated yearly and monthly statistics for improved performance
-- Author: Claude Code
-- Date: 2024-12-24

-- Add year_stats column with default empty JSON object
ALTER TABLE calendars
ADD COLUMN IF NOT EXISTS year_stats JSONB DEFAULT '{}'::jsonb;

-- Add GIN index for fast JSONB queries
CREATE INDEX IF NOT EXISTS idx_calendars_year_stats
ON calendars USING GIN (year_stats);

-- Add column comment for documentation
COMMENT ON COLUMN calendars.year_stats IS
'Pre-calculated statistics per year. Structure:
{
  "2024": {
    "year": 2024,
    "yearly_pnl": 5000.50,
    "yearly_growth_percentage": 10.5,
    "total_trades": 150,
    "win_count": 90,
    "loss_count": 60,
    "win_rate": 60.0,
    "best_month_index": 5,
    "best_month_pnl": 1200.00,
    "monthly_stats": [
      {
        "month_index": 0,
        "month_pnl": 500.00,
        "trade_count": 12,
        "win_count": 8,
        "loss_count": 4,
        "growth_percentage": 5.2,
        "account_value_at_start": 9600.00
      },
      ... (array of 12 months, indices 0-11)
    ]
  },
  "2025": { ... }
}

Populated automatically by handle-trade-changes edge function on trade INSERT/UPDATE/DELETE.
Synced to clients via realtime broadcast subscriptions.';
