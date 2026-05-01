-- ============================================================
-- claim_reminder: atomic pending -> firing transition
-- ============================================================
--
-- Both fire paths (browser local timer + cron dispatcher) call this RPC
-- to claim ownership of a reminder before doing the work. Only one path
-- can win the conditional UPDATE; the loser gets a NULL row and bails.
--
-- Prevents double-fire when multiple tabs are open, when the cron and
-- a local timer race, or when a stale local timer wakes after a recovery
-- the cron has already handled.
--
-- SECURITY DEFINER is required so the cron / service-role caller can
-- update without RLS friction. The function only flips status; it
-- doesn't expose data the caller wouldn't otherwise have access to.
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_reminder(p_id UUID)
RETURNS public.reminders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed public.reminders;
BEGIN
  UPDATE public.reminders
     SET status = 'firing',
         updated_at = NOW()
   WHERE id = p_id
     AND status = 'pending'
     AND trigger_at <= NOW()
   RETURNING * INTO claimed;

  RETURN claimed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_reminder(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_reminder(UUID) TO service_role;

COMMENT ON FUNCTION public.claim_reminder(UUID) IS
  'Atomic pending->firing transition for reminders. Returns the row on success, NULL on miss (already fired/cancelled, or trigger_at not yet).';
