-- =====================================================
-- Migration: Fix JSONB null casting in trade RPC functions
-- =====================================================
-- Issue: When JavaScript sends null values, they become JSONB null
-- which causes "cannot cast jsonb null to type numeric" error
-- Fix: Check for both key existence AND non-null values using jsonb_typeof

-- =====================================================
-- FUNCTION: add_trade_with_tags (Fixed JSONB null handling)
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

  -- Insert the trade
  -- Use jsonb_typeof to check for non-null values before casting
  INSERT INTO trades (
    id,
    calendar_id,
    user_id,
    name,
    trade_type,
    trade_date,
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
    is_temporary,
    session,
    created_at,
    updated_at
  ) VALUES (
    v_trade_id,
    p_calendar_id,
    v_user_id,
    p_trade->>'name',
    p_trade->>'trade_type',
    (p_trade->>'trade_date')::TIMESTAMPTZ,
    CASE
      WHEN jsonb_typeof(p_trade->'amount') != 'null' THEN (p_trade->>'amount')::DECIMAL(15,2)
      ELSE NULL
    END,
    CASE
      WHEN jsonb_typeof(p_trade->'entry_price') != 'null' THEN (p_trade->>'entry_price')::DECIMAL(15,8)
      ELSE NULL
    END,
    CASE
      WHEN jsonb_typeof(p_trade->'exit_price') != 'null' THEN (p_trade->>'exit_price')::DECIMAL(15,8)
      ELSE NULL
    END,
    CASE
      WHEN jsonb_typeof(p_trade->'stop_loss') != 'null' THEN (p_trade->>'stop_loss')::DECIMAL(15,8)
      ELSE NULL
    END,
    CASE
      WHEN jsonb_typeof(p_trade->'take_profit') != 'null' THEN (p_trade->>'take_profit')::DECIMAL(15,8)
      ELSE NULL
    END,
    CASE
      WHEN jsonb_typeof(p_trade->'risk_to_reward') != 'null' THEN (p_trade->>'risk_to_reward')::DECIMAL(8,4)
      ELSE NULL
    END,
    (p_trade->>'partials_taken')::BOOLEAN,
    p_trade->>'notes',
    CASE
      WHEN p_trade->'tags' IS NOT NULL AND jsonb_typeof(p_trade->'tags') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(p_trade->'tags'))
      ELSE ARRAY[]::TEXT[]
    END,
    COALESCE(p_trade->'images', '[]'::JSONB),
    COALESCE((p_trade->>'is_temporary')::BOOLEAN, FALSE),
    p_trade->>'session',
    NOW(),
    NOW()
  );

  -- Extract tags from the trade
  IF p_trade->'tags' IS NOT NULL AND jsonb_typeof(p_trade->'tags') = 'array' THEN
    v_new_tags := ARRAY(SELECT jsonb_array_elements_text(p_trade->'tags'));
  ELSE
    v_new_tags := ARRAY[]::TEXT[];
  END IF;

  -- Get current calendar tags
  v_calendar_tags := COALESCE(v_calendar.tags, ARRAY[]::TEXT[]);

  -- Update calendar tags if there are new tags
  IF array_length(v_new_tags, 1) > 0 THEN
    -- Merge new tags with existing calendar tags (remove duplicates)
    v_calendar_tags := ARRAY(
      SELECT DISTINCT unnest(v_calendar_tags || v_new_tags)
      ORDER BY 1
    );

    -- Update the calendar with new tags
    UPDATE calendars
    SET
      tags = v_calendar_tags,
      updated_at = NOW()
    WHERE id = p_calendar_id;

    v_tags_updated := TRUE;
  END IF;

  -- Return success result
  v_result := jsonb_build_object(
    'success', TRUE,
    'trade_id', v_trade_id,
    'tags_updated', v_tags_updated
  );

  RETURN v_result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION add_trade_with_tags(JSONB, UUID) TO authenticated;

-- =====================================================
-- FUNCTION: update_trade_with_tags (Fixed JSONB null handling)
-- =====================================================
CREATE OR REPLACE FUNCTION update_trade_with_tags(
  p_trade_id UUID,
  p_trade_updates JSONB,
  p_calendar_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_calendar RECORD;
  v_old_tags TEXT[];
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

  -- Get old tags from the trade
  SELECT tags INTO v_old_tags FROM trades WHERE id = p_trade_id;

  -- Extract new tags from updates
  IF p_trade_updates ? 'tags' AND jsonb_typeof(p_trade_updates->'tags') = 'array' THEN
    v_new_tags := ARRAY(SELECT jsonb_array_elements_text(p_trade_updates->'tags'));
  ELSE
    v_new_tags := ARRAY[]::TEXT[];
  END IF;

  -- Update the trade
  -- Use jsonb_typeof to check for non-null values
  UPDATE trades
  SET
    name = COALESCE(p_trade_updates->>'name', name),
    trade_type = COALESCE(p_trade_updates->>'trade_type', trade_type),
    trade_date = COALESCE((p_trade_updates->>'trade_date')::TIMESTAMPTZ, trade_date),
    session = CASE
      WHEN p_trade_updates ? 'session' THEN p_trade_updates->>'session'
      ELSE session
    END,
    amount = CASE
      WHEN p_trade_updates ? 'amount' AND jsonb_typeof(p_trade_updates->'amount') != 'null'
      THEN (p_trade_updates->>'amount')::DECIMAL(15,2)
      WHEN p_trade_updates ? 'amount' AND jsonb_typeof(p_trade_updates->'amount') = 'null'
      THEN NULL
      ELSE amount
    END,
    entry_price = CASE
      WHEN p_trade_updates ? 'entry_price' AND jsonb_typeof(p_trade_updates->'entry_price') != 'null'
      THEN (p_trade_updates->>'entry_price')::DECIMAL(15,8)
      WHEN p_trade_updates ? 'entry_price' AND jsonb_typeof(p_trade_updates->'entry_price') = 'null'
      THEN NULL
      ELSE entry_price
    END,
    exit_price = CASE
      WHEN p_trade_updates ? 'exit_price' AND jsonb_typeof(p_trade_updates->'exit_price') != 'null'
      THEN (p_trade_updates->>'exit_price')::DECIMAL(15,8)
      WHEN p_trade_updates ? 'exit_price' AND jsonb_typeof(p_trade_updates->'exit_price') = 'null'
      THEN NULL
      ELSE exit_price
    END,
    stop_loss = CASE
      WHEN p_trade_updates ? 'stop_loss' AND jsonb_typeof(p_trade_updates->'stop_loss') != 'null'
      THEN (p_trade_updates->>'stop_loss')::DECIMAL(15,8)
      WHEN p_trade_updates ? 'stop_loss' AND jsonb_typeof(p_trade_updates->'stop_loss') = 'null'
      THEN NULL
      ELSE stop_loss
    END,
    take_profit = CASE
      WHEN p_trade_updates ? 'take_profit' AND jsonb_typeof(p_trade_updates->'take_profit') != 'null'
      THEN (p_trade_updates->>'take_profit')::DECIMAL(15,8)
      WHEN p_trade_updates ? 'take_profit' AND jsonb_typeof(p_trade_updates->'take_profit') = 'null'
      THEN NULL
      ELSE take_profit
    END,
    risk_to_reward = CASE
      WHEN p_trade_updates ? 'risk_to_reward' AND jsonb_typeof(p_trade_updates->'risk_to_reward') != 'null'
      THEN (p_trade_updates->>'risk_to_reward')::DECIMAL(8,4)
      WHEN p_trade_updates ? 'risk_to_reward' AND jsonb_typeof(p_trade_updates->'risk_to_reward') = 'null'
      THEN NULL
      ELSE risk_to_reward
    END,
    partials_taken = COALESCE(
      CASE
        WHEN p_trade_updates ? 'partials_taken' AND p_trade_updates->>'partials_taken' IS NOT NULL
        THEN (p_trade_updates->>'partials_taken')::BOOLEAN
        ELSE NULL
      END,
      partials_taken
    ),
    notes = CASE
      WHEN p_trade_updates ? 'notes' THEN p_trade_updates->>'notes'
      ELSE notes
    END,
    tags = CASE
      WHEN p_trade_updates ? 'tags' THEN v_new_tags
      ELSE tags
    END,
    images = CASE
      WHEN p_trade_updates ? 'images' THEN COALESCE(p_trade_updates->'images', '[]'::JSONB)
      ELSE images
    END,
    is_temporary = COALESCE(
      CASE
        WHEN p_trade_updates ? 'is_temporary' AND p_trade_updates->>'is_temporary' IS NOT NULL
        THEN (p_trade_updates->>'is_temporary')::BOOLEAN
        ELSE NULL
      END,
      is_temporary
    ),
    updated_at = NOW()
  WHERE id = p_trade_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trade not found: %', p_trade_id;
  END IF;

  -- Check if tags have changed
  IF v_old_tags IS DISTINCT FROM v_new_tags THEN
    -- Get current calendar tags
    v_calendar_tags := COALESCE(v_calendar.tags, ARRAY[]::TEXT[]);

    -- Merge new tags with existing calendar tags (remove duplicates)
    IF array_length(v_new_tags, 1) > 0 THEN
      v_calendar_tags := ARRAY(
        SELECT DISTINCT unnest(v_calendar_tags || v_new_tags)
        ORDER BY 1
      );

      -- Update the calendar with new tags
      UPDATE calendars
      SET
        tags = v_calendar_tags,
        updated_at = NOW()
      WHERE id = p_calendar_id;

      v_tags_updated := TRUE;
    END IF;
  END IF;

  -- Return success result
  v_result := jsonb_build_object(
    'success', TRUE,
    'tags_updated', v_tags_updated
  );

  RETURN v_result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_trade_with_tags(UUID, JSONB, UUID) TO authenticated;

COMMENT ON FUNCTION update_trade_with_tags IS 'Atomically updates a trade and calendar tags with proper JSONB null handling using jsonb_typeof';
