# Deploying Supabase SQL Functions

The AI chat feature uses SQL functions to query the database. These functions need to be deployed to your Supabase instance.

## Instructions

1. Log in to your Supabase dashboard at https://app.supabase.com
2. Navigate to your project: https://gwubzauelilziaqnsfac.supabase.co
3. Click on "SQL Editor" in the left sidebar
4. Create a new query by clicking "New Query"
5. Copy the entire contents of the `supabase-sql-functions-fixed.sql` file and paste it into the SQL editor
6. Click "Run" to execute the SQL statements

## Verifying Deployment

After running the SQL, you can verify that the functions were deployed correctly:

1. In the Supabase dashboard, go to "Database" → "Functions"
2. You should see the `execute_sql` function listed
3. Check that the main tables exist:
   - `trade_embeddings` - Main table with all trade data and embeddings
   - `embedding_metadata` - Metadata for tracking embedding sync status

## Testing with Example Queries

Once deployed, you can test the SQL function with these example queries:

### Simple Count Query
```sql
SELECT COUNT(*) as total_trades FROM trade_embeddings
```

### Profitable Monday London Trades
```sql
SELECT
  TO_CHAR(trade_date, 'YYYY-MM') AS trade_month,
  COUNT(*) AS total_trades,
  SUM(trade_amount) AS total_profit
FROM trade_embeddings
WHERE
  trade_type = 'win'
  AND trade_amount > 100
  AND EXTRACT(DOW FROM trade_date) = 1
  AND trade_session = 'London'
  AND trade_date >= NOW() - INTERVAL '6 months'
GROUP BY trade_month
ORDER BY trade_month
```

### Win Rate by Session
```sql
SELECT
  trade_session,
  COUNT(*) as total_trades,
  SUM(CASE WHEN trade_type = 'win' THEN 1 ELSE 0 END) as wins,
  ROUND(
    (SUM(CASE WHEN trade_type = 'win' THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100,
    2
  ) as win_rate
FROM trade_embeddings
WHERE trade_session IS NOT NULL
GROUP BY trade_session
ORDER BY win_rate DESC
```

## Troubleshooting

If you encounter errors when running the SQL:

1. Make sure you're using the SQL Editor with admin privileges
2. Check if the tables and views already exist (you may need to drop them first)
3. Look for syntax errors in the SQL statements

If the AI chat feature still returns "No response received" after deploying the functions:

1. Check the browser console for errors
2. Verify that the `execute_sql` function exists and is accessible to authenticated users
3. Try a simpler query to test the function

## Alternative: Using searchTrades Instead

While the SQL functions provide more flexibility, most queries can be handled by the `searchTrades` function. If you're having trouble with the SQL functions, you can modify the AI instructions to prefer using `searchTrades` instead.

For example, to get the top 5 most profitable trades for the current month, the AI can use:

```javascript
searchTrades({
  dateRange: "current month",
  tradeType: "win",
  limit: 5
})
```

This will return the same information without requiring the SQL functions.
