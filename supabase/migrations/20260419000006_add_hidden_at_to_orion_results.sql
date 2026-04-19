-- ============================================================
-- Soft-delete for Orion task results
--
-- Users can hide results from their feed without removing them from the
-- database. Hidden rows still feed Orion's dedup context (fetchRecentBriefings
-- and get_recent_orion_briefings intentionally do NOT filter by hidden_at)
-- so Orion doesn't re-report the same catalyst the user already dismissed.
--
-- Hidden rows are cleaned up by the existing 30-day cron (cleanup-orion-task-results).
-- ============================================================

ALTER TABLE public.orion_task_results
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;

-- Partial index: fast feed queries filter WHERE hidden_at IS NULL.
CREATE INDEX IF NOT EXISTS idx_orion_task_results_visible
  ON public.orion_task_results(user_id, created_at DESC)
  WHERE hidden_at IS NULL;

COMMENT ON COLUMN public.orion_task_results.hidden_at IS
  'Soft-delete timestamp. NULL = visible in user feed. Hidden rows still feed Orion dedup.';
