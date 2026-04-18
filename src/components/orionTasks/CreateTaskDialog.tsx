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
} from '@mui/material';
import type {
  TaskType,
  TaskConfig,
  TradingSession,
  SessionCheckpoint,
  CoachingTone,
} from '../../types/orionTask';
import { TASK_TYPE_LABELS, DEFAULT_CONFIGS } from '../../types/orionTask';

interface CreateTaskDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (taskType: TaskType, config: TaskConfig) => Promise<unknown>;
  existingTaskTypes: TaskType[];
}

const SESSION_LABELS: Record<TradingSession, string> = {
  asia: 'Asia',
  london: 'London',
  ny_am: 'NY AM',
  ny_pm: 'NY PM',
};

const CHECKPOINT_LABELS: Record<SessionCheckpoint, string> = {
  start: 'Start',
  mid: 'Mid',
  end: 'End',
};

const TONE_LABELS: Record<CoachingTone, string> = {
  tough_love: 'Tough Love Coach',
  blunt_analyst: 'Blunt Analyst',
  supportive_mentor: 'Supportive Mentor',
};

const CreateTaskDialog: React.FC<CreateTaskDialogProps> = ({
  open,
  onClose,
  onCreate,
  existingTaskTypes,
}) => {
  const [taskType, setTaskType] = useState<TaskType | ''>('');
  const [config, setConfig] = useState<TaskConfig | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const availableTypes = (
    Object.keys(TASK_TYPE_LABELS) as TaskType[]
  ).filter((t) => !existingTaskTypes.includes(t));

  const handleTypeChange = (type: TaskType) => {
    setTaskType(type);
    setConfig({ ...DEFAULT_CONFIGS[type] });
  };

  const handleCreate = async () => {
    if (!taskType || !config) return;
    setSubmitting(true);
    try {
      await onCreate(taskType, config);
      onClose();
      setTaskType('');
      setConfig(null);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleArrayItem = <T extends string>(
    arr: T[],
    item: T
  ): T[] =>
    arr.includes(item)
      ? arr.filter((v) => v !== item)
      : [...arr, item];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: '12px' } }}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>Create Task</DialogTitle>
      <DialogContent>
        <FormControl fullWidth sx={{ mt: 1, mb: 2 }}>
          <InputLabel>Task Type</InputLabel>
          <Select
            value={taskType}
            label="Task Type"
            onChange={(e) =>
              handleTypeChange(e.target.value as TaskType)
            }
          >
            {availableTypes.map((type) => (
              <MenuItem key={type} value={type}>
                {TASK_TYPE_LABELS[type]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {taskType === 'market_research' && config && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                Sessions
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {(Object.keys(SESSION_LABELS) as TradingSession[]).map(
                  (s) => (
                    <Chip
                      key={s}
                      label={SESSION_LABELS[s]}
                      size="small"
                      onClick={() =>
                        setConfig({
                          ...config,
                          sessions: toggleArrayItem(
                            (config as any).sessions,
                            s
                          ),
                        })
                      }
                      color={
                        (config as any).sessions.includes(s)
                          ? 'primary'
                          : 'default'
                      }
                      variant={
                        (config as any).sessions.includes(s)
                          ? 'filled'
                          : 'outlined'
                      }
                    />
                  )
                )}
              </Box>
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                Checkpoints
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {(
                  Object.keys(CHECKPOINT_LABELS) as SessionCheckpoint[]
                ).map((c) => (
                  <Chip
                    key={c}
                    label={CHECKPOINT_LABELS[c]}
                    size="small"
                    onClick={() =>
                      setConfig({
                        ...config,
                        checkpoints: toggleArrayItem(
                          (config as any).checkpoints,
                          c
                        ),
                      })
                    }
                    color={
                      (config as any).checkpoints.includes(c)
                        ? 'primary'
                        : 'default'
                    }
                    variant={
                      (config as any).checkpoints.includes(c)
                        ? 'filled'
                        : 'outlined'
                    }
                  />
                ))}
              </Box>
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

        {taskType === 'daily_analysis' && config && (
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
              >
                {(Object.keys(TONE_LABELS) as CoachingTone[]).map(
                  (t) => (
                    <MenuItem key={t} value={t}>
                      {TONE_LABELS[t]}
                    </MenuItem>
                  )
                )}
              </Select>
            </FormControl>
          </Box>
        )}

        {taskType === 'weekly_review' && config && (
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
              >
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
                  (d, i) => (
                    <MenuItem key={d} value={i}>
                      {d}
                    </MenuItem>
                  )
                )}
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

        {taskType === 'monthly_rollup' && config && (
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
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={!taskType || !config || submitting}
        >
          {submitting ? 'Creating...' : 'Create Task'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateTaskDialog;
