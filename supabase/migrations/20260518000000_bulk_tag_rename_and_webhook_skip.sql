-- Migration: Bulk tag-rename RPC + skip-webhook GUC + year_stats recompute coalescing
--
-- Background:
--   Renaming a tag previously issued N individual UPDATE statements (one per affected
--   trade). The per-row notify_trade_changes trigger fired N pg_net.http_post calls,
--   spawning N concurrent handle-trade-changes invocations that all raced to recompute
--   year_stats and UPDATE the same calendars row. With ~500 trades this hit Postgres
--   statement_timeout (code 57014) on the calendars row UPDATE.
--
-- Fix has three parts:
--   1. _apply_tag_rename helpers — port the JS tag-transform logic to SQL so a single
--      UPDATE can rename the tag across all trades.
--   2. bulk_update_tag_in_calendar RPC — does the work in one transaction with the
--      app.skip_trade_webhook GUC set, so notify_trade_changes early-returns.
--      Replaces the per-row loop in the update-tag edge function.
--   3. notify_trade_changes — honor the skip GUC.
--   4. claim_year_stats_recompute RPC + year_stats_last_recomputed_at column —
--      defense-in-depth coalescing for handle-trade-changes so any future bulk
--      write path that bypasses the skip flag still can't cause the same storm.

-- =====================================================
-- 1. Tag-transform helpers
-- =====================================================

-- Mirror of supabase/functions/_shared/utils.ts:updateTradeTagsWithGroupNameChange.
-- Preserves trade-tag ordering and does NOT dedup (matches existing trade.tags behavior).
CREATE OR REPLACE FUNCTION _apply_tag_rename(
  p_tags text[],
  p_old_tag text,
  p_new_tag text
)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_old_group text;
  v_new_group text;
  v_is_group_change boolean;
  v_result text[] := ARRAY[]::text[];
  v_tag text;
  v_new_trimmed text;
BEGIN
  IF p_tags IS NULL THEN
    RETURN NULL;
  END IF;

  v_new_trimmed := CASE WHEN p_new_tag IS NULL THEN '' ELSE btrim(p_new_tag) END;

  v_old_group := CASE
    WHEN p_old_tag LIKE '%:%' THEN split_part(p_old_tag, ':', 1)
    ELSE NULL
  END;
  v_new_group := CASE
    WHEN v_new_trimmed LIKE '%:%' THEN split_part(v_new_trimmed, ':', 1)
    ELSE NULL
  END;
  v_is_group_change := v_old_group IS NOT NULL
                       AND v_new_group IS NOT NULL
                       AND v_old_group <> v_new_group;

  FOREACH v_tag IN ARRAY p_tags LOOP
    IF v_is_group_change THEN
      IF v_tag = p_old_tag THEN
        IF v_new_trimmed <> '' THEN
          v_result := array_append(v_result, v_new_trimmed);
        END IF;
        -- empty new_tag drops the tag
      ELSIF v_tag LIKE '%:%' AND split_part(v_tag, ':', 1) = v_old_group THEN
        v_result := array_append(v_result, v_new_group || ':' || split_part(v_tag, ':', 2));
      ELSE
        v_result := array_append(v_result, v_tag);
      END IF;
    ELSE
      IF v_tag = p_old_tag THEN
        IF v_new_trimmed <> '' THEN
          v_result := array_append(v_result, v_new_trimmed);
        END IF;
      ELSE
        v_result := array_append(v_result, v_tag);
      END IF;
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$;

-- Calendar-metadata variant: dedup + sort (matches updateTagsArray in update-tag/index.ts).
CREATE OR REPLACE FUNCTION _apply_tag_rename_unique(
  p_tags text[],
  p_old_tag text,
  p_new_tag text
)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    (SELECT array_agg(DISTINCT t ORDER BY t)
       FROM unnest(_apply_tag_rename(p_tags, p_old_tag, p_new_tag)) AS t
      WHERE t IS NOT NULL),
    ARRAY[]::text[]
  );
$$;

-- =====================================================
-- 2. Bulk RPC
-- =====================================================

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
  -- Caller must own the calendar. We re-check here even though RLS would normally
  -- protect this, because SECURITY DEFINER bypasses RLS.
  SELECT * INTO v_calendar FROM calendars WHERE id = p_calendar_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Calendar not found: %', p_calendar_id;
  END IF;
  -- calendars.user_id is text (firebase-era legacy); cast auth.uid() to match.
  -- Consistent with all RLS policies in 018_migrate_user_id_to_auth_id.sql.
  IF v_calendar.user_id <> auth.uid()::text THEN
    RAISE EXCEPTION 'Not authorized to modify calendar %', p_calendar_id;
  END IF;

  -- Suppress per-row notify_trade_changes for the rest of this transaction.
  -- handle-trade-changes is invoked exactly once explicitly by the caller after this.
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

  -- 2a. Source-calendar trades: single UPDATE
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

  -- 2b. Propagate to linked calendar's synced copies within the 24hr sync window.
  -- This preserves the existing behavior where tag renames in the source flow
  -- through to recently-synced linked trades (see syncToLinkedCalendar in
  -- handle-trade-changes/index.ts). We only touch the tags column here — full
  -- amount/risk re-sync is intentionally NOT replicated, since a tag rename
  -- shouldn't trigger amount recalculation.
  v_linked_calendar_id := v_calendar.linked_to_calendar_id;
  IF v_linked_calendar_id IS NOT NULL THEN
    -- Filter by SOURCE trade's created_at (not linked.created_at) to exactly
    -- match isWithinSyncWindow() in handle-trade-changes/index.ts, which evaluates
    -- the source row. In practice the two timestamps differ by ~ms because the
    -- linked copy is created via webhook-driven sync right after the source
    -- insert, but checking source's column preserves identical behavior.
    WITH source_affected AS (
      SELECT id, created_at, _apply_tag_rename(tags, p_old_tag, p_new_tag) AS new_tags
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
       AND src.created_at >= v_sync_cutoff
       AND linked.tags IS DISTINCT FROM src.new_tags;
    GET DIAGNOSTICS v_linked_updated = ROW_COUNT;
  END IF;

  -- 2c. Calendar metadata: tags, required_tag_groups, excluded_tags_from_patterns
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

GRANT EXECUTE ON FUNCTION bulk_update_tag_in_calendar(uuid, text, text) TO authenticated, service_role;

COMMENT ON FUNCTION bulk_update_tag_in_calendar(uuid, text, text) IS
'Bulk-renames a tag across all trades in a calendar (and synced copies in any linked '
'calendar within the 24hr sync window), plus updates calendar metadata arrays. '
'Suppresses the per-row notify_trade_changes webhook via app.skip_trade_webhook. '
'Caller is responsible for triggering a single year_stats recompute after this returns.';

-- =====================================================
-- 3. notify_trade_changes honors the skip flag
-- =====================================================

CREATE OR REPLACE FUNCTION notify_trade_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payload jsonb;
  v_edge_function_url text;
  v_service_role_key text;
  v_skip text;
BEGIN
  -- Bulk operations set this GUC to suppress the per-row webhook flood.
  -- They are responsible for triggering one explicit recompute after their work.
  v_skip := current_setting('app.skip_trade_webhook', true);
  IF v_skip = 'true' THEN
    IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  v_edge_function_url := current_setting('app.settings.edge_function_url', true);
  v_service_role_key := current_setting('app.settings.service_role_key', true);

  IF v_edge_function_url IS NULL THEN
    v_edge_function_url := 'https://gwubzauelilziaqnsfac.supabase.co/functions/v1/handle-trade-changes';
  END IF;

  IF (TG_OP = 'DELETE') THEN
    v_payload := jsonb_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'old_record', row_to_json(OLD)::jsonb,
      'calendar_id', OLD.calendar_id,
      'user_id', OLD.user_id
    );
  ELSIF (TG_OP = 'UPDATE') THEN
    v_payload := jsonb_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'old_record', row_to_json(OLD)::jsonb,
      'new_record', row_to_json(NEW)::jsonb,
      'calendar_id', NEW.calendar_id,
      'user_id', NEW.user_id
    );
  ELSIF (TG_OP = 'INSERT') THEN
    v_payload := jsonb_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'new_record', row_to_json(NEW)::jsonb,
      'calendar_id', NEW.calendar_id,
      'user_id', NEW.user_id
    );
  END IF;

  PERFORM net.http_post(
    url := v_edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(v_service_role_key, current_setting('request.jwt.claim.sub', true))
    ),
    body := v_payload
  );

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- =====================================================
-- 4. Year-stats recompute coalescing
-- =====================================================

ALTER TABLE calendars
  ADD COLUMN IF NOT EXISTS year_stats_last_recomputed_at TIMESTAMPTZ;

-- Atomic claim-or-skip: only one caller wins per (calendar_id, p_min_interval_seconds)
-- window. Returns true if the caller should perform the recompute, false if another
-- invocation already started one recently. Stale claims auto-clear after the window.
CREATE OR REPLACE FUNCTION claim_year_stats_recompute(
  p_calendar_id uuid,
  p_min_interval_seconds int DEFAULT 5
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claimed uuid;
BEGIN
  UPDATE calendars
     SET year_stats_last_recomputed_at = now()
   WHERE id = p_calendar_id
     AND (
       year_stats_last_recomputed_at IS NULL
       OR year_stats_last_recomputed_at < now() - make_interval(secs => p_min_interval_seconds)
     )
  RETURNING id INTO v_claimed;
  RETURN v_claimed IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_year_stats_recompute(uuid, int) TO authenticated, service_role;

COMMENT ON FUNCTION claim_year_stats_recompute(uuid, int) IS
'Coalescing guard for year_stats recomputation. Returns true if the caller should '
'proceed (no other recompute in the last p_min_interval_seconds), false if it should '
'skip. Atomic via UPDATE...RETURNING row lock. Trades exact-up-to-date stats for '
'O(1) writes during bulk-write storms; the next webhook after the window picks up.';
