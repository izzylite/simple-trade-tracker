-- =====================================================
-- FIX NUMERIC OVERFLOW IN CALENDAR STATS
-- =====================================================
-- This migration increases the precision of percentage columns in the calendars table
-- from NUMERIC(6,2) causing overflows (max 9999.99) to DECIMAL(15,2).
-- It also updates the calculation functions to support these larger values.

-- 1. Resize columns in calendars table
ALTER TABLE calendars ALTER COLUMN pnl_performance TYPE DECIMAL(15, 2);
ALTER TABLE calendars ALTER COLUMN weekly_pnl_percentage TYPE DECIMAL(15, 2);
ALTER TABLE calendars ALTER COLUMN monthly_pnl_percentage TYPE DECIMAL(15, 2);
ALTER TABLE calendars ALTER COLUMN yearly_pnl_percentage TYPE DECIMAL(15, 2);
ALTER TABLE calendars ALTER COLUMN weekly_progress TYPE DECIMAL(15, 2);
ALTER TABLE calendars ALTER COLUMN monthly_progress TYPE DECIMAL(15, 2);
ALTER TABLE calendars ALTER COLUMN target_progress TYPE DECIMAL(15, 2);
ALTER TABLE calendars ALTER COLUMN max_drawdown TYPE DECIMAL(15, 2);
ALTER TABLE calendars ALTER COLUMN win_rate TYPE DECIMAL(15, 2);


-- 2. Update calculate_calendar_stats function (Write logic)
CREATE OR REPLACE FUNCTION calculate_calendar_stats(p_calendar_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_calendar RECORD;
  v_total_trades INTEGER;
  v_win_count INTEGER;
  v_loss_count INTEGER;
  v_total_pnl DECIMAL(15,2);
  v_win_rate DECIMAL(15,2); -- Increased precision
  v_profit_factor DECIMAL(15,4); -- Increased precision (safe side)
  v_max_drawdown DECIMAL(15,2); -- Increased precision
  v_target_progress DECIMAL(15,2); -- Increased precision
  v_pnl_performance DECIMAL(15,2); -- Increased precision
  v_avg_win DECIMAL(15,2);
  v_avg_loss DECIMAL(15,2);
  v_current_balance DECIMAL(15,2);
  v_gross_profit DECIMAL(15,2);
  v_gross_loss DECIMAL(15,2);
  v_drawdown_start_date TIMESTAMPTZ;
  v_drawdown_end_date TIMESTAMPTZ;
  v_drawdown_recovery_needed DECIMAL(15,2);
  v_drawdown_duration INTEGER;
  v_weekly_pnl DECIMAL(15,2);
  v_monthly_pnl DECIMAL(15,2);
  v_yearly_pnl DECIMAL(15,2);
  v_weekly_pnl_percentage DECIMAL(15,2); -- Increased precision
  v_monthly_pnl_percentage DECIMAL(15,2); -- Increased precision
  v_yearly_pnl_percentage DECIMAL(15,2); -- Increased precision
  v_weekly_progress DECIMAL(15,2); -- Increased precision
  v_monthly_progress DECIMAL(15,2); -- Increased precision
BEGIN
  -- Get calendar data
  SELECT * INTO v_calendar FROM calendars WHERE id = p_calendar_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Query trades from database
  -- Basic trade counts and totals
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE amount > 0),
    COUNT(*) FILTER (WHERE amount < 0),
    COALESCE(SUM(amount), 0)
  INTO v_total_trades, v_win_count, v_loss_count, v_total_pnl
  FROM trades
  WHERE calendar_id = p_calendar_id;

  -- Average win/loss
  SELECT COALESCE(AVG(amount), 0)
  INTO v_avg_win
  FROM trades
  WHERE calendar_id = p_calendar_id AND amount > 0;

  SELECT COALESCE(ABS(AVG(amount)), 0)
  INTO v_avg_loss
  FROM trades
  WHERE calendar_id = p_calendar_id AND amount < 0;

  -- Gross profit and loss
  SELECT COALESCE(SUM(amount), 0)
  INTO v_gross_profit
  FROM trades
  WHERE calendar_id = p_calendar_id AND amount > 0;

  SELECT COALESCE(ABS(SUM(amount)), 0)
  INTO v_gross_loss
  FROM trades
  WHERE calendar_id = p_calendar_id AND amount < 0;

  -- Period-based PnL calculations
  SELECT COALESCE(SUM(amount), 0)
  INTO v_weekly_pnl
  FROM trades
  WHERE calendar_id = p_calendar_id
    AND trade_date >= DATE_TRUNC('week', CURRENT_DATE);

  SELECT COALESCE(SUM(amount), 0)
  INTO v_monthly_pnl
  FROM trades
  WHERE calendar_id = p_calendar_id
    AND trade_date >= DATE_TRUNC('month', CURRENT_DATE);

  SELECT COALESCE(SUM(amount), 0)
  INTO v_yearly_pnl
  FROM trades
  WHERE calendar_id = p_calendar_id
    AND trade_date >= DATE_TRUNC('year', CURRENT_DATE);

  -- Drawdown calculation
  WITH running_balance AS (
    SELECT
      trade_date,
      amount,
      SUM(amount) OVER (ORDER BY trade_date, created_at) + v_calendar.account_balance as balance
    FROM trades
    WHERE calendar_id = p_calendar_id
  ),
  balance_with_peak AS (
    SELECT
      trade_date,
      balance,
      MAX(balance) OVER (ORDER BY trade_date) as peak
    FROM running_balance
  ),
  drawdowns AS (
    SELECT
      trade_date,
      CASE
        WHEN peak > 0 THEN ((peak - balance) / peak) * 100 -- REMOVED LEAST(..., 999.99)
        ELSE 0
      END as drawdown
    FROM balance_with_peak
  )
  SELECT COALESCE(MAX(drawdown), 0)
  INTO v_max_drawdown
  FROM drawdowns;

  -- Common calculations
  -- Win rate (percentage of winning trades)
  v_win_rate := CASE
    WHEN v_total_trades > 0 THEN (v_win_count::DECIMAL / v_total_trades::DECIMAL) * 100
    ELSE 0
  END;

  -- Profit factor
  v_profit_factor := CASE
    WHEN v_gross_loss > 0 THEN v_gross_profit / v_gross_loss -- REMOVED LEAST(..., 9999.9999)
    WHEN v_gross_profit > 0 THEN 999
    ELSE 0
  END;

  -- Current balance
  v_current_balance := v_calendar.account_balance + v_total_pnl;

  -- PnL performance
  -- REMOVED LEAST(..., 999.99)
  v_pnl_performance := CASE
    WHEN v_calendar.account_balance > 0 THEN
      (v_total_pnl / v_calendar.account_balance) * 100
    ELSE 0
  END;

  -- Period PnL percentages
  -- REMOVED LEAST(..., 999.99)
  v_weekly_pnl_percentage := CASE
    WHEN v_calendar.account_balance > 0 THEN
      (v_weekly_pnl / v_calendar.account_balance) * 100
    ELSE 0
  END;

  v_monthly_pnl_percentage := CASE
    WHEN v_calendar.account_balance > 0 THEN
      (v_monthly_pnl / v_calendar.account_balance) * 100
    ELSE 0
  END;

  v_yearly_pnl_percentage := CASE
    WHEN v_calendar.account_balance > 0 THEN
      (v_yearly_pnl / v_calendar.account_balance) * 100
    ELSE 0
  END;

  -- Target progress
  -- REMOVED LEAST(..., 999.99)
  v_weekly_progress := CASE
    WHEN v_calendar.weekly_target IS NOT NULL AND v_calendar.weekly_target > 0 THEN
      (v_weekly_pnl / v_calendar.weekly_target) * 100
    ELSE 0
  END;

  v_monthly_progress := CASE
    WHEN v_calendar.monthly_target IS NOT NULL AND v_calendar.monthly_target > 0 THEN
      (v_monthly_pnl / v_calendar.monthly_target) * 100
    ELSE 0
  END;

  v_target_progress := CASE
    WHEN v_calendar.yearly_target IS NOT NULL AND v_calendar.yearly_target > 0 THEN
      (v_yearly_pnl / v_calendar.yearly_target) * 100
    ELSE 0
  END;

  -- Drawdown recovery and duration (simplified - set to 0 for now)
  v_drawdown_recovery_needed := 0;
  v_drawdown_duration := 0;
  v_drawdown_start_date := NULL;
  v_drawdown_end_date := NULL;

  -- Update calendar with calculated stats
  UPDATE calendars
  SET
    win_rate = v_win_rate,
    profit_factor = v_profit_factor,
    max_drawdown = v_max_drawdown,
    target_progress = v_target_progress,
    pnl_performance = v_pnl_performance,
    total_trades = v_total_trades,
    win_count = v_win_count,
    loss_count = v_loss_count,
    total_pnl = v_total_pnl,
    drawdown_start_date = v_drawdown_start_date,
    drawdown_end_date = v_drawdown_end_date,
    drawdown_recovery_needed = v_drawdown_recovery_needed,
    drawdown_duration = v_drawdown_duration,
    avg_win = v_avg_win,
    avg_loss = v_avg_loss,
    current_balance = v_current_balance,
    weekly_pnl = v_weekly_pnl,
    monthly_pnl = v_monthly_pnl,
    yearly_pnl = v_yearly_pnl,
    weekly_pnl_percentage = v_weekly_pnl_percentage,
    monthly_pnl_percentage = v_monthly_pnl_percentage,
    yearly_pnl_percentage = v_yearly_pnl_percentage,
    weekly_progress = v_weekly_progress,
    monthly_progress = v_monthly_progress,
    updated_at = NOW()
  WHERE id = p_calendar_id;
END;
$$;


-- 3. Update get_calendar_stats function (Read-only logic)
CREATE OR REPLACE FUNCTION get_calendar_stats(
  p_calendar_id UUID,
  p_trades JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_calendar RECORD;
  v_total_trades INTEGER;
  v_win_count INTEGER;
  v_loss_count INTEGER;
  v_total_pnl DECIMAL(15,2);
  v_win_rate DECIMAL(15,2); -- Increased precision
  v_profit_factor DECIMAL(15,4); -- Increased precision
  v_max_drawdown DECIMAL(15,2); -- Increased precision
  v_target_progress DECIMAL(15,2); -- Increased precision
  v_pnl_performance DECIMAL(15,2); -- Increased precision
  v_avg_win DECIMAL(15,2);
  v_avg_loss DECIMAL(15,2);
  v_current_balance DECIMAL(15,2);
  v_gross_profit DECIMAL(15,2);
  v_gross_loss DECIMAL(15,2);
  v_drawdown_start_date TIMESTAMPTZ;
  v_drawdown_end_date TIMESTAMPTZ;
  v_drawdown_recovery_needed DECIMAL(15,2);
  v_drawdown_duration INTEGER;
  v_weekly_pnl DECIMAL(15,2);
  v_monthly_pnl DECIMAL(15,2);
  v_yearly_pnl DECIMAL(15,2);
  v_weekly_pnl_percentage DECIMAL(15,2); -- Increased precision
  v_monthly_pnl_percentage DECIMAL(15,2); -- Increased precision
  v_yearly_pnl_percentage DECIMAL(15,2); -- Increased precision
  v_weekly_progress DECIMAL(15,2); -- Increased precision
  v_monthly_progress DECIMAL(15,2); -- Increased precision
BEGIN
  -- Get calendar data
  SELECT * INTO v_calendar FROM calendars WHERE id = p_calendar_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Use provided trades from JSONB parameter
  -- Basic trade counts and totals
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE (value->>'amount')::DECIMAL > 0),
    COUNT(*) FILTER (WHERE (value->>'amount')::DECIMAL < 0),
    COALESCE(SUM((value->>'amount')::DECIMAL), 0)
  INTO v_total_trades, v_win_count, v_loss_count, v_total_pnl
  FROM jsonb_array_elements(p_trades) AS value;

  -- Average win/loss
  SELECT COALESCE(AVG((value->>'amount')::DECIMAL), 0)
  INTO v_avg_win
  FROM jsonb_array_elements(p_trades) AS value
  WHERE (value->>'amount')::DECIMAL > 0;

  SELECT COALESCE(ABS(AVG((value->>'amount')::DECIMAL)), 0)
  INTO v_avg_loss
  FROM jsonb_array_elements(p_trades) AS value
  WHERE (value->>'amount')::DECIMAL < 0;

  -- Gross profit and loss for profit factor
  SELECT COALESCE(SUM((value->>'amount')::DECIMAL), 0)
  INTO v_gross_profit
  FROM jsonb_array_elements(p_trades) AS value
  WHERE (value->>'amount')::DECIMAL > 0;

  SELECT COALESCE(ABS(SUM((value->>'amount')::DECIMAL)), 0)
  INTO v_gross_loss
  FROM jsonb_array_elements(p_trades) AS value
  WHERE (value->>'amount')::DECIMAL < 0;

  -- Period-based PnL calculations
  SELECT COALESCE(SUM((value->>'amount')::DECIMAL), 0)
  INTO v_weekly_pnl
  FROM jsonb_array_elements(p_trades) AS value
  WHERE (value->>'trade_date')::TIMESTAMPTZ >= DATE_TRUNC('week', CURRENT_DATE);

  SELECT COALESCE(SUM((value->>'amount')::DECIMAL), 0)
  INTO v_monthly_pnl
  FROM jsonb_array_elements(p_trades) AS value
  WHERE (value->>'trade_date')::TIMESTAMPTZ >= DATE_TRUNC('month', CURRENT_DATE);

  SELECT COALESCE(SUM((value->>'amount')::DECIMAL), 0)
  INTO v_yearly_pnl
  FROM jsonb_array_elements(p_trades) AS value
  WHERE (value->>'trade_date')::TIMESTAMPTZ >= DATE_TRUNC('year', CURRENT_DATE);

  -- Drawdown calculation with provided trades
  WITH running_balance AS (
    SELECT
      (value->>'trade_date')::TIMESTAMPTZ as trade_date,
      (value->>'amount')::DECIMAL as amount,
      SUM((value->>'amount')::DECIMAL) OVER (
        ORDER BY (value->>'trade_date')::TIMESTAMPTZ, (value->>'created_at')::TIMESTAMPTZ
      ) + v_calendar.account_balance as balance
    FROM jsonb_array_elements(p_trades) AS value
  ),
  balance_with_peak AS (
    SELECT
      trade_date,
      balance,
      MAX(balance) OVER (ORDER BY trade_date) as peak
    FROM running_balance
  ),
  drawdowns AS (
    SELECT
      trade_date,
      CASE
        WHEN peak > 0 THEN ((peak - balance) / peak) * 100 -- REMOVED LEAST(..., 999.99)
        ELSE 0
      END as drawdown
    FROM balance_with_peak
  )
  SELECT COALESCE(MAX(drawdown), 0)
  INTO v_max_drawdown
  FROM drawdowns;

  -- Common calculations
  -- Win rate (percentage of winning trades)
  v_win_rate := CASE
    WHEN v_total_trades > 0 THEN (v_win_count::DECIMAL / v_total_trades::DECIMAL) * 100
    ELSE 0
  END;

  -- Profit factor
  v_profit_factor := CASE
    WHEN v_gross_loss > 0 THEN v_gross_profit / v_gross_loss -- REMOVED LEAST(..., 9999.9999)
    WHEN v_gross_profit > 0 THEN 999
    ELSE 0
  END;

  -- Current balance
  v_current_balance := v_calendar.account_balance + v_total_pnl;

  -- PnL performance
  v_pnl_performance := CASE
    WHEN v_calendar.account_balance > 0 THEN
      (v_total_pnl / v_calendar.account_balance) * 100
    ELSE 0
  END;

  -- Period PnL percentages
  v_weekly_pnl_percentage := CASE
    WHEN v_calendar.account_balance > 0 THEN
      (v_weekly_pnl / v_calendar.account_balance) * 100
    ELSE 0
  END;

  v_monthly_pnl_percentage := CASE
    WHEN v_calendar.account_balance > 0 THEN
      (v_monthly_pnl / v_calendar.account_balance) * 100
    ELSE 0
  END;

  v_yearly_pnl_percentage := CASE
    WHEN v_calendar.account_balance > 0 THEN
      (v_yearly_pnl / v_calendar.account_balance) * 100
    ELSE 0
  END;

  -- Target progress
  v_weekly_progress := CASE
    WHEN v_calendar.weekly_target IS NOT NULL AND v_calendar.weekly_target > 0 THEN
      (v_weekly_pnl / v_calendar.weekly_target) * 100
    ELSE 0
  END;

  v_monthly_progress := CASE
    WHEN v_calendar.monthly_target IS NOT NULL AND v_calendar.monthly_target > 0 THEN
      (v_monthly_pnl / v_calendar.monthly_target) * 100
    ELSE 0
  END;

  v_target_progress := CASE
    WHEN v_calendar.yearly_target IS NOT NULL AND v_calendar.yearly_target > 0 THEN
      (v_yearly_pnl / v_calendar.yearly_target) * 100
    ELSE 0
  END;

  -- Drawdown recovery and duration
  v_drawdown_recovery_needed := 0;
  v_drawdown_duration := 0;
  v_drawdown_start_date := NULL;
  v_drawdown_end_date := NULL;

  -- Return stats as JSONB (do NOT update the database)
  RETURN jsonb_build_object(
    'win_rate', v_win_rate,
    'profit_factor', v_profit_factor,
    'max_drawdown', v_max_drawdown,
    'target_progress', v_target_progress,
    'pnl_performance', v_pnl_performance,
    'total_trades', v_total_trades,
    'win_count', v_win_count,
    'loss_count', v_loss_count,
    'total_pnl', v_total_pnl,
    'drawdown_start_date', v_drawdown_start_date,
    'drawdown_end_date', v_drawdown_end_date,
    'drawdown_recovery_needed', v_drawdown_recovery_needed,
    'drawdown_duration', v_drawdown_duration,
    'avg_win', v_avg_win,
    'avg_loss', v_avg_loss,
    'current_balance', v_current_balance,
    'weekly_pnl', v_weekly_pnl,
    'monthly_pnl', v_monthly_pnl,
    'yearly_pnl', v_yearly_pnl,
    'weekly_pnl_percentage', v_weekly_pnl_percentage,
    'monthly_pnl_percentage', v_monthly_pnl_percentage,
    'yearly_pnl_percentage', v_yearly_pnl_percentage,
    'weekly_progress', v_weekly_progress,
    'monthly_progress', v_monthly_progress
  );
END;
$$;
