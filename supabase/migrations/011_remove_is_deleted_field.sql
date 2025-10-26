-- =====================================================
-- Migration: Remove is_deleted field
-- =====================================================
-- Trades are now permanently deleted instead of soft-deleted
-- Associated images are also deleted from storage

-- Drop indexes related to is_deleted
DROP INDEX IF EXISTS idx_calendars_is_deleted;
DROP INDEX IF EXISTS idx_calendars_user_active;
DROP INDEX IF EXISTS idx_trades_is_deleted;
DROP INDEX IF EXISTS idx_trades_calendar_active;

-- Remove is_deleted column from trades table
ALTER TABLE trades DROP COLUMN IF EXISTS is_deleted;

-- Remove is_deleted column from calendars table
ALTER TABLE calendars DROP COLUMN IF EXISTS is_deleted;

-- Update the update_trade_with_tags function to remove is_deleted handling
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
  -- Use CASE statements to handle NULL values properly
  UPDATE trades
  SET
    name = COALESCE(p_trade_updates->>'name', name),
    trade_type = COALESCE(p_trade_updates->>'trade_type', trade_type),
    trade_date = COALESCE((p_trade_updates->>'trade_date')::TIMESTAMPTZ, trade_date),
    session = CASE
      WHEN p_trade_updates ? 'session' THEN p_trade_updates->>'session'
      ELSE session
    END,
    amount = COALESCE(
      CASE
        WHEN p_trade_updates ? 'amount' AND p_trade_updates->'amount' IS NOT NULL
        THEN (p_trade_updates->'amount')::DECIMAL(15,2)
        ELSE NULL
      END,
      amount
    ),
    entry_price = CASE
      WHEN p_trade_updates ? 'entry_price' THEN
        CASE
          WHEN p_trade_updates->'entry_price' IS NOT NULL
          THEN (p_trade_updates->'entry_price')::DECIMAL(15,8)
          ELSE NULL
        END
      ELSE entry_price
    END,
    exit_price = CASE
      WHEN p_trade_updates ? 'exit_price' THEN
        CASE
          WHEN p_trade_updates->'exit_price' IS NOT NULL
          THEN (p_trade_updates->'exit_price')::DECIMAL(15,8)
          ELSE NULL
        END
      ELSE exit_price
    END,
    stop_loss = CASE
      WHEN p_trade_updates ? 'stop_loss' THEN
        CASE
          WHEN p_trade_updates->'stop_loss' IS NOT NULL
          THEN (p_trade_updates->'stop_loss')::DECIMAL(15,8)
          ELSE NULL
        END
      ELSE stop_loss
    END,
    take_profit = CASE
      WHEN p_trade_updates ? 'take_profit' THEN
        CASE
          WHEN p_trade_updates->'take_profit' IS NOT NULL
          THEN (p_trade_updates->'take_profit')::DECIMAL(15,8)
          ELSE NULL
        END
      ELSE take_profit
    END,
    risk_to_reward = CASE
      WHEN p_trade_updates ? 'risk_to_reward' THEN
        CASE
          WHEN p_trade_updates->'risk_to_reward' IS NOT NULL
          THEN (p_trade_updates->'risk_to_reward')::DECIMAL(8,4)
          ELSE NULL
        END
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

COMMENT ON FUNCTION update_trade_with_tags IS 'Atomically updates a trade and calendar tags with proper NULL handling for numeric fields';

-- Recreate indexes for active records (without is_deleted)
CREATE INDEX idx_calendars_user_active ON calendars(user_id, updated_at DESC);
CREATE INDEX idx_trades_calendar_active ON trades(calendar_id, trade_date DESC);
