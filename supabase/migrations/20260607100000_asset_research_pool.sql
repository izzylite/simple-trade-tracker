-- asset_research_pool
-- One shared Gemini output row per asset, upserted in place.
-- status: 'processing' = claimed by a runner (sentinel)
--         'fresh'      = result available, expires_at not yet passed
--         'failed'     = last run errored, expires_at is backoff deadline

CREATE TABLE public.asset_research_pool (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  asset          TEXT        NOT NULL CHECK (char_length(asset) <= 20),
  status         TEXT        NOT NULL DEFAULT 'processing'
                             CHECK (status IN ('processing','fresh','failed')),
  refreshed_at   TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ,
  briefing_html  TEXT,
  briefing_plain TEXT,
  significance   TEXT        CHECK (significance IN ('low','medium','high')),
  queries_used   TEXT[]      DEFAULT '{}',
  error_detail   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per asset, ever (upserted in place by runner)
CREATE UNIQUE INDEX asset_research_pool_asset ON public.asset_research_pool (asset);

-- Fast lookup for dispatcher Phase 1
CREATE INDEX asset_research_pool_status ON public.asset_research_pool (status, expires_at);

ALTER TABLE public.asset_research_pool ENABLE ROW LEVEL SECURITY;
-- Only service role writes; no user reads needed (delivery goes via orion_task_results)
-- No SELECT policy = authenticated users cannot read directly (service role bypasses RLS)

-- RPC: claim an asset slot atomically.
-- Returns TRUE if this call owns the processing slot (inserted or reset from failed).
-- Returns FALSE if the slot is already processing/fresh or in backoff.
CREATE OR REPLACE FUNCTION public.claim_asset_for_research(p_asset TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INT;
BEGIN
  -- Insert new row (asset not yet in pool)
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
