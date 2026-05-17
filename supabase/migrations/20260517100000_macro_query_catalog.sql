-- Macro Query Catalog
-- ===================
--
-- DB-backed catalog of predefined macro queries available in the Orion
-- market-research task editor. Stored in DB (not code) so entries can be
-- updated, A/B-tested, or hot-disabled without a frontend redeploy.
--
-- The edge function never reads this table — orion_tasks.config stores the
-- selected query STRINGS, and run-orion-task just executes them. Cache keys
-- in serper_cache derive from those strings, so renaming a catalog entry
-- here does not invalidate any existing cache or break running tasks
-- (they keep firing the old string until the user re-picks).
--
-- Symbols semantic:
--   is_market_wide = true  → entry appears for any selected symbol within
--                            its markets (e.g. Fed FOMC affects everything)
--   is_market_wide = false → entry appears only if at least one symbol in
--                            `symbols` is in the user's watchlist
--
-- Symbol IDs use Yahoo Finance format (EURUSD=X, ^GSPC, BTC-USD, CL=F)
-- to match src/components/orionTasks/CreateTaskDialog.tsx YAHOO_SYMBOL_CATALOG.

CREATE TABLE public.macro_query_catalog (
  id              TEXT PRIMARY KEY,
  query           TEXT NOT NULL,
  markets         TEXT[] NOT NULL,
  is_market_wide  BOOLEAN NOT NULL DEFAULT false,
  symbols         TEXT[] NOT NULL DEFAULT '{}',
  category        TEXT NOT NULL,
  display_order   INTEGER NOT NULL DEFAULT 0,
  is_enabled      BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.macro_query_catalog IS
  'Predefined macro queries for Orion market-research task editor. Edited via Supabase dashboard or future admin UI; reads do not require auth beyond authenticated role. Edge functions never read this table — only the frontend dropdown does.';

CREATE INDEX idx_macro_query_catalog_enabled_order
  ON public.macro_query_catalog (is_enabled, category, display_order);

-- ---------------------------------------------------------------------------
-- RLS — authenticated users can read enabled entries; writes are service-role only
-- ---------------------------------------------------------------------------

ALTER TABLE public.macro_query_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read enabled macro queries"
  ON public.macro_query_catalog
  FOR SELECT
  TO authenticated
  USING (is_enabled = true);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.touch_macro_query_catalog_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_macro_query_catalog_updated_at
  BEFORE UPDATE ON public.macro_query_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_macro_query_catalog_updated_at();

-- ---------------------------------------------------------------------------
-- Seed — 70 entries, using PL/pgSQL helper vars to keep symbol lists DRY
-- ---------------------------------------------------------------------------

DO $seed$
DECLARE
  usd_pairs TEXT[] := ARRAY[
    'EURUSD=X','GBPUSD=X','USDJPY=X','USDCHF=X','USDCAD=X',
    'AUDUSD=X','NZDUSD=X','DX-Y.NYB','USDMXN=X','USDZAR=X',
    'USDTRY=X','USDCNH=X'
  ];
  eur_pairs TEXT[] := ARRAY['EURUSD=X','EURGBP=X','EURJPY=X','EURCHF=X','EURAUD=X','EURCAD=X'];
  gbp_pairs TEXT[] := ARRAY['GBPUSD=X','EURGBP=X','GBPJPY=X','GBPAUD=X','GBPCAD=X'];
  jpy_pairs TEXT[] := ARRAY['USDJPY=X','EURJPY=X','GBPJPY=X','AUDJPY=X','NZDJPY=X','CADJPY=X','CHFJPY=X'];
  chf_pairs TEXT[] := ARRAY['USDCHF=X','EURCHF=X','CHFJPY=X'];
  aud_pairs TEXT[] := ARRAY['AUDUSD=X','EURAUD=X','GBPAUD=X','AUDJPY=X','AUDNZD=X'];
  nzd_pairs TEXT[] := ARRAY['NZDUSD=X','AUDNZD=X','NZDJPY=X'];
  cad_pairs TEXT[] := ARRAY['USDCAD=X','EURCAD=X','GBPCAD=X','CADJPY=X'];
  cnh_linked TEXT[] := ARRAY['USDCNH=X','AUDUSD=X','NZDUSD=X','HG=F','^HSI','^AXJO'];

  us_indices TEXT[] := ARRAY['^GSPC','^IXIC','^DJI','^RUT','^VIX','SPY','QQQ','IWM','DIA'];
  eu_indices TEXT[] := ARRAY['^FTSE','^GDAXI','^FCHI','^STOXX50E'];
  apac_indices TEXT[] := ARRAY['^N225','^HSI','^AXJO'];

  precious_metals TEXT[] := ARRAY['GC=F','SI=F','PL=F','PA=F'];
  energy TEXT[] := ARRAY['CL=F','BZ=F','NG=F','HO=F','RB=F'];
  agricultural TEXT[] := ARRAY['ZC=F','ZS=F','ZW=F','KC=F','SB=F','CT=F'];

  us_bonds TEXT[] := ARRAY['^TNX','^FVX','^TYX','^IRX','ZB=F','ZN=F','ZF=F','TLT'];

  crypto_all TEXT[] := ARRAY[
    'BTC-USD','ETH-USD','SOL-USD','BNB-USD','XRP-USD',
    'ADA-USD','DOGE-USD','AVAX-USD','LINK-USD','LTC-USD'
  ];

  mega_cap_stocks TEXT[] := ARRAY['AAPL','MSFT','NVDA','GOOGL','META','AMZN','TSLA','JPM','XOM','BRK-B'];
  tech_mega_cap TEXT[] := ARRAY['AAPL','MSFT','NVDA','GOOGL','META','AMZN','TSLA'];
BEGIN
  INSERT INTO public.macro_query_catalog
    (id, query, markets, is_market_wide, symbols, category, display_order)
  VALUES
    -- ===== Central banks =====
    ('cb-fed-fomc',                'Federal Reserve OR FOMC speech statement policy today',           ARRAY['forex','stocks','indices','bonds','commodities','crypto'], true,  '{}',                                                              'Central banks', 10),
    ('cb-ecb-boe-boj',             'ECB OR Bank of England OR Bank of Japan policy commentary today', ARRAY['forex','indices','bonds'],                                  false, eur_pairs || gbp_pairs || jpy_pairs || eu_indices || ARRAY['^N225'], 'Central banks', 20),
    ('cb-ecb',                     'ECB European Central Bank rate decision Lagarde commentary today', ARRAY['forex','indices','bonds'],                                 false, eur_pairs || eu_indices,                                           'Central banks', 30),
    ('cb-boe',                     'Bank of England BoE rate decision MPC commentary today',          ARRAY['forex','indices','bonds'],                                  false, gbp_pairs || ARRAY['^FTSE'],                                       'Central banks', 40),
    ('cb-boj',                     'Bank of Japan BoJ Ueda YCC yield curve control today',            ARRAY['forex','indices','bonds'],                                  false, jpy_pairs || ARRAY['^N225'],                                       'Central banks', 50),
    ('cb-snb',                     'Swiss National Bank SNB rate decision CHF intervention today',    ARRAY['forex'],                                                    false, chf_pairs,                                                         'Central banks', 60),
    ('cb-rba',                     'Reserve Bank of Australia RBA cash rate decision today',          ARRAY['forex','indices'],                                          false, aud_pairs || ARRAY['^AXJO'],                                       'Central banks', 70),
    ('cb-rbnz',                    'Reserve Bank of New Zealand RBNZ OCR decision today',             ARRAY['forex'],                                                    false, nzd_pairs,                                                         'Central banks', 80),
    ('cb-boc',                     'Bank of Canada BoC rate decision Macklem commentary today',       ARRAY['forex','commodities'],                                      false, cad_pairs || ARRAY['CL=F','BZ=F'],                                 'Central banks', 90),
    ('cb-pboc',                    'PBOC China central bank stimulus LPR yuan fixing today',          ARRAY['forex','commodities','indices'],                            false, cnh_linked,                                                        'Central banks', 100),
    ('cb-fed-minutes',             'FOMC minutes hawkish dovish dot plot today',                      ARRAY['forex','stocks','indices','bonds','commodities','crypto'], true,  '{}',                                                              'Central banks', 110),
    ('cb-rate-cut-expectations',   'rate cut expectations Fed Funds futures pricing today',           ARRAY['forex','stocks','indices','bonds','commodities'],          true,  '{}',                                                              'Central banks', 120),

    -- ===== Geopolitics & policy =====
    ('geo-white-house',            'White House OR US President statement market impact today',       ARRAY['forex','stocks','indices','bonds','commodities','crypto'], true,  '{}',                                                              'Geopolitics & policy', 10),
    ('geo-trump-truth-social',     'Trump tweet OR Donald J Trump Truth Social today',                ARRAY['forex','stocks','indices','bonds','commodities','crypto'], true,  '{}',                                                              'Geopolitics & policy', 20),
    ('geo-tension',                'geopolitical tension war sanctions markets today',                ARRAY['forex','stocks','indices','bonds','commodities','crypto'], true,  '{}',                                                              'Geopolitics & policy', 30),
    ('geo-china-trade',            'China US trade policy tariffs today',                             ARRAY['forex','stocks','indices','commodities'],                   false, cnh_linked || us_indices || apac_indices || agricultural || usd_pairs || ARRAY['HG=F'], 'Geopolitics & policy', 40),
    ('geo-middle-east',            'Middle East Iran Israel oil supply markets today',                ARRAY['commodities','forex','stocks'],                             false, energy || precious_metals || ARRAY['DX-Y.NYB'],                    'Geopolitics & policy', 50),
    ('geo-russia-ukraine',         'Russia Ukraine ceasefire sanctions energy today',                 ARRAY['commodities','forex','indices'],                            false, energy || precious_metals || eu_indices || ARRAY['EURUSD=X'],      'Geopolitics & policy', 60),
    ('geo-eu-policy',              'European Union policy regulation markets today',                  ARRAY['forex','stocks','indices'],                                 false, eur_pairs || eu_indices,                                           'Geopolitics & policy', 70),

    -- ===== US macro data =====
    ('us-cpi-inflation',           'US CPI inflation data release reaction today',                    ARRAY['forex','stocks','indices','bonds','commodities','crypto'], true,  '{}',                                                              'US macro data', 10),
    ('us-nfp-jobs',                'US nonfarm payrolls NFP jobs report unemployment today',          ARRAY['forex','stocks','indices','bonds','commodities'],          true,  '{}',                                                              'US macro data', 20),
    ('us-gdp',                     'US GDP growth Q1 Q2 Q3 Q4 estimate today',                        ARRAY['forex','stocks','indices','bonds'],                         false, usd_pairs || us_indices || us_bonds,                               'US macro data', 30),
    ('us-pce-inflation',           'US PCE core inflation Fed preferred gauge today',                 ARRAY['forex','stocks','indices','bonds','commodities'],          true,  '{}',                                                              'US macro data', 40),
    ('us-retail-sales',            'US retail sales consumer spending today',                         ARRAY['forex','stocks','indices','bonds'],                         false, usd_pairs || us_indices,                                           'US macro data', 50),
    ('us-ism-pmi',                 'US ISM manufacturing services PMI today',                         ARRAY['forex','stocks','indices','bonds'],                         false, usd_pairs || us_indices,                                           'US macro data', 60),
    ('us-debt-ceiling',            'US debt ceiling Treasury issuance fiscal today',                  ARRAY['forex','bonds','indices','commodities'],                    false, usd_pairs || us_bonds || us_indices || ARRAY['GC=F'],              'US macro data', 70),

    -- ===== Commodities =====
    ('cmd-oil',                    'oil price WTI Brent crude today',                                 ARRAY['commodities','forex','stocks','indices'],                   false, ARRAY['CL=F','BZ=F'] || cad_pairs || usd_pairs || ARRAY['XOM'] || us_indices, 'Commodities', 10),
    ('cmd-gold-silver',            'gold silver commodity prices today',                              ARRAY['commodities','forex'],                                      false, ARRAY['GC=F','SI=F','DX-Y.NYB'] || usd_pairs,                      'Commodities', 20),
    ('cmd-opec',                   'OPEC production cut decision oil supply today',                   ARRAY['commodities','forex'],                                      false, ARRAY['CL=F','BZ=F'] || cad_pairs,                                 'Commodities', 30),
    ('cmd-natgas',                 'natural gas price European demand winter today',                  ARRAY['commodities'],                                              false, ARRAY['NG=F'],                                                     'Commodities', 40),
    ('cmd-copper',                 'copper price China demand industrial metals today',               ARRAY['commodities','forex'],                                      false, ARRAY['HG=F'] || aud_pairs || ARRAY['USDCNH=X'],                   'Commodities', 50),
    ('cmd-agricultural',           'wheat corn soybeans agricultural commodity prices today',         ARRAY['commodities'],                                              false, agricultural,                                                      'Commodities', 60),
    ('cmd-gold-safehaven',         'gold safe haven flight to quality today',                         ARRAY['commodities','forex'],                                      false, ARRAY['GC=F','SI=F'] || jpy_pairs || ARRAY['USDCHF=X'],            'Commodities', 70),

    -- ===== Equities =====
    ('eq-us-premarket',            'US stocks S&P 500 Nasdaq Dow premarket earnings Wall Street',     ARRAY['stocks','indices','forex'],                                 false, us_indices || mega_cap_stocks || usd_pairs || jpy_pairs,           'Equities', 10),
    ('eq-earnings-season',         'US earnings season reports beat miss guidance today',             ARRAY['stocks','indices'],                                         false, us_indices || mega_cap_stocks,                                     'Equities', 20),
    ('eq-mag7-tech',               'Magnificent 7 tech stocks AAPL MSFT NVDA earnings today',         ARRAY['stocks','indices'],                                         false, tech_mega_cap || ARRAY['^IXIC','QQQ'],                             'Equities', 30),
    ('eq-nvidia-ai',               'NVIDIA AI chip demand semiconductor today',                       ARRAY['stocks','indices'],                                         false, ARRAY['NVDA','^IXIC','QQQ'],                                       'Equities', 40),
    ('eq-vix-volatility',          'VIX volatility spike risk off equities today',                    ARRAY['stocks','indices'],                                         false, ARRAY['^VIX'] || us_indices,                                       'Equities', 50),
    ('eq-european-stocks',         'European stocks DAX FTSE CAC earnings today',                     ARRAY['stocks','indices'],                                         false, eu_indices,                                                        'Equities', 60),
    ('eq-japan-nikkei',            'Japan Nikkei stocks BoJ yen exporters today',                     ARRAY['stocks','indices','forex'],                                 false, ARRAY['^N225'] || jpy_pairs,                                       'Equities', 70),
    ('eq-china-hangseng',          'China stocks Hang Seng Shanghai composite stimulus today',        ARRAY['stocks','indices','forex'],                                 false, ARRAY['^HSI','USDCNH=X'],                                          'Equities', 80),
    ('eq-sector-rotation',         'sector rotation tech energy financials today',                    ARRAY['stocks','indices'],                                         false, us_indices,                                                        'Equities', 90),
    ('eq-tesla',                   'Tesla TSLA delivery numbers Musk today',                          ARRAY['stocks'],                                                   false, ARRAY['TSLA'],                                                     'Equities', 100),
    ('eq-apple',                   'Apple AAPL iPhone services revenue today',                        ARRAY['stocks'],                                                   false, ARRAY['AAPL'],                                                     'Equities', 110),
    ('eq-meta',                    'Meta Platforms META advertising revenue today',                   ARRAY['stocks'],                                                   false, ARRAY['META'],                                                     'Equities', 120),

    -- ===== Bonds & yields =====
    ('bond-us-treasury',           'US Treasury yields bond market today',                            ARRAY['bonds','forex','stocks','indices','commodities'],          true,  '{}',                                                              'Bonds & yields', 10),
    ('bond-yield-curve',           'US yield curve inversion 2s10s recession signal today',           ARRAY['bonds','stocks','indices','forex'],                         false, us_bonds || us_indices || usd_pairs,                               'Bonds & yields', 20),
    ('bond-european',              'European bond yields Bund Italy spread today',                    ARRAY['bonds','forex','indices'],                                  false, eur_pairs || eu_indices,                                           'Bonds & yields', 30),
    ('bond-japan-jgb',             'Japan JGB yields BoJ yield curve control today',                  ARRAY['bonds','forex'],                                            false, jpy_pairs,                                                         'Bonds & yields', 40),
    ('bond-credit-spreads',        'credit spreads high yield investment grade widening today',       ARRAY['bonds','stocks','indices'],                                 false, us_bonds || us_indices,                                            'Bonds & yields', 50),
    ('bond-treasury-auction',      'US Treasury auction demand bid-to-cover today',                   ARRAY['bonds','forex'],                                            false, us_bonds || usd_pairs,                                             'Bonds & yields', 60),

    -- ===== Crypto =====
    ('crypto-btc-price',           'Bitcoin BTC price action all-time high resistance today',         ARRAY['crypto'],                                                   false, crypto_all,                                                        'Crypto', 10),
    ('crypto-eth-ecosystem',       'Ethereum ETH price upgrade Layer 2 today',                        ARRAY['crypto'],                                                   false, ARRAY['ETH-USD','BTC-USD'],                                        'Crypto', 20),
    ('crypto-etf-flows',           'Bitcoin Ethereum ETF flows institutional inflows today',          ARRAY['crypto'],                                                   false, ARRAY['BTC-USD','ETH-USD'],                                        'Crypto', 30),
    ('crypto-regulation',          'crypto regulation SEC CFTC ruling today',                         ARRAY['crypto'],                                                   false, crypto_all,                                                        'Crypto', 40),
    ('crypto-stablecoin',          'stablecoin USDT USDC Tether depeg risk today',                    ARRAY['crypto'],                                                   false, crypto_all,                                                        'Crypto', 50),
    ('crypto-exchange-risk',       'crypto exchange hack outage Binance Coinbase today',              ARRAY['crypto'],                                                   false, crypto_all,                                                        'Crypto', 60),
    ('crypto-altcoin-rotation',    'altcoin rotation Solana XRP Cardano momentum today',              ARRAY['crypto'],                                                   false, ARRAY['SOL-USD','XRP-USD','ADA-USD','AVAX-USD','LINK-USD'],        'Crypto', 70),

    -- ===== FX themes =====
    ('fx-dxy-strength',            'DXY dollar index strength weakness today',                        ARRAY['forex','commodities'],                                      false, ARRAY['DX-Y.NYB'] || usd_pairs || ARRAY['GC=F','SI=F'],            'FX themes', 10),
    ('fx-eurusd-parity',           'EUR USD parity ECB Fed divergence today',                         ARRAY['forex'],                                                    false, ARRAY['EURUSD=X','DX-Y.NYB'],                                      'FX themes', 20),
    ('fx-yen-intervention',        'Japan yen intervention MoF Kanda BoJ verbal today',               ARRAY['forex'],                                                    false, jpy_pairs,                                                         'FX themes', 30),
    ('fx-yuan-fixing',             'China yuan CNH offshore PBOC fixing today',                       ARRAY['forex'],                                                    false, ARRAY['USDCNH=X'],                                                 'FX themes', 40),
    ('fx-carry-trade',             'carry trade unwind JPY funding currency today',                   ARRAY['forex'],                                                    false, jpy_pairs || aud_pairs || nzd_pairs || ARRAY['USDMXN=X','USDTRY=X','USDZAR=X'], 'FX themes', 50),
    ('fx-emerging-markets',        'emerging market currencies MXN TRY ZAR pressure today',           ARRAY['forex'],                                                    false, ARRAY['USDMXN=X','USDTRY=X','USDZAR=X'],                           'FX themes', 60),
    ('fx-commodity-currencies',    'commodity currencies AUD CAD NZD oil iron ore today',             ARRAY['forex','commodities'],                                      false, aud_pairs || cad_pairs || nzd_pairs || ARRAY['CL=F','HG=F'],       'FX themes', 70),

    -- ===== Risk sentiment =====
    ('risk-off-safehaven',         'risk off safe haven flight gold yen swiss franc today',           ARRAY['forex','commodities','stocks','indices'],                   false, jpy_pairs || chf_pairs || ARRAY['GC=F','SI=F','^VIX'] || us_indices, 'Risk sentiment', 10),
    ('risk-on-risk-off',           'risk on risk off equities bonds rotation today',                  ARRAY['stocks','forex','bonds','crypto','indices'],                true,  '{}',                                                              'Risk sentiment', 20),
    ('risk-liquidity-crisis',      'liquidity crisis funding stress repo market today',               ARRAY['bonds','forex','stocks','indices'],                         false, us_bonds || usd_pairs || us_indices,                               'Risk sentiment', 30),
    ('risk-recession-fears',       'recession fears soft landing hard landing today',                 ARRAY['stocks','indices','bonds','forex','commodities'],          true,  '{}',                                                              'Risk sentiment', 40),
    ('risk-volatility-spike',      'volatility spike VIX MOVE bond stress today',                     ARRAY['stocks','indices','bonds'],                                 false, ARRAY['^VIX'] || us_indices || us_bonds,                           'Risk sentiment', 50);
END
$seed$;
