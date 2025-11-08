-- =====================================================
-- Multi-Calendar Performance Calculation RPC Functions
-- =====================================================
-- These functions calculate performance metrics across multiple calendars
-- to support "All Calendars" view in Performance page

-- =====================================================
-- FUNCTION: calculate_economic_event_correlations (single calendar wrapper)
-- =====================================================
-- Update the single-calendar function to delegate to the multi-calendar version
CREATE OR REPLACE FUNCTION calculate_economic_event_correlations(
  p_calendar_id UUID,
  p_selected_currency TEXT DEFAULT 'ALL',
  p_selected_impact TEXT DEFAULT 'High',
  p_time_period TEXT DEFAULT 'all',
  p_selected_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- Delegate to multi-calendar version
  RETURN calculate_economic_event_correlations_multi(
    ARRAY[p_calendar_id],
    p_selected_currency,
    p_selected_impact,
    p_time_period,
    p_selected_date
  );
END;
$$;

GRANT EXECUTE ON FUNCTION calculate_economic_event_correlations(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;

COMMENT ON FUNCTION calculate_economic_event_correlations IS
'Wrapper function that delegates to calculate_economic_event_correlations_multi for single calendar analysis.';

-- =====================================================
-- FUNCTION: calculate_performance_metrics_multi
-- =====================================================
-- Calculates comprehensive performance metrics for multiple calendars
-- Returns aggregated statistics across all specified calendars
CREATE OR REPLACE FUNCTION calculate_performance_metrics_multi(
  p_calendar_ids UUID[],
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

  -- Calculate win/loss statistics across all calendars
  SELECT jsonb_build_object(
    'winners', jsonb_build_object(
      'total', COUNT(*) FILTER (WHERE trade_type = 'win'),
      'avgAmount', COALESCE(AVG(amount) FILTER (WHERE trade_type = 'win'), 0),
      'maxConsecutive', 0,
      'avgConsecutive', 0
    ),
    'losers', jsonb_build_object(
      'total', COUNT(*) FILTER (WHERE trade_type = 'loss'),
      'avgAmount', COALESCE(AVG(amount) FILTER (WHERE trade_type = 'loss'), 0),
      'maxConsecutive', 0,
      'avgConsecutive', 0
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
  WHERE calendar_id = ANY(p_calendar_ids)
    AND trade_date >= v_start_date
    AND trade_date < v_end_date;

  -- Calculate tag statistics across all calendars
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
                 (COUNT(*) FILTER (WHERE trade_type = 'win') + COUNT(*) FILTER (WHERE trade_type = 'loss'))::DECIMAL) * 100, 2)
        ELSE 0
      END as win_rate,
      COALESCE(SUM(amount), 0) as total_pnl
    FROM public.trades
    WHERE calendar_id = ANY(p_calendar_ids)
      AND trade_date >= v_start_date
      AND trade_date < v_end_date
    GROUP BY tag
  ) tag_data;

  -- Calculate daily summary across all calendars
  -- Use CTE to calculate cumulative sum before aggregation
  WITH daily_data AS (
    SELECT
      trade_date::DATE as trade_date,
      COUNT(*) as total_trades,
      COUNT(*) FILTER (WHERE trade_type = 'win') as wins,
      COUNT(*) FILTER (WHERE trade_type = 'loss') as losses,
      COUNT(*) FILTER (WHERE trade_type = 'breakeven') as breakevens,
      CASE
        WHEN (COUNT(*) FILTER (WHERE trade_type = 'win') + COUNT(*) FILTER (WHERE trade_type = 'loss')) > 0 THEN
          ROUND((COUNT(*) FILTER (WHERE trade_type = 'win')::DECIMAL /
                 (COUNT(*) FILTER (WHERE trade_type = 'win') + COUNT(*) FILTER (WHERE trade_type = 'loss'))::DECIMAL) * 100, 2)
        ELSE 0
      END as win_rate,
      COALESCE(SUM(amount), 0) as total_pnl
    FROM public.trades
    WHERE calendar_id = ANY(p_calendar_ids)
      AND trade_date >= v_start_date
      AND trade_date < v_end_date
    GROUP BY trade_date::DATE
  ),
  daily_with_cumulative AS (
    SELECT
      trade_date,
      total_trades,
      wins,
      losses,
      breakevens,
      win_rate,
      total_pnl,
      SUM(total_pnl) OVER (ORDER BY trade_date) as cumulative_pnl
    FROM daily_data
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', trade_date,
      'total_trades', total_trades,
      'wins', wins,
      'losses', losses,
      'breakevens', breakevens,
      'win_rate', win_rate,
      'total_pnl', total_pnl,
      'cumulative_pnl', cumulative_pnl
    )
    ORDER BY trade_date
  )
  INTO v_daily_summary
  FROM daily_with_cumulative;

  -- Calculate risk/reward statistics across all calendars
  SELECT jsonb_build_object(
    'average', COALESCE(AVG(risk_to_reward), 0),
    'max', COALESCE(MAX(risk_to_reward), 0),
    'data', jsonb_agg(
      jsonb_build_object(
        'trade_id', id,
        'risk_reward_ratio', risk_to_reward,
        'amount', amount
      )
    )
  )
  INTO v_risk_reward_stats
  FROM public.trades
  WHERE calendar_id = ANY(p_calendar_ids)
    AND trade_date >= v_start_date
    AND trade_date < v_end_date
    AND risk_to_reward IS NOT NULL;

  -- Calculate session statistics across all calendars
  SELECT jsonb_agg(
    jsonb_build_object(
      'session', session,
      'total_trades', total_trades,
      'wins', wins,
      'losses', losses,
      'win_rate', win_rate,
      'total_pnl', total_pnl
    )
  )
  INTO v_session_stats
  FROM (
    SELECT
      session,
      COUNT(*) as total_trades,
      COUNT(*) FILTER (WHERE trade_type = 'win') as wins,
      COUNT(*) FILTER (WHERE trade_type = 'loss') as losses,
      CASE
        WHEN (COUNT(*) FILTER (WHERE trade_type = 'win') + COUNT(*) FILTER (WHERE trade_type = 'loss')) > 0 THEN
          ROUND((COUNT(*) FILTER (WHERE trade_type = 'win')::DECIMAL /
                 (COUNT(*) FILTER (WHERE trade_type = 'win') + COUNT(*) FILTER (WHERE trade_type = 'loss'))::DECIMAL) * 100, 2)
        ELSE 0
      END as win_rate,
      COALESCE(SUM(amount), 0) as total_pnl
    FROM public.trades
    WHERE calendar_id = ANY(p_calendar_ids)
      AND trade_date >= v_start_date
      AND trade_date < v_end_date
      AND session IS NOT NULL
    GROUP BY session
  ) session_data;

  -- Get all unique tags across all calendars
  SELECT ARRAY_AGG(DISTINCT tag)
  INTO v_all_tags
  FROM (
    SELECT unnest(tags) as tag
    FROM public.trades
    WHERE calendar_id = ANY(p_calendar_ids)
      AND trade_date >= v_start_date
      AND trade_date < v_end_date
  ) all_tags_data;

  -- Calculate comparison data if comparison tags provided
  IF array_length(p_comparison_tags, 1) > 0 THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'tag', tag,
        'wins', wins,
        'losses', losses,
        'total_trades', total_trades
      )
    )
    INTO v_comparison_data
    FROM (
      SELECT
        unnest(tags) as tag,
        COUNT(*) FILTER (WHERE trade_type = 'win') as wins,
        COUNT(*) FILTER (WHERE trade_type = 'loss') as losses,
        COUNT(*) as total_trades
      FROM public.trades
      WHERE calendar_id = ANY(p_calendar_ids)
        AND trade_date >= v_start_date
        AND trade_date < v_end_date
        AND tags && p_comparison_tags
      GROUP BY tag
    ) comparison_data
    WHERE tag = ANY(p_comparison_tags);
  END IF;

  -- Build final result
  v_result := jsonb_build_object(
    'winLossStats', v_win_loss_stats,
    'tagStats', COALESCE(v_tag_stats, '[]'::jsonb),
    'dailySummaryData', COALESCE(v_daily_summary, '[]'::jsonb),
    'riskRewardStats', COALESCE(v_risk_reward_stats, jsonb_build_object('average', 0, 'max', 0, 'data', '[]'::jsonb)),
    'sessionStats', COALESCE(v_session_stats, '[]'::jsonb),
    'comparisonWinLossData', v_comparison_data,
    'allTags', COALESCE(v_all_tags, ARRAY[]::TEXT[]),
    'calculatedAt', NOW()
  );

  RETURN v_result;
END;
$$;

-- =====================================================
-- FUNCTION: calculate_chart_data_multi
-- =====================================================
-- Calculates chart data for multiple calendars
CREATE OR REPLACE FUNCTION calculate_chart_data_multi(
  p_calendar_ids UUID[],
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

  -- Calculate chart data across all calendars
  -- Match the format of calculate_chart_data (returns array, not object)
  WITH daily_data AS (
    SELECT
      trade_date::DATE as date,
      COALESCE(SUM(amount), 0) as pnl,
      COUNT(*) as trades
    FROM public.trades
    WHERE calendar_id = ANY(p_calendar_ids)
      AND trade_date >= v_start_date
      AND trade_date < v_end_date
    GROUP BY trade_date::DATE
  ),
  cumulative_data AS (
    SELECT
      date,
      pnl,
      SUM(pnl) OVER (ORDER BY date) as cumulative_pnl,
      trades
    FROM daily_data
  )
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
  FROM cumulative_data;

  RETURN v_result;
END;
$$;

-- =====================================================
-- FUNCTION: calculate_tag_performance_multi
-- =====================================================
-- Calculates tag performance for multiple calendars
CREATE OR REPLACE FUNCTION calculate_tag_performance_multi(
  p_calendar_ids UUID[],
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

  -- Calculate tag performance across all calendars
  -- Use a subquery to iterate over each primary tag
  SELECT jsonb_agg(
    jsonb_build_object(
      'tag', tag_name,
      'wins', wins,
      'losses', losses,
      'breakevens', breakevens,
      'total_trades', total_trades,
      'win_rate', win_rate,
      'total_pnl', total_pnl,
      'avg_pnl', avg_pnl
    )
    ORDER BY total_trades DESC
  )
  INTO v_result
  FROM (
    SELECT
      tag_name,
      COUNT(*) FILTER (WHERE t.trade_type = 'win') as wins,
      COUNT(*) FILTER (WHERE t.trade_type = 'loss') as losses,
      COUNT(*) FILTER (WHERE t.trade_type = 'breakeven') as breakevens,
      COUNT(*) as total_trades,
      CASE
        WHEN (COUNT(*) FILTER (WHERE t.trade_type = 'win') + COUNT(*) FILTER (WHERE t.trade_type = 'loss')) > 0 THEN
          ROUND((COUNT(*) FILTER (WHERE t.trade_type = 'win')::DECIMAL /
                 (COUNT(*) FILTER (WHERE t.trade_type = 'win') + COUNT(*) FILTER (WHERE t.trade_type = 'loss'))::DECIMAL) * 100, 2)
        ELSE 0
      END as win_rate,
      COALESCE(SUM(t.amount), 0) as total_pnl,
      COALESCE(AVG(t.amount), 0) as avg_pnl
    FROM unnest(p_primary_tags) as tag_name
    LEFT JOIN public.trades t ON
      t.calendar_id = ANY(p_calendar_ids)
      AND t.trade_date >= v_start_date
      AND t.trade_date < v_end_date
      AND t.tags @> ARRAY[tag_name]
      AND (
        (array_length(p_secondary_tags, 1) > 0 AND t.tags @> p_secondary_tags)
        OR array_length(p_secondary_tags, 1) IS NULL
        OR array_length(p_secondary_tags, 1) = 0
      )
    GROUP BY tag_name
  ) tag_data;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- =====================================================
-- FUNCTION: calculate_economic_event_correlations_multi
-- =====================================================
-- Calculates economic event correlations for multiple calendars
CREATE OR REPLACE FUNCTION calculate_economic_event_correlations_multi(
  p_calendar_ids UUID[],
  p_selected_currency TEXT,
  p_selected_impact TEXT,
  p_time_period TEXT,
  p_selected_date TIMESTAMPTZ
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
  v_losing_correlations JSONB;
  v_winning_correlations JSONB;
  v_correlation_stats JSONB;
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

  -- Calculate losing trade correlations
  SELECT jsonb_agg(
    jsonb_build_object(
      'trade_id', t.id,
      'trade_date', t.trade_date,
      'amount', t.amount,
      'events', (
        SELECT jsonb_agg(event)
        FROM jsonb_array_elements(COALESCE(t.economic_events, '[]'::jsonb)) AS event
        WHERE (p_selected_currency = 'ALL' OR event->>'currency' = p_selected_currency)
          AND event->>'impact' = p_selected_impact
      )
    )
  )
  INTO v_losing_correlations
  FROM public.trades t
  WHERE t.calendar_id = ANY(p_calendar_ids)
    AND t.trade_date >= v_start_date
    AND t.trade_date < v_end_date
    AND t.trade_type = 'loss'
    AND t.economic_events IS NOT NULL
    AND jsonb_array_length(COALESCE(t.economic_events, '[]'::jsonb)) > 0;

  -- Calculate winning trade correlations
  SELECT jsonb_agg(
    jsonb_build_object(
      'trade_id', t.id,
      'trade_date', t.trade_date,
      'amount', t.amount,
      'events', (
        SELECT jsonb_agg(event)
        FROM jsonb_array_elements(COALESCE(t.economic_events, '[]'::jsonb)) AS event
        WHERE (p_selected_currency = 'ALL' OR event->>'currency' = p_selected_currency)
          AND event->>'impact' = p_selected_impact
      )
    )
  )
  INTO v_winning_correlations
  FROM public.trades t
  WHERE t.calendar_id = ANY(p_calendar_ids)
    AND t.trade_date >= v_start_date
    AND t.trade_date < v_end_date
    AND t.trade_type = 'win'
    AND t.economic_events IS NOT NULL
    AND jsonb_array_length(COALESCE(t.economic_events, '[]'::jsonb)) > 0;

  -- Calculate correlation statistics with additional metrics
  WITH trade_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE trade_type = 'loss') as total_losing_trades,
      COUNT(*) FILTER (WHERE trade_type = 'win') as total_winning_trades,
      COUNT(*) FILTER (WHERE trade_type = 'loss' AND economic_events IS NOT NULL AND jsonb_array_length(COALESCE(economic_events, '[]'::jsonb)) > 0) as losing_with_events,
      COUNT(*) FILTER (WHERE trade_type = 'win' AND economic_events IS NOT NULL AND jsonb_array_length(COALESCE(economic_events, '[]'::jsonb)) > 0) as winning_with_events,
      AVG(ABS(amount)) FILTER (WHERE trade_type = 'loss' AND economic_events IS NOT NULL AND jsonb_array_length(COALESCE(economic_events, '[]'::jsonb)) > 0) as avg_loss_with_events,
      AVG(ABS(amount)) FILTER (WHERE trade_type = 'loss' AND (economic_events IS NULL OR jsonb_array_length(COALESCE(economic_events, '[]'::jsonb)) = 0)) as avg_loss_without_events,
      AVG(amount) FILTER (WHERE trade_type = 'win' AND economic_events IS NOT NULL AND jsonb_array_length(COALESCE(economic_events, '[]'::jsonb)) > 0) as avg_win_with_events,
      AVG(amount) FILTER (WHERE trade_type = 'win' AND (economic_events IS NULL OR jsonb_array_length(COALESCE(economic_events, '[]'::jsonb)) = 0)) as avg_win_without_events
    FROM public.trades
    WHERE calendar_id = ANY(p_calendar_ids)
      AND trade_date >= v_start_date
      AND trade_date < v_end_date
  ),
  event_type_stats AS (
    SELECT jsonb_agg(event_stats ORDER BY total_trades DESC) as event_types
    FROM (
      SELECT
        event_name,
        jsonb_build_object(
          'event', event_name,
          'losingTrades', losing_trades,
          'winningTrades', winning_trades,
          'totalLoss', total_loss,
          'totalWin', total_win,
          'avg_loss', CASE WHEN losing_count > 0 THEN total_loss / losing_count ELSE 0 END,
          'avg_win', CASE WHEN winning_count > 0 THEN total_win / winning_count ELSE 0 END,
          'count', total_trades,
          'winRate', CASE WHEN total_trades > 0 THEN (winning_count::DECIMAL / total_trades::DECIMAL) * 100 ELSE 0 END,
          'economicEventDetails', first_event_details
        ) as event_stats,
        total_trades
      FROM (
        SELECT
          event->>'name' as event_name,
          jsonb_agg(to_jsonb(t.*) ORDER BY t.id) FILTER (WHERE t.trade_type = 'loss') as losing_trades,
          jsonb_agg(to_jsonb(t.*) ORDER BY t.id) FILTER (WHERE t.trade_type = 'win') as winning_trades,
          SUM(ABS(t.amount)) FILTER (WHERE t.trade_type = 'loss') as total_loss,
          SUM(t.amount) FILTER (WHERE t.trade_type = 'win') as total_win,
          COUNT(*) FILTER (WHERE t.trade_type = 'loss') as losing_count,
          COUNT(*) FILTER (WHERE t.trade_type = 'win') as winning_count,
          COUNT(*) as total_trades,
          jsonb_build_object(
            'flagCode', (array_agg(event->>'flagCode'))[1],
            'flagUrl', 'https://www.myfxbook.com/images/flags/' || (array_agg(event->>'flagCode'))[1] || '.png'
          ) as first_event_details
        FROM public.trades t,
             jsonb_array_elements(COALESCE(t.economic_events, '[]'::jsonb)) AS event
        WHERE t.calendar_id = ANY(p_calendar_ids)
          AND t.trade_date >= v_start_date
          AND t.trade_date < v_end_date
          AND (
            (p_selected_currency = 'ALL' AND event->>'impact' = p_selected_impact)
            OR (event->>'currency' = p_selected_currency AND event->>'impact' = p_selected_impact)
          )
        GROUP BY event->>'name'
      ) event_aggregates
      ORDER BY total_trades DESC
      LIMIT 9
    ) top_events
  )
  SELECT jsonb_build_object(
    'totalLosingTrades', ts.total_losing_trades,
    'totalWinningTrades', ts.total_winning_trades,
    'losingTradesWithEvents', ts.losing_with_events,
    'winningTradesWithEvents', ts.winning_with_events,
    'anyEventLossCorrelationRate', CASE WHEN ts.total_losing_trades > 0
                                    THEN (ts.losing_with_events::DECIMAL / ts.total_losing_trades::DECIMAL) * 100
                                    ELSE 0 END,
    'anyEventWinCorrelationRate', CASE WHEN ts.total_winning_trades > 0
                                  THEN (ts.winning_with_events::DECIMAL / ts.total_winning_trades::DECIMAL) * 100
                                  ELSE 0 END,
    'avgLossWithEvents', COALESCE(ts.avg_loss_with_events, 0),
    'avgLossWithoutEvents', COALESCE(ts.avg_loss_without_events, 0),
    'avgWinWithEvents', COALESCE(ts.avg_win_with_events, 0),
    'avgWinWithoutEvents', COALESCE(ts.avg_win_without_events, 0),
    'mostCommonEventTypes', COALESCE(ets.event_types, '[]'::jsonb)
  )
  INTO v_correlation_stats
  FROM trade_stats ts
  CROSS JOIN event_type_stats ets;

  -- Build final result (use property names that match the service)
  v_result := jsonb_build_object(
    'losingCorrelations', COALESCE(v_losing_correlations, '[]'::jsonb),
    'winningCorrelations', COALESCE(v_winning_correlations, '[]'::jsonb),
    'stats', v_correlation_stats
  );

  RETURN v_result;
END;
$$;

