-- =====================================================
-- Drop Multi-Calendar Performance Functions
-- =====================================================
-- These functions are no longer needed as we only support
-- single calendar operations

-- Drop multi-calendar functions
DROP FUNCTION IF EXISTS calculate_performance_metrics_multi(UUID[], TEXT, TIMESTAMPTZ, TEXT[]);
DROP FUNCTION IF EXISTS calculate_chart_data_multi(UUID[], TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS calculate_tag_performance_multi(UUID[], TEXT[], TEXT[], TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS calculate_economic_event_correlations_multi(UUID[], TEXT, TEXT, TEXT, TIMESTAMPTZ);

-- Recreate calculate_economic_event_correlations as standalone (not delegating to multi)
-- This function was previously a wrapper that delegated to the multi version
DROP FUNCTION IF EXISTS calculate_economic_event_correlations(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ);

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
  WHERE t.calendar_id = p_calendar_id
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
  WHERE t.calendar_id = p_calendar_id
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
    WHERE calendar_id = p_calendar_id
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
        WHERE t.calendar_id = p_calendar_id
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

GRANT EXECUTE ON FUNCTION calculate_economic_event_correlations(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;

COMMENT ON FUNCTION calculate_economic_event_correlations IS
'Calculates economic event correlations for a single calendar.';
