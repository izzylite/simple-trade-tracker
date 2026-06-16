-- Scale fix: index orion_task_results.briefing_id on its own.
--
-- The dedup unique index is (user_id, briefing_id) with user_id leading, so it
-- serves the RLS EXISTS check (both columns equality) but CANNOT serve a
-- briefing_id-only lookup. The nightly orphan-cleanup cron
-- (orion-briefings-delete-orphaned) filters `NOT EXISTS (SELECT 1 FROM
-- orion_task_results r WHERE r.briefing_id = b.id)` with no user_id predicate,
-- so without this index it scans orion_task_results once per candidate briefing
-- — O(briefings x results) every night. Trivial today, but this feature targets
-- thousands of users (millions of result rows).
--
-- Partial (briefing_id IS NOT NULL) because legacy/non-pool rows have NULL
-- briefing_id and never need this lookup; the predicate is implied by the
-- cron's equality filter, so the planner can still use it. This index is NOT
-- for ON CONFLICT (that targets the non-partial unique index).
CREATE INDEX IF NOT EXISTS idx_orion_task_results_briefing_id
  ON public.orion_task_results (briefing_id)
  WHERE briefing_id IS NOT NULL;
