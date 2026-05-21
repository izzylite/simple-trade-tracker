-- One-shot: restore updated_at for rows scrambled by the trigger bug
-- fixed in 20260521120000_ai_conversations_updated_at_skip_metadata_only.sql.
--
-- Two scramble shapes existed before the trigger fix:
--   (a) Bulk: match_conversations' UPDATE on last_accessed_at stamped 6+
--       unrelated rows to the same NOW() microsecond.
--   (b) Touch: each touch_ai_conversation call bumped a single row.
--
-- Both leave updated_at much later than the conversation's actual last
-- activity. The messages JSONB carries per-message timestamps that are
-- the authoritative "real last activity" signal — restore from that.
--
-- This migration depends on the trigger fix landing FIRST. With the old
-- trigger active, this UPDATE would re-stamp every row with NOW() and
-- the restore would be a no-op (or worse).
--
-- Detection heuristic: updated_at > last-message-timestamp + 5min slack.
-- The slack absorbs normal turn-end persist latency. Anything beyond
-- that is a bumped-without-content-change row.
--
-- Idempotent: re-running gives the same result (the WHERE clause keeps
-- finding the same scrambled rows or none).
--
-- Rows with empty messages JSONB are skipped (nothing to restore from).
-- Repository code already enforces non-empty messages on persist, so
-- this is a rare edge case.

UPDATE public.ai_conversations
SET updated_at = (messages -> (jsonb_array_length(messages) - 1) ->> 'timestamp')::timestamptz
WHERE jsonb_array_length(COALESCE(messages, '[]'::jsonb)) > 0
  AND updated_at > (
        (messages -> (jsonb_array_length(messages) - 1) ->> 'timestamp')::timestamptz
        + INTERVAL '5 minutes'
      );
