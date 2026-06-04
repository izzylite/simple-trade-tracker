-- Migration: Fix bulk_update_tag_in_notes to patch Draft.js content entityMap.
--
-- notes.tags is a system-tag categorisation field (INSIGHT, LESSON_LEARNED, etc.)
-- and should never be touched by a trading-tag rename. Trading tags only live in
-- content.entityMap[N].data.tagName as Draft.js TRADE_TAG entities.
--
-- This replaces the previous version which incorrectly updated notes.tags.

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
  v_notes_updated   int  := 0;
  v_old_group       text;
  v_new_group       text;
  v_is_group_change boolean;
  v_affected_calendars uuid[];
  v_cal_id          uuid;
  v_old_json_frag   text;
  v_new_json_frag   text;
  v_old_group_prefix text;
  v_new_group_prefix text;
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Not authorized to modify notes for user %', p_user_id;
  END IF;

  -- Nothing to do on delete (leave orphaned entity chips as-is).
  IF p_new_tag = '' THEN
    RETURN jsonb_build_object('notes_updated', 0);
  END IF;

  v_old_group := CASE WHEN p_old_tag LIKE '%:%' THEN split_part(p_old_tag, ':', 1) ELSE NULL END;
  v_new_group := CASE
    WHEN btrim(p_new_tag) LIKE '%:%' THEN split_part(btrim(p_new_tag), ':', 1)
    ELSE NULL
  END;
  v_is_group_change := v_old_group IS NOT NULL
                       AND v_new_group IS NOT NULL
                       AND v_old_group <> v_new_group;

  -- Exact JSON fragment to target in entityMap: "tagName":"<tag>"
  v_old_json_frag    := '"tagName":"' || p_old_tag || '"';
  v_new_json_frag    := '"tagName":"' || p_new_tag || '"';
  -- Group-level prefix for group renames: renames every "tagName":"OldGroup:..."
  v_old_group_prefix := '"tagName":"' || v_old_group || ':';
  v_new_group_prefix := '"tagName":"' || v_new_group || ':';

  -- Capture affected calendar IDs before the update for mirror rebuild.
  SELECT array_agg(DISTINCT calendar_id)
  INTO   v_affected_calendars
  FROM   notes
  WHERE  user_id = p_user_id
    AND  calendar_id IS NOT NULL
    AND  content IS NOT NULL
    AND  (
           content LIKE '%' || v_old_json_frag || '%'
           OR (v_is_group_change AND content LIKE '%' || v_old_group_prefix || '%')
         );

  PERFORM set_config('app.skip_notes_rebuild', 'true', true);

  UPDATE notes
  SET
    content = CASE
      WHEN v_is_group_change AND content LIKE '%' || v_old_group_prefix || '%'
        THEN replace(content, v_old_group_prefix, v_new_group_prefix)
      ELSE replace(content, v_old_json_frag, v_new_json_frag)
    END,
    updated_at = now()
  WHERE user_id = p_user_id
    AND content IS NOT NULL
    AND (
          content LIKE '%' || v_old_json_frag || '%'
          OR (v_is_group_change AND content LIKE '%' || v_old_group_prefix || '%')
        );

  GET DIAGNOSTICS v_notes_updated = ROW_COUNT;

  PERFORM set_config('app.skip_notes_rebuild', 'false', true);

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
'Renames a trading tag across all note content by patching Draft.js entityMap tagName '
'references. Only touches the content column — notes.tags (system tags) is never modified. '
'Handles simple renames and group renames (prefix swap). Tag deletions are no-ops.';
