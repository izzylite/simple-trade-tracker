-- Fix: calendars.user_id is text but auth.uid() returns uuid.
-- The ownership check in bulk_update_tag_in_calendar threw 42883
-- (operator does not exist: text <> uuid).
-- Cast auth.uid() to text to match the column type, consistent with all RLS policies
-- defined in 018_migrate_user_id_to_auth_id.sql.
--
-- This migration redefines the function body verbatim from 20260518000000 except for
-- the cast. The base migration was edited in source to fix the bug for fresh installs;
-- this migration is the patch applied to environments that already ran the buggy version.

CREATE OR REPLACE FUNCTION bulk_update_tag_in_calendar(
  p_calendar_id uuid,
  p_old_tag text,
  p_new_tag text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trades_updated int := 0;
  v_linked_updated int := 0;
  v_old_group text;
  v_new_group text;
  v_is_group_change boolean;
  v_calendar record;
  v_linked_calendar_id uuid;
  v_required_tag_groups text[];
  v_calendar_tags text[];
  v_excluded_tags text[];
  v_sync_cutoff timestamptz := now() - interval '24 hours';
BEGIN
  SELECT * INTO v_calendar FROM calendars WHERE id = p_calendar_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Calendar not found: %', p_calendar_id;
  END IF;
  IF v_calendar.user_id <> auth.uid()::text THEN
    RAISE EXCEPTION 'Not authorized to modify calendar %', p_calendar_id;
  END IF;

  PERFORM set_config('app.skip_trade_webhook', 'true', true);

  v_old_group := CASE WHEN p_old_tag LIKE '%:%' THEN split_part(p_old_tag, ':', 1) ELSE NULL END;
  v_new_group := CASE
    WHEN p_new_tag IS NOT NULL AND btrim(p_new_tag) LIKE '%:%'
      THEN split_part(btrim(p_new_tag), ':', 1)
    ELSE NULL
  END;
  v_is_group_change := v_old_group IS NOT NULL
                       AND v_new_group IS NOT NULL
                       AND v_old_group <> v_new_group;

  WITH affected AS (
    SELECT id, _apply_tag_rename(tags, p_old_tag, p_new_tag) AS new_tags
      FROM trades
     WHERE calendar_id = p_calendar_id
       AND tags IS NOT NULL
       AND (
         p_old_tag = ANY(tags)
         OR (
           v_is_group_change
           AND EXISTS (
             SELECT 1 FROM unnest(tags) AS tg WHERE tg LIKE v_old_group || ':%'
           )
         )
       )
  )
  UPDATE trades t
     SET tags = a.new_tags,
         updated_at = now()
    FROM affected a
   WHERE t.id = a.id;
  GET DIAGNOSTICS v_trades_updated = ROW_COUNT;

  v_linked_calendar_id := v_calendar.linked_to_calendar_id;
  IF v_linked_calendar_id IS NOT NULL THEN
    WITH source_affected AS (
      SELECT id, _apply_tag_rename(tags, p_old_tag, p_new_tag) AS new_tags
        FROM trades
       WHERE calendar_id = p_calendar_id
         AND tags IS NOT NULL
    )
    UPDATE trades linked
       SET tags = src.new_tags,
           updated_at = now()
      FROM source_affected src
     WHERE linked.source_trade_id = src.id
       AND linked.calendar_id = v_linked_calendar_id
       AND linked.created_at >= v_sync_cutoff
       AND linked.tags IS DISTINCT FROM src.new_tags;
    GET DIAGNOSTICS v_linked_updated = ROW_COUNT;
  END IF;

  v_required_tag_groups := v_calendar.required_tag_groups;
  IF v_required_tag_groups IS NOT NULL AND v_is_group_change THEN
    SELECT array_agg(CASE WHEN g = v_old_group THEN v_new_group ELSE g END)
      INTO v_required_tag_groups
      FROM unnest(v_required_tag_groups) AS g;
  END IF;

  v_calendar_tags := CASE
    WHEN v_calendar.tags IS NULL THEN NULL
    ELSE _apply_tag_rename_unique(v_calendar.tags, p_old_tag, p_new_tag)
  END;

  v_excluded_tags := CASE
    WHEN v_calendar.excluded_tags_from_patterns IS NULL THEN NULL
    ELSE _apply_tag_rename_unique(v_calendar.excluded_tags_from_patterns, p_old_tag, p_new_tag)
  END;

  UPDATE calendars
     SET tags = COALESCE(v_calendar_tags, tags),
         required_tag_groups = v_required_tag_groups,
         excluded_tags_from_patterns = v_excluded_tags,
         updated_at = now()
   WHERE id = p_calendar_id;

  RETURN jsonb_build_object(
    'trades_updated', v_trades_updated,
    'linked_trades_updated', v_linked_updated,
    'linked_calendar_id', v_linked_calendar_id,
    'calendar_id', p_calendar_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION bulk_update_tag_in_calendar(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION bulk_update_tag_in_calendar(uuid, text, text) TO authenticated, service_role;
