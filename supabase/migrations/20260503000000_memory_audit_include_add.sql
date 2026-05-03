-- Memory audit: include ADD ops + raise cap from 100 to 500.
--
-- Original design (20260426000000) audited only destructive ops on the
-- premise that ADD is recoverable from the note's prior content. The
-- Memory Logs panel (commit e98ecd0) changes the contract: users now
-- expect every memory mutation to appear in the log. Without ADD audits,
-- bullets accumulate silently and the panel misleads.
--
-- Cap raised to 500 because ADD is the most frequent op — at 100 rows,
-- a couple of weeks of activity would evict destructive ops before
-- anyone could investigate them. 500 gives ~3-6 months of history at
-- typical usage and stays cheap to query (idx_memory_audit_recent).

-- 1. Extend the enum. ALTER TYPE ... ADD VALUE cannot run in a
--    transaction in older PG versions — wrap defensively.
ALTER TYPE public.memory_audit_op ADD VALUE IF NOT EXISTS 'ADD';

-- 2. Raise the per-(user, calendar) cap from 100 to 500.
CREATE OR REPLACE FUNCTION public.cap_memory_audit_rows()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.memory_audit
  WHERE id IN (
    SELECT id
    FROM public.memory_audit
    WHERE user_id = NEW.user_id
      AND calendar_id = NEW.calendar_id
    ORDER BY created_at DESC, id DESC
    OFFSET 500
  );
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.cap_memory_audit_rows IS
  'Keeps memory_audit at 500 rows per (user, calendar). Fires after every INSERT.';

COMMENT ON TABLE public.memory_audit IS
  'Audit trail of all memory ops (ADD/UPDATE/REMOVE/COMPACT/REPLACE_SECTION). Capped at 500 rows per (user, calendar) by trigger. Surfaced in the Memory Logs panel.';
