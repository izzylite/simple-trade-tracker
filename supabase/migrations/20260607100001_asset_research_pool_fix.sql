-- Corrective migration: fix claim_asset_for_research security posture
-- and align significance CHECK with orion_task_results.

-- 1. Recreate function with SET search_path + correct REVOKE/GRANT
CREATE OR REPLACE FUNCTION public.claim_asset_for_research(p_asset TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INT;
BEGIN
  INSERT INTO public.asset_research_pool (asset, status)
  VALUES (p_asset, 'processing')
  ON CONFLICT (asset) DO UPDATE
    SET status       = 'processing',
        error_detail = NULL,
        refreshed_at = NULL,
        expires_at   = NULL
    WHERE public.asset_research_pool.status = 'failed'
      AND (public.asset_research_pool.expires_at IS NULL
           OR public.asset_research_pool.expires_at <= now())
  ;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_asset_for_research(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_asset_for_research(TEXT) TO service_role;

-- 2. Fix significance CHECK to match orion_task_results (no 'critical')
ALTER TABLE public.asset_research_pool
  DROP CONSTRAINT IF EXISTS asset_research_pool_significance_check;

ALTER TABLE public.asset_research_pool
  ADD CONSTRAINT asset_research_pool_significance_check
  CHECK (significance IN ('low','medium','high'));

-- 3. Add asset length constraint
ALTER TABLE public.asset_research_pool
  ADD CONSTRAINT asset_research_pool_asset_length_check
  CHECK (char_length(asset) <= 20);
