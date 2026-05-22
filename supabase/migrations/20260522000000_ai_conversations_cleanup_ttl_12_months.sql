-- Reduce the ai_conversations cleanup TTL from 24 months to 12 months.
--
-- Original rationale (from 20260521000000) was "a 2-year-old take applied to
-- today's tape is worse than no context." That argument applies even more
-- strongly at 1 year for a domain (markets) that turns over fast — sessions,
-- regimes, and instruments change enough year-over-year that 12-month-stale
-- conversations are effectively decorative.
--
-- Function body is identical otherwise (batched delete, 500 rows × 20
-- batches, NOT pinned, no pending/firing reminders).

CREATE OR REPLACE FUNCTION public.cleanup_stale_ai_conversations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      WHERE last_accessed_at < NOW() - INTERVAL '12 months'
        AND NOT pinned
        AND NOT EXISTS (
          SELECT 1
          FROM public.reminders r
          WHERE r.conversation_id = ai_conversations.id
            AND r.status IN ('pending', 'firing')
        )
      ORDER BY last_accessed_at
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
$function$;

COMMENT ON FUNCTION public.cleanup_stale_ai_conversations() IS
  'Batched delete of ai_conversations rows with last_accessed_at older than 12 months (not pinned, no pending/firing reminders). 500-row batches, up to 10K rows/call. Called nightly by pg_cron job cleanup-stale-ai-conversations.';
