# Example SQL Queries for Trade Database

These example queries work with your Supabase database schema and can be used to test the `queryDatabase` function in the AI chat.

## Basic Queries

### Count Total Trades
```sql
SELECT COUNT(*) as total_trades FROM trade_embeddings
```

### Basic Trade Statistics
```sql
SELECT 
  COUNT(*) as total_trades,
  SUM(trade_amount) as total_pnl,
  AVG(trade_amount) as avg_pnl,
  MIN(trade_date) as earliest_trade,
  MAX(trade_date) as latest_trade
FROM trade_embeddings
```

## Time-Based Analysis

### Trades by Month
```sql
SELECT 
  TO_CHAR(trade_date, 'YYYY-MM') AS month,
  COUNT(*) AS trade_count,
  SUM(trade_amount) AS total_pnl,
  ROUND(AVG(trade_amount), 2) AS avg_pnl
FROM trade_embeddings
GROUP BY TO_CHAR(trade_date, 'YYYY-MM')
ORDER BY month
```

### Trades by Day of Week
```sql
SELECT 
  EXTRACT(DOW FROM trade_date) as day_number,
  TO_CHAR(trade_date, 'Day') as day_name,
  COUNT(*) as trade_count,
  SUM(trade_amount) as total_pnl,
  ROUND(AVG(trade_amount), 2) as avg_pnl
FROM trade_embeddings
GROUP BY EXTRACT(DOW FROM trade_date), TO_CHAR(trade_date, 'Day')
ORDER BY day_number
```

### Recent Profitable Monday Trades
```sql
SELECT 
  trade_id,
  trade_date,
  trade_session,
  trade_amount,
  tags
FROM trade_embeddings
WHERE 
  trade_type = 'win'
  AND EXTRACT(DOW FROM trade_date) = 1 -- Monday
  AND trade_date >= NOW() - INTERVAL '3 months'
ORDER BY trade_amount DESC
LIMIT 10
```

## Session Analysis

### Performance by Session
```sql
SELECT 
  trade_session,
  COUNT(*) as trade_count,
  SUM(trade_amount) as total_pnl,
  ROUND(AVG(trade_amount), 2) as avg_pnl,
  SUM(CASE WHEN trade_type = 'win' THEN 1 ELSE 0 END) as wins,
  SUM(CASE WHEN trade_type = 'loss' THEN 1 ELSE 0 END) as losses,
  ROUND(
    (SUM(CASE WHEN trade_type = 'win' THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100, 
    2
  ) as win_rate
FROM trade_embeddings
WHERE trade_session IS NOT NULL
GROUP BY trade_session
ORDER BY avg_pnl DESC
```

### London Session Trades by Month
```sql
SELECT 
  TO_CHAR(trade_date, 'YYYY-MM') AS month,
  COUNT(*) AS trade_count,
  SUM(trade_amount) AS total_pnl
FROM trade_embeddings
WHERE trade_session = 'London'
GROUP BY TO_CHAR(trade_date, 'YYYY-MM')
ORDER BY month
```

## Tag Analysis

### Most Profitable Tags
```sql
SELECT 
  unnest(tags) as tag,
  COUNT(*) as trade_count,
  SUM(trade_amount) as total_pnl,
  ROUND(AVG(trade_amount), 2) as avg_pnl,
  SUM(CASE WHEN trade_type = 'win' THEN 1 ELSE 0 END) as wins,
  ROUND(
    (SUM(CASE WHEN trade_type = 'win' THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100, 
    2
  ) as win_rate
FROM trade_embeddings
WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
GROUP BY unnest(tags)
ORDER BY total_pnl DESC
LIMIT 10
```

### Trades with Specific Tag
```sql
SELECT 
  trade_id,
  trade_date,
  trade_session,
  trade_type,
  trade_amount
FROM trade_embeddings
WHERE 'breakout' = ANY(tags)
ORDER BY trade_date DESC
LIMIT 10
```

### Trades with Multiple Tags
```sql
SELECT 
  trade_id,
  trade_date,
  trade_session,
  trade_type,
  trade_amount,
  tags
FROM trade_embeddings
WHERE tags @> ARRAY['trend', 'breakout']
ORDER BY trade_date DESC
```

## Complex Analysis

### Win Rate by Month
```sql
SELECT 
  TO_CHAR(trade_date, 'YYYY-MM') AS month,
  COUNT(*) AS trade_count,
  SUM(CASE WHEN trade_type = 'win' THEN 1 ELSE 0 END) as wins,
  ROUND(
    (SUM(CASE WHEN trade_type = 'win' THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100, 
    2
  ) as win_rate
FROM trade_embeddings
GROUP BY TO_CHAR(trade_date, 'YYYY-MM')
ORDER BY month
```

### Session Performance by Day of Week
```sql
SELECT 
  trade_session,
  EXTRACT(DOW FROM trade_date) as day_number,
  TO_CHAR(trade_date, 'Day') as day_name,
  COUNT(*) as trade_count,
  SUM(trade_amount) as total_pnl,
  ROUND(
    (SUM(CASE WHEN trade_type = 'win' THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100, 
    2
  ) as win_rate
FROM trade_embeddings
WHERE trade_session IS NOT NULL
GROUP BY trade_session, EXTRACT(DOW FROM trade_date), TO_CHAR(trade_date, 'Day')
ORDER BY trade_session, day_number
```

### Tag Performance by Session
```sql
SELECT 
  unnest(tags) as tag,
  trade_session,
  COUNT(*) as trade_count,
  SUM(trade_amount) as total_pnl,
  ROUND(
    (SUM(CASE WHEN trade_type = 'win' THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100, 
    2
  ) as win_rate
FROM trade_embeddings
WHERE 
  tags IS NOT NULL 
  AND array_length(tags, 1) > 0
  AND trade_session IS NOT NULL
GROUP BY unnest(tags), trade_session
ORDER BY tag, total_pnl DESC
```

## Using Views

### User Summary
```sql
SELECT * FROM user_trade_embeddings_summary
```

### Session Analysis
```sql
SELECT * FROM trade_embeddings_by_session
ORDER BY win_rate DESC
```

### Day of Week Analysis
```sql
SELECT * FROM trade_embeddings_by_day
ORDER BY avg_amount DESC
```

### Monthly Analysis
```sql
SELECT * FROM trade_embeddings_by_month
WHERE month >= NOW() - INTERVAL '6 months'
ORDER BY month
```

### Tag Analysis
```sql
SELECT * FROM trade_embeddings_tag_analysis
WHERE tag_count > 5
ORDER BY wins_with_tag DESC
LIMIT 10
```
