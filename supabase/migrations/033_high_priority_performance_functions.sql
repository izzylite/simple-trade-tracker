-- =====================================================
-- High Priority Performance RPC Functions
-- =====================================================
-- These functions move complex calculations from client to server
-- for better performance with large datasets

-- =====================================================
-- FUNCTION: calculate_economic_event_correlations
-- =====================================================
-- Analyzes correlation between economic events and trade outcomes
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
  v_losing_correlations JSONB;
  v_winning_correlations JSONB;
  v_correlation_stats JSONB;
  v_total_losing_trades INT;
  v_total_winning_trades INT;
  v_losing_with_events INT;
  v_winning_with_events INT;
  v_event_type_stats JSONB;
  v_impact_distribution JSONB;
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

  -- Get losing trade correlations
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'trade', to_jsonb(t.*),
        'economic_events', filtered_events,
        'hasHighImpactEvents', jsonb_array_length(filtered_events) > 0,
        'hasMediumImpactEvents', jsonb_array_length(filtered_events) > 0,
        'eventCount', jsonb_array_length(filtered_events)
      )
    )
  INTO v_losing_correlations
  FROM (
    SELECT 
      t.*,
      CASE
        WHEN p_selected_currency = 'ALL' THEN
          (
            SELECT jsonb_agg(event)
            FROM jsonb_array_elements(COALESCE(t.economic_events, '[]'::jsonb)) AS event
            WHERE event->>'impact' = p_selected_impact
          )
        ELSE
          (
            SELECT jsonb_agg(event)
            FROM jsonb_array_elements(COALESCE(t.economic_events, '[]'::jsonb)) AS event
            WHERE event->>'currency' = p_selected_currency
              AND event->>'impact' = p_selected_impact
          )
      END AS filtered_events
    FROM public.trades t
    WHERE t.calendar_id = p_calendar_id
      AND t.trade_date >= v_start_date
      AND t.trade_date < v_end_date
      AND t.trade_type = 'loss'
  ) t
  WHERE filtered_events IS NOT NULL;

  -- Get winning trade correlations
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'trade', to_jsonb(t.*),
        'economic_events', filtered_events,
        'hasHighImpactEvents', jsonb_array_length(filtered_events) > 0,
        'hasMediumImpactEvents', jsonb_array_length(filtered_events) > 0,
        'eventCount', jsonb_array_length(filtered_events)
      )
    )
  INTO v_winning_correlations
  FROM (
    SELECT 
      t.*,
      CASE
        WHEN p_selected_currency = 'ALL' THEN
          (
            SELECT jsonb_agg(event)
            FROM jsonb_array_elements(COALESCE(t.economic_events, '[]'::jsonb)) AS event
            WHERE event->>'impact' = p_selected_impact
          )
        ELSE
          (
            SELECT jsonb_agg(event)
            FROM jsonb_array_elements(COALESCE(t.economic_events, '[]'::jsonb)) AS event
            WHERE event->>'currency' = p_selected_currency
              AND event->>'impact' = p_selected_impact
          )
      END AS filtered_events
    FROM public.trades t
    WHERE t.calendar_id = p_calendar_id
      AND t.trade_date >= v_start_date
      AND t.trade_date < v_end_date
      AND t.trade_type = 'win'
  ) t
  WHERE filtered_events IS NOT NULL;

  -- Calculate counts
  SELECT COUNT(*) INTO v_total_losing_trades
  FROM public.trades
  WHERE calendar_id = p_calendar_id
    AND trade_date >= v_start_date
    AND trade_date < v_end_date
    AND trade_type = 'loss';

  SELECT COUNT(*) INTO v_total_winning_trades
  FROM public.trades
  WHERE calendar_id = p_calendar_id
    AND trade_date >= v_start_date
    AND trade_date < v_end_date
    AND trade_type = 'win';

  -- Count trades with events
  SELECT 
    COUNT(*) FILTER (WHERE jsonb_array_length(COALESCE(filtered_events, '[]'::jsonb)) > 0)
  INTO v_losing_with_events
  FROM (
    SELECT 
      CASE
        WHEN p_selected_currency = 'ALL' THEN
          (
            SELECT jsonb_agg(event)
            FROM jsonb_array_elements(COALESCE(economic_events, '[]'::jsonb)) AS event
            WHERE event->>'impact' = p_selected_impact
          )
        ELSE
          (
            SELECT jsonb_agg(event)
            FROM jsonb_array_elements(COALESCE(economic_events, '[]'::jsonb)) AS event
            WHERE event->>'currency' = p_selected_currency
              AND event->>'impact' = p_selected_impact
          )
      END AS filtered_events
    FROM public.trades
    WHERE calendar_id = p_calendar_id
      AND trade_date >= v_start_date
      AND trade_date < v_end_date
      AND trade_type = 'loss'
  ) losing_events;

  SELECT 
    COUNT(*) FILTER (WHERE jsonb_array_length(COALESCE(filtered_events, '[]'::jsonb)) > 0)
  INTO v_winning_with_events
  FROM (
    SELECT 
      CASE
        WHEN p_selected_currency = 'ALL' THEN
          (
            SELECT jsonb_agg(event)
            FROM jsonb_array_elements(COALESCE(economic_events, '[]'::jsonb)) AS event
            WHERE event->>'impact' = p_selected_impact
          )
        ELSE
          (
            SELECT jsonb_agg(event)
            FROM jsonb_array_elements(COALESCE(economic_events, '[]'::jsonb)) AS event
            WHERE event->>'currency' = p_selected_currency
              AND event->>'impact' = p_selected_impact
          )
      END AS filtered_events
    FROM public.trades
    WHERE calendar_id = p_calendar_id
      AND trade_date >= v_start_date
      AND trade_date < v_end_date
      AND trade_type = 'win'
  ) winning_events;

  -- Calculate most common event types (top 9)
  SELECT jsonb_agg(event_stats ORDER BY total_trades DESC)
  INTO v_event_type_stats
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
        jsonb_agg(DISTINCT t.* ORDER BY t.id) FILTER (WHERE t.trade_type = 'loss') as losing_trades,
        jsonb_agg(DISTINCT t.* ORDER BY t.id) FILTER (WHERE t.trade_type = 'win') as winning_trades,
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
  ) top_events;

  -- Calculate impact distribution
  SELECT jsonb_object_agg(impact, count)
  INTO v_impact_distribution
  FROM (
    SELECT 
      event->>'impact' as impact,
      COUNT(*) as count
    FROM public.trades t,
         jsonb_array_elements(COALESCE(t.economic_events, '[]'::jsonb)) AS event
    WHERE t.calendar_id = p_calendar_id
      AND t.trade_date >= v_start_date
      AND t.trade_date < v_end_date
      AND (
        (p_selected_currency = 'ALL' AND event->>'impact' = p_selected_impact)
        OR (event->>'currency' = p_selected_currency AND event->>'impact' = p_selected_impact)
      )
    GROUP BY event->>'impact'
  ) impact_counts;

  -- Build correlation stats
  v_correlation_stats := jsonb_build_object(
    'totalLosingTrades', v_total_losing_trades,
    'totalWinningTrades', v_total_winning_trades,
    'losingTradesWithEvents', v_losing_with_events,
    'winningTradesWithEvents', v_winning_with_events,
    'anyEventLossCorrelationRate', CASE WHEN v_total_losing_trades > 0 THEN (v_losing_with_events::DECIMAL / v_total_losing_trades::DECIMAL) * 100 ELSE 0 END,
    'anyEventWinCorrelationRate', CASE WHEN v_total_winning_trades > 0 THEN (v_winning_with_events::DECIMAL / v_total_winning_trades::DECIMAL) * 100 ELSE 0 END,
    'mostCommonEventTypes', COALESCE(v_event_type_stats, '[]'::jsonb),
    'impactDistribution', COALESCE(v_impact_distribution, '{}'::jsonb)
  );

  RETURN jsonb_build_object(
    'losingTradeCorrelations', COALESCE(v_losing_correlations, '[]'::jsonb),
    'winningTradeCorrelations', COALESCE(v_winning_correlations, '[]'::jsonb),
    'correlationStats', v_correlation_stats
  );
END;
$$;

GRANT EXECUTE ON FUNCTION calculate_economic_event_correlations(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;

COMMENT ON FUNCTION calculate_economic_event_correlations IS
'Analyzes correlation between economic events and trade outcomes. Returns losing/winning trade correlations and statistics.';

