-- Normalized briefing delivery: store each briefing once, reference per-user.

-- 1. Immutable shared briefing snapshots (one row per delivered research cycle).
CREATE TABLE public.asset_research_briefings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset         TEXT NOT NULL,
  content_html  TEXT NOT NULL,
  content_plain TEXT NOT NULL,
  significance  TEXT CHECK (significance IN ('low','medium','high')),
  citations     JSONB,
  tool_calls    JSONB,
  generated_at  TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_asset_research_briefings_asset
  ON public.asset_research_briefings (asset, created_at DESC);

-- 2. Pool points at the current snapshot.
ALTER TABLE public.asset_research_pool
  ADD COLUMN current_briefing_id UUID REFERENCES public.asset_research_briefings(id);

-- 3. Result rows become thin envelopes.
ALTER TABLE public.orion_task_results
  ADD COLUMN briefing_id UUID REFERENCES public.asset_research_briefings(id),
  ADD COLUMN title TEXT;
ALTER TABLE public.orion_task_results
  ALTER COLUMN content_html  DROP NOT NULL,
  ALTER COLUMN content_plain DROP NOT NULL;

-- One delivery per (user, briefing): a later due-tick never re-delivers the same briefing.
CREATE UNIQUE INDEX uq_orion_task_results_user_briefing
  ON public.orion_task_results (user_id, briefing_id)
  WHERE briefing_id IS NOT NULL;

-- 4. RLS: a user reads a briefing only if they hold a result referencing it.
ALTER TABLE public.asset_research_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read briefings delivered to them"
  ON public.asset_research_briefings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.orion_task_results r
    WHERE r.briefing_id = asset_research_briefings.id
      AND r.user_id = auth.uid()
  ));

CREATE POLICY "Service role inserts briefings"
  ON public.asset_research_briefings FOR INSERT WITH CHECK (true);

-- 5. Cleanup: delete briefings nothing references (aged out, or below-threshold
--    cycles nobody received). Replaces the content-blanking strip cron.
SELECT cron.unschedule('orion-results-strip-old-market-research')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'orion-results-strip-old-market-research');

SELECT cron.schedule(
  'orion-briefings-delete-orphaned',
  '0 3 * * *',
  $$DELETE FROM public.asset_research_briefings b
    WHERE NOT EXISTS (
      SELECT 1 FROM public.orion_task_results r WHERE r.briefing_id = b.id
    )
    AND b.created_at < now() - INTERVAL '7 days';$$
);
