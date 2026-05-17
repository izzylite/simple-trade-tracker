import React, { useState } from 'react';
import {
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
  CircularProgress,
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
  AutoAwesome as AIIcon,
  AddTask as AddTaskIcon,
  Edit as EditIcon,
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
import BaseDialog from '../common/BaseDialog';
import { Z_INDEX } from '../../styles/zIndex';

const MONO_FONT = "'JetBrains Mono', ui-monospace, monospace";

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

const CreateTaskDialog: React.FC<CreateTaskDialogProps> = ({
  open,
  onClose,
  onCreate,
  existingTaskTypes,
  editingTask,
  onSave,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isEditMode = !!editingTask;
  const [taskType, setTaskType] = useState<TaskType | ''>('');
  const [config, setConfig] = useState<TaskConfig | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [macroQueryInput, setMacroQueryInput] = useState('');

  // Style tokens — match canonical tag-dialog language.
  const violet = theme.palette.primary.main;
  const violetSoft = alpha(violet, isDark ? 0.18 : 0.14);
  const violetSofter = alpha(violet, isDark ? 0.12 : 0.10);
  const violetBorder = alpha(violet, isDark ? 0.35 : 0.28);
  const surfaceInset = isDark ? 'rgba(255,255,255,0.03)' : alpha(theme.palette.text.primary, 0.03);
  const hairline = isDark ? 'rgba(255,255,255,0.08)' : theme.palette.divider;

  const monoLabelSx = {
    fontFamily: MONO_FONT,
    fontSize: '0.68rem',
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: theme.palette.text.secondary,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0.75,
  };

  const optionalSx = {
    fontFamily: MONO_FONT,
    fontSize: '0.68rem',
    fontWeight: 500,
    letterSpacing: '0.08em',
    color: alpha(theme.palette.text.secondary, 0.7),
    textTransform: 'none' as const,
  };

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: 1.5,
      backgroundColor: surfaceInset,
      '& fieldset': { borderColor: hairline },
      '&:hover fieldset': { borderColor: alpha(violet, 0.5) },
      '&.Mui-focused fieldset': { borderColor: violet, borderWidth: 1 },
    },
    '& .MuiOutlinedInput-input, & .MuiSelect-select': {
      py: 1.1,
      fontSize: '0.88rem',
      fontWeight: 500,
    },
  };

  const menuPaperSx = {
    borderRadius: 1.5,
    border: `1px solid ${hairline}`,
    boxShadow: theme.shadows[8],
    backgroundImage: 'none',
    mt: 0.5,
  };

  const menuItemSx = {
    fontSize: '0.88rem',
    fontWeight: 500,
    borderRadius: 1,
    mx: 0.5,
    my: 0.25,
    '&.Mui-selected': {
      backgroundColor: violetSoft,
      color: violet,
      '&:hover': { backgroundColor: violetSoft },
    },
  };

  const chipBaseSx = (selected: boolean) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0.75,
    px: 1.25,
    py: 0.5,
    borderRadius: 999,
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
    userSelect: 'none' as const,
    transition: 'all 120ms ease',
    backgroundColor: selected ? violetSoft : surfaceInset,
    color: selected ? violet : theme.palette.text.primary,
    border: `1px solid ${selected ? violetBorder : hairline}`,
    '&:hover': {
      backgroundColor: selected
        ? violetSoft
        : alpha(theme.palette.text.primary, isDark ? 0.06 : 0.05),
    },
  });

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

  // Header title node — includes a back affordance during create-mode step 2.
  const title = isEditMode && taskType && selectedInfo
    ? `Edit ${TASK_TYPE_LABELS[taskType]}`
    : taskType && selectedInfo
      ? TASK_TYPE_LABELS[taskType]
      : 'New Orion task';

  const subtitle = isEditMode
    ? 'Update schedule and parameters for this task'
    : taskType && selectedInfo
      ? selectedInfo.summary
      : 'Schedule Orion to run analysis on autopilot';

  const titleNode = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      {taskType && !isEditMode && (
        <IconButton
          size="small"
          onClick={handleBack}
          sx={{
            color: theme.palette.text.secondary,
            border: `1px solid ${hairline}`,
            borderRadius: 1,
            width: 22,
            height: 22,
            mr: 0.25,
            '&:hover': {
              backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.06 : 0.04),
            },
          }}
        >
          <ArrowBackIcon sx={{ fontSize: 14 }} />
        </IconButton>
      )}
      <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
        {title}
      </Typography>
    </Box>
  );

  const headerIcon = isEditMode
    ? <EditIcon sx={{ fontSize: 18 }} />
    : taskType
      ? <AIIcon sx={{ fontSize: 18 }} />
      : <AddTaskIcon sx={{ fontSize: 18 }} />;

  const primaryLabel = submitting
    ? (isEditMode ? 'Saving…' : 'Creating…')
    : (isEditMode ? 'Save changes' : 'Create task');

  const primaryButton = taskType ? (
    <Button
      onClick={handleSubmit}
      disabled={!config || submitting || !canSubmit}
      variant="contained"
      endIcon={
        submitting ? (
          <CircularProgress size={14} thickness={5} sx={{ color: 'inherit' }} />
        ) : undefined
      }
      sx={{
        textTransform: 'none',
        fontWeight: 600,
        fontSize: '0.85rem',
        backgroundColor: violet,
        color: '#fff',
        borderRadius: 1.25,
        px: 1.75,
        py: 0.75,
        boxShadow: 'none',
        '&:hover': {
          backgroundColor: theme.palette.primary.dark,
          boxShadow: 'none',
        },
        '&.Mui-disabled': {
          backgroundColor: alpha(violet, 0.35),
          color: alpha('#fff', 0.7),
        },
      }}
    >
      {primaryLabel}
    </Button>
  ) : null;

  return (
    <BaseDialog
      open={open}
      onClose={handleClose}
      title={titleNode}
      subtitle={subtitle}
      headerIcon={headerIcon}
      maxWidth="sm"
      fullWidth
      sx={{ zIndex: Z_INDEX.DIALOG }}
      contentSx={{ maxHeight: '70vh' }}
      actions={primaryButton}
      hideFooterCancelButton={false}
    >
      {!taskType && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Typography sx={monoLabelSx}>Pick a task type</Typography>
            <Typography sx={{ fontSize: '0.82rem', color: theme.palette.text.secondary, lineHeight: 1.5 }}>
              Orion will run it on schedule and post results directly into your assistant feed.
            </Typography>
          </Box>

          {availableTypes.length === 0 && (
            <Box
              sx={{
                px: 2,
                py: 3,
                borderRadius: 1.5,
                border: `1px dashed ${hairline}`,
                backgroundColor: surfaceInset,
                textAlign: 'center',
              }}
            >
              <Typography sx={{ fontSize: '0.85rem', color: theme.palette.text.secondary }}>
                All task types are already configured.
              </Typography>
            </Box>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
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
                    gap: 1.25,
                    px: 1.5,
                    py: 1.25,
                    borderRadius: 1.5,
                    border: `1px solid ${hairline}`,
                    backgroundColor: surfaceInset,
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                    '&:hover': {
                      borderColor: alpha(info.iconColor, 0.5),
                      backgroundColor: alpha(info.iconColor, isDark ? 0.08 : 0.05),
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: 1.25,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: alpha(info.iconColor, isDark ? 0.18 : 0.14),
                      color: info.iconColor,
                      border: `1px solid ${alpha(info.iconColor, isDark ? 0.35 : 0.28)}`,
                      flexShrink: 0,
                    }}
                  >
                    <Icon sx={{ fontSize: 18 }} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.3 }}>
                      {TASK_TYPE_LABELS[type]}
                    </Typography>
                    <Typography
                      sx={{
                        color: theme.palette.text.secondary,
                        fontSize: '0.78rem',
                        lineHeight: 1.4,
                        mt: 0.25,
                      }}
                    >
                      {info.summary}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      {taskType && selectedInfo && config && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
          {/* Description + example output */}
          <Box
            sx={{
              p: 1.5,
              borderRadius: 1.5,
              backgroundColor: alpha(selectedInfo.iconColor, isDark ? 0.1 : 0.06),
              border: `1px solid ${alpha(selectedInfo.iconColor, isDark ? 0.3 : 0.22)}`,
            }}
          >
            <Typography sx={{ mb: 1.5, fontSize: '0.85rem', lineHeight: 1.55 }}>
              {selectedInfo.description}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
              <CheckIcon sx={{ fontSize: 14, color: selectedInfo.iconColor }} />
              <Typography
                sx={{
                  ...monoLabelSx,
                  color: selectedInfo.iconColor,
                  fontSize: '0.62rem',
                }}
              >
                Example Output
              </Typography>
            </Box>

            <Typography
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
              component="pre"
              sx={{
                display: 'block',
                fontFamily: 'inherit',
                fontSize: '0.75rem',
                lineHeight: 1.55,
                color: theme.palette.text.secondary,
                whiteSpace: 'pre-wrap',
                m: 0,
              }}
            >
              {selectedInfo.exampleOutput}
            </Typography>
          </Box>

          <Typography sx={monoLabelSx}>Configure</Typography>

          {taskType === 'market_research' && (
            <MarketResearchForm
              config={config as MarketResearchConfig}
              setConfig={(next) => setConfig(next)}
              macroQueryInput={macroQueryInput}
              setMacroQueryInput={setMacroQueryInput}
              monoLabelSx={monoLabelSx}
              optionalSx={optionalSx}
              inputSx={inputSx}
              menuPaperSx={menuPaperSx}
              menuItemSx={menuItemSx}
              chipBaseSx={chipBaseSx}
              violet={violet}
              violetSoft={violetSoft}
              violetSofter={violetSofter}
              violetBorder={violetBorder}
              hairline={hairline}
              surfaceInset={surfaceInset}
            />
          )}

          {taskType === 'daily_analysis' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  <Typography sx={monoLabelSx}>Run time</Typography>
                  <TextField
                    type="time"
                    value={(config as any).run_time_utc}
                    onChange={(e) =>
                      setConfig({ ...config, run_time_utc: e.target.value })
                    }
                    size="small"
                    fullWidth
                    sx={inputSx}
                  />
                </Box>
                <Box sx={{ flex: 1.3, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  <Typography sx={monoLabelSx}>Timezone</Typography>
                  <Select
                    value={(config as any).timezone || 'UTC'}
                    onChange={(e) =>
                      setConfig({ ...config, timezone: e.target.value as string })
                    }
                    size="small"
                    fullWidth
                    sx={inputSx}
                    MenuProps={{
                      sx: { zIndex: Z_INDEX.DIALOG_POPUP },
                      PaperProps: { sx: menuPaperSx },
                    }}
                  >
                    {timezoneOptions.map((tz) => (
                      <MenuItem key={tz.value} value={tz.value} sx={menuItemSx}>
                        {tz.label}
                      </MenuItem>
                    ))}
                  </Select>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Typography sx={monoLabelSx}>Coaching tone</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {(Object.keys(TONE_LABELS) as CoachingTone[]).map((t) => {
                    const selected = ((config as any).tone ?? 'tough_love') === t;
                    return (
                      <Box
                        key={t}
                        sx={chipBaseSx(selected)}
                        onClick={() => setConfig({ ...config, tone: t })}
                      >
                        {TONE_LABELS[t]}
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            </Box>
          )}

          {taskType === 'weekly_review' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Typography sx={monoLabelSx}>Coaching tone</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {(Object.keys(TONE_LABELS) as CoachingTone[]).map((t) => {
                    const selected = ((config as any).tone ?? 'tough_love') === t;
                    return (
                      <Box
                        key={t}
                        sx={chipBaseSx(selected)}
                        onClick={() => setConfig({ ...config, tone: t })}
                      >
                        {TONE_LABELS[t]}
                      </Box>
                    );
                  })}
                </Box>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Typography sx={monoLabelSx}>Run day</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => {
                    const selected = (config as any).run_day === i;
                    return (
                      <Box
                        key={d}
                        sx={chipBaseSx(selected)}
                        onClick={() => setConfig({ ...config, run_day: i })}
                      >
                        {d}
                      </Box>
                    );
                  })}
                </Box>
              </Box>

              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  <Typography sx={monoLabelSx}>Run time</Typography>
                  <TextField
                    type="time"
                    value={(config as any).run_time_utc}
                    onChange={(e) =>
                      setConfig({ ...config, run_time_utc: e.target.value })
                    }
                    size="small"
                    fullWidth
                    sx={inputSx}
                  />
                </Box>
                <Box sx={{ flex: 1.3, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  <Typography sx={monoLabelSx}>Timezone</Typography>
                  <Select
                    value={(config as any).timezone || 'UTC'}
                    onChange={(e) =>
                      setConfig({ ...config, timezone: e.target.value as string })
                    }
                    size="small"
                    fullWidth
                    sx={inputSx}
                    MenuProps={{
                      sx: { zIndex: Z_INDEX.DIALOG_POPUP },
                      PaperProps: { sx: menuPaperSx },
                    }}
                  >
                    {timezoneOptions.map((tz) => (
                      <MenuItem key={tz.value} value={tz.value} sx={menuItemSx}>
                        {tz.label}
                      </MenuItem>
                    ))}
                  </Select>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Typography sx={monoLabelSx}>Comparison weeks</Typography>
                <TextField
                  type="number"
                  value={(config as any).comparison_weeks}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      comparison_weeks: parseInt(e.target.value) || 4,
                    })
                  }
                  inputProps={{ min: 1, max: 12 }}
                  size="small"
                  fullWidth
                  sx={inputSx}
                />
              </Box>
            </Box>
          )}

          {taskType === 'monthly_rollup' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Typography sx={monoLabelSx}>Coaching tone</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {(Object.keys(TONE_LABELS) as CoachingTone[]).map((t) => {
                    const selected = ((config as any).tone ?? 'tough_love') === t;
                    return (
                      <Box
                        key={t}
                        sx={chipBaseSx(selected)}
                        onClick={() => setConfig({ ...config, tone: t })}
                      >
                        {TONE_LABELS[t]}
                      </Box>
                    );
                  })}
                </Box>
              </Box>

              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  <Typography sx={monoLabelSx}>Run time</Typography>
                  <TextField
                    type="time"
                    value={(config as any).run_time_utc}
                    onChange={(e) =>
                      setConfig({ ...config, run_time_utc: e.target.value })
                    }
                    size="small"
                    fullWidth
                    sx={inputSx}
                  />
                </Box>
                <Box sx={{ flex: 1.3, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  <Typography sx={monoLabelSx}>Timezone</Typography>
                  <Select
                    value={(config as any).timezone || 'UTC'}
                    onChange={(e) =>
                      setConfig({ ...config, timezone: e.target.value as string })
                    }
                    size="small"
                    fullWidth
                    sx={inputSx}
                    MenuProps={{
                      sx: { zIndex: Z_INDEX.DIALOG_POPUP },
                      PaperProps: { sx: menuPaperSx },
                    }}
                  >
                    {timezoneOptions.map((tz) => (
                      <MenuItem key={tz.value} value={tz.value} sx={menuItemSx}>
                        {tz.label}
                      </MenuItem>
                    ))}
                  </Select>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Typography sx={monoLabelSx}>Comparison months</Typography>
                <TextField
                  type="number"
                  value={(config as any).comparison_months}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      comparison_months: parseInt(e.target.value) || 3,
                    })
                  }
                  inputProps={{ min: 1, max: 12 }}
                  size="small"
                  fullWidth
                  sx={inputSx}
                />
              </Box>
            </Box>
          )}
        </Box>
      )}
    </BaseDialog>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Market Research sub-form
// Kept inside this file to avoid extracting helpers to new files (circular-
// import trap). Pulls style tokens from props so it stays themed in sync with
// the parent.
// ────────────────────────────────────────────────────────────────────────────

interface MarketResearchFormStyleProps {
  monoLabelSx: Record<string, unknown>;
  optionalSx: Record<string, unknown>;
  inputSx: Record<string, unknown>;
  menuPaperSx: Record<string, unknown>;
  menuItemSx: Record<string, unknown>;
  chipBaseSx: (selected: boolean) => Record<string, unknown>;
  violet: string;
  violetSoft: string;
  violetSofter: string;
  violetBorder: string;
  hairline: string;
  surfaceInset: string;
}

const MarketResearchForm: React.FC<
  MarketResearchFormProps & MarketResearchFormStyleProps
> = ({
  config,
  setConfig,
  macroQueryInput,
  setMacroQueryInput,
  monoLabelSx,
  optionalSx,
  inputSx,
  menuPaperSx,
  menuItemSx,
  chipBaseSx,
  violet,
  violetSoft,
  violetSofter,
  violetBorder,
  hairline,
  surfaceInset,
}) => {
  const theme = useTheme();
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
      {/* Template */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Typography sx={monoLabelSx}>Template</Typography>
        <Select
          value={templateValue}
          onChange={(e) => handleTemplateChange(e.target.value as string)}
          size="small"
          fullWidth
          sx={inputSx}
          MenuProps={{
            sx: { zIndex: Z_INDEX.DIALOG_POPUP },
            PaperProps: { sx: menuPaperSx },
          }}
          renderValue={(val) => {
            const label =
              val === CUSTOM_TEMPLATE_ID
                ? 'Custom (edited)'
                : getTemplate(val as string)?.name ?? (val as string);
            return (
              <Typography sx={{ fontWeight: 600, fontSize: '0.88rem' }}>
                {label}
              </Typography>
            );
          }}
        >
          {RESEARCH_TEMPLATES.map((t) => (
            <MenuItem key={t.id} value={t.id} sx={{ ...menuItemSx, py: 1 }}>
              <Box>
                <Typography sx={{ fontWeight: 600, fontSize: '0.88rem' }}>
                  {t.name}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.74rem',
                    color: theme.palette.text.secondary,
                    lineHeight: 1.4,
                  }}
                >
                  {t.description}
                </Typography>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </Box>

      {/* Frequency + significance */}
      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Typography sx={monoLabelSx}>Check every</Typography>
          <Select
            value={config.frequency_minutes}
            onChange={(e) =>
              setConfig({
                ...config,
                frequency_minutes: e.target.value as 15 | 30 | 60,
              })
            }
            size="small"
            fullWidth
            sx={inputSx}
            MenuProps={{
              sx: { zIndex: Z_INDEX.DIALOG_POPUP },
              PaperProps: { sx: menuPaperSx },
            }}
          >
            <MenuItem value={15} sx={menuItemSx}>15 min</MenuItem>
            <MenuItem value={30} sx={menuItemSx}>30 min</MenuItem>
            <MenuItem value={60} sx={menuItemSx}>1 hour</MenuItem>
          </Select>
        </Box>

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Typography sx={monoLabelSx}>Alert on</Typography>
          <Select
            value={config.min_significance}
            onChange={(e) =>
              setConfig({
                ...config,
                min_significance: e.target.value as 'medium' | 'high',
              })
            }
            size="small"
            fullWidth
            sx={inputSx}
            MenuProps={{
              sx: { zIndex: Z_INDEX.DIALOG_POPUP },
              PaperProps: { sx: menuPaperSx },
            }}
          >
            <MenuItem value="medium" sx={menuItemSx}>Medium &amp; high</MenuItem>
            <MenuItem value="high" sx={menuItemSx}>High only</MenuItem>
          </Select>
        </Box>
      </Box>

      {/* Markets */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Typography sx={monoLabelSx}>Markets</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {MARKET_OPTIONS.map((m) => {
            const selected = config.markets.includes(m.value);
            return (
              <Box
                key={m.value}
                sx={chipBaseSx(selected)}
                onClick={() =>
                  setConfig({
                    ...config,
                    markets: toggleArrayItem(config.markets, m.value),
                  })
                }
              >
                {m.label}
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Watchlist symbols */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Typography sx={monoLabelSx}>
          Watchlist symbols
          <Box component="span" sx={{ color: theme.palette.error.main, fontFamily: 'inherit', ml: 0.5 }}>*</Box>
        </Typography>
        <Typography
          sx={{
            color: theme.palette.text.secondary,
            fontSize: '0.75rem',
            lineHeight: 1.5,
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
          slotProps={{
            popper: { sx: { zIndex: Z_INDEX.DIALOG_POPUP } },
            paper: { sx: menuPaperSx },
          }}
          renderTags={(value, getTagProps) =>
            value.map((opt, index) => {
              const tagProps = getTagProps({ index });
              return (
                <Chip
                  {...tagProps}
                  key={opt.symbol}
                  label={opt.label}
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    backgroundColor: violetSoft,
                    color: violet,
                    border: `1px solid ${violetBorder}`,
                    fontFamily: MONO_FONT,
                    '& .MuiChip-deleteIcon': {
                      color: alpha(violet, 0.7),
                      fontSize: 14,
                      '&:hover': { color: violet },
                    },
                  }}
                />
              );
            })
          }
          renderOption={(props, opt) => (
            <li {...props} key={opt.symbol}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 500 }}>
                  {opt.label}
                </Typography>
                <Typography
                  sx={{
                    color: theme.palette.text.secondary,
                    fontFamily: MONO_FONT,
                    fontSize: '0.72rem',
                  }}
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
              sx={inputSx}
            />
          )}
        />
      </Box>

      {/* Macro queries */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={monoLabelSx}>
            Macro queries
            <Box component="span" sx={{ ...optionalSx, ml: 0.5 }}>
              · {config.macro_queries.length}/{MAX_MACRO_QUERIES}
            </Box>
          </Typography>
        </Box>
        <Typography
          sx={{
            color: theme.palette.text.secondary,
            fontSize: '0.75rem',
            lineHeight: 1.5,
          }}
        >
          Baseline queries Orion runs every sweep. Edit to tailor to your market — e.g. add "$TSLA earnings" or "BTC ETF flows". Up to {MAX_MACRO_QUERIES} queries.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
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
            sx={inputSx}
          />
          <Button
            size="small"
            startIcon={<AddIcon sx={{ fontSize: 14 }} />}
            disabled={
              !macroQueryInput.trim() ||
              config.macro_queries.length >= MAX_MACRO_QUERIES
            }
            onClick={addMacroQuery}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.8rem',
              color: violet,
              backgroundColor: violetSofter,
              border: `1px solid ${violetBorder}`,
              borderRadius: 1.25,
              px: 1.25,
              py: 0.5,
              minWidth: 0,
              flexShrink: 0,
              '&:hover': { backgroundColor: violetSoft },
              '&.Mui-disabled': {
                color: alpha(violet, 0.45),
                borderColor: alpha(violet, 0.18),
                backgroundColor: alpha(violet, 0.05),
              },
            }}
          >
            Add
          </Button>
        </Box>
        {config.macro_queries.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
            {config.macro_queries.map((q) => (
              <Chip
                key={q}
                label={q}
                size="small"
                onDelete={() => removeMacroQuery(q)}
                sx={{
                  height: 24,
                  fontSize: '0.76rem',
                  fontWeight: 500,
                  backgroundColor: surfaceInset,
                  color: theme.palette.text.primary,
                  border: `1px solid ${hairline}`,
                  fontFamily: MONO_FONT,
                  '& .MuiChip-deleteIcon': {
                    color: alpha(theme.palette.text.secondary, 0.6),
                    fontSize: 14,
                    '&:hover': { color: theme.palette.text.primary },
                  },
                }}
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default CreateTaskDialog;
