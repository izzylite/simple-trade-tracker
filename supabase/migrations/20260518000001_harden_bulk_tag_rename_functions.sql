-- Address advisor warnings on functions introduced by 20260518000000_bulk_tag_rename_and_webhook_skip.
--
-- 1. Pin search_path on functions that lack it (mutable search_path is a privilege-escalation
--    vector for SECURITY DEFINER functions, and best practice even for non-DEFINER ones).
-- 2. Revoke the default PUBLIC execute grant on the SECURITY DEFINER functions so anon
--    can't call them. The original GRANTs to authenticated/service_role are unaffected.
--    bulk_update_tag_in_calendar is functionally safe against anon (auth.uid() returns NULL
--    so the ownership check rejects), but claim_year_stats_recompute would let anon DoS
--    year_stats recomputes on any calendar.

ALTER FUNCTION _apply_tag_rename(text[], text, text) SET search_path = public;
ALTER FUNCTION _apply_tag_rename_unique(text[], text, text) SET search_path = public;
ALTER FUNCTION notify_trade_changes() SET search_path = public;

REVOKE EXECUTE ON FUNCTION bulk_update_tag_in_calendar(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION claim_year_stats_recompute(uuid, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION notify_trade_changes() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION bulk_update_tag_in_calendar(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION claim_year_stats_recompute(uuid, int) TO authenticated, service_role;
-- notify_trade_changes is invoked as a trigger; no role needs EXECUTE on it directly.
