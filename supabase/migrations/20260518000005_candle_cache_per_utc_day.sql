-- ============================================================
-- Candle Cache: switch from per-range to per-UTC-day rows
-- ============================================================
--
-- The first cut (20260518000004) keyed each cache row to the exact
-- (start_date, end_date) window the caller asked for. That meant a
-- request for 12pm-3pm and a later request for 12pm-1pm produced TWO
-- rows, and the second one was a cache miss even though the first row
-- contained every bar it wanted.
--
-- New shape: one row per UTC calendar day per (symbol, interval, tz).
-- Whenever we fetch from the provider for a cacheable past-only
-- request, we expand the API call to cover the FULL UTC day(s) — same
-- API credit cost (Twelve bills per call, not per bar), more bars
-- cached for free.
--
-- Subsequent queries for ANY sub-range that day → hit the row, slice
-- the candles array in JS, return. No row can duplicate another's
-- bars; the natural primary key enforces that.
--
-- Today's day is never cached (bars still forming). Once today rolls
-- past midnight UTC, the next query for that date triggers a full-day
-- fetch + cache.
-- ============================================================

-- Reset the old cache. Entries are <24h old at this point; no backfill.
SELECT cron.unschedule(jobid)
  FROM cron.job
 WHERE jobname = 'cleanup-candle-cache';

DROP TABLE IF EXISTS public.candle_cache;

CREATE TABLE public.candle_cache (
  symbol     TEXT NOT NULL,
  interval   TEXT NOT NULL,
  timezone   TEXT NOT NULL DEFAULT '',
  cache_date DATE NOT NULL,                  -- UTC day this row covers

  -- All bars for that UTC date, oldest→newest. Empty array for past
  -- weekends / holidays (market closed) — that "no data" answer is
  -- permanent and worth caching.
  candles    JSONB NOT NULL,

  source     TEXT NOT NULL,                  -- 'twelvedata' | 'yahoo'
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Equality cols first, range/IN col last — gives the IN-list scan on
  -- cache_date a tight btree prefix to walk within the symbol+interval
  -- +timezone bucket.
  PRIMARY KEY (symbol, interval, timezone, cache_date)
);

CREATE INDEX idx_candle_cache_accessed_at
  ON public.candle_cache (accessed_at);

-- Service-role only; cross-user shared data, RLS bypass on writes.
ALTER TABLE public.candle_cache ENABLE ROW LEVEL SECURITY;

-- LRU purge: anything not READ in 90 days is reaped. Daily at 03:17 UTC.
SELECT cron.schedule(
  'cleanup-candle-cache',
  '17 3 * * *',
  $$DELETE FROM public.candle_cache WHERE accessed_at < NOW() - INTERVAL '90 days';$$
);

COMMENT ON TABLE public.candle_cache IS
  'Per-UTC-day OHLC history cache. One row covers exactly one UTC calendar day of bars for (symbol, interval, timezone). Only past days are cached; requests touching today bypass entirely. LRU-evicted after 90 days unread.';
