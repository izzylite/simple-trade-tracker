# Example SQL Queries for Trade Database

How does my trading performance vary across different sessions (London, New York, Tokyo), and how do high-impact economic events occurring during those sessions affect my profitability and win rate?

I've been struggling with my breakout strategy on Tuesdays. Can you show me all my losing trades tagged 'breakout' that occurred on a Tuesday in the last 6 months, and analyze if there were any specific economic events or market conditions that contributed to these losses?


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

## Direct Aggregations on Main Table

### User Summary
```sql
SELECT
    user_id,
    calendar_id,
    COUNT(*) as total_trades,
    AVG(trade_amount) as avg_trade_amount,
    SUM(CASE WHEN trade_type = 'win' THEN 1 ELSE 0 END) as win_count,
    SUM(CASE WHEN trade_type = 'loss' THEN 1 ELSE 0 END) as loss_count,
    ROUND((SUM(CASE WHEN trade_type = 'win' THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100, 2) as win_rate
FROM trade_embeddings
GROUP BY user_id, calendar_id
```

### Session Analysis
```sql
SELECT
    trade_session,
    COUNT(*) as trade_count,
    AVG(trade_amount) as avg_amount,
    ROUND((SUM(CASE WHEN trade_type = 'win' THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100, 2) as win_rate
FROM trade_embeddings
WHERE trade_session IS NOT NULL
GROUP BY trade_session
ORDER BY win_rate DESC
```

### Day of Week Analysis
```sql
SELECT
    EXTRACT(DOW FROM to_timestamp(trade_date / 1000)) as day_of_week,
    TO_CHAR(to_timestamp(trade_date / 1000), 'Day') as day_name,
    COUNT(*) as trade_count,
    AVG(trade_amount) as avg_amount
FROM trade_embeddings
GROUP BY EXTRACT(DOW FROM to_timestamp(trade_date / 1000)), TO_CHAR(to_timestamp(trade_date / 1000), 'Day')
ORDER BY avg_amount DESC
```

### Monthly Analysis
```sql
SELECT
    TO_CHAR(to_timestamp(trade_date / 1000), 'YYYY-MM') as month_label,
    COUNT(*) as trade_count,
    SUM(trade_amount) as total_amount,
    AVG(trade_amount) as avg_amount
FROM trade_embeddings
WHERE trade_date >= EXTRACT(EPOCH FROM (NOW() - INTERVAL '6 months')) * 1000
GROUP BY TO_CHAR(to_timestamp(trade_date / 1000), 'YYYY-MM')
ORDER BY month_label
```

### Tag Analysis
```sql
SELECT
    unnest(tags) as tag,
    COUNT(*) as tag_count,
    SUM(CASE WHEN trade_type = 'win' THEN 1 ELSE 0 END) as wins_with_tag,
    SUM(CASE WHEN trade_type = 'loss' THEN 1 ELSE 0 END) as losses_with_tag
FROM trade_embeddings
WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
GROUP BY unnest(tags)
HAVING COUNT(*) > 5
ORDER BY wins_with_tag DESC
LIMIT 10
```
