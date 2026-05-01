-- ============================================================
-- claim_reminder: atomic pending -> firing transition
-- ============================================================
--
-- Both fire paths (browser local timer + cron dispatcher) ultimately POST
-- to the ai-trading-agent edge function in mode='reminder'; the edge
-- function calls this RPC with the service-role client to atomically
-- transition pending -> firing. Whichever path's edge-function invocation
-- wins the conditional UPDATE owns the fire; the other gets an empty
-- result and bails. Single chokepoint = no double-fire.
--
-- SECURITY DEFINER + service_role-only grant follows the
-- acquire_api_key / mark_quota_exhausted precedent. The function returns
-- the full reminder row on success, which is sensitive data — restricting
-- to service_role keeps it server-side only.
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_reminder(p_id UUID)
RETURNS SETOF public.reminders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    UPDATE public.reminders
       SET status = 'firing'
     WHERE id = p_id
       AND status = 'pending'
       AND trigger_at <= NOW()
     RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_reminder(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_reminder(UUID) TO service_role;

COMMENT ON FUNCTION public.claim_reminder(UUID) IS
  'Atomic pending->firing transition for reminders. Returns the row on success, empty result on miss. service_role only — called by ai-trading-agent edge function.';
