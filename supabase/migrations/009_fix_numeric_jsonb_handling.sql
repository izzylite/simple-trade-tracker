-- =====================================================
-- Migration: Fix Numeric JSONB Handling in Trade RPC Functions
-- =====================================================
-- Updates add_trade_with_tags and update_trade_with_tags to properly handle
-- numeric values in JSONB (instead of converting to text first)

-- =====================================================
-- FUNCTION: add_trade_with_tags (Updated)
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
  -- Use -> for numeric fields (keeps as JSONB number) and ->> for text fields
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
    (p_trade->'amount')::DECIMAL(15,2),
    (p_trade->'entry_price')::DECIMAL(15,8),
    (p_trade->'exit_price')::DECIMAL(15,8),
    (p_trade->'stop_loss')::DECIMAL(15,8),
    (p_trade->'take_profit')::DECIMAL(15,8),
    (p_trade->'risk_to_reward')::DECIMAL(8,4),
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

-- =====================================================
-- FUNCTION: update_trade_with_tags (Updated)
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
  IF p_trade_updates->'tags' IS NOT NULL AND jsonb_typeof(p_trade_updates->'tags') = 'array' THEN
    v_new_tags := ARRAY(SELECT jsonb_array_elements_text(p_trade_updates->'tags'));
  ELSE
    v_new_tags := ARRAY[]::TEXT[];
  END IF;
  
  -- Update the trade
  -- Use -> for numeric fields (keeps as JSONB number) and ->> for text fields
  UPDATE trades
  SET
    name = p_trade_updates->>'name',
    trade_type = p_trade_updates->>'trade_type',
    trade_date = (p_trade_updates->>'trade_date')::TIMESTAMPTZ,
    amount = (p_trade_updates->'amount')::DECIMAL(15,2),
    entry_price = (p_trade_updates->'entry_price')::DECIMAL(15,8),
    exit_price = (p_trade_updates->'exit_price')::DECIMAL(15,8),
    stop_loss = (p_trade_updates->'stop_loss')::DECIMAL(15,8),
    take_profit = (p_trade_updates->'take_profit')::DECIMAL(15,8),
    risk_to_reward = (p_trade_updates->'risk_to_reward')::DECIMAL(8,4),
    partials_taken = (p_trade_updates->>'partials_taken')::BOOLEAN,
    notes = p_trade_updates->>'notes',
    tags = v_new_tags,
    images = COALESCE(p_trade_updates->'images', '[]'::JSONB),
    is_temporary = COALESCE((p_trade_updates->>'is_temporary')::BOOLEAN, FALSE),
    session = p_trade_updates->>'session',
    updated_at = NOW()
  WHERE id = p_trade_id;
  
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

