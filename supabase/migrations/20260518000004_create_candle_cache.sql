-- ============================================================
-- Candle Cache: shared OHLC history cache for Orion market-data tools
-- ============================================================
--
-- The ai-trading-agent's get_market_data(history) and the per-day
-- session-levels fan-out in include_summary repeatedly fetch the SAME
-- past windows of OHLC bars from Twelve Data / Yahoo:
--
--   - Orion asks "show me SPY 1h last week" multiple ways per chat
--   - include_summary fans out 1× /time_series per UTC day in the window
--     for PDH/PDL + Asia/London/NY session levels
--   - Different users running the same backtest pull identical bars
--
-- Past trading sessions are IMMUTABLE — bars don't change after close
-- (corporate-action splits are the only exception, rare and tolerated).
-- So entries don't need a TTL for freshness; we only cache windows
-- whose end_date is strictly before today's UTC date.
--
-- Eviction is LRU-style: a daily cron purges entries that haven't been
-- read in 90 days. Frequently-hit symbols (SPY, EURUSD) live forever;
-- the long-tail one-off queries get reaped.
--
-- Separate from price_cache because:
--   * Payload is Candle[] (variable size, up to 5000 bars) vs single
--     quote snapshot.
--   * No TTL (price_cache has 60s).
--   * Composite key shape — keying on a deterministic cache_key string
--     (mirroring serper_cache) keeps the index single-column.
-- ============================================================

CREATE TABLE public.candle_cache (
  cache_key TEXT PRIMARY KEY,

  -- Denormalized for debugging / ad-hoc inspection. The cache_key
  -- already encodes these; storing them lets ops run
  -- "what's cached for EURUSD=X" without parsing the key.
  symbol TEXT NOT NULL,
  interval TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  outputsize INT NOT NULL DEFAULT 0,
  timezone TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL,           -- 'twelvedata' | 'yahoo'

  -- Always stored oldest→newest, regardless of source's native order,
  -- so callers don't need to track per-source orientation.
  candles JSONB NOT NULL,

  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- LRU eviction needs an index on accessed_at for the purge query.
CREATE INDEX idx_candle_cache_accessed_at ON public.candle_cache (accessed_at);

-- Service-role only; cross-user shared data, no per-user access.
ALTER TABLE public.candle_cache ENABLE ROW LEVEL SECURITY;

-- LRU purge: anything not READ in 90 days is reaped. Runs once daily
-- at an off-hour to avoid stepping on hourly Orion-task crons.
SELECT cron.schedule(
  'cleanup-candle-cache',
  '17 3 * * *',
  $$DELETE FROM public.candle_cache WHERE accessed_at < NOW() - INTERVAL '90 days';$$
);

COMMENT ON TABLE public.candle_cache IS
  'Shared OHLC history cache for the ai-trading-agent get_market_data(history) and session-levels tools. Only stores windows fully in the past (end_date < today UTC); evicted LRU by accessed_at after 90 days. Payload always oldest→newest.';
