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
  Switch,
  FormControlLabel,
  IconButton,
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
  TradingSession,
  CoachingTone,
  OrionTask,
} from '../../types/orionTask';
import { TASK_TYPE_LABELS, DEFAULT_CONFIGS } from '../../types/orionTask';

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

const SESSION_LABELS: Record<TradingSession, string> = {
  asia: 'Asia',
  london: 'London',
  ny_am: 'NY AM',
  ny_pm: 'NY PM',
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
  const [customTopicInput, setCustomTopicInput] = useState('');

  // When opening in edit mode, hydrate from the editing task
  React.useEffect(() => {
    if (editingTask) {
      setTaskType(editingTask.task_type);
      setConfig({ ...editingTask.config } as TaskConfig);
      setCustomTopicInput('');
    }
  }, [editingTask]);

  const availableTypes = (
    Object.keys(TASK_TYPE_LABELS) as TaskType[]
  ).filter((t) => !existingTaskTypes.includes(t));

  const handleTypeChange = (type: TaskType) => {
    setTaskType(type);
    setConfig({ ...DEFAULT_CONFIGS[type] });
  };

  const handleBack = () => {
    if (isEditMode) return; // in edit mode, back is disabled — only cancel/save
    setTaskType('');
    setConfig(null);
    setCustomTopicInput('');
  };

  const handleClose = () => {
    onClose();
    setTaskType('');
    setConfig(null);
    setCustomTopicInput('');
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

  const toggleArrayItem = <T extends string>(arr: T[], item: T): T[] =>
    arr.includes(item) ? arr.filter((v) => v !== item) : [...arr, item];

  const selectedInfo = taskType ? TASK_TYPE_INFO[taskType] : null;

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
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Core monitor config — frequency + threshold drive the whole task */}
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <FormControl size="small" sx={{ flex: 1 }}>
                    <InputLabel>Check every</InputLabel>
                    <Select
                      value={(config as any).frequency_minutes}
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
                      value={(config as any).min_significance}
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
                    Sessions
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
                    Focus the news search and economic-calendar filter on these hours. Doesn't affect when the task runs.
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {(Object.keys(SESSION_LABELS) as TradingSession[]).map((s) => (
                      <Chip
                        key={s}
                        label={SESSION_LABELS[s]}
                        size="small"
                        onClick={() =>
                          setConfig({
                            ...config,
                            sessions: toggleArrayItem((config as any).sessions, s),
                          })
                        }
                        color={(config as any).sessions.includes(s) ? 'primary' : 'default'}
                        variant={(config as any).sessions.includes(s) ? 'filled' : 'outlined'}
                      />
                    ))}
                  </Box>
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
                            markets: toggleArrayItem(
                              (config as any).markets,
                              m.value
                            ),
                          })
                        }
                        color={
                          (config as any).markets.includes(m.value)
                            ? 'primary'
                            : 'default'
                        }
                        variant={
                          (config as any).markets.includes(m.value)
                            ? 'filled'
                            : 'outlined'
                        }
                      />
                    ))}
                  </Box>
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    Custom Topics
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
                    Add specific search topics (e.g. "ECB rate decision", "Fed minutes", "China PMI")
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <TextField
                      size="small"
                      placeholder="Add a topic…"
                      value={customTopicInput}
                      onChange={(e) => setCustomTopicInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const trimmed = customTopicInput.trim();
                          if (
                            trimmed &&
                            !(config as any).custom_topics.includes(trimmed)
                          ) {
                            setConfig({
                              ...config,
                              custom_topics: [
                                ...(config as any).custom_topics,
                                trimmed,
                              ],
                            });
                            setCustomTopicInput('');
                          }
                        }
                      }}
                      fullWidth
                    />
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AddIcon />}
                      disabled={!customTopicInput.trim()}
                      onClick={() => {
                        const trimmed = customTopicInput.trim();
                        if (
                          trimmed &&
                          !(config as any).custom_topics.includes(trimmed)
                        ) {
                          setConfig({
                            ...config,
                            custom_topics: [
                              ...(config as any).custom_topics,
                              trimmed,
                            ],
                          });
                          setCustomTopicInput('');
                        }
                      }}
                    >
                      Add
                    </Button>
                  </Box>
                  {(config as any).custom_topics.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {(config as any).custom_topics.map((topic: string) => (
                        <Chip
                          key={topic}
                          label={topic}
                          size="small"
                          onDelete={() =>
                            setConfig({
                              ...config,
                              custom_topics: (config as any).custom_topics.filter(
                                (t: string) => t !== topic
                              ),
                            })
                          }
                        />
                      ))}
                    </Box>
                  )}
                </Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={(config as any).instrument_aware}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          instrument_aware: e.target.checked,
                        })
                      }
                    />
                  }
                  label="Instrument-aware (tailor to my traded pairs)"
                />
              </Box>
            )}

            {taskType === 'daily_analysis' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Run Time (UTC)"
                  type="time"
                  value={(config as any).run_time_utc}
                  onChange={(e) =>
                    setConfig({ ...config, run_time_utc: e.target.value })
                  }
                  fullWidth
                />
                <FormControl fullWidth>
                  <InputLabel>Coaching Tone</InputLabel>
                  <Select
                    value={(config as any).tone}
                    label="Coaching Tone"
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        tone: e.target.value as CoachingTone,
                      })
                    }
                    MenuProps={{ sx: { zIndex: 1600 } }}
                  >
                    {(Object.keys(TONE_LABELS) as CoachingTone[]).map((t) => (
                      <MenuItem key={t} value={t}>
                        {TONE_LABELS[t]}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            )}

            {taskType === 'weekly_review' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                <TextField
                  label="Run Time (UTC)"
                  type="time"
                  value={(config as any).run_time_utc}
                  onChange={(e) =>
                    setConfig({ ...config, run_time_utc: e.target.value })
                  }
                  fullWidth
                />
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
                <TextField
                  label="Run Time (UTC)"
                  type="time"
                  value={(config as any).run_time_utc}
                  onChange={(e) =>
                    setConfig({ ...config, run_time_utc: e.target.value })
                  }
                  fullWidth
                />
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
            disabled={!config || submitting}
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
