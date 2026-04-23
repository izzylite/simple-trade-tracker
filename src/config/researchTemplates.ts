/**
 * A research template is a preset bundle of macro search queries tailored to a
 * particular trading style. Picking one at task creation populates the task's
 * config with a snapshot of these values — the user can then edit any field
 * before saving. Edits to this file do NOT retroactively mutate existing tasks
 * (they store their own copy), so we can safely tune templates over time.
 */
export interface ResearchTemplate {
  id: string;
  name: string;
  description: string;
  macro_queries: string[];
}

export const FOREX_MACRO_TEMPLATE: ResearchTemplate = {
  id: 'forex_macro',
  name: 'Forex Macro',
  description:
    'Central banks, geopolitics, and currency-driven catalysts. Best for FX traders.',
  macro_queries: [
    'Federal Reserve OR FOMC speech statement policy today',
    'ECB OR Bank of England OR Bank of Japan policy commentary today',
    'White House OR US President statement market impact today',
    'geopolitical tension war sanctions markets today',
    'oil price WTI Brent crude today',
    'gold silver commodity prices today',
    'US Treasury yields bond market today',
    'China US trade policy tariffs today',
  ],
};

export const US_EQUITIES_TEMPLATE: ResearchTemplate = {
  id: 'us_equities',
  name: 'US Equities',
  description:
    'S&P 500, Nasdaq, mega-cap earnings, VIX, Treasury yields. Best for US stock traders.',
  macro_queries: [
    'Federal Reserve OR FOMC speech statement policy today',
    'S&P 500 Nasdaq Dow Jones market today',
    'VIX volatility index fear gauge today',
    'US Treasury yields 10-year bond market today',
    'mega-cap earnings Apple Microsoft Amazon Google Nvidia today',
    'US economic data CPI PCE jobs GDP today',
    'White House OR SEC regulation policy stocks today',
    'sector rotation tech financials energy today',
  ],
};

export const CRYPTO_TEMPLATE: ResearchTemplate = {
  id: 'crypto',
  name: 'Crypto',
  description:
    'BTC, ETH, ETF flows, SEC actions, on-chain events. Best for crypto traders.',
  macro_queries: [
    'Bitcoin BTC price news today',
    'Ethereum ETH price news today',
    'SEC crypto regulation enforcement today',
    'spot Bitcoin ETF Ethereum ETF flows today',
    'Federal Reserve interest rates crypto impact today',
    'stablecoin USDT USDC market today',
    'crypto exchange Binance Coinbase news today',
    'DeFi Layer 2 Solana major crypto news today',
  ],
};

export const INDICES_TEMPLATE: ResearchTemplate = {
  id: 'indices',
  name: 'Global Indices',
  description:
    'Nikkei, FTSE, DAX, S&P futures, cross-regional index catalysts. Best for index traders.',
  macro_queries: [
    'Federal Reserve OR FOMC rate decision indices today',
    'ECB OR Bank of England OR Bank of Japan rate decision today',
    'geopolitical tension war sanctions indices today',
    'global indices correlation risk-on risk-off today',
    'VIX volatility index today',
    'China PBoC economic stimulus indices today',
    'oil price WTI Brent indices today',
    'US Treasury yields 10-year indices today',
  ],
};

export const RESEARCH_TEMPLATES: ResearchTemplate[] = [
  FOREX_MACRO_TEMPLATE,
  US_EQUITIES_TEMPLATE,
  CRYPTO_TEMPLATE,
  INDICES_TEMPLATE,
];

export function getTemplate(id: string): ResearchTemplate | undefined {
  return RESEARCH_TEMPLATES.find((t) => t.id === id);
}

export const DEFAULT_TEMPLATE_ID = FOREX_MACRO_TEMPLATE.id;
