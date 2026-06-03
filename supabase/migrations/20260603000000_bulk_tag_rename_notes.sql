-- Migration: Extend tag-rename to cover the notes table
--
-- When a tag is renamed (or deleted) via the update-tag edge function, the
-- existing bulk_update_tag_in_calendar RPC already handles trades. This
-- migration adds the notes side:
--
--   1. Update trigger_rebuild_calendar_notes to honor app.skip_notes_rebuild
--      (same GUC pattern as app.skip_trade_webhook for trades) so a bulk
--      UPDATE on notes doesn't fire N per-row calendar-mirror rebuilds.
--
--   2. bulk_update_tag_in_notes RPC — bulk-renames or removes a tag across
--      every note owned by the user (calendar-specific + global), suppresses
--      the per-row trigger, then rebuilds the calendars.notes mirror once per
--      affected calendar.

-- =====================================================
-- 1. Update trigger_rebuild_calendar_notes with skip GUC
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_rebuild_calendar_notes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- bulk_update_tag_in_notes sets this to suppress per-row rebuilds.
  -- The RPC calls rebuild_calendar_notes once per calendar after the bulk write.
  IF current_setting('app.skip_notes_rebuild', TRUE) = 'true' THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.calendar_id IS NOT NULL THEN
      PERFORM rebuild_calendar_notes(OLD.calendar_id);
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.calendar_id IS NOT NULL THEN
      PERFORM rebuild_calendar_notes(NEW.calendar_id);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.calendar_id IS NOT NULL THEN
      PERFORM rebuild_calendar_notes(NEW.calendar_id);
    END IF;
    -- Note moved to a different calendar: rebuild the old calendar too.
    IF OLD.calendar_id IS DISTINCT FROM NEW.calendar_id AND OLD.calendar_id IS NOT NULL THEN
      PERFORM rebuild_calendar_notes(OLD.calendar_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

-- =====================================================
-- 2. bulk_update_tag_in_notes RPC
-- =====================================================

CREATE OR REPLACE FUNCTION bulk_update_tag_in_notes(
  p_user_id uuid,
  p_old_tag text,
  p_new_tag text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notes_updated  int  := 0;
  v_old_group      text;
  v_new_group      text;
  v_is_group_change boolean;
  v_affected_calendars uuid[];
  v_cal_id         uuid;
BEGIN
  -- SECURITY DEFINER bypasses RLS; enforce ownership explicitly.
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Not authorized to modify notes for user %', p_user_id;
  END IF;

  -- Determine whether this is a group rename (e.g. Setup:A → Strategy:A).
  -- Mirrors the same logic in bulk_update_tag_in_calendar so notes and trades
  -- are always renamed identically.
  v_old_group := CASE WHEN p_old_tag LIKE '%:%' THEN split_part(p_old_tag, ':', 1) ELSE NULL END;
  v_new_group := CASE
    WHEN p_new_tag IS NOT NULL AND btrim(p_new_tag) LIKE '%:%'
      THEN split_part(btrim(p_new_tag), ':', 1)
    ELSE NULL
  END;
  v_is_group_change := v_old_group IS NOT NULL
                       AND v_new_group IS NOT NULL
                       AND v_old_group <> v_new_group;

  -- Capture the calendar IDs of affected notes BEFORE the update so we know
  -- which mirrors to rebuild afterward. Global notes (calendar_id IS NULL)
  -- don't feed into any mirror, so we only care about calendar-scoped ones.
  SELECT array_agg(DISTINCT calendar_id)
  INTO   v_affected_calendars
  FROM   notes
  WHERE  user_id = p_user_id
    AND  calendar_id IS NOT NULL
    AND  tags IS NOT NULL
    AND  (
           p_old_tag = ANY(tags)
           OR (
             v_is_group_change
             AND EXISTS (
               SELECT 1 FROM unnest(tags) AS tg WHERE tg LIKE v_old_group || ':%'
             )
           )
         );

  -- Suppress per-row calendar-mirror rebuilds for the duration of the bulk write.
  PERFORM set_config('app.skip_notes_rebuild', 'true', true);

  -- Single bulk UPDATE covering all notes for this user (calendar + global).
  -- _apply_tag_rename handles both the rename and delete (empty new_tag) cases,
  -- plus group-level renames, matching the trades behavior exactly.
  UPDATE notes
  SET    tags       = _apply_tag_rename(tags, p_old_tag, p_new_tag),
         updated_at = now()
  WHERE  user_id = p_user_id
    AND  tags IS NOT NULL
    AND  (
           p_old_tag = ANY(tags)
           OR (
             v_is_group_change
             AND EXISTS (
               SELECT 1 FROM unnest(tags) AS tg WHERE tg LIKE v_old_group || ':%'
             )
           )
         );

  GET DIAGNOSTICS v_notes_updated = ROW_COUNT;

  -- Re-enable the trigger before the mirror rebuilds so any subsequent per-row
  -- writes from other sessions are handled normally.
  PERFORM set_config('app.skip_notes_rebuild', 'false', true);

  -- Rebuild the calendars.notes mirror once per affected calendar.
  IF v_affected_calendars IS NOT NULL THEN
    FOREACH v_cal_id IN ARRAY v_affected_calendars LOOP
      PERFORM rebuild_calendar_notes(v_cal_id);
    END LOOP;
  END IF;

  RETURN jsonb_build_object('notes_updated', v_notes_updated);
END;
$$;

REVOKE EXECUTE ON FUNCTION bulk_update_tag_in_notes(uuid, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION bulk_update_tag_in_notes(uuid, text, text) TO authenticated, service_role;

COMMENT ON FUNCTION bulk_update_tag_in_notes(uuid, text, text) IS
'Bulk-renames or removes a tag across all notes owned by a user (calendar-scoped and global). '
'Uses _apply_tag_rename so group renames propagate identically to how bulk_update_tag_in_calendar '
'handles trades. Suppresses per-row notes_calendar_sync trigger via app.skip_notes_rebuild, '
'then rebuilds the calendars.notes mirror once per affected calendar.';
