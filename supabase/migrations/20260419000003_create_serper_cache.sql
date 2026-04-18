-- ============================================================
-- Serper Cache: shared-query result cache for Orion tasks
-- ============================================================
--
-- The market_research handler runs a set of baseline macro queries (Fed,
-- ECB, White House, geopolitics, oil, gold, Treasury, tariffs) + breaking-content
-- queries on every sweep. These queries are IDENTICAL across all users —
-- every user hitting "Fed speech today" gets the same Google News result
-- set for the same minute.
--
-- Without caching: N users × 14 shared queries × (48 runs/day @ 30-min) =
--   672N Serper calls/day just on shared queries.
--
-- With 5-min cache: Serper is hit at most once per query per 5-min window,
-- so shared queries collapse to ~288/day total regardless of user count.
-- At 1,000 users that's a ~2,000x reduction in Serper spend.
-- ============================================================

CREATE TABLE public.serper_cache (
  cache_key TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  endpoint TEXT NOT NULL CHECK (endpoint IN ('news', 'search')),
  results JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Used both for TTL lookups and cleanup scans
CREATE INDEX idx_serper_cache_fetched_at ON public.serper_cache (fetched_at);

-- Only the service role (dispatcher / run-orion-task) touches this table.
-- No user-level access; results are shared across all users by design.
ALTER TABLE public.serper_cache ENABLE ROW LEVEL SECURITY;
-- No policies = no one can read/write except service role (which bypasses RLS).

-- Cleanup cron: keep only the last hour of entries. The longest TTL in use
-- is 5 min, so anything > 1 hour old is definitely stale and wasting space.
SELECT cron.schedule(
  'cleanup-serper-cache',
  '*/10 * * * *',
  $$DELETE FROM public.serper_cache WHERE fetched_at < NOW() - INTERVAL '1 hour';$$
);

COMMENT ON TABLE public.serper_cache IS
  'Short-lived cache of Serper API responses for queries shared across users (macro, session, market, breaking). Custom topics and instrument-specific queries bypass this cache.';
