-- Review fixes for normalized briefing delivery.

-- A) The orphan-delete cron must not touch briefings still referenced by
--    asset_research_pool.current_briefing_id. If an asset's last briefing was
--    delivered to nobody (below every subscriber's threshold) and the asset
--    then goes inactive, the pool keeps pointing at it; deleting it raises an
--    FK violation that aborts the ENTIRE delete statement — killing cleanup
--    for every other orphan, every night. A pool-current briefing is also
--    still deliverable, so it must not be removed anyway.
SELECT cron.unschedule('orion-briefings-delete-orphaned')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'orion-briefings-delete-orphaned');

SELECT cron.schedule(
  'orion-briefings-delete-orphaned',
  '0 3 * * *',
  $$DELETE FROM public.asset_research_briefings b
    WHERE NOT EXISTS (
      SELECT 1 FROM public.orion_task_results r WHERE r.briefing_id = b.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.asset_research_pool p WHERE p.current_briefing_id = b.id
    )
    AND b.created_at < now() - INTERVAL '7 days';$$
);

-- B) Drop the permissive INSERT policies. `WITH CHECK (true)` with no TO
--    clause applies to ALL roles, and Supabase's default grants give
--    anon/authenticated INSERT privilege on public tables — so any signed-in
--    user could insert arbitrary rows. The only writer is the service role,
--    which BYPASSES RLS entirely and never needed these policies.
DROP POLICY IF EXISTS "Service role inserts briefings" ON public.asset_research_briefings;
DROP POLICY IF EXISTS "Service role can insert task results" ON public.orion_task_results;
