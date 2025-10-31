-- =====================================================
-- Performance Calculation RPC Functions
-- =====================================================
-- These functions calculate performance metrics server-side
-- to improve client performance with large datasets (250+ trades)

-- =====================================================
-- FUNCTION: calculate_performance_metrics
-- =====================================================
-- Calculates comprehensive performance metrics for a calendar
-- Returns all statistics needed for the Performance Charts dialog
CREATE OR REPLACE FUNCTION calculate_performance_metrics(
  p_calendar_id UUID,
  p_time_period TEXT DEFAULT 'month', -- 'month', 'year', 'all'
  p_selected_date TIMESTAMPTZ DEFAULT NOW(),
  p_comparison_tags TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_start_date TIMESTAMPTZ;
  v_end_date TIMESTAMPTZ;
  v_result JSONB;
  v_win_loss_stats JSONB;
  v_tag_stats JSONB;
  v_daily_summary JSONB;
  v_risk_reward_stats JSONB;
  v_session_stats JSONB;
  v_comparison_data JSONB;
  v_all_tags TEXT[];
BEGIN
  -- Calculate date range based on time period
  IF p_time_period = 'month' THEN
    v_start_date := date_trunc('month', p_selected_date);
    v_end_date := date_trunc('month', p_selected_date) + INTERVAL '1 month';
  ELSIF p_time_period = 'year' THEN
    v_start_date := date_trunc('year', p_selected_date);
    v_end_date := date_trunc('year', p_selected_date) + INTERVAL '1 year';
  ELSE -- 'all'
    v_start_date := '1970-01-01'::TIMESTAMPTZ;
    v_end_date := '2100-01-01'::TIMESTAMPTZ;
  END IF;

  -- Calculate win/loss statistics
  -- Note: Win rate excludes breakevens from denominator (wins / (wins + losses))
  SELECT jsonb_build_object(
    'winners', jsonb_build_object(
      'total', COUNT(*) FILTER (WHERE trade_type = 'win'),
      'avgAmount', COALESCE(AVG(amount) FILTER (WHERE trade_type = 'win'), 0),
      'maxConsecutive', 0,  -- Calculated separately if needed
      'avgConsecutive', 0   -- Calculated separately if needed
    ),
    'losers', jsonb_build_object(
      'total', COUNT(*) FILTER (WHERE trade_type = 'loss'),
      'avgAmount', COALESCE(AVG(amount) FILTER (WHERE trade_type = 'loss'), 0),
      'maxConsecutive', 0,  -- Calculated separately if needed
      'avgConsecutive', 0   -- Calculated separately if needed
    ),
    'breakevens', jsonb_build_object(
      'total', COUNT(*) FILTER (WHERE trade_type = 'breakeven'),
      'avgAmount', COALESCE(AVG(amount) FILTER (WHERE trade_type = 'breakeven'), 0)
    ),
    'total_trades', COUNT(*),
    'win_rate', CASE
      WHEN (COUNT(*) FILTER (WHERE trade_type = 'win') + COUNT(*) FILTER (WHERE trade_type = 'loss')) > 0 THEN
        ROUND((COUNT(*) FILTER (WHERE trade_type = 'win')::DECIMAL /
               (COUNT(*) FILTER (WHERE trade_type = 'win') + COUNT(*) FILTER (WHERE trade_type = 'loss'))::DECIMAL) * 100, 2)
      ELSE 0
    END
  )
  INTO v_win_loss_stats
  FROM public.trades
  WHERE calendar_id = p_calendar_id
    AND trade_date >= v_start_date
    AND trade_date < v_end_date;

  -- Calculate tag statistics
  -- Note: Win rate excludes breakevens from denominator, sorted by total_trades descending
  SELECT jsonb_agg(
    jsonb_build_object(
      'tag', tag,
      'wins', wins,
      'losses', losses,
      'breakevens', breakevens,
      'total_trades', total_trades,
      'win_rate', win_rate,
      'total_pnl', total_pnl
    )
    ORDER BY total_trades DESC
  )
  INTO v_tag_stats
  FROM (
    SELECT
      unnest(tags) as tag,
      COUNT(*) FILTER (WHERE trade_type = 'win') as wins,
      COUNT(*) FILTER (WHERE trade_type = 'loss') as losses,
      COUNT(*) FILTER (WHERE trade_type = 'breakeven') as breakevens,
      COUNT(*) as total_trades,
      CASE
        WHEN (COUNT(*) FILTER (WHERE trade_type = 'win') + COUNT(*) FILTER (WHERE trade_type = 'loss')) > 0 THEN
          ROUND((COUNT(*) FILTER (WHERE trade_type = 'win')::DECIMAL /
                 (COUNT(*) FILTER (WHERE trade_type = 'win') + COUNT(*) FILTER (WHERE trade_type = 'loss'))::DECIMAL) * 100, 0)
        ELSE 0
      END as win_rate,
      COALESCE(SUM(amount), 0) as total_pnl
    FROM public.trades
    WHERE calendar_id = p_calendar_id
      AND trade_date >= v_start_date
      AND trade_date < v_end_date
      AND tags IS NOT NULL
    GROUP BY tag
    HAVING COUNT(*) > 0
  ) tag_data;

  -- Calculate daily summary
  -- Note: cumulative_pnl calculated in subquery before aggregation
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', date,
      'total_trades', total_trades,
      'wins', wins,
      'losses', losses,
      'breakevens', breakevens,
      'total_pnl', total_pnl,
      'win_rate', win_rate,
      'cumulative_pnl', cumulative_pnl
    )
    ORDER BY date
  )
  INTO v_daily_summary
  FROM (
    SELECT
      date,
      total_trades,
      wins,
      losses,
      breakevens,
      total_pnl,
      win_rate,
      SUM(total_pnl) OVER (ORDER BY date) as cumulative_pnl
    FROM (
      SELECT
        DATE(trade_date) as date,
        COUNT(*) as total_trades,
        COUNT(*) FILTER (WHERE trade_type = 'win') as wins,
        COUNT(*) FILTER (WHERE trade_type = 'loss') as losses,
        COUNT(*) FILTER (WHERE trade_type = 'breakeven') as breakevens,
        COALESCE(SUM(amount), 0) as total_pnl,
        CASE
          WHEN COUNT(*) > 0 THEN
            ROUND((COUNT(*) FILTER (WHERE trade_type = 'win')::DECIMAL / COUNT(*)::DECIMAL) * 100, 2)
          ELSE 0
        END as win_rate
      FROM public.trades
      WHERE calendar_id = p_calendar_id
        AND trade_date >= v_start_date
        AND trade_date < v_end_date
      GROUP BY DATE(trade_date)
    ) daily_data
  ) daily_with_cumulative;

  -- Calculate risk/reward statistics
  SELECT jsonb_build_object(
    'average', COALESCE(AVG(risk_to_reward), 0),
    'max', COALESCE(MAX(risk_to_reward), 0),
    'min', COALESCE(MIN(risk_to_reward), 0),
    'data', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'date', trade_date,
          'rr', risk_to_reward
        )
        ORDER BY trade_date
      ),
      '[]'::jsonb
    )
  )
  INTO v_risk_reward_stats
  FROM public.trades
  WHERE calendar_id = p_calendar_id
    AND trade_date >= v_start_date
    AND trade_date < v_end_date
    AND risk_to_reward IS NOT NULL;

  -- Calculate session statistics
  -- Note: Win rate excludes breakevens from denominator
  SELECT jsonb_agg(
    jsonb_build_object(
      'session', session,
      'total_trades', total_trades,
      'winners', winners,
      'losers', losers,
      'breakevens', breakevens,
      'win_rate', win_rate,
      'total_pnl', total_pnl,
      'average_pnl', average_pnl,
      'pnl_percentage', 0  -- Calculated client-side with account balance
    )
  )
  INTO v_session_stats
  FROM (
    SELECT
      session,
      COUNT(*) as total_trades,
      COUNT(*) FILTER (WHERE trade_type = 'win') as winners,
      COUNT(*) FILTER (WHERE trade_type = 'loss') as losers,
      COUNT(*) FILTER (WHERE trade_type = 'breakeven') as breakevens,
      CASE
        WHEN (COUNT(*) FILTER (WHERE trade_type = 'win') + COUNT(*) FILTER (WHERE trade_type = 'loss')) > 0 THEN
          ROUND((COUNT(*) FILTER (WHERE trade_type = 'win')::DECIMAL /
                 (COUNT(*) FILTER (WHERE trade_type = 'win') + COUNT(*) FILTER (WHERE trade_type = 'loss'))::DECIMAL) * 100, 2)
        ELSE 0
      END as win_rate,
      COALESCE(SUM(amount), 0) as total_pnl,
      COALESCE(AVG(amount), 0) as average_pnl
    FROM public.trades
    WHERE calendar_id = p_calendar_id
      AND trade_date >= v_start_date
      AND trade_date < v_end_date
      AND session IS NOT NULL
    GROUP BY session
  ) session_data;

  -- Get all unique tags
  SELECT array_agg(DISTINCT tag ORDER BY tag)
  INTO v_all_tags
  FROM (
    SELECT unnest(tags) as tag
    FROM public.trades
    WHERE calendar_id = p_calendar_id
      AND tags IS NOT NULL
  ) all_tags_data;

  -- Calculate comparison win/loss data (if comparison tags provided)
  -- Filters trades that contain ANY of the specified tags
  IF p_comparison_tags IS NOT NULL AND array_length(p_comparison_tags, 1) > 0 THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'name', name,
        'value', value
      )
    )
    INTO v_comparison_data
    FROM (
      SELECT 'Wins' as name, COUNT(*) FILTER (WHERE trade_type = 'win') as value
      FROM public.trades
      WHERE calendar_id = p_calendar_id
        AND trade_date >= v_start_date
        AND trade_date < v_end_date
        AND tags && p_comparison_tags  -- Array overlap operator (contains any)
      UNION ALL
      SELECT 'Losses' as name, COUNT(*) FILTER (WHERE trade_type = 'loss') as value
      FROM public.trades
      WHERE calendar_id = p_calendar_id
        AND trade_date >= v_start_date
        AND trade_date < v_end_date
        AND tags && p_comparison_tags
      UNION ALL
      SELECT 'Breakeven' as name, COUNT(*) FILTER (WHERE trade_type = 'breakeven') as value
      FROM public.trades
      WHERE calendar_id = p_calendar_id
        AND trade_date >= v_start_date
        AND trade_date < v_end_date
        AND tags && p_comparison_tags
    ) comparison_counts
    WHERE value > 0;  -- Only include categories with values > 0
  ELSE
    v_comparison_data := NULL;
  END IF;

  -- Build final result
  v_result := jsonb_build_object(
    'winLossStats', COALESCE(v_win_loss_stats, '{}'::jsonb),
    'tagStats', COALESCE(v_tag_stats, '[]'::jsonb),
    'dailySummaryData', COALESCE(v_daily_summary, '[]'::jsonb),
    'riskRewardStats', COALESCE(v_risk_reward_stats, '{}'::jsonb),
    'sessionStats', COALESCE(v_session_stats, '[]'::jsonb),
    'comparisonWinLossData', v_comparison_data,
    'allTags', COALESCE(to_jsonb(v_all_tags), '[]'::jsonb),
    'calculatedAt', NOW()
  );

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION calculate_performance_metrics(UUID, TEXT, TIMESTAMPTZ, TEXT[]) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION calculate_performance_metrics IS
'Calculates comprehensive performance metrics for a calendar. Returns win/loss stats, tag performance, daily summaries, risk/reward stats, and session statistics. Optimized for large datasets (250+ trades).';

-- =====================================================
-- FUNCTION: calculate_chart_data
-- =====================================================
-- Calculates cumulative P&L chart data for performance charts
CREATE OR REPLACE FUNCTION calculate_chart_data(
  p_calendar_id UUID,
  p_time_period TEXT DEFAULT 'month',
  p_selected_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_start_date TIMESTAMPTZ;
  v_end_date TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  -- Calculate date range based on time period
  IF p_time_period = 'month' THEN
    v_start_date := date_trunc('month', p_selected_date);
    v_end_date := date_trunc('month', p_selected_date) + INTERVAL '1 month';
  ELSIF p_time_period = 'year' THEN
    v_start_date := date_trunc('year', p_selected_date);
    v_end_date := date_trunc('year', p_selected_date) + INTERVAL '1 year';
  ELSE -- 'all'
    v_start_date := '1970-01-01'::TIMESTAMPTZ;
    v_end_date := '2100-01-01'::TIMESTAMPTZ;
  END IF;

  -- Calculate cumulative P&L data
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', date,
      'pnl', pnl,
      'cumulativePnl', cumulative_pnl,
      'trades', trades
    )
    ORDER BY date
  )
  INTO v_result
  FROM (
    SELECT
      DATE(trade_date) as date,
      COALESCE(SUM(amount), 0) as pnl,
      SUM(COALESCE(SUM(amount), 0)) OVER (ORDER BY DATE(trade_date)) as cumulative_pnl,
      COUNT(*) as trades
    FROM public.trades
    WHERE calendar_id = p_calendar_id
      AND trade_date >= v_start_date
      AND trade_date < v_end_date
    GROUP BY DATE(trade_date)
  ) chart_data;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION calculate_chart_data(UUID, TEXT, TIMESTAMPTZ) TO authenticated;

COMMENT ON FUNCTION calculate_chart_data IS
'Calculates cumulative P&L chart data for performance visualization. Returns daily P&L and cumulative totals.';

-- =====================================================
-- FUNCTION: calculate_tag_performance
-- =====================================================
-- Calculates detailed performance metrics for specific tags
CREATE OR REPLACE FUNCTION calculate_tag_performance(
  p_calendar_id UUID,
  p_primary_tags TEXT[],
  p_secondary_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_time_period TEXT DEFAULT 'all',
  p_selected_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_start_date TIMESTAMPTZ;
  v_end_date TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  -- Calculate date range
  IF p_time_period = 'month' THEN
    v_start_date := date_trunc('month', p_selected_date);
    v_end_date := date_trunc('month', p_selected_date) + INTERVAL '1 month';
  ELSIF p_time_period = 'year' THEN
    v_start_date := date_trunc('year', p_selected_date);
    v_end_date := date_trunc('year', p_selected_date) + INTERVAL '1 year';
  ELSE
    v_start_date := '1970-01-01'::TIMESTAMPTZ;
    v_end_date := '2100-01-01'::TIMESTAMPTZ;
  END IF;

  -- Calculate tag performance
  SELECT jsonb_agg(
    jsonb_build_object(
      'tag', tag,
      'wins', wins,
      'losses', losses,
      'breakevens', breakevens,
      'total_trades', total_trades,
      'win_rate', win_rate,
      'total_pnl', total_pnl,
      'avg_pnl', avg_pnl,
      'max_win', max_win,
      'max_loss', max_loss
    )
  )
  INTO v_result
  FROM (
    SELECT
      unnest(p_primary_tags) as tag,
      COUNT(*) FILTER (WHERE trade_type = 'win') as wins,
      COUNT(*) FILTER (WHERE trade_type = 'loss') as losses,
      COUNT(*) FILTER (WHERE trade_type = 'breakeven') as breakevens,
      COUNT(*) as total_trades,
      CASE
        WHEN COUNT(*) > 0 THEN
          ROUND((COUNT(*) FILTER (WHERE trade_type = 'win')::DECIMAL / COUNT(*)::DECIMAL) * 100, 2)
        ELSE 0
      END as win_rate,
      COALESCE(SUM(amount), 0) as total_pnl,
      COALESCE(AVG(amount), 0) as avg_pnl,
      COALESCE(MAX(amount) FILTER (WHERE trade_type = 'win'), 0) as max_win,
      COALESCE(MIN(amount) FILTER (WHERE trade_type = 'loss'), 0) as max_loss
    FROM public.trades
    WHERE calendar_id = p_calendar_id
      AND trade_date >= v_start_date
      AND trade_date < v_end_date
      AND tags && p_primary_tags  -- Has any of the primary tags
      AND (
        array_length(p_secondary_tags, 1) IS NULL
        OR tags @> p_secondary_tags  -- Has all secondary tags
      )
    GROUP BY unnest(p_primary_tags)
  ) tag_data
  WHERE total_trades > 0;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION calculate_tag_performance(UUID, TEXT[], TEXT[], TEXT, TIMESTAMPTZ) TO authenticated;

COMMENT ON FUNCTION calculate_tag_performance IS
'Calculates detailed performance metrics for specific primary and secondary tag combinations.';

