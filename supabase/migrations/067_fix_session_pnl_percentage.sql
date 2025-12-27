-- Fix session pnlPercentage calculation
-- Previously pnlPercentage was hardcoded to 0.0 with comment "calculated client-side"
-- This migration calculates it server-side using the calendar's account_balance

DROP FUNCTION IF EXISTS calculate_chart_data(UUID, TEXT, TIMESTAMPTZ);

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
  v_chart_data JSONB;
  v_trades JSONB;
  v_performance_metrics JSONB;
  v_economic_correlations JSONB;
  v_result JSONB;
  v_account_balance DECIMAL(15,2);
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

  -- Fetch account_balance from calendar for pnlPercentage calculation
  SELECT COALESCE(account_balance, 0)
  INTO v_account_balance
  FROM public.calendars
  WHERE id = p_calendar_id;

  -- =====================================================
  -- 1. Calculate cumulative P&L chart data
  -- =====================================================
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', date,
      'pnl', pnl,
      'cumulativePnl', cumulative_pnl,
      'trades', trades
    )
    ORDER BY date
  )
  INTO v_chart_data
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

  -- =====================================================
  -- 2. Fetch all individual trades
  -- =====================================================
  SELECT jsonb_agg(to_jsonb(t.*) ORDER BY t.trade_date, t.created_at)
  INTO v_trades
  FROM public.trades t
  WHERE t.calendar_id = p_calendar_id
    AND t.trade_date >= v_start_date
    AND t.trade_date < v_end_date;

  -- =====================================================
  -- 3. Calculate comprehensive performance metrics
  -- =====================================================
  WITH trade_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE trade_type = 'win') as total_wins,
      COUNT(*) FILTER (WHERE trade_type = 'loss') as total_losses,
      COUNT(*) FILTER (WHERE trade_type = 'breakeven') as total_breakevens,
      COUNT(*) as total_trades,
      COALESCE(AVG(amount) FILTER (WHERE trade_type = 'win'), 0) as avg_win,
      COALESCE(AVG(amount) FILTER (WHERE trade_type = 'loss'), 0) as avg_loss,
      COALESCE(AVG(amount) FILTER (WHERE trade_type = 'breakeven'), 0) as avg_breakeven
    FROM public.trades
    WHERE calendar_id = p_calendar_id
      AND trade_date >= v_start_date
      AND trade_date < v_end_date
  ),
  -- Consecutive stats using islands and gaps technique
  consecutive_stats AS (
    WITH ordered_trades AS (
      SELECT
        trade_type,
        trade_date,
        ROW_NUMBER() OVER (ORDER BY trade_date, created_at) -
        ROW_NUMBER() OVER (PARTITION BY trade_type ORDER BY trade_date, created_at) as grp
      FROM public.trades
      WHERE calendar_id = p_calendar_id
        AND trade_date >= v_start_date
        AND trade_date < v_end_date
        AND trade_type IN ('win', 'loss')
    ),
    streaks AS (
      SELECT
        trade_type,
        COUNT(*) as streak_length
      FROM ordered_trades
      GROUP BY trade_type, grp
    )
    SELECT
      MAX(streak_length) FILTER (WHERE trade_type = 'win') as max_consecutive_wins,
      COALESCE(AVG(streak_length) FILTER (WHERE trade_type = 'win'), 0) as avg_consecutive_wins,
      MAX(streak_length) FILTER (WHERE trade_type = 'loss') as max_consecutive_losses,
      COALESCE(AVG(streak_length) FILTER (WHERE trade_type = 'loss'), 0) as avg_consecutive_losses
    FROM streaks
  ),
  tag_stats AS (
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
    ) as tag_stats_data
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
      GROUP BY tag
    ) tag_data
  ),
  -- FIXED: Daily summary with correct field names
  daily_summary AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'trade_date', trade_date,
        'trades', total_trades,          -- FIXED: changed from 'total_trades'
        'wins', wins,
        'losses', losses,
        'breakevens', breakevens,
        'win_rate', win_rate,
        'pnl', total_pnl,                -- FIXED: changed from 'total_pnl'
        'cumulative_pnl', cumulative_pnl,
        'session', most_common_session   -- ADDED: session field
      )
      ORDER BY trade_date
    ) as daily_summary_data
    FROM (
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
        COALESCE(SUM(amount), 0) as total_pnl,
        SUM(COALESCE(SUM(amount), 0)) OVER (ORDER BY trade_date::DATE) as cumulative_pnl,
        MODE() WITHIN GROUP (ORDER BY session) as most_common_session  -- ADDED: Calculate most common session
      FROM public.trades
      WHERE calendar_id = p_calendar_id
        AND trade_date >= v_start_date
        AND trade_date < v_end_date
      GROUP BY trade_date::DATE
    ) daily_data
  ),
  -- Correct risk/reward data structure with date and rr
  risk_reward_stats AS (
    SELECT jsonb_build_object(
      'average', COALESCE(AVG(risk_to_reward), 0),
      'max', COALESCE(MAX(risk_to_reward), 0),
      'data', jsonb_agg(
        jsonb_build_object(
          'date', trade_date,
          'rr', risk_to_reward
        )
        ORDER BY trade_date
      )
    ) as risk_reward_data
    FROM public.trades
    WHERE calendar_id = p_calendar_id
      AND trade_date >= v_start_date
      AND trade_date < v_end_date
      AND risk_to_reward IS NOT NULL
  ),
  -- Define all 4 trading sessions
  all_sessions AS (
    SELECT unnest(ARRAY['Asia', 'London', 'NY AM', 'NY PM']) AS session
  ),
  -- Calculate stats for sessions that have trades
  actual_session_data AS (
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
      COALESCE(SUM(amount), 0) as total_pnl,
      COALESCE(AVG(amount), 0) as averagePnL
    FROM public.trades
    WHERE calendar_id = p_calendar_id
      AND trade_date >= v_start_date
      AND trade_date < v_end_date
      AND session IS NOT NULL
    GROUP BY session
  ),
  -- LEFT JOIN to ensure all 4 sessions are returned, even with 0 trades
  -- FIXED: Now calculates pnlPercentage using account_balance
  session_stats AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'session', s.session,
        'total_trades', COALESCE(asd.total_trades, 0),
        'winners', COALESCE(asd.wins, 0),
        'losers', COALESCE(asd.losses, 0),
        'win_rate', COALESCE(asd.win_rate, 0),
        'total_pnl', COALESCE(asd.total_pnl, 0),
        'averagePnL', COALESCE(asd.averagePnL, 0),
        'pnlPercentage', CASE
          WHEN v_account_balance > 0 THEN
            ROUND((COALESCE(asd.total_pnl, 0) / v_account_balance) * 100, 2)
          ELSE 0
        END
      )
      ORDER BY
        CASE s.session
          WHEN 'Asia' THEN 1
          WHEN 'London' THEN 2
          WHEN 'NY AM' THEN 3
          WHEN 'NY PM' THEN 4
        END
    ) as session_stats_data
    FROM all_sessions s
    LEFT JOIN actual_session_data asd ON s.session = asd.session
  ),
  all_tags AS (
    SELECT ARRAY_AGG(DISTINCT tag) as all_tags_data
    FROM (
      SELECT unnest(tags) as tag
      FROM public.trades
      WHERE calendar_id = p_calendar_id
        AND trade_date >= v_start_date
        AND trade_date < v_end_date
    ) tags_list
  )
  SELECT jsonb_build_object(
    'winLossStats', jsonb_build_object(
      'winners', jsonb_build_object(
        'total', ts.total_wins,
        'avgAmount', ts.avg_win,
        'maxConsecutive', COALESCE(cs.max_consecutive_wins, 0),
        'avgConsecutive', ROUND(COALESCE(cs.avg_consecutive_wins, 0), 1)
      ),
      'losers', jsonb_build_object(
        'total', ts.total_losses,
        'avgAmount', ts.avg_loss,
        'maxConsecutive', COALESCE(cs.max_consecutive_losses, 0),
        'avgConsecutive', ROUND(COALESCE(cs.avg_consecutive_losses, 0), 1)
      ),
      'breakevens', jsonb_build_object(
        'total', ts.total_breakevens,
        'avgAmount', ts.avg_breakeven
      ),
      'total_trades', ts.total_trades,
      'win_rate', CASE
        WHEN (ts.total_wins + ts.total_losses) > 0 THEN
          ROUND((ts.total_wins::DECIMAL / (ts.total_wins + ts.total_losses)::DECIMAL) * 100, 2)
        ELSE 0
      END
    ),
    'tagStats', COALESCE(tgs.tag_stats_data, '[]'::jsonb),
    'dailySummaryData', COALESCE(ds.daily_summary_data, '[]'::jsonb),
    'riskRewardStats', COALESCE(rrs.risk_reward_data, jsonb_build_object('average', 0, 'max', 0, 'data', '[]'::jsonb)),
    'sessionStats', COALESCE(ss.session_stats_data, '[]'::jsonb),
    'allTags', COALESCE(at.all_tags_data, ARRAY[]::TEXT[]),
    'winLossData', jsonb_build_array(
      jsonb_build_object('name', 'Wins', 'value', ts.total_wins),
      jsonb_build_object('name', 'Losses', 'value', ts.total_losses),
      jsonb_build_object('name', 'Breakeven', 'value', ts.total_breakevens)
    )
  ) INTO v_performance_metrics
  FROM trade_stats ts
  CROSS JOIN consecutive_stats cs
  CROSS JOIN LATERAL (SELECT tag_stats_data FROM tag_stats) tgs
  CROSS JOIN LATERAL (SELECT daily_summary_data FROM daily_summary) ds
  CROSS JOIN LATERAL (SELECT risk_reward_data FROM risk_reward_stats) rrs
  CROSS JOIN LATERAL (SELECT session_stats_data FROM session_stats) ss
  CROSS JOIN LATERAL (SELECT all_tags_data FROM all_tags) at;

  -- =====================================================
  -- 4. Calculate economic correlations with averages
  -- =====================================================
  WITH high_impact_correlations AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'trade', to_jsonb(t.*),
        'economic_events', filtered_events,
        'hasHighImpactEvents', jsonb_array_length(filtered_events) > 0,
        'hasMediumImpactEvents', false,
        'eventCount', jsonb_array_length(filtered_events)
      )
    ) as losing_correlations
    FROM (
      SELECT
        t.*,
        (
          SELECT jsonb_agg(event)
          FROM jsonb_array_elements(COALESCE(t.economic_events, '[]'::jsonb)) AS event
          WHERE event->>'impact' = 'High'
        ) AS filtered_events
      FROM public.trades t
      WHERE t.calendar_id = p_calendar_id
        AND t.trade_date >= v_start_date
        AND t.trade_date < v_end_date
        AND t.trade_type = 'loss'
    ) t
    WHERE filtered_events IS NOT NULL AND jsonb_array_length(filtered_events) > 0
  ),
  high_impact_winning AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'trade', to_jsonb(t.*),
        'economic_events', filtered_events,
        'hasHighImpactEvents', jsonb_array_length(filtered_events) > 0,
        'hasMediumImpactEvents', false,
        'eventCount', jsonb_array_length(filtered_events)
      )
    ) as winning_correlations
    FROM (
      SELECT
        t.*,
        (
          SELECT jsonb_agg(event)
          FROM jsonb_array_elements(COALESCE(t.economic_events, '[]'::jsonb)) AS event
          WHERE event->>'impact' = 'High'
        ) AS filtered_events
      FROM public.trades t
      WHERE t.calendar_id = p_calendar_id
        AND t.trade_date >= v_start_date
        AND t.trade_date < v_end_date
        AND t.trade_type = 'win'
    ) t
    WHERE filtered_events IS NOT NULL AND jsonb_array_length(filtered_events) > 0
  ),
  -- Calculate sum totals for average calculations
  high_impact_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE trade_type = 'loss') as total_losing,
      COUNT(*) FILTER (WHERE trade_type = 'win') as total_winning,
      COUNT(*) FILTER (
        WHERE trade_type = 'loss' AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(economic_events, '[]'::jsonb)) AS event
          WHERE event->>'impact' = 'High'
        )
      ) as losing_with_events,
      COUNT(*) FILTER (
        WHERE trade_type = 'win' AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(economic_events, '[]'::jsonb)) AS event
          WHERE event->>'impact' = 'High'
        )
      ) as winning_with_events,
      -- Sum totals for averages
      COALESCE(SUM(ABS(amount)) FILTER (
        WHERE trade_type = 'loss' AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(economic_events, '[]'::jsonb)) AS event
          WHERE event->>'impact' = 'High'
        )
      ), 0) as total_loss_with_events,
      COALESCE(SUM(amount) FILTER (
        WHERE trade_type = 'win' AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(economic_events, '[]'::jsonb)) AS event
          WHERE event->>'impact' = 'High'
        )
      ), 0) as total_win_with_events,
      COUNT(*) FILTER (
        WHERE trade_type = 'loss' AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(economic_events, '[]'::jsonb)) AS event
          WHERE event->>'impact' = 'High'
        )
      ) as losing_without_events,
      COUNT(*) FILTER (
        WHERE trade_type = 'win' AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(economic_events, '[]'::jsonb)) AS event
          WHERE event->>'impact' = 'High'
        )
      ) as winning_without_events,
      COALESCE(SUM(ABS(amount)) FILTER (
        WHERE trade_type = 'loss' AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(economic_events, '[]'::jsonb)) AS event
          WHERE event->>'impact' = 'High'
        )
      ), 0) as total_loss_without_events,
      COALESCE(SUM(amount) FILTER (
        WHERE trade_type = 'win' AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(economic_events, '[]'::jsonb)) AS event
          WHERE event->>'impact' = 'High'
        )
      ), 0) as total_win_without_events
    FROM public.trades
    WHERE calendar_id = p_calendar_id
      AND trade_date >= v_start_date
      AND trade_date < v_end_date
  ),
  medium_impact_correlations AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'trade', to_jsonb(t.*),
        'economic_events', filtered_events,
        'hasHighImpactEvents', false,
        'hasMediumImpactEvents', jsonb_array_length(filtered_events) > 0,
        'eventCount', jsonb_array_length(filtered_events)
      )
    ) as losing_correlations
    FROM (
      SELECT
        t.*,
        (
          SELECT jsonb_agg(event)
          FROM jsonb_array_elements(COALESCE(t.economic_events, '[]'::jsonb)) AS event
          WHERE event->>'impact' = 'Medium'
        ) AS filtered_events
      FROM public.trades t
      WHERE t.calendar_id = p_calendar_id
        AND t.trade_date >= v_start_date
        AND t.trade_date < v_end_date
        AND t.trade_type = 'loss'
    ) t
    WHERE filtered_events IS NOT NULL AND jsonb_array_length(filtered_events) > 0
  ),
  medium_impact_winning AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'trade', to_jsonb(t.*),
        'economic_events', filtered_events,
        'hasHighImpactEvents', false,
        'hasMediumImpactEvents', jsonb_array_length(filtered_events) > 0,
        'eventCount', jsonb_array_length(filtered_events)
      )
    ) as winning_correlations
    FROM (
      SELECT
        t.*,
        (
          SELECT jsonb_agg(event)
          FROM jsonb_array_elements(COALESCE(t.economic_events, '[]'::jsonb)) AS event
          WHERE event->>'impact' = 'Medium'
        ) AS filtered_events
      FROM public.trades t
      WHERE t.calendar_id = p_calendar_id
        AND t.trade_date >= v_start_date
        AND t.trade_date < v_end_date
        AND t.trade_type = 'win'
    ) t
    WHERE filtered_events IS NOT NULL AND jsonb_array_length(filtered_events) > 0
  ),
  -- Calculate sum totals for average calculations
  medium_impact_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE trade_type = 'loss') as total_losing,
      COUNT(*) FILTER (WHERE trade_type = 'win') as total_winning,
      COUNT(*) FILTER (
        WHERE trade_type = 'loss' AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(economic_events, '[]'::jsonb)) AS event
          WHERE event->>'impact' = 'Medium'
        )
      ) as losing_with_events,
      COUNT(*) FILTER (
        WHERE trade_type = 'win' AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(economic_events, '[]'::jsonb)) AS event
          WHERE event->>'impact' = 'Medium'
        )
      ) as winning_with_events,
      -- Sum totals for averages
      COALESCE(SUM(ABS(amount)) FILTER (
        WHERE trade_type = 'loss' AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(economic_events, '[]'::jsonb)) AS event
          WHERE event->>'impact' = 'Medium'
        )
      ), 0) as total_loss_with_events,
      COALESCE(SUM(amount) FILTER (
        WHERE trade_type = 'win' AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(economic_events, '[]'::jsonb)) AS event
          WHERE event->>'impact' = 'Medium'
        )
      ), 0) as total_win_with_events,
      COUNT(*) FILTER (
        WHERE trade_type = 'loss' AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(economic_events, '[]'::jsonb)) AS event
          WHERE event->>'impact' = 'Medium'
        )
      ) as losing_without_events,
      COUNT(*) FILTER (
        WHERE trade_type = 'win' AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(economic_events, '[]'::jsonb)) AS event
          WHERE event->>'impact' = 'Medium'
        )
      ) as winning_without_events,
      COALESCE(SUM(ABS(amount)) FILTER (
        WHERE trade_type = 'loss' AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(economic_events, '[]'::jsonb)) AS event
          WHERE event->>'impact' = 'Medium'
        )
      ), 0) as total_loss_without_events,
      COALESCE(SUM(amount) FILTER (
        WHERE trade_type = 'win' AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(economic_events, '[]'::jsonb)) AS event
          WHERE event->>'impact' = 'Medium'
        )
      ), 0) as total_win_without_events
    FROM public.trades
    WHERE calendar_id = p_calendar_id
      AND trade_date >= v_start_date
      AND trade_date < v_end_date
  ),
  high_impact_event_types AS (
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
          'win_rate', CASE WHEN total_trades > 0 THEN (winning_count::DECIMAL / total_trades::DECIMAL) * 100 ELSE 0 END,
          'economicEventDetails', first_event_details
        ) as event_stats,
        total_trades
      FROM (
        SELECT
          event->>'name' as event_name,
          jsonb_agg(t.* ORDER BY t.id) FILTER (WHERE t.trade_type = 'loss') as losing_trades,
          jsonb_agg(t.* ORDER BY t.id) FILTER (WHERE t.trade_type = 'win') as winning_trades,
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
          AND event->>'impact' = 'High'
        GROUP BY event->>'name'
      ) event_aggregates
      ORDER BY total_trades DESC
      LIMIT 9
    ) top_events
  ),
  medium_impact_event_types AS (
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
          'win_rate', CASE WHEN total_trades > 0 THEN (winning_count::DECIMAL / total_trades::DECIMAL) * 100 ELSE 0 END,
          'economicEventDetails', first_event_details
        ) as event_stats,
        total_trades
      FROM (
        SELECT
          event->>'name' as event_name,
          jsonb_agg(t.* ORDER BY t.id) FILTER (WHERE t.trade_type = 'loss') as losing_trades,
          jsonb_agg(t.* ORDER BY t.id) FILTER (WHERE t.trade_type = 'win') as winning_trades,
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
          AND event->>'impact' = 'Medium'
        GROUP BY event->>'name'
      ) event_aggregates
      ORDER BY total_trades DESC
      LIMIT 9
    ) top_events
  )
  SELECT jsonb_build_object(
    'high', jsonb_build_object(
      'losingTradeCorrelations', COALESCE(hic.losing_correlations, '[]'::jsonb),
      'winningTradeCorrelations', COALESCE(hiw.winning_correlations, '[]'::jsonb),
      'correlationStats', jsonb_build_object(
        'totalLosingTrades', his.total_losing,
        'totalWinningTrades', his.total_winning,
        'losingTradesWithEvents', his.losing_with_events,
        'winningTradesWithEvents', his.winning_with_events,
        'anyEventLossCorrelationRate', CASE
          WHEN his.total_losing > 0 THEN (his.losing_with_events::DECIMAL / his.total_losing::DECIMAL) * 100
          ELSE 0
        END,
        'anyEventWinCorrelationRate', CASE
          WHEN his.total_winning > 0 THEN (his.winning_with_events::DECIMAL / his.total_winning::DECIMAL) * 100
          ELSE 0
        END,
        -- Average calculations
        'avgLossWithEvents', CASE
          WHEN his.losing_with_events > 0 THEN his.total_loss_with_events / his.losing_with_events
          ELSE 0
        END,
        'avgLossWithoutEvents', CASE
          WHEN his.losing_without_events > 0 THEN his.total_loss_without_events / his.losing_without_events
          ELSE 0
        END,
        'avgWinWithEvents', CASE
          WHEN his.winning_with_events > 0 THEN his.total_win_with_events / his.winning_with_events
          ELSE 0
        END,
        'avgWinWithoutEvents', CASE
          WHEN his.winning_without_events > 0 THEN his.total_win_without_events / his.winning_without_events
          ELSE 0
        END,
        'mostCommonEventTypes', COALESCE(hiet.event_types, '[]'::jsonb)
      )
    ),
    'medium', jsonb_build_object(
      'losingTradeCorrelations', COALESCE(mic.losing_correlations, '[]'::jsonb),
      'winningTradeCorrelations', COALESCE(miw.winning_correlations, '[]'::jsonb),
      'correlationStats', jsonb_build_object(
        'totalLosingTrades', mis.total_losing,
        'totalWinningTrades', mis.total_winning,
        'losingTradesWithEvents', mis.losing_with_events,
        'winningTradesWithEvents', mis.winning_with_events,
        'anyEventLossCorrelationRate', CASE
          WHEN mis.total_losing > 0 THEN (mis.losing_with_events::DECIMAL / mis.total_losing::DECIMAL) * 100
          ELSE 0
        END,
        'anyEventWinCorrelationRate', CASE
          WHEN mis.total_winning > 0 THEN (mis.winning_with_events::DECIMAL / mis.total_winning::DECIMAL) * 100
          ELSE 0
        END,
        -- Average calculations
        'avgLossWithEvents', CASE
          WHEN mis.losing_with_events > 0 THEN mis.total_loss_with_events / mis.losing_with_events
          ELSE 0
        END,
        'avgLossWithoutEvents', CASE
          WHEN mis.losing_without_events > 0 THEN mis.total_loss_without_events / mis.losing_without_events
          ELSE 0
        END,
        'avgWinWithEvents', CASE
          WHEN mis.winning_with_events > 0 THEN mis.total_win_with_events / mis.winning_with_events
          ELSE 0
        END,
        'avgWinWithoutEvents', CASE
          WHEN mis.winning_without_events > 0 THEN mis.total_win_without_events / mis.winning_without_events
          ELSE 0
        END,
        'mostCommonEventTypes', COALESCE(miet.event_types, '[]'::jsonb)
      )
    )
  ) INTO v_economic_correlations
  FROM high_impact_correlations hic
  CROSS JOIN high_impact_winning hiw
  CROSS JOIN high_impact_stats his
  CROSS JOIN high_impact_event_types hiet
  CROSS JOIN medium_impact_correlations mic
  CROSS JOIN medium_impact_winning miw
  CROSS JOIN medium_impact_stats mis
  CROSS JOIN medium_impact_event_types miet;

  -- =====================================================
  -- 5. Build comprehensive result
  -- =====================================================
  v_result := jsonb_build_object(
    'chartData', COALESCE(v_chart_data, '[]'::jsonb),
    'trades', COALESCE(v_trades, '[]'::jsonb),
    'performanceMetrics', COALESCE(v_performance_metrics, '{}'::jsonb),
    'economicCorrelations', COALESCE(v_economic_correlations, '{}'::jsonb)
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION calculate_chart_data(UUID, TEXT, TIMESTAMPTZ) TO authenticated;

COMMENT ON FUNCTION calculate_chart_data IS
'Comprehensive chart data function with FIXED session pnlPercentage calculation.
Changes in this migration:
- Added v_account_balance variable to fetch calendar account_balance
- pnlPercentage now calculated as: (total_pnl / account_balance) * 100
- Previously was hardcoded to 0.0';
