import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  Divider,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import Shimmer from '../Shimmer';
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
  onDeleteTask: (taskId: string) => Promise<void>;
  onMarkRead: (resultId: string) => Promise<void>;
}

const OrionTasksContent: React.FC<OrionTasksContentProps> = ({
  tasks,
  results,
  unreadCount,
  loading,
  onCreateTask,
  onDeleteTask,
  onMarkRead,
}) => {
  const theme = useTheme();
  const [createOpen, setCreateOpen] = useState(false);
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
    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Shimmer width="100%" height={60} />
        <Shimmer width="100%" height={80} />
        <Shimmer width="100%" height={80} />
      </Box>
    );
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
      {/* Active tasks summary */}
      <Box sx={{ p: 2, pb: 1 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1.5,
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 700, fontSize: '0.85rem' }}
          >
            Active Tasks ({tasks.filter((t) => t.status === 'active').length})
          </Typography>
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
            {tasks.map((task) => (
              <Chip
                key={task.id}
                label={TASK_TYPE_LABELS[task.task_type]}
                size="small"
                color={task.status === 'active' ? 'primary' : 'default'}
                variant={
                  task.status === 'active' ? 'filled' : 'outlined'
                }
                onDelete={() => setPendingDeleteTaskId(task.id)}
                deleteIcon={
                  <DeleteIcon sx={{ fontSize: '14px !important' }} />
                }
                sx={{ fontSize: '0.75rem', height: 26 }}
              />
            ))}
          </Box>
        )}
      </Box>

      <Divider />

      {/* Results feed */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 2,
          pt: 1,
          ...scrollbarStyles(theme),
        }}
      >
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
                />
              ))}
            </Box>
          ))
        )}
      </Box>

      <CreateTaskDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={onCreateTask}
        existingTaskTypes={existingTaskTypes}
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
