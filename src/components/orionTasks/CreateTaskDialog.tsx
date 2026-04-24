import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  Chip,
  TextField,
  IconButton,
  Autocomplete,
  useTheme,
  alpha,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  TrendingUp as MarketResearchIcon,
  Psychology as DailyAnalysisIcon,
  Assessment as WeeklyReviewIcon,
  CalendarMonth as MonthlyRollupIcon,
  CheckCircleOutline as CheckIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import type {
  TaskType,
  TaskConfig,
  MarketResearchConfig,
  CoachingTone,
  OrionTask,
} from '../../types/orionTask';
import {
  TASK_TYPE_LABELS,
  buildDefaultConfigs,
  detectBrowserTimezone,
} from '../../types/orionTask';
import {
  RESEARCH_TEMPLATES,
  getTemplate,
  FOREX_MACRO_TEMPLATE,
} from '../../config/researchTemplates';

// Backfill template fields on legacy task configs saved before templates
// existed. Returns a fully-populated MarketResearchConfig so the form never
// sees undefined arrays. Preserves prior `custom_topics` by merging them into
// `macro_queries` so a user's ad-hoc topics don't silently vanish.
function hydrateMarketResearchConfig(
  raw: Record<string, unknown>
): MarketResearchConfig {
  const legacyTopics = Array.isArray(raw.custom_topics)
    ? (raw.custom_topics as string[])
    : [];
  const macroQueries = Array.isArray(raw.macro_queries)
    ? (raw.macro_queries as string[])
    : [...FOREX_MACRO_TEMPLATE.macro_queries, ...legacyTopics];
  return {
    markets: (raw.markets as string[]) ?? ['forex'],
    frequency_minutes: (raw.frequency_minutes as 15 | 30 | 60) ?? 30,
    min_significance: (raw.min_significance as 'medium' | 'high') ?? 'high',
    template_id: (raw.template_id as string) ?? FOREX_MACRO_TEMPLATE.id,
    macro_queries: macroQueries.slice(0, MAX_MACRO_QUERIES),
    watchlist_symbols: Array.isArray(raw.watchlist_symbols)
      ? (raw.watchlist_symbols as string[])
      : [],
  };
}

// IANA timezones we surface in the dropdown. The browser-detected tz is
// always prepended so the user's actual zone appears even if it's not in
// this curated list. Covers the major trading hubs + UTC baseline.
const TIMEZONE_PRESETS: Array<{ value: string; label: string }> = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'New York (ET)' },
  { value: 'America/Chicago', label: 'Chicago (CT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Frankfurt', label: 'Frankfurt (CET/CEST)' },
  { value: 'Europe/Zurich', label: 'Zurich (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AET)' },
];

function buildTimezoneOptions(
  detected: string
): Array<{ value: string; label: string }> {
  const presetValues = new Set(TIMEZONE_PRESETS.map((t) => t.value));
  if (detected && !presetValues.has(detected)) {
    return [{ value: detected, label: `${detected} (browser)` }, ...TIMEZONE_PRESETS];
  }
  return TIMEZONE_PRESETS;
}

interface CreateTaskDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (taskType: TaskType, config: TaskConfig) => Promise<unknown>;
  existingTaskTypes: TaskType[];
  /** If set, dialog runs in edit mode: task type is locked, config is pre-populated */
  editingTask?: OrionTask | null;
  /** Called on Save in edit mode. Only required when editingTask is set. */
  onSave?: (taskId: string, config: TaskConfig) => Promise<unknown>;
}

interface TaskTypeInfo {
  summary: string;
  description: string;
  exampleTitle: string;
  exampleOutput: string;
  Icon: React.ElementType;
  iconColor: string;
}

const TASK_TYPE_INFO: Record<TaskType, TaskTypeInfo> = {
  market_research: {
    summary: 'Surprise monitor: alerts you the moment something market-moving happens',
    description:
      'Orion sweeps live news every 15-60 minutes looking for catalysts that actually move markets — ' +
      'central bank surprises, political statements, geopolitical shocks, unexpected data, and commodity disruptions. ' +
      'You only get a notification when something real happens and clears your significance threshold. ' +
      'Quiet markets = silent. Surprise hits = red dot on Orion within minutes, with full impact breakdown and affected assets.',
    exampleTitle: 'Surprise ceasefire announcement, EUR/USD ripping',
    exampleOutput:
      'Heads up: the US President posted ~30 min ago announcing a 10-day\n' +
      'Middle East ceasefire. Risk-on unwind in progress.\n\n' +
      'Market impact so far:\n' +
      '• USD safe-haven bid evaporating → EUR/USD +95 pips since the post\n' +
      '• Oil −3.2% (lower risk premium)\n' +
      '• Gold −1.1%, defense stocks (LMT, RTX) −2%\n' +
      '• Eurozone Trade Balance beat (€4.944B vs €3.83B forecast) adding fuel\n\n' +
      'Watch: Fed speaker at 16:15 UTC could cap dollar downside if hawkish.\n' +
      'If you are short EUR/USD or long USD, size risk accordingly.',
    Icon: MarketResearchIcon,
    iconColor: '#3b82f6',
  },
  daily_analysis: {
    summary: 'End-of-day coaching review of your closed trades',
    description:
      'Orion analyzes every trade you closed today, checks rule compliance against your required tag groups ' +
      'and risk-per-trade settings, detects emotional patterns (revenge trading, size escalation, FOMO entries, ' +
      'over-trading), and correlates tag performance against outcomes. Delivers coaching in your chosen tone. ' +
      'Automatically skipped on zero-trade days.',
    exampleTitle: 'Daily Recap — 3 trades, +$245 — High Significance',
    exampleOutput:
      'Rule Compliance:\n' +
      '✓ Trades 1 & 2 inside 1% risk-per-trade rule\n' +
      '✗ Trade 3 broke max-risk rule (2.5% vs 1% target)\n\n' +
      'Emotional Patterns:\n' +
      '⚠ Size-up after loss detected: after a losing trade 2, trade 3 size ran 2.3x larger\n' +
      '⚠ Fast re-entry (7 min after loss) — possible revenge trade\n\n' +
      'Tag Performance:\n' +
      '• "breakout-london": 2 trades, 2W 0L, +$310\n' +
      '• "reversal-ny_pm": 1 trade, 0W 1L, −$65\n\n' +
      'Takeaway: pause 30 minutes after any loss before re-entering.',
    Icon: DailyAnalysisIcon,
    iconColor: '#a855f7',
  },
  weekly_review: {
    summary: 'End-of-week performance summary with trend analysis',
    description:
      'Orion compares this week\'s win rate, P&L, and session performance against the past N weeks. ' +
      'Highlights regressions and improvements so you know what to focus on next week. ' +
      'Runs independently of daily analysis — enable both for full coverage.',
    exampleTitle: 'Weekly Review — Win rate 62% (↑ from 54%)',
    exampleOutput:
      'This week: 14 trades, +$820 | 4-week avg: +$540\n' +
      '• Strength: London session win rate jumped to 71%\n' +
      '• Regression: NY AM average loss grew 18%\n' +
      '• Risk/reward held steady at 1.8:1\n' +
      'Focus for next week: tighten NY AM stops to 0.8x ATR.',
    Icon: WeeklyReviewIcon,
    iconColor: '#22c55e',
  },
  monthly_rollup: {
    summary: 'Comprehensive monthly report with instrument rankings',
    description:
      'Runs on the last day of the month. Includes instrument-by-instrument performance rankings, ' +
      'equity curve analysis, drawdown events, and month-over-month comparison. ' +
      'Your most detailed report — use it for strategy reviews.',
    exampleTitle: 'April Rollup — +$2,140 (+8.4%)',
    exampleOutput:
      'Top performers: EUR/USD (+$1,200, 68% WR), GBP/JPY (+$640, 60% WR)\n' +
      'Underperformers: NAS100 (−$310, 33% WR)\n' +
      'Equity curve peaked Apr 14 (+12.1%), drew down 4% over the next 8 sessions.\n' +
      'vs March: +2.1% P&L improvement, win rate flat at 58%.\n' +
      'Recommendation: pause NAS100 until rangebound conditions clear.',
    Icon: MonthlyRollupIcon,
    iconColor: '#f59e0b',
  },
};

const TONE_LABELS: Record<CoachingTone, string> = {
  tough_love: 'Tough Love Coach',
  blunt_analyst: 'Blunt Analyst',
  supportive_mentor: 'Supportive Mentor',
};

interface CoachingToneSelectProps {
  value: CoachingTone | undefined;
  onChange: (tone: CoachingTone) => void;
}

const CoachingToneSelect: React.FC<CoachingToneSelectProps> = ({ value, onChange }) => (
  <FormControl fullWidth>
    <InputLabel>Coaching Tone</InputLabel>
    <Select
      value={value ?? 'tough_love'}
      label="Coaching Tone"
      onChange={(e) => onChange(e.target.value as CoachingTone)}
      MenuProps={{ sx: { zIndex: 1600 } }}
    >
      {(Object.keys(TONE_LABELS) as CoachingTone[]).map((t) => (
        <MenuItem key={t} value={t}>
          {TONE_LABELS[t]}
        </MenuItem>
      ))}
    </Select>
  </FormControl>
);

const MARKET_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'forex', label: 'Forex' },
  { value: 'stocks', label: 'Stocks' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'commodities', label: 'Commodities' },
  { value: 'indices', label: 'Indices' },
  { value: 'bonds', label: 'Bonds' },
];

// Curated catalog of Yahoo Finance symbols, grouped by asset class for the
// Autocomplete picker. Not exhaustive (Yahoo has tens of thousands of
// tickers) — just the instruments traders actually watch. Keyboard shortcuts
// / display labels are the primary UX, so we keep the label concise and put
// the verbose name in `description` for the option row.
interface YahooSymbolOption {
  symbol: string;
  label: string;
  group: string;
}

const YAHOO_SYMBOL_CATALOG: YahooSymbolOption[] = [
  // Forex — majors
  { symbol: 'EURUSD=X', label: 'EUR/USD', group: 'Forex majors' },
  { symbol: 'GBPUSD=X', label: 'GBP/USD', group: 'Forex majors' },
  { symbol: 'USDJPY=X', label: 'USD/JPY', group: 'Forex majors' },
  { symbol: 'USDCHF=X', label: 'USD/CHF', group: 'Forex majors' },
  { symbol: 'USDCAD=X', label: 'USD/CAD', group: 'Forex majors' },
  { symbol: 'AUDUSD=X', label: 'AUD/USD', group: 'Forex majors' },
  { symbol: 'NZDUSD=X', label: 'NZD/USD', group: 'Forex majors' },
  // Forex — crosses
  { symbol: 'EURGBP=X', label: 'EUR/GBP', group: 'Forex crosses' },
  { symbol: 'EURJPY=X', label: 'EUR/JPY', group: 'Forex crosses' },
  { symbol: 'EURCHF=X', label: 'EUR/CHF', group: 'Forex crosses' },
  { symbol: 'EURAUD=X', label: 'EUR/AUD', group: 'Forex crosses' },
  { symbol: 'EURCAD=X', label: 'EUR/CAD', group: 'Forex crosses' },
  { symbol: 'GBPJPY=X', label: 'GBP/JPY', group: 'Forex crosses' },
  { symbol: 'GBPAUD=X', label: 'GBP/AUD', group: 'Forex crosses' },
  { symbol: 'GBPCAD=X', label: 'GBP/CAD', group: 'Forex crosses' },
  { symbol: 'AUDJPY=X', label: 'AUD/JPY', group: 'Forex crosses' },
  { symbol: 'AUDNZD=X', label: 'AUD/NZD', group: 'Forex crosses' },
  { symbol: 'NZDJPY=X', label: 'NZD/JPY', group: 'Forex crosses' },
  { symbol: 'CADJPY=X', label: 'CAD/JPY', group: 'Forex crosses' },
  { symbol: 'CHFJPY=X', label: 'CHF/JPY', group: 'Forex crosses' },
  // Dollar / exotic FX
  { symbol: 'DX-Y.NYB', label: 'DXY — US Dollar Index', group: 'Forex crosses' },
  { symbol: 'USDMXN=X', label: 'USD/MXN', group: 'Forex crosses' },
  { symbol: 'USDZAR=X', label: 'USD/ZAR', group: 'Forex crosses' },
  { symbol: 'USDTRY=X', label: 'USD/TRY', group: 'Forex crosses' },
  { symbol: 'USDCNH=X', label: 'USD/CNH (offshore yuan)', group: 'Forex crosses' },
  // Equity indices — US
  { symbol: '^GSPC', label: 'S&P 500', group: 'Equity indices' },
  { symbol: '^IXIC', label: 'Nasdaq Composite', group: 'Equity indices' },
  { symbol: '^DJI', label: 'Dow Jones', group: 'Equity indices' },
  { symbol: '^RUT', label: 'Russell 2000', group: 'Equity indices' },
  { symbol: '^VIX', label: 'VIX', group: 'Equity indices' },
  // Equity indices — international
  { symbol: '^FTSE', label: 'FTSE 100', group: 'Equity indices' },
  { symbol: '^GDAXI', label: 'DAX', group: 'Equity indices' },
  { symbol: '^FCHI', label: 'CAC 40', group: 'Equity indices' },
  { symbol: '^STOXX50E', label: 'Euro Stoxx 50', group: 'Equity indices' },
  { symbol: '^N225', label: 'Nikkei 225', group: 'Equity indices' },
  { symbol: '^HSI', label: 'Hang Seng', group: 'Equity indices' },
  { symbol: '^AXJO', label: 'ASX 200', group: 'Equity indices' },
  // Index ETFs
  { symbol: 'SPY', label: 'SPY', group: 'Index ETFs' },
  { symbol: 'QQQ', label: 'QQQ', group: 'Index ETFs' },
  { symbol: 'IWM', label: 'IWM', group: 'Index ETFs' },
  { symbol: 'DIA', label: 'DIA', group: 'Index ETFs' },
  // Commodities — metals
  { symbol: 'GC=F', label: 'Gold', group: 'Commodities' },
  { symbol: 'SI=F', label: 'Silver', group: 'Commodities' },
  { symbol: 'HG=F', label: 'Copper', group: 'Commodities' },
  { symbol: 'PL=F', label: 'Platinum', group: 'Commodities' },
  { symbol: 'PA=F', label: 'Palladium', group: 'Commodities' },
  // Commodities — energy
  { symbol: 'CL=F', label: 'WTI Crude', group: 'Commodities' },
  { symbol: 'BZ=F', label: 'Brent Crude', group: 'Commodities' },
  { symbol: 'NG=F', label: 'Natural Gas', group: 'Commodities' },
  { symbol: 'HO=F', label: 'Heating Oil', group: 'Commodities' },
  { symbol: 'RB=F', label: 'Gasoline (RBOB)', group: 'Commodities' },
  // Commodities — agricultural
  { symbol: 'ZC=F', label: 'Corn', group: 'Commodities' },
  { symbol: 'ZS=F', label: 'Soybeans', group: 'Commodities' },
  { symbol: 'ZW=F', label: 'Wheat', group: 'Commodities' },
  { symbol: 'KC=F', label: 'Coffee', group: 'Commodities' },
  { symbol: 'SB=F', label: 'Sugar', group: 'Commodities' },
  { symbol: 'CT=F', label: 'Cotton', group: 'Commodities' },
  // Bonds / yields
  { symbol: '^TNX', label: 'US 10Y Yield', group: 'Bonds & yields' },
  { symbol: '^FVX', label: 'US 5Y Yield', group: 'Bonds & yields' },
  { symbol: '^TYX', label: 'US 30Y Yield', group: 'Bonds & yields' },
  { symbol: '^IRX', label: 'US 13W Yield', group: 'Bonds & yields' },
  { symbol: 'ZB=F', label: '30Y T-Bond Future', group: 'Bonds & yields' },
  { symbol: 'ZN=F', label: '10Y T-Note Future', group: 'Bonds & yields' },
  { symbol: 'ZF=F', label: '5Y T-Note Future', group: 'Bonds & yields' },
  { symbol: 'TLT', label: 'TLT (20Y+ Treasury ETF)', group: 'Bonds & yields' },
  // Crypto
  { symbol: 'BTC-USD', label: 'Bitcoin', group: 'Crypto' },
  { symbol: 'ETH-USD', label: 'Ethereum', group: 'Crypto' },
  { symbol: 'SOL-USD', label: 'Solana', group: 'Crypto' },
  { symbol: 'BNB-USD', label: 'BNB', group: 'Crypto' },
  { symbol: 'XRP-USD', label: 'XRP', group: 'Crypto' },
  { symbol: 'ADA-USD', label: 'Cardano', group: 'Crypto' },
  { symbol: 'DOGE-USD', label: 'Dogecoin', group: 'Crypto' },
  { symbol: 'AVAX-USD', label: 'Avalanche', group: 'Crypto' },
  { symbol: 'LINK-USD', label: 'Chainlink', group: 'Crypto' },
  { symbol: 'LTC-USD', label: 'Litecoin', group: 'Crypto' },
  // Mega-cap stocks
  { symbol: 'AAPL', label: 'Apple', group: 'Mega-cap stocks' },
  { symbol: 'MSFT', label: 'Microsoft', group: 'Mega-cap stocks' },
  { symbol: 'NVDA', label: 'NVIDIA', group: 'Mega-cap stocks' },
  { symbol: 'GOOGL', label: 'Alphabet Class A', group: 'Mega-cap stocks' },
  { symbol: 'META', label: 'Meta', group: 'Mega-cap stocks' },
  { symbol: 'AMZN', label: 'Amazon', group: 'Mega-cap stocks' },
  { symbol: 'TSLA', label: 'Tesla', group: 'Mega-cap stocks' },
  { symbol: 'JPM', label: 'JPMorgan', group: 'Mega-cap stocks' },
  { symbol: 'XOM', label: 'Exxon', group: 'Mega-cap stocks' },
  { symbol: 'BRK-B', label: 'Berkshire Hathaway B', group: 'Mega-cap stocks' },
];

const CUSTOM_TEMPLATE_ID = 'custom';

// Each macro query fires a Serper call every sweep. Capped to keep quota usage
// bounded; edge function trims defensively to the same limit.
const MAX_MACRO_QUERIES = 10;

interface MarketResearchFormProps {
  config: MarketResearchConfig;
  setConfig: (c: MarketResearchConfig) => void;
  macroQueryInput: string;
  setMacroQueryInput: (v: string) => void;
}

const MarketResearchForm: React.FC<MarketResearchFormProps> = ({
  config,
  setConfig,
  macroQueryInput,
  setMacroQueryInput,
}) => {
  const toggleArrayItem = <T extends string>(arr: T[], item: T): T[] =>
    arr.includes(item) ? arr.filter((v) => v !== item) : [...arr, item];

  const handleTemplateChange = (templateId: string) => {
    const template = getTemplate(templateId);
    if (!template) return;
    // Overwrite the macro-query snapshot with the chosen template. Preserve
    // markets/frequency/threshold/watchlist — those are orthogonal to the
    // preset queries.
    setConfig({
      ...config,
      template_id: template.id,
      macro_queries: template.macro_queries.slice(0, MAX_MACRO_QUERIES),
    });
  };

  const addMacroQuery = () => {
    const trimmed = macroQueryInput.trim();
    if (!trimmed || config.macro_queries.includes(trimmed)) return;
    if (config.macro_queries.length >= MAX_MACRO_QUERIES) return;
    setConfig({
      ...config,
      macro_queries: [...config.macro_queries, trimmed],
      template_id: CUSTOM_TEMPLATE_ID,
    });
    setMacroQueryInput('');
  };

  const removeMacroQuery = (q: string) => {
    setConfig({
      ...config,
      macro_queries: config.macro_queries.filter((x) => x !== q),
      template_id: CUSTOM_TEMPLATE_ID,
    });
  };

  const updateWatchlistSymbols = (symbols: string[]) => {
    setConfig({
      ...config,
      watchlist_symbols: symbols,
    });
  };

  // If the stored template_id is something we don't recognize (custom or
  // legacy), show it as "Custom" in the picker rather than leaving the
  // Select empty.
  const templateValue = RESEARCH_TEMPLATES.some((t) => t.id === config.template_id)
    ? config.template_id
    : CUSTOM_TEMPLATE_ID;

  const watchlistEmpty = (config.watchlist_symbols ?? []).length === 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <FormControl size="small" fullWidth>
        <InputLabel>Template</InputLabel>
        <Select
          value={templateValue}
          label="Template"
          onChange={(e) => handleTemplateChange(e.target.value as string)}
          MenuProps={{ sx: { zIndex: 1600 } }}
          renderValue={(val) => {
            const label =
              val === CUSTOM_TEMPLATE_ID
                ? 'Custom (edited)'
                : getTemplate(val as string)?.name ?? (val as string);
            return (
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, color: 'text.primary' }}
              >
                {label}
              </Typography>
            );
          }}
        >
          {RESEARCH_TEMPLATES.map((t) => (
            <MenuItem key={t.id} value={t.id}>
              <Box>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 600, color: 'text.primary' }}
                >
                  {t.name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {t.description}
                </Typography>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <FormControl size="small" sx={{ flex: 1 }}>
          <InputLabel>Check every</InputLabel>
          <Select
            value={config.frequency_minutes}
            label="Check every"
            onChange={(e) =>
              setConfig({
                ...config,
                frequency_minutes: e.target.value as 15 | 30 | 60,
              })
            }
            MenuProps={{ sx: { zIndex: 1600 } }}
          >
            <MenuItem value={15}>15 min</MenuItem>
            <MenuItem value={30}>30 min</MenuItem>
            <MenuItem value={60}>1 hour</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ flex: 1 }}>
          <InputLabel>Alert on</InputLabel>
          <Select
            value={config.min_significance}
            label="Alert on"
            onChange={(e) =>
              setConfig({
                ...config,
                min_significance: e.target.value as 'medium' | 'high',
              })
            }
            MenuProps={{ sx: { zIndex: 1600 } }}
          >
            <MenuItem value="medium">Medium &amp; high</MenuItem>
            <MenuItem value="high">High only</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          Markets
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {MARKET_OPTIONS.map((m) => (
            <Chip
              key={m.value}
              label={m.label}
              size="small"
              onClick={() =>
                setConfig({
                  ...config,
                  markets: toggleArrayItem(config.markets, m.value),
                })
              }
              color={config.markets.includes(m.value) ? 'primary' : 'default'}
              variant={config.markets.includes(m.value) ? 'filled' : 'outlined'}
            />
          ))}
        </Box>
      </Box>

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          Watchlist symbols <Box component="span" sx={{ color: 'error.main' }}>*</Box>
        </Typography>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            color: 'text.secondary',
            mb: 1,
            fontSize: '0.72rem',
          }}
        >
          Pick the instruments you're watching. Drives live price grounding, per‑instrument news queries, and economic‑event currency filtering. Capped at ~12 total.
        </Typography>
        <Autocomplete<YahooSymbolOption, true>
          multiple
          size="small"
          options={YAHOO_SYMBOL_CATALOG}
          groupBy={(opt) => opt.group}
          getOptionLabel={(opt) => `${opt.label} (${opt.symbol})`}
          isOptionEqualToValue={(a, b) => a.symbol === b.symbol}
          value={YAHOO_SYMBOL_CATALOG.filter((opt) =>
            (config.watchlist_symbols ?? []).includes(opt.symbol)
          )}
          onChange={(_, newValue) =>
            updateWatchlistSymbols(newValue.map((v) => v.symbol))
          }
          // The enclosing Dialog sets z-index 1500; default Popper lands behind it.
          slotProps={{ popper: { sx: { zIndex: 1600 } } }}
          renderOption={(props, opt) => (
            <li {...props} key={opt.symbol}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <span>{opt.label}</span>
                <Typography
                  component="span"
                  variant="caption"
                  sx={{ color: 'text.secondary', fontFamily: 'monospace' }}
                >
                  {opt.symbol}
                </Typography>
              </Box>
            </li>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Search instruments…"
              error={watchlistEmpty}
              helperText={watchlistEmpty ? 'Pick at least one instrument.' : undefined}
            />
          )}
        />
      </Box>

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          Macro Queries{' '}
          <Typography
            component="span"
            variant="caption"
            sx={{ color: 'text.secondary', fontWeight: 400 }}
          >
            ({config.macro_queries.length}/{MAX_MACRO_QUERIES})
          </Typography>
        </Typography>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            color: 'text.secondary',
            mb: 1,
            fontSize: '0.72rem',
          }}
        >
          Baseline queries Orion runs every sweep. Edit to tailor to your market — e.g. add "$TSLA earnings" or "BTC ETF flows". Up to {MAX_MACRO_QUERIES} queries.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
          <TextField
            size="small"
            placeholder={
              config.macro_queries.length >= MAX_MACRO_QUERIES
                ? `Limit reached (${MAX_MACRO_QUERIES})`
                : 'Add a query…'
            }
            value={macroQueryInput}
            onChange={(e) => setMacroQueryInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addMacroQuery();
              }
            }}
            disabled={config.macro_queries.length >= MAX_MACRO_QUERIES}
            fullWidth
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            disabled={
              !macroQueryInput.trim() ||
              config.macro_queries.length >= MAX_MACRO_QUERIES
            }
            onClick={addMacroQuery}
          >
            Add
          </Button>
        </Box>
        {config.macro_queries.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {config.macro_queries.map((q) => (
              <Chip
                key={q}
                label={q}
                size="small"
                onDelete={() => removeMacroQuery(q)}
              />
            ))}
          </Box>
        )}
      </Box>

    </Box>
  );
};

const CreateTaskDialog: React.FC<CreateTaskDialogProps> = ({
  open,
  onClose,
  onCreate,
  existingTaskTypes,
  editingTask,
  onSave,
}) => {
  const theme = useTheme();
  const isEditMode = !!editingTask;
  const [taskType, setTaskType] = useState<TaskType | ''>('');
  const [config, setConfig] = useState<TaskConfig | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [macroQueryInput, setMacroQueryInput] = useState('');

  // Detect once per mount — changing TZ mid-dialog is unexpected.
  const browserTimezone = React.useMemo(() => detectBrowserTimezone(), []);
  const timezoneOptions = React.useMemo(
    () => buildTimezoneOptions(browserTimezone),
    [browserTimezone]
  );
  const defaultConfigs = React.useMemo(
    () => buildDefaultConfigs(browserTimezone),
    [browserTimezone]
  );

  // When opening in edit mode, hydrate from the editing task. Market research
  // configs may predate the template fields — run them through the hydrator so
  // the form always sees a fully-populated config.
  React.useEffect(() => {
    if (editingTask) {
      setTaskType(editingTask.task_type);
      const raw = editingTask.config as unknown as Record<string, unknown>;
      const hydrated =
        editingTask.task_type === 'market_research'
          ? (hydrateMarketResearchConfig(raw) as unknown as TaskConfig)
          : ({ ...editingTask.config } as TaskConfig);
      setConfig(hydrated);
      setMacroQueryInput('');
    }
  }, [editingTask]);

  const availableTypes = (
    Object.keys(TASK_TYPE_LABELS) as TaskType[]
  ).filter((t) => !existingTaskTypes.includes(t));

  const handleTypeChange = (type: TaskType) => {
    setTaskType(type);
    setConfig({ ...defaultConfigs[type] });
  };

  const handleBack = () => {
    if (isEditMode) return; // in edit mode, back is disabled — only cancel/save
    setTaskType('');
    setConfig(null);
    setMacroQueryInput('');
  };

  const handleClose = () => {
    onClose();
    setTaskType('');
    setConfig(null);
    setMacroQueryInput('');
  };

  const handleSubmit = async () => {
    if (!taskType || !config) return;
    setSubmitting(true);
    try {
      if (isEditMode && onSave && editingTask) {
        await onSave(editingTask.id, config);
      } else {
        await onCreate(taskType, config);
      }
      handleClose();
    } finally {
      setSubmitting(false);
    }
  };

  const selectedInfo = taskType ? TASK_TYPE_INFO[taskType] : null;

  // Market research requires at least one watchlist symbol — it drives news
  // queries, price grounding, and economic-event currency filtering. Without
  // symbols there's nothing to ground the briefing against.
  const canSubmit = (() => {
    if (taskType !== 'market_research') return true;
    const mr = config as MarketResearchConfig | null;
    return !!mr && (mr.watchlist_symbols ?? []).length > 0;
  })();

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      sx={{ zIndex: 1500 }}
      PaperProps={{ sx: { borderRadius: '12px' } }}
    >
      <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
        {taskType && !isEditMode && (
          <IconButton size="small" onClick={handleBack} sx={{ mr: 0.5 }}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        )}
        {isEditMode && taskType && selectedInfo
          ? `Edit ${TASK_TYPE_LABELS[taskType]}`
          : taskType && selectedInfo
            ? TASK_TYPE_LABELS[taskType]
            : 'Create Task'}
      </DialogTitle>

      <DialogContent>
        {!taskType && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mt: 0.5 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
              Pick a task type. Orion will run it on schedule and post results here.
            </Typography>
            {availableTypes.length === 0 && (
              <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 3 }}>
                All task types are already configured.
              </Typography>
            )}
            {availableTypes.map((type) => {
              const info = TASK_TYPE_INFO[type];
              const Icon = info.Icon;
              return (
                <Box
                  key={type}
                  onClick={() => handleTypeChange(type)}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1.5,
                    p: 1.5,
                    borderRadius: '10px',
                    border: `1px solid ${theme.palette.divider}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      borderColor: alpha(info.iconColor, 0.5),
                      backgroundColor: alpha(info.iconColor, 0.04),
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: alpha(info.iconColor, 0.12),
                      color: info.iconColor,
                      flexShrink: 0,
                    }}
                  >
                    <Icon fontSize="small" />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
                      {TASK_TYPE_LABELS[type]}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.78rem' }}>
                      {info.summary}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}

        {taskType && selectedInfo && config && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 0.5 }}>
            {/* Description + Example output */}
            <Box
              sx={{
                p: 1.5,
                borderRadius: '10px',
                backgroundColor: alpha(selectedInfo.iconColor, 0.06),
                border: `1px solid ${alpha(selectedInfo.iconColor, 0.2)}`,
              }}
            >
              <Typography variant="body2" sx={{ mb: 1.5, fontSize: '0.85rem', lineHeight: 1.5 }}>
                {selectedInfo.description}
              </Typography>

              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  mb: 0.75,
                }}
              >
                <CheckIcon sx={{ fontSize: 14, color: selectedInfo.iconColor }} />
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    color: selectedInfo.iconColor,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    fontSize: '0.68rem',
                  }}
                >
                  Example Output
                </Typography>
              </Box>

              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  mb: 0.5,
                }}
              >
                {selectedInfo.exampleTitle}
              </Typography>
              <Typography
                variant="caption"
                component="pre"
                sx={{
                  display: 'block',
                  fontFamily: 'inherit',
                  fontSize: '0.75rem',
                  lineHeight: 1.55,
                  color: 'text.secondary',
                  whiteSpace: 'pre-wrap',
                  m: 0,
                }}
              >
                {selectedInfo.exampleOutput}
              </Typography>
            </Box>

            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                fontSize: '0.68rem',
                color: 'text.secondary',
                mt: 0.5,
              }}
            >
              Configure
            </Typography>

            {taskType === 'market_research' && (
              <MarketResearchForm
                config={config as MarketResearchConfig}
                setConfig={(next) => setConfig(next)}
                macroQueryInput={macroQueryInput}
                setMacroQueryInput={setMacroQueryInput}
              />
            )}

            {taskType === 'daily_analysis' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <TextField
                    label="Run Time"
                    type="time"
                    value={(config as any).run_time_utc}
                    onChange={(e) =>
                      setConfig({ ...config, run_time_utc: e.target.value })
                    }
                    sx={{ flex: 1 }}
                  />
                  <FormControl size="small" sx={{ flex: 1.3 }}>
                    <InputLabel>Timezone</InputLabel>
                    <Select
                      value={(config as any).timezone || 'UTC'}
                      label="Timezone"
                      onChange={(e) =>
                        setConfig({ ...config, timezone: e.target.value as string })
                      }
                      MenuProps={{ sx: { zIndex: 1600 } }}
                    >
                      {timezoneOptions.map((tz) => (
                        <MenuItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                <CoachingToneSelect
                  value={(config as any).tone}
                  onChange={(tone) => setConfig({ ...config, tone })}
                />
              </Box>
            )}

            {taskType === 'weekly_review' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <CoachingToneSelect
                  value={(config as any).tone}
                  onChange={(tone) => setConfig({ ...config, tone })}
                />
                <FormControl fullWidth>
                  <InputLabel>Run Day</InputLabel>
                  <Select
                    value={(config as any).run_day}
                    label="Run Day"
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        run_day: e.target.value as number,
                      })
                    }
                    MenuProps={{ sx: { zIndex: 1600 } }}
                  >
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                      <MenuItem key={d} value={i}>
                        {d}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <TextField
                    label="Run Time"
                    type="time"
                    value={(config as any).run_time_utc}
                    onChange={(e) =>
                      setConfig({ ...config, run_time_utc: e.target.value })
                    }
                    sx={{ flex: 1 }}
                  />
                  <FormControl size="small" sx={{ flex: 1.3 }}>
                    <InputLabel>Timezone</InputLabel>
                    <Select
                      value={(config as any).timezone || 'UTC'}
                      label="Timezone"
                      onChange={(e) =>
                        setConfig({ ...config, timezone: e.target.value as string })
                      }
                      MenuProps={{ sx: { zIndex: 1600 } }}
                    >
                      {timezoneOptions.map((tz) => (
                        <MenuItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                <TextField
                  label="Comparison Weeks"
                  type="number"
                  value={(config as any).comparison_weeks}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      comparison_weeks: parseInt(e.target.value) || 4,
                    })
                  }
                  inputProps={{ min: 1, max: 12 }}
                  fullWidth
                />
              </Box>
            )}

            {taskType === 'monthly_rollup' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <CoachingToneSelect
                  value={(config as any).tone}
                  onChange={(tone) => setConfig({ ...config, tone })}
                />
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <TextField
                    label="Run Time"
                    type="time"
                    value={(config as any).run_time_utc}
                    onChange={(e) =>
                      setConfig({ ...config, run_time_utc: e.target.value })
                    }
                    sx={{ flex: 1 }}
                  />
                  <FormControl size="small" sx={{ flex: 1.3 }}>
                    <InputLabel>Timezone</InputLabel>
                    <Select
                      value={(config as any).timezone || 'UTC'}
                      label="Timezone"
                      onChange={(e) =>
                        setConfig({ ...config, timezone: e.target.value as string })
                      }
                      MenuProps={{ sx: { zIndex: 1600 } }}
                    >
                      {timezoneOptions.map((tz) => (
                        <MenuItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                <TextField
                  label="Comparison Months"
                  type="number"
                  value={(config as any).comparison_months}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      comparison_months: parseInt(e.target.value) || 3,
                    })
                  }
                  inputProps={{ min: 1, max: 12 }}
                  fullWidth
                />
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose}>Cancel</Button>
        {taskType && (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!config || submitting || !canSubmit}
          >
            {submitting
              ? (isEditMode ? 'Saving...' : 'Creating...')
              : (isEditMode ? 'Save Changes' : 'Create Task')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CreateTaskDialog;
