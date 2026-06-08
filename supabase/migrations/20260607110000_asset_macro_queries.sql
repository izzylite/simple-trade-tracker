CREATE TABLE public.asset_macro_queries (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  asset         TEXT    NOT NULL CHECK (char_length(asset) <= 20),
  query         TEXT    NOT NULL,
  display_order INT     NOT NULL DEFAULT 0,
  is_enabled    BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX asset_macro_queries_asset
  ON public.asset_macro_queries (asset)
  WHERE is_enabled = true;

ALTER TABLE public.asset_macro_queries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.asset_macro_queries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.asset_macro_queries TO service_role;

-- -------------------------------------------------------------------------
-- Seed from macro_query_catalog
-- -------------------------------------------------------------------------

DO $seed$
BEGIN
  CREATE TEMP TABLE _broker_yahoo_map (
    broker_symbol TEXT PRIMARY KEY,
    yahoo_symbol  TEXT,
    market_class  TEXT NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO _broker_yahoo_map VALUES
    -- Forex majors
    ('EURUSD',  'EURUSD=X',   'forex'),
    ('GBPUSD',  'GBPUSD=X',   'forex'),
    ('USDJPY',  'USDJPY=X',   'forex'),
    ('AUDUSD',  'AUDUSD=X',   'forex'),
    ('USDCAD',  'USDCAD=X',   'forex'),
    ('NZDUSD',  'NZDUSD=X',   'forex'),
    ('USDCHF',  'USDCHF=X',   'forex'),
    -- EUR crosses
    ('EURJPY',  'EURJPY=X',   'forex'),
    ('EURGBP',  'EURGBP=X',   'forex'),
    ('EURAUD',  'EURAUD=X',   'forex'),
    ('EURCAD',  'EURCAD=X',   'forex'),
    ('EURCHF',  'EURCHF=X',   'forex'),
    ('EURNZD',  NULL,          'forex'),
    -- GBP crosses
    ('GBPJPY',  'GBPJPY=X',   'forex'),
    ('GBPAUD',  'GBPAUD=X',   'forex'),
    ('GBPCAD',  'GBPCAD=X',   'forex'),
    ('GBPCHF',  NULL,          'forex'),
    ('GBPNZD',  NULL,          'forex'),
    -- JPY crosses
    ('AUDJPY',  'AUDJPY=X',   'forex'),
    ('CADJPY',  'CADJPY=X',   'forex'),
    ('CHFJPY',  'CHFJPY=X',   'forex'),
    ('NZDJPY',  'NZDJPY=X',   'forex'),
    -- Other crosses
    ('AUDCAD',  NULL,          'forex'),
    ('AUDCHF',  NULL,          'forex'),
    ('AUDNZD',  'AUDNZD=X',   'forex'),
    ('CADCHF',  NULL,          'forex'),
    ('NZDCAD',  NULL,          'forex'),
    ('NZDCHF',  NULL,          'forex'),
    -- Commodities
    ('XAUUSD',  'GC=F',        'commodities'),
    ('XAGUSD',  'SI=F',        'commodities'),
    -- Crypto
    ('BTCUSD',  'BTC-USD',     'crypto'),
    ('ETHUSD',  'ETH-USD',     'crypto'),
    -- Indices
    ('US30',    '^DJI',        'indices'),
    ('NAS100',  '^IXIC',       'indices'),
    ('SPX500',  '^GSPC',       'indices'),
    ('US2000',  '^RUT',        'indices'),
    ('GER40',   '^GDAXI',      'indices'),
    ('EU50',    '^STOXX50E',   'indices'),
    ('UK100',   '^FTSE',       'indices'),
    ('JP225',   '^N225',       'indices'),
    ('AUS200',  '^AXJO',       'indices');

  INSERT INTO public.asset_macro_queries (asset, query, display_order)
  SELECT DISTINCT
    m.broker_symbol AS asset,
    c.query,
    c.display_order
  FROM _broker_yahoo_map m
  JOIN public.macro_query_catalog c ON c.is_enabled = true
    AND (
      (c.is_market_wide = true AND m.market_class = ANY(c.markets))
      OR
      (m.yahoo_symbol IS NOT NULL AND m.yahoo_symbol = ANY(c.symbols))
    )
  ORDER BY m.broker_symbol, c.display_order;

END $seed$;
