-- =====================================================
-- AUTO-CALCULATE CALENDAR STATISTICS
-- =====================================================
-- This migration creates a PostgreSQL function and triggers to automatically
-- calculate and update calendar statistics whenever trades are modified.
-- This eliminates the need for client-side stats calculation and reduces network overhead.

-- =====================================================
-- FUNCTION: calculate_calendar_stats
-- =====================================================
-- Calculates all statistics for a calendar based on its trades
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
  v_win_rate DECIMAL(5,2);
  v_profit_factor DECIMAL(8,4);
  v_max_drawdown DECIMAL(5,2);
  v_target_progress DECIMAL(5,2);
  v_pnl_performance DECIMAL(5,2);
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
  v_weekly_pnl_percentage DECIMAL(5,2);
  v_monthly_pnl_percentage DECIMAL(5,2);
  v_yearly_pnl_percentage DECIMAL(5,2);
  v_weekly_progress DECIMAL(5,2);
  v_monthly_progress DECIMAL(5,2);
BEGIN
  -- Get calendar data
  SELECT * INTO v_calendar FROM calendars WHERE id = p_calendar_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Basic trade counts and totals
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE amount > 0),
    COUNT(*) FILTER (WHERE amount < 0),
    COALESCE(SUM(amount), 0)
  INTO v_total_trades, v_win_count, v_loss_count, v_total_pnl
  FROM trades
  WHERE calendar_id = p_calendar_id;

  -- Win rate (percentage of winning trades)
  v_win_rate := CASE 
    WHEN v_total_trades > 0 THEN (v_win_count::DECIMAL / v_total_trades::DECIMAL) * 100
    ELSE 0
  END;

  -- Average win/loss
  SELECT COALESCE(AVG(amount), 0)
  INTO v_avg_win
  FROM trades
  WHERE calendar_id = p_calendar_id AND amount > 0;

  SELECT COALESCE(ABS(AVG(amount)), 0)
  INTO v_avg_loss
  FROM trades
  WHERE calendar_id = p_calendar_id AND amount < 0;

  -- Profit factor
  SELECT 
    COALESCE(SUM(amount), 0),
    COALESCE(ABS(SUM(amount)), 0)
  INTO v_gross_profit, v_gross_loss
  FROM trades
  WHERE calendar_id = p_calendar_id AND amount > 0
  UNION ALL
  SELECT 0, COALESCE(ABS(SUM(amount)), 0)
  FROM trades
  WHERE calendar_id = p_calendar_id AND amount < 0;

  v_profit_factor := CASE
    WHEN v_gross_loss > 0 THEN LEAST(v_gross_profit / v_gross_loss, 9999.9999)
    WHEN v_gross_profit > 0 THEN 999
    ELSE 0
  END;

  -- Current balance
  v_current_balance := v_calendar.account_balance + v_total_pnl;

  -- PnL performance (capped at 999.99%)
  v_pnl_performance := CASE
    WHEN v_calendar.account_balance > 0 THEN 
      LEAST((v_total_pnl / v_calendar.account_balance) * 100, 999.99)
    ELSE 0
  END;

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

  -- Period PnL percentages (capped at 999.99%)
  v_weekly_pnl_percentage := CASE
    WHEN v_calendar.account_balance > 0 THEN 
      LEAST((v_weekly_pnl / v_calendar.account_balance) * 100, 999.99)
    ELSE 0
  END;

  v_monthly_pnl_percentage := CASE
    WHEN v_calendar.account_balance > 0 THEN 
      LEAST((v_monthly_pnl / v_calendar.account_balance) * 100, 999.99)
    ELSE 0
  END;

  v_yearly_pnl_percentage := CASE
    WHEN v_calendar.account_balance > 0 THEN 
      LEAST((v_yearly_pnl / v_calendar.account_balance) * 100, 999.99)
    ELSE 0
  END;

  -- Target progress (capped at 999.99%)
  v_weekly_progress := CASE
    WHEN v_calendar.weekly_target IS NOT NULL AND v_calendar.weekly_target > 0 THEN
      LEAST((v_weekly_pnl / v_calendar.weekly_target) * 100, 999.99)
    ELSE 0
  END;

  v_monthly_progress := CASE
    WHEN v_calendar.monthly_target IS NOT NULL AND v_calendar.monthly_target > 0 THEN
      LEAST((v_monthly_pnl / v_calendar.monthly_target) * 100, 999.99)
    ELSE 0
  END;

  v_target_progress := CASE
    WHEN v_calendar.yearly_target IS NOT NULL AND v_calendar.yearly_target > 0 THEN
      LEAST((v_yearly_pnl / v_calendar.yearly_target) * 100, 999.99)
    ELSE 0
  END;

  -- Drawdown calculation (simplified - using a CTE for running balance)
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
        WHEN peak > 0 THEN LEAST(((peak - balance) / peak) * 100, 999.99)
        ELSE 0
      END as drawdown
    FROM balance_with_peak
  )
  SELECT COALESCE(MAX(drawdown), 0)
  INTO v_max_drawdown
  FROM drawdowns;

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

-- =====================================================
-- TRIGGER FUNCTION: trigger_calculate_calendar_stats
-- =====================================================
-- Wrapper function to call calculate_calendar_stats after trade changes
CREATE OR REPLACE FUNCTION trigger_calculate_calendar_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- For INSERT and UPDATE, use NEW.calendar_id
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM calculate_calendar_stats(NEW.calendar_id);
  -- For DELETE, use OLD.calendar_id
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM calculate_calendar_stats(OLD.calendar_id);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- =====================================================
-- TRIGGERS
-- =====================================================
-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trades_after_insert_stats ON trades;
DROP TRIGGER IF EXISTS trades_after_update_stats ON trades;
DROP TRIGGER IF EXISTS trades_after_delete_stats ON trades;

-- Create triggers for automatic stats calculation
CREATE TRIGGER trades_after_insert_stats
  AFTER INSERT ON trades
  FOR EACH ROW
  EXECUTE FUNCTION trigger_calculate_calendar_stats();

CREATE TRIGGER trades_after_update_stats
  AFTER UPDATE ON trades
  FOR EACH ROW
  WHEN (OLD.amount IS DISTINCT FROM NEW.amount OR OLD.trade_type IS DISTINCT FROM NEW.trade_type)
  EXECUTE FUNCTION trigger_calculate_calendar_stats();

CREATE TRIGGER trades_after_delete_stats
  AFTER DELETE ON trades
  FOR EACH ROW
  EXECUTE FUNCTION trigger_calculate_calendar_stats();

-- =====================================================
-- INITIAL STATS CALCULATION
-- =====================================================
-- Calculate stats for all existing calendars
DO $$
DECLARE
  calendar_record RECORD;
BEGIN
  FOR calendar_record IN SELECT id FROM calendars LOOP
    PERFORM calculate_calendar_stats(calendar_record.id);
  END LOOP;
END $$;

