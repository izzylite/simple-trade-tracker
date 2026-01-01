-- =====================================================
-- Migration: Add Sync Fields to Trade Functions
-- =====================================================
-- Updates add_trade_with_tags and update_trade_with_tags to include
-- source_trade_id and is_synced_copy fields for calendar linking feature

-- Drop existing functions first to allow parameter name changes
DROP FUNCTION IF EXISTS update_trade_with_tags(UUID, JSONB, UUID);

-- =====================================================
-- FUNCTION: add_trade_with_tags (UPDATED with sync fields)
-- =====================================================
CREATE OR REPLACE FUNCTION add_trade_with_tags(
  p_trade JSONB,
  p_calendar_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_trade_id UUID;
  v_user_id UUID;
  v_calendar RECORD;
  v_new_tags TEXT[];
  v_calendar_tags TEXT[];
  v_tags_updated BOOLEAN := FALSE;
  v_result JSONB;
BEGIN
  -- Get calendar and user_id
  SELECT * INTO v_calendar FROM calendars WHERE id = p_calendar_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Calendar not found: %', p_calendar_id;
  END IF;

  v_user_id := v_calendar.user_id;

  -- Extract trade data and set user_id
  v_trade_id := COALESCE((p_trade->>'id')::UUID, uuid_generate_v4());

  -- Insert the trade (includes sync fields for calendar linking)
  INSERT INTO trades (
    id,
    calendar_id,
    user_id,
    name,
    trade_type,
    trade_date,
    session,
    amount,
    entry_price,
    exit_price,
    stop_loss,
    take_profit,
    risk_to_reward,
    partials_taken,
    notes,
    tags,
    images,
    economic_events,
    is_temporary,
    source_trade_id,
    is_synced_copy,
    created_at,
    updated_at
  ) VALUES (
    v_trade_id,
    p_calendar_id,
    v_user_id,
    p_trade->>'name',
    p_trade->>'trade_type',
    (p_trade->>'trade_date')::TIMESTAMPTZ,
    p_trade->>'session',
    (p_trade->>'amount')::DECIMAL(15,2),
    CASE WHEN p_trade->>'entry_price' IS NOT NULL AND p_trade->>'entry_price' != ''
      THEN (p_trade->>'entry_price')::DECIMAL(15,8)
      ELSE NULL
    END,
    CASE WHEN p_trade->>'exit_price' IS NOT NULL AND p_trade->>'exit_price' != ''
      THEN (p_trade->>'exit_price')::DECIMAL(15,8)
      ELSE NULL
    END,
    CASE WHEN p_trade->>'stop_loss' IS NOT NULL AND p_trade->>'stop_loss' != ''
      THEN (p_trade->>'stop_loss')::DECIMAL(15,8)
      ELSE NULL
    END,
    CASE WHEN p_trade->>'take_profit' IS NOT NULL AND p_trade->>'take_profit' != ''
      THEN (p_trade->>'take_profit')::DECIMAL(15,8)
      ELSE NULL
    END,
    CASE WHEN p_trade->>'risk_to_reward' IS NOT NULL AND p_trade->>'risk_to_reward' != ''
      THEN (p_trade->>'risk_to_reward')::DECIMAL(8,4)
      ELSE NULL
    END,
    (p_trade->>'partials_taken')::BOOLEAN,
    p_trade->>'notes',
    CASE
      WHEN p_trade ? 'tags' THEN
        ARRAY(SELECT jsonb_array_elements_text(p_trade->'tags'))
      ELSE ARRAY[]::TEXT[]
    END,
    COALESCE((p_trade->'images')::JSONB, '[]'::JSONB),
    COALESCE((p_trade->'economic_events')::JSONB, '[]'::JSONB),
    COALESCE((p_trade->>'is_temporary')::BOOLEAN, FALSE),
    -- Sync fields for calendar linking
    (p_trade->>'source_trade_id')::UUID,
    COALESCE((p_trade->>'is_synced_copy')::BOOLEAN, FALSE),
    NOW(),
    NOW()
  );

  -- Update calendar tags if trade has tags
  IF jsonb_array_length(COALESCE((p_trade->'tags')::JSONB, '[]'::JSONB)) > 0 THEN
    -- Extract tags from trade
    SELECT ARRAY(SELECT jsonb_array_elements_text(p_trade->'tags')) INTO v_new_tags;

    -- Get current calendar tags
    v_calendar_tags := COALESCE(v_calendar.tags, ARRAY[]::TEXT[]);

    -- Add new tags to calendar if they don't exist
    FOR i IN 1..array_length(v_new_tags, 1) LOOP
      IF NOT (v_new_tags[i] = ANY(v_calendar_tags)) THEN
        v_calendar_tags := array_append(v_calendar_tags, v_new_tags[i]);
        v_tags_updated := TRUE;
      END IF;
    END LOOP;

    -- Update calendar tags if changed
    IF v_tags_updated THEN
      UPDATE calendars SET tags = v_calendar_tags WHERE id = p_calendar_id;
    END IF;
  END IF;

  -- Build result JSON
  v_result := jsonb_build_object(
    'trade_id', v_trade_id,
    'calendar_id', p_calendar_id,
    'tags_updated', v_tags_updated
  );

  RETURN v_result;
END;
$$;

-- =====================================================
-- FUNCTION: update_trade_with_tags (UPDATED with sync fields)
-- =====================================================
CREATE OR REPLACE FUNCTION update_trade_with_tags(
  p_trade_id UUID,
  p_trade JSONB,
  p_calendar_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_calendar RECORD;
  v_new_tags TEXT[];
  v_calendar_tags TEXT[];
  v_tags_updated BOOLEAN := FALSE;
  v_result JSONB;
BEGIN
  -- Get calendar
  SELECT * INTO v_calendar FROM calendars WHERE id = p_calendar_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Calendar not found: %', p_calendar_id;
  END IF;

  -- Update the trade (includes sync fields for calendar linking)
  UPDATE trades SET
    name = COALESCE(p_trade->>'name', name),
    trade_type = COALESCE(p_trade->>'trade_type', trade_type),
    trade_date = COALESCE((p_trade->>'trade_date')::TIMESTAMPTZ, trade_date),
    session = COALESCE(p_trade->>'session', session),
    amount = COALESCE((p_trade->>'amount')::DECIMAL(15,2), amount),
    entry_price = CASE
      WHEN p_trade ? 'entry_price' THEN
        CASE WHEN p_trade->>'entry_price' IS NOT NULL AND p_trade->>'entry_price' != ''
          THEN (p_trade->>'entry_price')::DECIMAL(15,8)
          ELSE NULL
        END
      ELSE entry_price
    END,
    exit_price = CASE
      WHEN p_trade ? 'exit_price' THEN
        CASE WHEN p_trade->>'exit_price' IS NOT NULL AND p_trade->>'exit_price' != ''
          THEN (p_trade->>'exit_price')::DECIMAL(15,8)
          ELSE NULL
        END
      ELSE exit_price
    END,
    stop_loss = CASE
      WHEN p_trade ? 'stop_loss' THEN
        CASE WHEN p_trade->>'stop_loss' IS NOT NULL AND p_trade->>'stop_loss' != ''
          THEN (p_trade->>'stop_loss')::DECIMAL(15,8)
          ELSE NULL
        END
      ELSE stop_loss
    END,
    take_profit = CASE
      WHEN p_trade ? 'take_profit' THEN
        CASE WHEN p_trade->>'take_profit' IS NOT NULL AND p_trade->>'take_profit' != ''
          THEN (p_trade->>'take_profit')::DECIMAL(15,8)
          ELSE NULL
        END
      ELSE take_profit
    END,
    risk_to_reward = CASE
      WHEN p_trade ? 'risk_to_reward' THEN
        CASE WHEN p_trade->>'risk_to_reward' IS NOT NULL AND p_trade->>'risk_to_reward' != ''
          THEN (p_trade->>'risk_to_reward')::DECIMAL(8,4)
          ELSE NULL
        END
      ELSE risk_to_reward
    END,
    partials_taken = COALESCE((p_trade->>'partials_taken')::BOOLEAN, partials_taken),
    notes = COALESCE(p_trade->>'notes', notes),
    tags = CASE
      WHEN p_trade ? 'tags' THEN
        ARRAY(SELECT jsonb_array_elements_text(p_trade->'tags'))
      ELSE tags
    END,
    images = CASE
      WHEN p_trade ? 'images' THEN (p_trade->'images')::JSONB
      ELSE images
    END,
    economic_events = CASE
      WHEN p_trade ? 'economic_events' THEN (p_trade->'economic_events')::JSONB
      ELSE economic_events
    END,
    is_temporary = COALESCE((p_trade->>'is_temporary')::BOOLEAN, is_temporary),
    -- Sync fields - only update if provided (don't overwrite existing values)
    source_trade_id = CASE
      WHEN p_trade ? 'source_trade_id' THEN (p_trade->>'source_trade_id')::UUID
      ELSE source_trade_id
    END,
    is_synced_copy = CASE
      WHEN p_trade ? 'is_synced_copy' THEN (p_trade->>'is_synced_copy')::BOOLEAN
      ELSE is_synced_copy
    END,
    updated_at = NOW()
  WHERE id = p_trade_id;

  -- Update calendar tags if trade has tags
  IF jsonb_array_length(COALESCE((p_trade->'tags')::JSONB, '[]'::JSONB)) > 0 THEN
    -- Extract tags from trade
    SELECT ARRAY(SELECT jsonb_array_elements_text(p_trade->'tags')) INTO v_new_tags;

    -- Get current calendar tags
    v_calendar_tags := COALESCE(v_calendar.tags, ARRAY[]::TEXT[]);

    -- Add new tags to calendar if they don't exist
    FOR i IN 1..array_length(v_new_tags, 1) LOOP
      IF NOT (v_new_tags[i] = ANY(v_calendar_tags)) THEN
        v_calendar_tags := array_append(v_calendar_tags, v_new_tags[i]);
        v_tags_updated := TRUE;
      END IF;
    END LOOP;

    -- Update calendar tags if changed
    IF v_tags_updated THEN
      UPDATE calendars SET tags = v_calendar_tags WHERE id = p_calendar_id;
    END IF;
  END IF;

  -- Build result JSON
  v_result := jsonb_build_object(
    'trade_id', p_trade_id,
    'calendar_id', p_calendar_id,
    'tags_updated', v_tags_updated
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION add_trade_with_tags(JSONB, UUID) IS
  'Creates a trade with automatic calendar tag merging. Supports source_trade_id and is_synced_copy for calendar linking.';

COMMENT ON FUNCTION update_trade_with_tags(UUID, JSONB, UUID) IS
  'Updates a trade with automatic calendar tag merging. Supports source_trade_id and is_synced_copy for calendar linking.';
