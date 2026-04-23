-- ============================================================
-- Price Cache: shared market-price snapshot cache for Orion tasks
-- ============================================================
--
-- The market_research handler fetches a small watchlist of Yahoo Finance
-- quotes (FX majors, dollar index, VIX, commodities) on every sweep to
-- ground Gemini's "what's moving" claims in real numbers rather than
-- letting it hallucinate pip counts from news headlines.
--
-- These symbols are IDENTICAL across all users running the same
-- `markets` config — two traders both watching "forex + commodities"
-- pull the same 10 symbols.
--
-- Without caching: N users × 10 symbols × (48 runs/day @ 30-min) = 480N
-- Yahoo calls/day. With a 60s cache those collapse to at most 1,440/day
-- regardless of user count.
--
-- Separate from serper_cache because the payload schema differs and
-- because the price source is expected to be swapped to a licensed
-- provider (Twelve Data Grow tier or similar) when the app monetizes —
-- keeping concerns isolated makes that swap surgical.
-- ============================================================

CREATE TABLE public.price_cache (
  symbol TEXT PRIMARY KEY,
  snapshot JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_price_cache_fetched_at ON public.price_cache (fetched_at);

-- Service-role only; shared data, no per-user access.
ALTER TABLE public.price_cache ENABLE ROW LEVEL SECURITY;

-- Cleanup cron: the longest TTL in use is 60s, so anything > 10 minutes
-- old is definitely stale. Run every 10 minutes, mirroring serper_cache.
SELECT cron.schedule(
  'cleanup-price-cache',
  '*/10 * * * *',
  $$DELETE FROM public.price_cache WHERE fetched_at < NOW() - INTERVAL '10 minutes';$$
);

COMMENT ON TABLE public.price_cache IS
  'Short-lived cache of market-price snapshots (Yahoo Finance source) keyed by symbol, shared across all users running price-aware Orion tasks.';
