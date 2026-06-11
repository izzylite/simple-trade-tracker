-- Fix: the per-(user, briefing) dedup guard must be targetable by a bare
-- `ON CONFLICT (user_id, briefing_id)` (what supabase-js upsert emits).
--
-- The original index from 20260609120000 was PARTIAL (`WHERE briefing_id IS NOT
-- NULL`). Postgres cannot infer a partial unique index from a bare ON CONFLICT
-- without the matching predicate (error 42P10), so storeTaskResult's upsert
-- failed silently and no thin rows were ever delivered.
--
-- A non-partial unique index has identical dedup semantics here: NULL briefing_id
-- rows (legacy / non-pool deliveries) are treated as DISTINCT under the default
-- NULLS DISTINCT behaviour, so they remain unconstrained, while non-null
-- briefing_id pairs are deduped — and it IS targetable by the ON CONFLICT clause.
DROP INDEX IF EXISTS public.uq_orion_task_results_user_briefing;
CREATE UNIQUE INDEX uq_orion_task_results_user_briefing
  ON public.orion_task_results (user_id, briefing_id);
