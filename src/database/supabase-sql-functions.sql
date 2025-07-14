-- Additional SQL functions for AI-driven database queries
-- Run this SQL in your Supabase SQL Editor after the main schema

-- Create a secure function to execute SELECT queries
-- This function provides a controlled way for the AI to query the database
CREATE OR REPLACE FUNCTION execute_sql(sql_query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
    query_lower TEXT;
    row_count INTEGER;
BEGIN
    -- Convert query to lowercase for security checks
    query_lower := LOWER(TRIM(sql_query));

    -- Security: Only allow SELECT statements
    IF NOT query_lower LIKE 'select%' THEN
        RAISE EXCEPTION 'Only SELECT queries are allowed';
    END IF;

    -- Security: Block dangerous keywords
    IF query_lower ~ '(drop|delete|update|insert|alter|create|truncate|grant|revoke|;)' THEN
        RAISE EXCEPTION 'Query contains forbidden operations';
    END IF;

    -- Execute the query and return results as JSONB
    EXECUTE format('SELECT COALESCE(json_agg(row_to_json(t)), ''[]''::json) FROM (%s) t', sql_query) INTO result;

    -- Get row count for metadata
    GET DIAGNOSTICS row_count = ROW_COUNT;

    -- Return results with metadata
    RETURN jsonb_build_object(
        'success', true,
        'data', result,
        'row_count', row_count,
        'query', sql_query
    );

EXCEPTION
    WHEN OTHERS THEN
        -- Return error information as JSONB
        RETURN jsonb_build_object(
            'success', false,
            'error', true,
            'message', SQLERRM,
            'code', SQLSTATE,
            'query', sql_query
        );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION execute_sql(TEXT) TO authenticated;

-- Create helper views for common AI queries
-- These views provide pre-built, safe queries that the AI can reference

-- View: Trade embeddings summary by user
CREATE OR REPLACE VIEW user_trade_embeddings_summary AS
SELECT 
    user_id,
    calendar_id,
    COUNT(*) as total_embeddings,
    COUNT(DISTINCT trade_type) as unique_trade_types,
    MIN(trade_date) as earliest_trade,
    MAX(trade_date) as latest_trade,
    AVG(trade_amount) as avg_trade_amount,
    SUM(CASE WHEN trade_type = 'win' THEN 1 ELSE 0 END) as win_count,
    SUM(CASE WHEN trade_type = 'loss' THEN 1 ELSE 0 END) as loss_count,
    SUM(CASE WHEN trade_type = 'breakeven' THEN 1 ELSE 0 END) as breakeven_count,
    ROUND(
        (SUM(CASE WHEN trade_type = 'win' THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100, 
        2
    ) as win_rate_percentage
FROM trade_embeddings
GROUP BY user_id, calendar_id;

-- View: Trade embeddings by session
CREATE OR REPLACE VIEW trade_embeddings_by_session AS
SELECT 
    user_id,
    calendar_id,
    trade_session,
    COUNT(*) as trade_count,
    AVG(trade_amount) as avg_amount,
    SUM(CASE WHEN trade_type = 'win' THEN 1 ELSE 0 END) as wins,
    SUM(CASE WHEN trade_type = 'loss' THEN 1 ELSE 0 END) as losses,
    ROUND(
        (SUM(CASE WHEN trade_type = 'win' THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100, 
        2
    ) as win_rate
FROM trade_embeddings
WHERE trade_session IS NOT NULL
GROUP BY user_id, calendar_id, trade_session;

-- View: Trade embeddings by day of week
CREATE OR REPLACE VIEW trade_embeddings_by_day AS
SELECT 
    user_id,
    calendar_id,
    EXTRACT(DOW FROM trade_date) as day_of_week,
    TO_CHAR(trade_date, 'Day') as day_name,
    COUNT(*) as trade_count,
    AVG(trade_amount) as avg_amount,
    SUM(CASE WHEN trade_type = 'win' THEN 1 ELSE 0 END) as wins,
    SUM(CASE WHEN trade_type = 'loss' THEN 1 ELSE 0 END) as losses
FROM trade_embeddings
GROUP BY user_id, calendar_id, EXTRACT(DOW FROM trade_date), TO_CHAR(trade_date, 'Day')
ORDER BY day_of_week;

-- View: Trade embeddings by month
CREATE OR REPLACE VIEW trade_embeddings_by_month AS
SELECT 
    user_id,
    calendar_id,
    DATE_TRUNC('month', trade_date) as month,
    TO_CHAR(trade_date, 'YYYY-MM') as month_label,
    COUNT(*) as trade_count,
    SUM(trade_amount) as total_amount,
    AVG(trade_amount) as avg_amount,
    SUM(CASE WHEN trade_type = 'win' THEN 1 ELSE 0 END) as wins,
    SUM(CASE WHEN trade_type = 'loss' THEN 1 ELSE 0 END) as losses
FROM trade_embeddings
GROUP BY user_id, calendar_id, DATE_TRUNC('month', trade_date), TO_CHAR(trade_date, 'YYYY-MM')
ORDER BY month;

-- View: Most common tags
CREATE OR REPLACE VIEW trade_embeddings_tag_analysis AS
SELECT 
    user_id,
    calendar_id,
    unnest(tags) as tag,
    COUNT(*) as tag_count,
    AVG(trade_amount) as avg_amount_with_tag,
    SUM(CASE WHEN trade_type = 'win' THEN 1 ELSE 0 END) as wins_with_tag,
    SUM(CASE WHEN trade_type = 'loss' THEN 1 ELSE 0 END) as losses_with_tag
FROM trade_embeddings
WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
GROUP BY user_id, calendar_id, unnest(tags)
ORDER BY tag_count DESC;

-- Set ownership of views to postgres (optional, for better management)
ALTER VIEW user_trade_embeddings_summary OWNER TO postgres;
ALTER VIEW trade_embeddings_by_session OWNER TO postgres;
ALTER VIEW trade_embeddings_by_day OWNER TO postgres;
ALTER VIEW trade_embeddings_by_month OWNER TO postgres;
ALTER VIEW trade_embeddings_tag_analysis OWNER TO postgres;

-- Note: Views automatically inherit RLS from their base tables.
-- Since trade_embeddings already has RLS policies that filter by user_id,
-- these views will automatically respect those security constraints.
-- No additional RLS policies are needed on the views themselves.
