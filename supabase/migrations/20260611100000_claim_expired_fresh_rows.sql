-- Fix: expired-FRESH pool rows could never be reclaimed, deadlocking the
-- hourly refresh cycle.
--
-- claim_asset_for_research's ON CONFLICT reclaim was scoped to
-- status IN ('failed','processing'). A row that finished a cycle sits at
-- status='fresh' with expires_at = refreshed_at + 1h; once that lapses the
-- dispatcher correctly stops treating it as fresh and tries to claim — but the
-- RPC's WHERE matched nothing, returned false, and Phase 1 skipped the asset.
-- Every subsequent tick repeated this, so the asset never refreshed again
-- (observed: EURUSD frozen for ~42h after its last manual cycle). Manual
-- testing always reset status='failed' first, which masked the natural path.
--
-- The TTL is the single source of truth for "protected": an unexpired row of
-- ANY status (fresh = still current, processing = in-flight claim TTL,
-- failed = backoff) must not be reclaimed, and an expired row of any status
-- is fair game. So the reclaim guard is just the expires_at check.
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
    WHERE public.asset_research_pool.expires_at IS NULL
       OR public.asset_research_pool.expires_at <= now()
  ;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$function$;
