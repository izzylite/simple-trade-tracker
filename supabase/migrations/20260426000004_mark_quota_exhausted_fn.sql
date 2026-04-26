-- Atomic failure-count + cooldown update for a key in the api_keys pool.
-- Called by markQuotaExhausted() in apiKeyPool.ts. The schedule (cooldown
-- seconds keyed by failure count) is passed in as an int[] from TS so the
-- backoff curve stays defined in one place (apiKeyPool.ts:nextBackoffSeconds).
--
-- Why an RPC: a naive read-then-write in the client races on the increment
-- (two concurrent quota errors lose an increment, so step 2 silently behaves
-- like step 1). Doing the increment + cooldown calc in a single UPDATE keeps
-- it atomic — no read step, no race window.
--
-- Schedule indexing: array is 1-indexed in Postgres, and the TS schedule
-- array's index 0 is a defensive sentinel (never used). We pass the
-- ALREADY-OFFSET array (slice from index 1) so SQL indexes it directly.

CREATE OR REPLACE FUNCTION public.mark_quota_exhausted(
  p_key_id bigint,
  p_reason text,
  p_schedule_seconds int[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cap int := array_length(p_schedule_seconds, 1);
BEGIN
  UPDATE public.api_keys SET
    consecutive_failures = consecutive_failures + 1,
    next_retry_at = now() + (
      p_schedule_seconds[LEAST(consecutive_failures + 1, v_cap)]
      || ' seconds'
    )::interval,
    last_failure_reason = p_reason
  WHERE id = p_key_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_quota_exhausted(bigint, text, int[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_quota_exhausted(bigint, text, int[]) TO service_role;
