-- Stuck-processing recovery: give the claim a TTL and let the dispatcher
-- reclaim stale 'processing' rows.
--
-- Before: claim_asset_for_research only reclaimed 'failed' rows on conflict, and
-- left expires_at NULL while 'processing'. If a run-asset-research worker was
-- killed mid-flight (platform recycle / wall-clock kill) before markPoolFailed
-- ran, the row stayed 'processing' forever and Phase 1 skipped it on every tick
-- — the asset wedged and never refreshed.
--
-- After: claiming stamps expires_at = now() + 10 min (a claim TTL — safely above
-- the ~150s platform max runtime, so no live run ever exceeds it). A successful
-- run overwrites it (status='fresh', 1h TTL); a failure sets the backoff TTL. If
-- the worker dies, the claim TTL lapses and the ON CONFLICT clause below reclaims
-- the stale 'processing' row on the next dispatch. The dispatcher's Phase 1 is
-- updated in tandem to treat a 'processing' row as in-flight only while its TTL
-- is unexpired.
CREATE OR REPLACE FUNCTION public.claim_asset_for_research(p_asset text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rows INT;
BEGIN
  INSERT INTO public.asset_research_pool (asset, status, expires_at)
  VALUES (p_asset, 'processing', now() + interval '10 minutes')
  ON CONFLICT (asset) DO UPDATE
    SET status       = 'processing',
        error_detail = NULL,
        refreshed_at = NULL,
        expires_at   = now() + interval '10 minutes'
    WHERE public.asset_research_pool.status IN ('failed', 'processing')
      AND (public.asset_research_pool.expires_at IS NULL
           OR public.asset_research_pool.expires_at <= now())
  ;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$function$;
