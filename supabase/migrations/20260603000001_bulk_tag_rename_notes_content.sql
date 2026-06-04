-- Migration: Fix bulk_update_tag_in_notes to also update content entityMap
--
-- Tags referenced inline in note content are stored as Draft.js TRADE_TAG
-- entities in content.entityMap[N].data.tagName. The previous version only
-- updated the notes.tags array, so any tag chip embedded in note body text
-- was left pointing to the old tag name.
--
-- This migration replaces the RPC to:
--   1. Also patch content.entityMap tagName references via replace().
--   2. Expand the WHERE clause to include notes that reference the tag only
--      via content entityMap (not necessarily in the tags array).
--   3. Handle group renames in content (replace the group prefix, same as
--      _apply_tag_rename does for the tags array).

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
  -- Exact JSON fragment to match in the content entityMap
  v_old_json_frag   text;
  v_new_json_frag   text;
  -- Group-level JSON prefix for group-rename path
  v_old_group_prefix text;
  v_new_group_prefix text;
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Not authorized to modify notes for user %', p_user_id;
  END IF;

  v_old_group := CASE WHEN p_old_tag LIKE '%:%' THEN split_part(p_old_tag, ':', 1) ELSE NULL END;
  v_new_group := CASE
    WHEN p_new_tag IS NOT NULL AND btrim(p_new_tag) LIKE '%:%'
      THEN split_part(btrim(p_new_tag), ':', 1)
    ELSE NULL
  END;
  v_is_group_change := v_old_group IS NOT NULL
                       AND v_new_group IS NOT NULL
                       AND v_old_group <> v_new_group;

  -- JSON fragments used in content string-replace.
  -- We target the exact serialized Draft.js entityMap shape:
  --   "tagName":"<tag>"
  -- so we never accidentally touch non-entity occurrences of the tag name.
  v_old_json_frag    := '"tagName":"' || p_old_tag || '"';
  v_new_json_frag    := '"tagName":"' || COALESCE(NULLIF(p_new_tag, p_old_tag), p_new_tag) || '"';

  -- For group renames we also need to patch every other tag in the old group
  -- (e.g. Confluence:Daily volume zone → Conf:Daily volume zone) — the same
  -- sweep _apply_tag_rename does for the tags array.
  v_old_group_prefix := '"tagName":"' || v_old_group || ':';
  v_new_group_prefix := '"tagName":"' || v_new_group || ':';

  -- Capture affected calendar IDs before the update (for mirror rebuild).
  SELECT array_agg(DISTINCT calendar_id)
  INTO   v_affected_calendars
  FROM   notes
  WHERE  user_id = p_user_id
    AND  calendar_id IS NOT NULL
    AND  (
           -- Tag in the tags array
           (tags IS NOT NULL AND (
             p_old_tag = ANY(tags)
             OR (v_is_group_change AND EXISTS (
               SELECT 1 FROM unnest(tags) AS tg WHERE tg LIKE v_old_group || ':%'
             ))
           ))
           -- Tag referenced in content entityMap
           OR (content IS NOT NULL AND content LIKE '%' || v_old_json_frag || '%')
           OR (v_is_group_change AND content IS NOT NULL
               AND content LIKE '%' || v_old_group_prefix || '%')
         );

  PERFORM set_config('app.skip_notes_rebuild', 'true', true);

  UPDATE notes
  SET
    -- 1. Update the tags array (categorisation field).
    tags = CASE
      WHEN tags IS NOT NULL AND (
        p_old_tag = ANY(tags)
        OR (v_is_group_change AND EXISTS (
          SELECT 1 FROM unnest(tags) AS tg WHERE tg LIKE v_old_group || ':%'
        ))
      ) THEN _apply_tag_rename(tags, p_old_tag, p_new_tag)
      ELSE tags
    END,

    -- 2. Update inline tag chips in Draft.js entityMap.
    --    We only patch on rename (p_new_tag <> ''); deletes leave the
    --    orphaned entity in place rather than risk corrupting the content JSON.
    content = CASE
      WHEN p_new_tag = '' THEN content
      WHEN v_is_group_change AND content LIKE '%' || v_old_group_prefix || '%'
        -- Group rename: replace the group prefix on every tagName in the group.
        -- Then also fix the specific tag being renamed (covered by the prefix
        -- replace already, but this is a no-op if they happen to collide).
        THEN replace(content, v_old_group_prefix, v_new_group_prefix)
      WHEN content LIKE '%' || v_old_json_frag || '%'
        -- Simple rename: replace exact tagName value.
        THEN replace(content, v_old_json_frag, v_new_json_frag)
      ELSE content
    END,

    updated_at = now()

  WHERE user_id = p_user_id
    AND (
          -- Tag in the tags array
          (tags IS NOT NULL AND (
            p_old_tag = ANY(tags)
            OR (v_is_group_change AND EXISTS (
              SELECT 1 FROM unnest(tags) AS tg WHERE tg LIKE v_old_group || ':%'
            ))
          ))
          -- Tag referenced in content entityMap
          OR (content IS NOT NULL AND content LIKE '%' || v_old_json_frag || '%')
          OR (v_is_group_change AND content IS NOT NULL
              AND content LIKE '%' || v_old_group_prefix || '%')
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
'Bulk-renames or removes a tag across all notes owned by a user. '
'Updates both the notes.tags categorisation array AND inline TRADE_TAG entity '
'references in Draft.js content.entityMap (via targeted JSON string-replace). '
'Covers simple renames, group renames (prefix swap), and the case where a note '
'references a tag only via content entityMap (not in the tags array).';
