-- Cleanup infrastructure for stale AI conversations.
--
-- Two parts:
--   1. last_accessed_at column — stronger TTL signal than updated_at.
--   2. Nightly cron that prunes conversations untouched in 24 months.
--
-- ===========================================================================
-- Why last_accessed_at instead of updated_at
-- ===========================================================================
-- updated_at only bumps on WRITES (message append, edit-resend, reminder
-- fire). A conversation can carry enduring value — a market regime
-- playbook, a post-mortem, a trade-rule discussion — that surfaces in
-- semantic recall regularly but never gets new messages. updated_at-based
-- cleanup would aggressively prune those.
--
-- last_accessed_at captures the broader notion of "still useful":
--   - High-confidence semantic recall match (similarity >= 0.5)
--   - action="get" transcript fetch by Orion
--   - User opens the conversation in the UI
--
-- Day-gated bumps (`WHERE last_accessed_at < NOW() - INTERVAL '1 day'`)
-- prevent write amplification — at most one UPDATE per row per day across
-- all access patterns. See match_conversations RPC + touch_ai_conversation
-- RPC below for the bump mechanics.
--
-- ===========================================================================
-- Why aggressive prune is correct for this product
-- ===========================================================================
-- For a trading journal, very old conversations carry stale market context
-- that's actively misleading to recall (a 2-year-old "bearish GBPUSD" take
-- applied to today's tape is worse than no context). Pruning at 24 months
-- of zero engagement is a feature.
--
-- Safety guards (NEVER delete):
--   - pinned = true (user's explicit "keep this" signal)
--   - has a pending or firing reminder pointing at it (active scheduled work)
--   - CASCADE on reminders.conversation_id handles terminal-state reminders
--     (fired/failed/cancelled) — they're historical and the messages they
--     appended are dying with the parent anyway.


-- ---------------------------------------------------------------------------
-- 1. last_accessed_at column + backfill
-- ---------------------------------------------------------------------------
ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ;

-- Seed existing rows to GREATEST(updated_at, created_at) — NOT NOW(),
-- because using NOW() would grant every stale conversation a fresh
-- 24-month grace period at deploy time and defeat the whole cleanup.
--
-- IMPORTANT: disable update_ai_conversations_updated_at_trigger during
-- this UPDATE. The trigger fires BEFORE UPDATE and sets updated_at = NOW()
-- on every touched row, which would scramble history-list sort order
-- across the entire table. We disable JUST that trigger by name (not
-- DISABLE TRIGGER ALL) so the image-cleanup triggers stay armed.
ALTER TABLE public.ai_conversations
  DISABLE TRIGGER update_ai_conversations_updated_at_trigger;

UPDATE public.ai_conversations
SET last_accessed_at = GREATEST(updated_at, created_at)
WHERE last_accessed_at IS NULL;

ALTER TABLE public.ai_conversations
  ENABLE TRIGGER update_ai_conversations_updated_at_trigger;

-- Now every row has a value — enforce NOT NULL and default future inserts.
ALTER TABLE public.ai_conversations
  ALTER COLUMN last_accessed_at SET NOT NULL,
  ALTER COLUMN last_accessed_at SET DEFAULT NOW();

COMMENT ON COLUMN public.ai_conversations.last_accessed_at IS
  'Last meaningful access: high-similarity semantic recall hit (>=0.5), action=get fetch, or UI open. Bumped at most once per day per row (day-gated for write-amp). Drives cleanup-stale-ai-conversations TTL.';


-- ---------------------------------------------------------------------------
-- 2. Partial index supporting the cleanup predicate
-- ---------------------------------------------------------------------------
-- Existing idx_ai_conversations_user_pinned_updated leads with user_id —
-- wrong for a table-wide scan on last_accessed_at. Partial WHERE NOT
-- pinned keeps the index small (most rows aren't pinned) and gives the
-- cleanup an index-only scan over just the candidate range.
CREATE INDEX IF NOT EXISTS idx_ai_conversations_stale_cleanup
  ON public.ai_conversations(last_accessed_at)
  WHERE NOT pinned;


-- ---------------------------------------------------------------------------
-- 3. touch_ai_conversation RPC — day-gated bump callable from anywhere
-- ---------------------------------------------------------------------------
-- Used by: action=get path (edge function) and UI conversation-load path
-- (frontend). The day-gate predicate keeps writes capped at 1/day/row even
-- under heavy access. Returns whether the row was actually bumped (true)
-- or skipped due to the gate (false) — useful for telemetry / tests.
--
-- SECURITY DEFINER with explicit ownership check — callers don't need
-- table-level UPDATE grants, but ownership still scopes the bump.
CREATE OR REPLACE FUNCTION public.touch_ai_conversation(
  p_conversation_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bumped AS (
    UPDATE public.ai_conversations
    SET last_accessed_at = NOW()
    WHERE id = p_conversation_id
      AND user_id = p_user_id
      AND last_accessed_at < NOW() - INTERVAL '1 day'
    RETURNING id
  )
  SELECT EXISTS (SELECT 1 FROM bumped);
$$;

REVOKE EXECUTE ON FUNCTION public.touch_ai_conversation(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_ai_conversation(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_ai_conversation(UUID, UUID) TO service_role;

COMMENT ON FUNCTION public.touch_ai_conversation(UUID, UUID) IS
  'Day-gated bump of last_accessed_at. Returns true if updated, false if skipped (already touched within last day). Call from action=get edge path and UI conversation-load path.';


-- ---------------------------------------------------------------------------
-- 4. Batched cleanup function
-- ---------------------------------------------------------------------------
-- Scale-aware design (see feedback_scale_first_implementation memory note):
--   - 500 rows per batch keeps each transaction's lock window <100ms,
--     letting concurrent message-persist writes slot in cleanly between
--     batches.
--   - Capped at 20 batches per cron run (10K rows/night) so a one-time
--     pathological backlog drains over multiple nights instead of one
--     runaway transaction. 10K rows/night × 365 = 3.65M rows/year of
--     headroom — well above any realistic aging rate.
--   - FOR UPDATE SKIP LOCKED never blocks on a row another worker holds.
--   - pg_sleep(0.1) between batches releases CPU/locks so writers breathe.
--   - Returns total rows deleted — pg_cron records this in
--     cron.job_run_details for free monitoring.
CREATE OR REPLACE FUNCTION public.cleanup_stale_ai_conversations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_deleted   INTEGER := 0;
  batch_deleted   INTEGER;
  batch_size      CONSTANT INTEGER := 500;
  max_batches     CONSTANT INTEGER := 20;
BEGIN
  FOR i IN 1..max_batches LOOP
    WITH victims AS (
      SELECT id
      FROM public.ai_conversations
      WHERE last_accessed_at < NOW() - INTERVAL '24 months'
        AND NOT pinned
        AND NOT EXISTS (
          SELECT 1
          FROM public.reminders r
          WHERE r.conversation_id = ai_conversations.id
            AND r.status IN ('pending', 'firing')
        )
      ORDER BY last_accessed_at  -- oldest first; index-friendly
      LIMIT batch_size
      FOR UPDATE SKIP LOCKED
    )
    DELETE FROM public.ai_conversations
    WHERE id IN (SELECT id FROM victims);

    GET DIAGNOSTICS batch_deleted = ROW_COUNT;
    total_deleted := total_deleted + batch_deleted;

    EXIT WHEN batch_deleted = 0;
    PERFORM pg_sleep(0.1);
  END LOOP;

  RETURN total_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_stale_ai_conversations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_ai_conversations() TO service_role;

COMMENT ON FUNCTION public.cleanup_stale_ai_conversations() IS
  'Batched delete of ai_conversations rows with last_accessed_at older than 24 months (not pinned, no pending/firing reminders). 500-row batches, up to 10K rows/call. Called nightly by pg_cron job cleanup-stale-ai-conversations.';


-- ---------------------------------------------------------------------------
-- 5. Schedule nightly at 04:00 UTC
-- ---------------------------------------------------------------------------
-- Offset from cleanup-scheduler (*/15) and cleanup-orion-task-results
-- (03:00) so cleanup work spreads across the early hours.
SELECT cron.schedule(
  'cleanup-stale-ai-conversations',
  '0 4 * * *',
  $$SELECT public.cleanup_stale_ai_conversations()$$
);
