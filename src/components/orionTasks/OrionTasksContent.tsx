import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  Divider,
  useTheme,
  alpha,
  CircularProgress,
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
import { TASK_TYPE_LABELS, TASK_TYPE_COLORS } from '../../types/orionTask';
import type { Calendar, Trade } from '../../types/dualWrite';
import type { TradeOperationsProps } from '../../types/tradeOperations';

interface OrionTasksContentProps {
  tasks: OrionTask[];
  results: OrionTaskResult[];
  unreadCount: number;
  loading: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
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
  /** Calendar + trades + operations are passed through to each result card so
   *  it can open TradeGalleryDialog / EconomicEventDetailDialog / NoteEditorDialog
   *  when the user clicks an inline <trade-ref>, <event-ref>, or <note-ref> chip. */
  calendar?: Calendar;
  trades?: Trade[];
  tradeOperations?: TradeOperationsProps;
  isReadOnly?: boolean;
}

const OrionTasksContent: React.FC<OrionTasksContentProps> = ({
  tasks,
  results,
  unreadCount,
  loading,
  hasMore,
  loadingMore,
  onLoadMore,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onMarkRead,
  onMarkAllRead,
  onHideResult,
  onFollowup,
  onSaveNote,
  calendar,
  trades,
  tradeOperations,
  isReadOnly,
}) => {
  const theme = useTheme();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<OrionTask | null>(null);
  const [pendingDeleteTaskId, setPendingDeleteTaskId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [filterTaskType, setFilterTaskType] = useState<TaskType | null>(null);

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

  const filterableTaskTypes = useMemo(
    () => tasks.map((t) => t.task_type),
    [tasks]
  );

  const selectedTask = useMemo(
    () => tasks.find((t) => t.task_type === filterTaskType) ?? null,
    [tasks, filterTaskType]
  );

  const filteredResults = useMemo(
    () => (filterTaskType ? results.filter((r) => r.task_type === filterTaskType) : results),
    [results, filterTaskType]
  );

  const groupedResults = useMemo(() => {
    const groups: Record<string, OrionTaskResult[]> = {};
    for (const r of filteredResults) {
      const key = r.group_date;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }
    return Object.entries(groups).sort(
      ([a], [b]) => new Date(b).getTime() - new Date(a).getTime()
    );
  }, [filteredResults]);

  if (loading) {
    return <EconomicEventShimmer count={10} />;
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

      {/* Scroll region */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          ...scrollbarStyles(theme),
        }}
      >
        {/* Filter row — always visible when there are tasks */}
        {tasks.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
            <Typography variant="body2" sx={{ mb: 1 }}>No tasks yet</Typography>
            <Typography variant="caption">Create a task and Orion will run it on schedule</Typography>
          </Box>
        ) : (
          <Box
            sx={{
              px: 2,
              py: 1,
              display: 'flex',
              gap: 0.5,
              alignItems: 'center',
              borderBottom: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Typography variant="caption" sx={{ color: 'text.secondary', mr: 0.5, flexShrink: 0 }}>
              Filter:
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', flex: 1 }}>
              <Chip
                label="All"
                size="small"
                variant={filterTaskType === null ? 'filled' : 'outlined'}
                onClick={() => setFilterTaskType(null)}
                sx={{ fontSize: '0.72rem', height: 22 }}
              />
              {filterableTaskTypes.map((type) => {
                const task = tasks.find((t) => t.task_type === type)!;
                const hasFailures = (task.consecutive_failures ?? 0) > 0;
                const color = TASK_TYPE_COLORS[type];
                const active = filterTaskType === type;
                const tooltip = hasFailures
                  ? `${task.consecutive_failures} consecutive failed run${task.consecutive_failures === 1 ? '' : 's'}${task.last_error ? ` — ${task.last_error}` : ''}`
                  : '';
                return (
                  <Chip
                    key={type}
                    icon={hasFailures ? <WarningIcon sx={{ fontSize: '14px !important' }} /> : undefined}
                    label={TASK_TYPE_LABELS[type]}
                    size="small"
                    title={tooltip}
                    variant={active ? 'filled' : 'outlined'}
                    onClick={() => setFilterTaskType(active ? null : type)}
                    sx={{
                      fontSize: '0.72rem',
                      height: 22,
                      backgroundColor: active
                        ? hasFailures ? alpha(theme.palette.warning.main, 0.3) : color
                        : 'transparent',
                      color: active
                        ? hasFailures ? theme.palette.warning.dark : '#fff'
                        : hasFailures ? theme.palette.warning.dark : color,
                      borderColor: hasFailures ? theme.palette.warning.main : alpha(color, 0.6),
                      '&:hover': {
                        backgroundColor: active
                          ? hasFailures ? alpha(theme.palette.warning.main, 0.3) : color
                          : hasFailures ? alpha(theme.palette.warning.main, 0.1) : alpha(color, 0.08),
                      },
                      '& .MuiChip-icon': { color: 'inherit' },
                    }}
                  />
                );
              })}
            </Box>
            {/* Edit / delete for the selected task */}
            <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
              {onUpdateTask && (
                <Button
                  size="small"
                  variant="outlined" 
                  disabled={!selectedTask}
                  onClick={() => selectedTask && setEditingTask(selectedTask)}
                  sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.25, minWidth: 0 }}
                >
                  Edit
                </Button>
              )}
              <Button
                size="small"
                variant="outlined" 
                disabled={!selectedTask}
                onClick={() => selectedTask && setPendingDeleteTaskId(selectedTask.id)}
                sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.25, minWidth: 0 }}
              >
                Delete
              </Button>
            </Box>
          </Box>
        )}

        {/* Results feed */}
        <Box sx={{ p: 2, pt: 1 }}>
        {filteredResults.length === 0 ? (
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
          <>
            {groupedResults.map(([date, dateResults]) => (
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
                    calendar={calendar}
                    trades={trades}
                    tradeOperations={tradeOperations}
                    isReadOnly={isReadOnly}
                  />
                ))}
              </Box>
            ))}
            {hasMore && !filterTaskType && (
              <Box sx={{ display: 'flex', justifyContent: 'center', pb: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={onLoadMore}
                  disabled={loadingMore}
                  startIcon={loadingMore ? <CircularProgress size={14} /> : undefined}
                  sx={{ textTransform: 'none', fontSize: '0.8rem' }}
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </Button>
              </Box>
            )}
          </>
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
