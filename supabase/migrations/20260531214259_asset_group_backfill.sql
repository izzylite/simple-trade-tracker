-- One-time backfill: migrate existing calendars + trades onto the Asset tag model.
--
-- Context: the app migrated instrument tagging from the legacy `pair:<SYM>` (CSV import)
-- and `Pairs:<SYM>` (old manual form) conventions onto a single `Asset:<SYM>` convention.
-- New calendars already seed a real required `Asset` tag group. This migration brings
-- existing calendars (6 active) and trades (235 legacy-tagged) into line.
--
-- Column types confirmed (information_schema): all three target columns are TEXT[]
-- (udt_name _text): calendars.tags, calendars.required_tag_groups, trades.tags.
--
-- ============================================================================
-- TRIGGER SAFETY — why session_replication_role = replica
-- ============================================================================
-- Without suppression, the following triggers would fire on the UPDATEs below
-- and cause correctness or performance problems:
--
-- ON public.trades UPDATE (all rows, no column filter):
--   • trade_changes_trigger → handle_trade_changes()
--       NO skip-guard. Fires net.http_post to handle-trade-changes edge fn for
--       every updated row (235 calls). That edge fn calls updateYearStats() which
--       UPDATEs the calendars row — 235 concurrent writers on the same row = PG
--       error 57014 (statement timeout / lock contention). It also calls
--       syncToLinkedCalendar() which may INSERT/UPDATE trades in a linked calendar,
--       creating ghost synced-copy trades for tag-only changes.
--   • trigger_trade_changes → notify_trade_changes()
--       Has an app.skip_trade_webhook guard, but calls the same edge fn, so a
--       SECURITY DEFINER wrapper with set_config only suppresses THIS trigger —
--       handle_trade_changes above still fires. Cannot use skip-GUC alone.
--   • trades_broadcast_changes → trigger_broadcast_trade_changes()
--       Realtime broadcast. No DB write, but would push 235 spurious realtime
--       events to any connected clients during a maintenance migration.
--   • trades_after_update_stats → trigger_calculate_calendar_stats()
--       Has a WHEN guard: only fires when old.amount IS DISTINCT FROM new.amount
--       OR old.trade_type IS DISTINCT FROM new.trade_type. A tags-only update
--       does NOT satisfy this condition, so this trigger is already safe.
--       Suppressed by replica mode anyway.
--   • update_trades_updated_at → update_updated_at_column() (BEFORE UPDATE)
--       Would set updated_at = NOW() on all 235 rows. Acceptable for a backfill
--       but suppressed for cleanliness — these are schema-migration changes, not
--       user edits.
--
-- ON public.calendars UPDATE (all rows, no column filter):
--   • trigger_calendar_changes → notify_calendar_deletions()
--       Fires net.http_post to handle-calendar-changes on every calendar UPDATE.
--       The edge fn inspects mark_for_deletion + deletion_date; since neither
--       column is changed by this migration, the handler returns early with
--       "no action taken". Harmless but wastes 6 outbound HTTP calls.
--   • calendars_broadcast_changes → trigger_broadcast_calendar_changes()
--       Column-filtered: fires only on UPDATE OF notes. Does NOT fire here.
--   • prevent_circular_calendar_link → check_circular_calendar_link()
--       Column-filtered: fires only on UPDATE OF linked_to_calendar_id. Safe.
--   • update_calendars_updated_at → update_updated_at_column() (BEFORE UPDATE)
--       Would bump updated_at on all 6 rows. Suppressed for same reason as
--       trades: this is a migration, not a user edit.
--
-- CHOSEN APPROACH: set session_replication_role = replica
--   • Permission confirmed: test SELECT of current_setting('session_replication_role')
--     after SET LOCAL returned 'replica' — the migration role has superuser or
--     replication privilege and can set this GUC.
--   • Safety: we only touch tags and required_tag_groups — no FK columns, no
--     cascade implications, no integrity constraints affected by replica mode.
--   • Scope: the SET is session-level; the RESET at the end restores origin mode.
--     If the migration aborts mid-way, the session ends and Postgres automatically
--     reverts to origin for the next connection.
--   • Effect: ALL user-defined triggers on both tables are skipped for the
--     duration of this session. Internal constraint triggers (PK, FK, NOT NULL)
--     are NOT affected — data integrity is fully enforced.
--
-- IDEMPOTENCY: safe to run twice. DISTINCT deduplicates tags and required_tag_groups,
-- so re-running after Asset entries are already present produces the same result.
-- The trades WHERE clause only matches rows still carrying pair:/Pairs: prefixes.
-- ============================================================================

SET session_replication_role = replica;

-- -------------------------------------------------------------------------
-- (a) Active calendars
--     • Add 'Asset' to required_tag_groups; drop legacy 'pair'/'Pairs' entries.
--     • Union the 28 Forex Asset:<SYM> tags into the tags array.
--     • Rewrite any legacy pair:<SYM> / Pairs:<SYM> tags already present → Asset:<SYM>.
-- -------------------------------------------------------------------------
UPDATE public.calendars c
SET
  required_tag_groups = (
    SELECT array(
      SELECT DISTINCT g
      FROM unnest(
        coalesce(c.required_tag_groups, '{}') || array['Asset']
      ) g
      WHERE g NOT IN ('pair', 'Pairs')
    )
  ),
  tags = (
    SELECT array(
      SELECT DISTINCT
        CASE
          WHEN t LIKE 'pair:%'  THEN 'Asset:' || split_part(t, ':', 2)
          WHEN t LIKE 'Pairs:%' THEN 'Asset:' || split_part(t, ':', 2)
          ELSE t
        END
      FROM unnest(
        coalesce(c.tags, '{}') || array[
          'Asset:EURUSD','Asset:GBPUSD','Asset:USDJPY','Asset:AUDUSD','Asset:USDCAD',
          'Asset:NZDUSD','Asset:USDCHF','Asset:EURJPY','Asset:EURGBP','Asset:EURAUD',
          'Asset:EURCAD','Asset:EURCHF','Asset:EURNZD','Asset:GBPJPY','Asset:GBPAUD',
          'Asset:GBPCAD','Asset:GBPCHF','Asset:GBPNZD','Asset:AUDJPY','Asset:CADJPY',
          'Asset:CHFJPY','Asset:NZDJPY','Asset:AUDCAD','Asset:AUDCHF','Asset:AUDNZD',
          'Asset:CADCHF','Asset:NZDCAD','Asset:NZDCHF'
        ]
      ) t
    )
  )
WHERE c.deleted_at IS NULL;

-- -------------------------------------------------------------------------
-- (b) Trades — bulk tag rewrite (all triggers suppressed by replica mode above)
--
-- Rewrites legacy pair:<SYM> and Pairs:<SYM> tags → Asset:<SYM>.
-- Only touches rows that carry at least one legacy tag (WHERE EXISTS guard).
-- Stats-neutral: only tags column changes; no amount/trade_type change, so even
-- without replica mode trades_after_update_stats would not fire (WHEN guard).
-- -------------------------------------------------------------------------
UPDATE public.trades
SET tags = (
  SELECT array(
    SELECT DISTINCT
      CASE
        WHEN t LIKE 'pair:%'  THEN 'Asset:' || split_part(t, ':', 2)
        WHEN t LIKE 'Pairs:%' THEN 'Asset:' || split_part(t, ':', 2)
        ELSE t
      END
    FROM unnest(tags) t
  )
)
WHERE EXISTS (
  SELECT 1 FROM unnest(tags) t
  WHERE t LIKE 'pair:%' OR t LIKE 'Pairs:%'
);

SET session_replication_role = origin;
