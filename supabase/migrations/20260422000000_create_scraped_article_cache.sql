-- ============================================================
-- Scraped Article Cache: shared article-content cache for Orion
-- ============================================================
--
-- The market_research handler can (optionally, via tool-use) ask Gemini to
-- scrape full article text for URLs whose headlines suggest a major catalyst
-- (central bank action, geopolitical shock, data surprise). Snippets alone
-- are often too thin to judge impact — 120 chars of "Fed signals pivot" is
-- very different from 3,000 chars of the actual speech transcript.
--
-- Article content is effectively immutable once published, so a 1-hour TTL
-- is safe. Every user running market_research against the same news cycle
-- hits the same URLs (Reuters Fed decision story, WSJ CPI print), so caching
-- collapses N users × ~3 scrapes/briefing down to ~3 scrapes per URL per hour.
--
-- 2-hour cleanup window gives us a 1-hour safety margin above the app TTL.
-- ============================================================

CREATE TABLE public.scraped_article_cache (
  url TEXT PRIMARY KEY,
  article JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scraped_article_cache_fetched_at
  ON public.scraped_article_cache (fetched_at);

-- Service-role only; shared data, no per-user access.
ALTER TABLE public.scraped_article_cache ENABLE ROW LEVEL SECURITY;

SELECT cron.schedule(
  'cleanup-scraped-article-cache',
  '*/15 * * * *',
  $$DELETE FROM public.scraped_article_cache WHERE fetched_at < NOW() - INTERVAL '2 hours';$$
);

COMMENT ON TABLE public.scraped_article_cache IS
  'Short-lived cache of Serper-scraped article content, shared across all users running Orion market-research tasks. 1h app TTL, 2h cleanup.';
