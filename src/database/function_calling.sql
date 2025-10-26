-- Fixed SQL functions for AI-driven database queries
-- Run this SQL in your Supabase SQL Editor

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


-- Test the function (optional - you can run this to verify it works)
-- SELECT execute_sql('SELECT COUNT(*) as total_embeddings FROM trade_embeddings LIMIT 5');
