import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  Divider,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  DoneAll as DoneAllIcon,
  Edit as EditIcon,
  WarningAmber as WarningIcon,
} from '@mui/icons-material';
import { IconButton, Tooltip } from '@mui/material';
import { format } from 'date-fns';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import EconomicEventShimmer from '../economicCalendar/EconomicEventShimmer';
import ConfirmationDialog from '../common/ConfirmationDialog';
import TaskResultCard from './TaskResultCard';
import CreateTaskDialog from './CreateTaskDialog';
import type {
  OrionTask,
  OrionTaskResult,
  TaskType,
  TaskConfig,
} from '../../types/orionTask';
import { TASK_TYPE_LABELS } from '../../types/orionTask';

interface OrionTasksContentProps {
  tasks: OrionTask[];
  results: OrionTaskResult[];
  unreadCount: number;
  loading: boolean;
  onCreateTask: (
    taskType: TaskType,
    config: TaskConfig
  ) => Promise<OrionTask | undefined>;
  onUpdateTask?: (
    taskId: string,
    updates: { config?: TaskConfig }
  ) => Promise<OrionTask | undefined>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onMarkRead: (resultId: string) => Promise<void>;
  onMarkAllRead?: () => Promise<void>;
  onHideResult?: (resultId: string) => Promise<void>;
  onFollowup?: (result: OrionTaskResult) => void;
  onSaveNote?: (result: OrionTaskResult) => Promise<void>;
}

const OrionTasksContent: React.FC<OrionTasksContentProps> = ({
  tasks,
  results,
  unreadCount,
  loading,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onMarkRead,
  onMarkAllRead,
  onHideResult,
  onFollowup,
  onSaveNote,
}) => {
  const theme = useTheme();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<OrionTask | null>(null);
  const [pendingDeleteTaskId, setPendingDeleteTaskId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const pendingDeleteTask = useMemo(
    () => tasks.find((t) => t.id === pendingDeleteTaskId) || null,
    [tasks, pendingDeleteTaskId]
  );

  const handleConfirmDelete = async () => {
    if (!pendingDeleteTaskId) return;
    setIsDeleting(true);
    try {
      await onDeleteTask(pendingDeleteTaskId);
      setPendingDeleteTaskId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const existingTaskTypes = useMemo(
    () => tasks.map((t) => t.task_type),
    [tasks]
  );

  const allTaskTypesUsed = useMemo(
    () =>
      (Object.keys(TASK_TYPE_LABELS) as TaskType[]).every((t) =>
        existingTaskTypes.includes(t)
      ),
    [existingTaskTypes]
  );

  const groupedResults = useMemo(() => {
    const groups: Record<string, OrionTaskResult[]> = {};
    for (const r of results) {
      const key = r.group_date;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }
    return Object.entries(groups).sort(
      ([a], [b]) => new Date(b).getTime() - new Date(a).getTime()
    );
  }, [results]);

  if (loading) {
    return <EconomicEventShimmer count={5} />;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Sticky header: title + action buttons only. Task chips scroll with the feed. */}
      <Box sx={{ px: 2, pt: 2, pb: 1,  borderBottom: `1px solid ${theme.palette.divider}`, backgroundColor: 'background.paper', zIndex: 1 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 700, fontSize: '0.85rem' }}
          >
            Active Tasks ({tasks.filter((t) => t.status === 'active').length})
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {onMarkAllRead && unreadCount > 0 && (
              <Tooltip title="Mark all results as read">
                <IconButton
                  size="small"
                  onClick={() => onMarkAllRead()}
                  sx={{ p: 0.5 }}
                >
                  <DoneAllIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )}
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setCreateOpen(true)}
              disabled={allTaskTypesUsed}
              sx={{ textTransform: 'none', fontSize: '0.8rem' }}
            >
              New Task
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Scroll region: task chips + results feed scroll together below the sticky header. */}
      <Box
        sx={{
          flex: 1,
          pt: 2,
          overflow: 'auto',
          ...scrollbarStyles(theme),
        }}
      >
        <Box sx={{ px: 2, pb: 1 }}>
        {tasks.length === 0 ? (
          <Box
            sx={{
              textAlign: 'center',
              py: 3,
              color: 'text.secondary',
            }}
          >
            <Typography variant="body2" sx={{ mb: 1 }}>
              No tasks yet
            </Typography>
            <Typography variant="caption">
              Create a task and Orion will run it on schedule
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
            {tasks.map((task) => {
              const hasFailures = (task.consecutive_failures ?? 0) > 0;
              const chipIcon = hasFailures ? (
                <WarningIcon sx={{ fontSize: '14px !important' }} />
              )  : undefined;
              const tooltip = hasFailures
                ? `${task.consecutive_failures} consecutive failed run${
                    task.consecutive_failures === 1 ? '' : 's'
                  }${task.last_error ? ` — ${task.last_error}` : ''}`
                : '';
              return (
                <Chip
                  key={task.id}
                  icon={chipIcon}
                  label={TASK_TYPE_LABELS[task.task_type]}
                  size="small"
                  title={tooltip}
                  color={
                    hasFailures
                      ? 'warning'
                      : task.status === 'active'
                        ? 'primary'
                        : 'default'
                  }
                  variant={task.status === 'active' ? 'filled' : 'outlined'}
                  onClick={onUpdateTask ? () => setEditingTask(task) : undefined}
                  onDelete={() => setPendingDeleteTaskId(task.id)}
                  deleteIcon={
                    <DeleteIcon sx={{ fontSize: '14px !important' }} />
                  }
                  sx={{
                    fontSize: '0.75rem',
                    height: 26,
                    cursor: onUpdateTask ? 'pointer' : 'default',
                    // Preserve background on hover — MUI's default darken
                    // for clickable chips fights the "filled accent color"
                    // we want the chip to hold in both states.
                    backgroundColor: hasFailures
                      ? alpha(theme.palette.warning.main, 0.15)
                      : task.status === 'active'
                        ? theme.palette.primary.main
                        : 'transparent',
                    color: hasFailures
                      ? theme.palette.warning.dark
                      : task.status === 'active'
                        ? theme.palette.primary.contrastText
                        : 'text.primary',
                    borderColor: hasFailures
                      ? theme.palette.warning.main
                      : undefined,
                    '&:hover, &.MuiChip-clickable:hover, &.MuiChip-clickable:focus': {
                      backgroundColor: hasFailures
                        ? alpha(theme.palette.warning.main, 0.15)
                        : task.status === 'active'
                          ? theme.palette.primary.main
                          : 'transparent',
                    },
                    // Match the leading + trailing icons to the chip's label
                    // color so they don't wash out against the fill.
                    '& .MuiChip-icon, & .MuiChip-deleteIcon': {
                      color: 'inherit',
                    },
                    '& .MuiChip-deleteIcon:hover': {
                      color: 'inherit',
                      opacity: 0.7,
                    },
                  }}
                />
              );
            })}
          </Box>
        )}
        </Box>

        <Divider />

        {/* Results feed */}
        <Box sx={{ p: 2, pt: 1 }}>
        {results.length === 0 ? (
          <Box
            sx={{
              textAlign: 'center',
              py: 4,
              color: 'text.secondary',
            }}
          >
            <Typography variant="body2">No results yet</Typography>
            <Typography variant="caption">
              Results will appear here as Orion completes tasks
            </Typography>
          </Box>
        ) : (
          groupedResults.map(([date, dateResults]) => (
            <Box key={date} sx={{ mb: 2 }}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  color: 'text.secondary',
                  fontSize: '0.7rem',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  mb: 0.5,
                  display: 'block',
                }}
              >
                {format(new Date(date), 'EEEE, MMM d')}
              </Typography>
              {dateResults.map((result) => (
                <TaskResultCard
                  key={result.id}
                  result={result}
                  onMarkRead={onMarkRead}
                  onHide={onHideResult}
                  onFollowup={onFollowup}
                  onSaveNote={onSaveNote}
                />
              ))}
            </Box>
          ))
        )}
        </Box>
      </Box>

      <CreateTaskDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={onCreateTask}
        existingTaskTypes={existingTaskTypes}
      />

      <CreateTaskDialog
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        onCreate={async () => undefined}
        existingTaskTypes={[]}
        editingTask={editingTask}
        onSave={
          onUpdateTask
            ? async (taskId, config) => {
                await onUpdateTask(taskId, { config });
              }
            : undefined
        }
      />

      <ConfirmationDialog
        open={!!pendingDeleteTaskId}
        title="Delete Task?"
        message={
          pendingDeleteTask
            ? `Are you sure you want to delete the "${TASK_TYPE_LABELS[pendingDeleteTask.task_type]}" task? Orion will stop running it.`
            : ''
        }
        confirmText="Delete"
        confirmColor="error"
        isSubmitting={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDeleteTaskId(null)}
      />
    </Box>
  );
};

export default OrionTasksContent;
