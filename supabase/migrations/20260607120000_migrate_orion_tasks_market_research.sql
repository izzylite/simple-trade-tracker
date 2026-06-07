-- Migrate orion_tasks.config for market_research tasks.
-- Old shape: { markets, frequency_minutes, min_significance, macro_queries, watchlist_symbols }
-- New shape: { frequency_minutes, min_significance, subscribed_assets }

WITH yahoo_to_broker(yahoo_sym, broker_sym) AS (
  VALUES
    ('EURUSD=X','EURUSD'), ('GBPUSD=X','GBPUSD'), ('USDJPY=X','USDJPY'),
    ('AUDUSD=X','AUDUSD'), ('USDCAD=X','USDCAD'), ('NZDUSD=X','NZDUSD'),
    ('USDCHF=X','USDCHF'), ('EURJPY=X','EURJPY'), ('EURGBP=X','EURGBP'),
    ('EURAUD=X','EURAUD'), ('EURCAD=X','EURCAD'), ('EURCHF=X','EURCHF'),
    ('EURNZD=X','EURNZD'), ('GBPJPY=X','GBPJPY'), ('GBPAUD=X','GBPAUD'),
    ('GBPCAD=X','GBPCAD'), ('GBPCHF=X','GBPCHF'), ('AUDJPY=X','AUDJPY'),
    ('CADJPY=X','CADJPY'), ('CHFJPY=X','CHFJPY'), ('NZDJPY=X','NZDJPY'),
    ('AUDNZD=X','AUDNZD'), ('GC=F','XAUUSD'), ('SI=F','XAGUSD'),
    ('BTC-USD','BTCUSD'), ('ETH-USD','ETHUSD'),
    ('^DJI','US30'), ('^IXIC','NAS100'), ('^GSPC','SPX500'), ('^RUT','US2000'),
    ('^GDAXI','GER40'), ('^STOXX50E','EU50'), ('^FTSE','UK100'),
    ('^N225','JP225'), ('^AXJO','AUS200')
)
UPDATE public.orion_tasks t
SET config = jsonb_build_object(
  'frequency_minutes', t.config->'frequency_minutes',
  'min_significance',  t.config->>'min_significance',
  'subscribed_assets', COALESCE(
    (
      SELECT jsonb_agg(DISTINCT ytb.broker_sym ORDER BY ytb.broker_sym)
      FROM jsonb_array_elements_text(t.config->'watchlist_symbols') ws(y)
      JOIN yahoo_to_broker ytb ON ytb.yahoo_sym = ws.y
    ),
    '[]'::jsonb
  )
)
WHERE t.task_type = 'market_research';
