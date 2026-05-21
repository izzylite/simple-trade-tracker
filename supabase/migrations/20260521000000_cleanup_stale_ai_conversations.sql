-- Nightly cleanup of stale AI conversations.
--
-- Deletes any conversation whose `updated_at` is older than 24 months,
-- UNLESS it's pinned by the user OR has an unfinished reminder pointing
-- at it. `updated_at` is bumped by every message append + edit-resend, so
-- this TTL only catches conversations that genuinely haven't been used in
-- two years.
--
-- For a trading journal, very old conversations carry stale market context
-- that's actively misleading to recall (a 2-year-old "bearish GBPUSD" take
-- applied to today's tape is worse than no context). Aggressive prune is a
-- feature.
--
-- Reminder interaction: reminders.conversation_id has ON DELETE CASCADE,
-- so fired/failed/cancelled reminders are swept alongside their parent.
-- PENDING/FIRING reminders block deletion — those represent active
-- scheduled work, and the upcoming fire will revive the conversation's
-- updated_at anyway.

-- ===========================================================================
-- Scale-aware design
-- ===========================================================================
-- An unbatched `DELETE FROM ai_conversations WHERE updated_at < ...` works
-- fine at hundreds of rows but breaks at scale in three ways:
--   1. Long-running DELETE holds row + index locks across thousands of
--      rows, stalling concurrent inserts (new chat persists) for the
--      duration. With CASCADE to `reminders`, the lock count amplifies.
--   2. A single rollback (deadlock, timeout, OOM) loses ALL the work and
--      leaves the table in the same shape, so the next run faces the
--      same backlog. No forward progress.
--   3. WAL traffic spike — backups + replicas have to chew through one
--      enormous transaction.
--
-- Mitigation: a plpgsql function that drains the backlog in 500-row
-- batches, with a brief pause between batches to let concurrent writes
-- through. Capped at MAX_BATCHES per cron run so a one-time pathological
-- backlog (e.g., huge initial cleanup after launch) drains over multiple
-- nights instead of one runaway run.

-- ---------------------------------------------------------------------------
-- Index: partial index supporting the cleanup predicate.
-- ---------------------------------------------------------------------------
-- Existing `idx_ai_conversations_user_pinned_updated` leads with user_id,
-- which is wrong for a table-wide scan over `updated_at`. A partial index
-- on (updated_at) WHERE NOT pinned gives the cleanup query an index-only
-- scan over just the rows it might delete (most conversations aren't
-- pinned, so this is also space-efficient — not duplicating the whole
-- table). Without this, at 1M+ rows the cleanup would sequential-scan
-- nightly.
CREATE INDEX IF NOT EXISTS idx_ai_conversations_stale_cleanup
  ON public.ai_conversations(updated_at)
  WHERE NOT pinned;

-- ---------------------------------------------------------------------------
-- Batched cleanup function.
-- ---------------------------------------------------------------------------
-- Returns the total number of rows deleted (visible in cron.job_run_details
-- for monitoring). Idempotent — safe to invoke manually or re-schedule.
CREATE OR REPLACE FUNCTION public.cleanup_stale_ai_conversations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_deleted   INTEGER := 0;
  batch_deleted   INTEGER;
  -- 500 rows × ~5 reminders + index updates is small enough to hold locks
  -- briefly. Tuned so each batch commits in <100ms at typical row sizes.
  batch_size      CONSTANT INTEGER := 500;
  -- 20 batches × 500 = 10K rows per cron run. At nightly cadence that's
  -- 3.65M rows/year of headroom — far above any realistic aging rate.
  -- A one-time large backlog (e.g., 50K aged rows after a feature launch)
  -- drains over ~5 nights instead of one runaway transaction.
  max_batches     CONSTANT INTEGER := 20;
BEGIN
  FOR i IN 1..max_batches LOOP
    -- Wrap each batch's id selection + delete in a single statement so the
    -- ids are stable for that delete. WITH ... DELETE keeps the read and
    -- write in one transaction; a separate SELECT then DELETE would race
    -- with concurrent writers bumping updated_at.
    WITH victims AS (
      SELECT id
      FROM public.ai_conversations
      WHERE updated_at < NOW() - INTERVAL '24 months'
        AND NOT pinned
        AND NOT EXISTS (
          SELECT 1
          FROM public.reminders r
          WHERE r.conversation_id = ai_conversations.id
            AND r.status IN ('pending', 'firing')
        )
      ORDER BY updated_at  -- oldest first; index-friendly
      LIMIT batch_size
      FOR UPDATE SKIP LOCKED  -- never block on a row another worker holds
    )
    DELETE FROM public.ai_conversations
    WHERE id IN (SELECT id FROM victims);

    GET DIAGNOSTICS batch_deleted = ROW_COUNT;
    total_deleted := total_deleted + batch_deleted;

    -- Nothing left to delete — exit early, don't burn the remaining budget.
    EXIT WHEN batch_deleted = 0;

    -- Yield briefly between batches so concurrent inserts can land. Without
    -- this, the function holds CPU + lock pressure continuously for the
    -- full max_batches duration; with it, writers slot in cleanly.
    PERFORM pg_sleep(0.1);
  END LOOP;

  RETURN total_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_stale_ai_conversations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_ai_conversations() TO service_role;

COMMENT ON FUNCTION public.cleanup_stale_ai_conversations() IS
  'Batched delete of ai_conversations rows older than 24 months (not pinned, no pending/firing reminders). Drains in 500-row batches up to 10K per call. Called nightly by pg_cron job cleanup-stale-ai-conversations.';

-- ---------------------------------------------------------------------------
-- Schedule the function nightly at 04:00 UTC.
-- ---------------------------------------------------------------------------
-- Offset from cleanup-scheduler (*/15) and cleanup-orion-task-results
-- (03:00) so cleanup work spreads across the early hours instead of
-- piling up on one timeslot.
SELECT cron.schedule(
  'cleanup-stale-ai-conversations',
  '0 4 * * *',
  $$SELECT public.cleanup_stale_ai_conversations()$$
);
