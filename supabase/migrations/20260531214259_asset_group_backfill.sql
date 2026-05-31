-- One-time backfill: migrate existing calendars + trades onto the Asset tag model.
--
-- Context: the app migrated instrument tagging from legacy `pair:<SYM>` (CSV import)
-- and `Pairs:<SYM>` (old manual form) conventions to a single `Asset:<SYM>` convention.
-- New calendars already seed a real required `Asset` tag group. This migration brings
-- existing calendars and trades in line.
--
-- Column types confirmed: public.calendars.tags TEXT[], calendars.required_tag_groups TEXT[],
-- public.trades.tags TEXT[] — all Postgres text arrays (udt_name _text).
--
-- Idempotent: repeated runs are safe — DISTINCT deduplicates, so existing Asset: entries
-- and Asset in required_tag_groups are not duplicated.

-- -------------------------------------------------------------------------
-- (a) Active calendars
--     • Add 'Asset' to required_tag_groups; drop legacy 'pair'/'Pairs' entries.
--     • Union the 28 Forex Asset:<SYM> tags into the tags array.
--     • Rewrite any legacy pair:<SYM> / Pairs:<SYM> tags already present to Asset:<SYM>.
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
-- (b) Trades — webhook-suppressed bulk tag rewrite
--
-- Why SECURITY DEFINER + set_config: the trade_changes_trigger fires
-- notify_trade_changes() which calls the handle-trade-changes edge function.
-- Without suppression, 235 concurrent HTTP calls race on the calendars row
-- (PG 57014). The tag rename is stats-neutral (no amount changes), so no
-- explicit year_stats recompute is required after the skip.
--
-- Note: trigger_calculate_calendar_stats does NOT check skip_trade_webhook and
-- will still fire on each updated row. The recompute is idempotent and
-- stats-neutral (tags-only update), so this is acceptable overhead (~235 calls).
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.backfill_trade_asset_tags()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer := 0;
BEGIN
  PERFORM set_config('app.skip_trade_webhook', 'true', true);

  WITH updated AS (
    UPDATE public.trades
    SET tags = (
      SELECT array(
        SELECT
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
    )
    RETURNING 1
  )
  SELECT count(*) INTO affected FROM updated;

  RETURN affected;
END;
$$;

SELECT public.backfill_trade_asset_tags();
DROP FUNCTION public.backfill_trade_asset_tags();
