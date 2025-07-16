# AI Database Query Function Setup

This guide explains how to set up the AI database query function that allows your AI assistant to execute SQL queries directly against your Supabase database.

## 🎯 What This Adds

- **Direct Database Access**: AI can query your Supabase database directly
- **Flexible Analysis**: AI can create custom queries for complex analysis
- **Real-time Data**: Access to the most current data in your database
- **Advanced Insights**: Complex aggregations and joins that aren't possible with pre-built functions

## 🔧 Setup Instructions

### 1. Run the SQL Setup

1. Go to your Supabase dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `src/database/supabase-sql-functions.sql`
4. Click **Run** to execute the SQL

This creates:
- `execute_sql()` function for secure query execution
- Helper views for common queries
- Proper security restrictions

### 2. Security Features

The implementation includes several security measures:

- **SELECT Only**: Only SELECT queries are allowed
- **Keyword Filtering**: Blocks dangerous operations (DROP, DELETE, etc.)
- **User Isolation**: Automatically adds user_id filters where needed
- **Error Handling**: Safe error reporting without exposing sensitive data

## 🚀 How It Works

### Available Database Tables

1. **trade_embeddings** - Raw trade data with vector embeddings
   - `trade_id`, `user_id`, `calendar_id`
   - `trade_type`, `trade_amount`, `trade_date`
   - `trade_session`, `tags[]`
   - `embedding` (vector), `embedded_content`

2. **embedding_metadata** - Embedding sync tracking
   - `user_id`, `calendar_id`
   - `model_name`, `total_trades`, `last_sync_at`

### Database Tables

The AI performs all aggregations directly on the main table:

1. **trade_embeddings** - Main table containing all trade data
   - All trade information with vector embeddings
   - Use this table for all queries and aggregations
   - No need for pre-built views - AI can create any aggregation on demand

## 💡 Example AI Queries

The AI can now handle queries like:

### Basic Queries
- "How many trades do I have in the database?"
- "What's my win rate by trading session?"
- "Show me my monthly performance trends"

### Advanced Analysis
- "Which tags have the highest win rates?"
- "What's my average trade size by day of week?"
- "Show me trades from the last 30 days with specific tags"

### Custom SQL
- "Run a query to find my best performing months"
- "Analyze correlation between trade session and profitability"
- "Get detailed statistics for trades with multiple tags"

## 🔍 Sample Queries the AI Might Generate

```sql
-- Monthly performance summary
SELECT
    TO_CHAR(to_timestamp(trade_date / 1000), 'YYYY-MM') as month_label,
    COUNT(*) as trade_count,
    SUM(trade_amount) as total_amount,
    SUM(CASE WHEN trade_type = 'win' THEN 1 ELSE 0 END) as wins,
    SUM(CASE WHEN trade_type = 'loss' THEN 1 ELSE 0 END) as losses,
    ROUND((SUM(CASE WHEN trade_type = 'win' THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100, 2) as win_rate
FROM trade_embeddings
WHERE user_id = 'user123'
GROUP BY TO_CHAR(to_timestamp(trade_date / 1000), 'YYYY-MM')
ORDER BY month_label;

-- Best performing tags
SELECT
    unnest(tags) as tag,
    COUNT(*) as tag_count,
    SUM(CASE WHEN trade_type = 'win' THEN 1 ELSE 0 END) as wins_with_tag,
    SUM(CASE WHEN trade_type = 'loss' THEN 1 ELSE 0 END) as losses_with_tag,
    ROUND((SUM(CASE WHEN trade_type = 'win' THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100, 2) as tag_win_rate
FROM trade_embeddings
WHERE user_id = 'user123' AND tags IS NOT NULL AND array_length(tags, 1) > 0
GROUP BY unnest(tags)
ORDER BY tag_win_rate DESC
LIMIT 10;

-- Session performance comparison
SELECT
    trade_session,
    COUNT(*) as trade_count,
    AVG(trade_amount) as avg_amount,
    ROUND((SUM(CASE WHEN trade_type = 'win' THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100, 2) as win_rate
FROM trade_embeddings
WHERE user_id = 'user123' AND trade_session IS NOT NULL
GROUP BY trade_session
ORDER BY win_rate DESC;
```

## 🛡️ Security Considerations

### What's Protected
- Only SELECT queries allowed
- Automatic user_id AND calendar_id filtering
- No access to other users' or calendars' data
- Blocked dangerous SQL operations

### What's Allowed
- Complex SELECT statements
- JOINs between tables
- Aggregation functions (COUNT, SUM, AVG, etc.)
- Date/time functions
- String functions

### What's Blocked
- INSERT, UPDATE, DELETE operations
- DROP, CREATE, ALTER statements
- GRANT, REVOKE permissions
- Any query without proper user filtering

## 🎉 Benefits

1. **Unlimited Analysis**: AI can create any SELECT query needed
2. **Real-time Data**: Direct access to current database state
3. **Complex Insights**: Multi-table joins and advanced aggregations
4. **Flexible Reporting**: Custom reports based on user questions
5. **Performance**: Direct database access is faster than multiple API calls

## 🔧 Troubleshooting

### Common Issues

1. **"Function execute_sql does not exist"**
   - Run the SQL setup script in Supabase SQL Editor
   - Ensure you have proper permissions

2. **"Only SELECT queries are allowed"**
   - This is expected behavior for security
   - AI should only generate SELECT statements

3. **"No data returned"**
   - Check if trade embeddings exist for the user
   - Verify user_id filtering is working correctly

4. **"Permission denied"**
   - Ensure RLS policies are properly configured
   - Check that the user is authenticated

The AI database query function provides powerful, flexible analysis capabilities while maintaining security and data isolation! 🚀
