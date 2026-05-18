-- TEMPORARY debug table created to diagnose why candle_cache wasn't
-- populating after Orion queries. Dropped in the next migration once
-- the root cause was found (outputsize=N at 1day was bypassing cache;
-- the wrapper now converts that to a closed-past UTC window).
--
-- Kept in migration history because it was applied to the remote DB
-- and dropping it requires the table to have existed. Replay on a
-- fresh database creates then drops in sequence — effectively a no-op.
CREATE TABLE IF NOT EXISTS public.candle_cache_debug (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  phase TEXT NOT NULL,
  symbol TEXT,
  interval TEXT,
  start_date TEXT,
  end_date TEXT,
  outputsize INT,
  has_supabase BOOLEAN,
  past_days_count INT,
  cached_count INT,
  missing_count INT,
  today_in_range BOOLEAN,
  write_count INT,
  error TEXT
);
ALTER TABLE public.candle_cache_debug ENABLE ROW LEVEL SECURITY;
