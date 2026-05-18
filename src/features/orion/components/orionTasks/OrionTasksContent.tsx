import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
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
  AssignmentOutlined as AssignmentIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { IconButton, Tooltip } from '@mui/material';
import { format, isToday, isYesterday } from 'date-fns';
import { scrollbarStyles } from 'styles/scrollbarStyles';
import { useDialogTokens, MONO_FONT } from 'styles/dialogTokens';
import EconomicEventShimmer from 'features/events/components/EconomicEventShimmer';
import ConfirmationDialog from 'components/common/ConfirmationDialog';
import TaskResultCard from 'features/orion/components/orionTasks/TaskResultCard';
import CreateTaskDialog from 'features/orion/components/orionTasks/CreateTaskDialog';
import type {
  OrionTask,
  OrionTaskResult,
  TaskType,
  TaskConfig,
} from 'features/orion/types/orionTask';
import { TASK_TYPE_LABELS, TASK_TYPE_COLORS } from 'features/orion/types/orionTask';
import type { Calendar, Trade } from 'features/calendar/types/dualWrite';
import type { TradeOperationsProps } from 'features/calendar/types/tradeOperations';

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

/**
 * Format the group date label as a mono uppercase string.
 * Today  → "TODAY · MAR 4"
 * Yest.  → "MAR 3 · YESTERDAY"
 * Other  → "EEE · MMM D"
 */
const formatGroupDate = (iso: string): string => {
  const d = new Date(iso);
  if (isToday(d)) return `TODAY · ${format(d, 'MMM d').toUpperCase()}`;
  if (isYesterday(d)) return `${format(d, 'MMM d').toUpperCase()} · YESTERDAY`;
  return format(d, 'EEE · MMM d').toUpperCase();
};

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
  const {
    violet,
    violetSoft,
    violetSofter,
    violetBorder,
    surfaceInset,
    hairline,
    monoLabelSx,
    monoSectionLabelSx,
    primaryButtonSx,
    ghostButtonSx,
    chipStyle,
  } = useDialogTokens();

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

  const activeTasksCount = tasks.filter((t) => t.status === 'active').length;

  if (loading) {
    return <EconomicEventShimmer count={6} />;
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
      {/* Sticky top bar — mono section label + count pill + actions */}
      <Box
        sx={{
          px: 2,
          pt: 1.75,
          pb: 1.25,
          borderBottom: `1px solid ${hairline}`,
          backgroundColor: 'background.paper',
          zIndex: 1,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
            <Typography component="span" sx={monoSectionLabelSx}>
              Active Tasks
            </Typography>
            <Box
              component="span"
              sx={{
                fontFamily: MONO_FONT,
                fontSize: '0.66rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                color: violet,
                backgroundColor: violetSofter,
                border: `1px solid ${violetBorder}`,
                borderRadius: 999,
                px: 0.85,
                py: 0.15,
                lineHeight: 1.4,
                minWidth: 22,
                textAlign: 'center',
              }}
            >
              {activeTasksCount}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {onMarkAllRead && unreadCount > 0 && (
              <Tooltip title="Mark all results as read">
                <IconButton
                  size="small"
                  onClick={() => onMarkAllRead()}
                  sx={{
                    ...ghostButtonSx,
                    p: 0.6,
                    borderRadius: 1,
                  }}
                >
                  <DoneAllIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
            <Button
              size="small"
              startIcon={<AddIcon sx={{ fontSize: 16 }} />}
              onClick={() => setCreateOpen(true)}
              disabled={allTaskTypesUsed}
              sx={{
                ...primaryButtonSx,
                fontSize: '0.78rem',
                px: 1.25,
                py: 0.4,
                minHeight: 0,
              }}
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
        {/* Filter row — chip-segmented bar */}
        {tasks.length === 0 ? null : (
          <Box
            sx={{
              px: 2,
              py: 1.25,
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              borderBottom: `1px solid ${hairline}`,
              backgroundColor: 'background.paper',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                flex: 1,
                minWidth: 0,
                overflowX: 'auto',
                ...scrollbarStyles(theme),
                '&::-webkit-scrollbar': { height: 0 },
                scrollbarWidth: 'none',
              }}
            >
              <Box
                component="span"
                onClick={() => setFilterTaskType(null)}
                sx={chipStyle(filterTaskType === null)}
              >
                All
              </Box>
              {filterableTaskTypes.map((type) => {
                const task = tasks.find((t) => t.task_type === type)!;
                const hasFailures = (task.consecutive_failures ?? 0) > 0;
                const color = TASK_TYPE_COLORS[type];
                const selected = filterTaskType === type;
                return (
                  <Box
                    key={type}
                    component="span"
                    onClick={() =>
                      setFilterTaskType(selected ? null : type)
                    }
                    sx={chipStyle(selected)}
                  >
                    <Box
                      sx={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        backgroundColor: color,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ whiteSpace: 'nowrap' }}>
                      {TASK_TYPE_LABELS[type]}
                    </span>
                    {hasFailures && (
                      <WarningIcon
                        sx={{
                          fontSize: 13,
                          color: theme.palette.warning.main,
                          ml: 0.25,
                        }}
                      />
                    )}
                  </Box>
                );
              })}
            </Box>

            {/* Edit / delete for the selected task — ghost icon buttons */}
            {selectedTask && (
              <Box sx={{ display: 'flex', gap: 0.25, flexShrink: 0, pl: 0.5 }}>
                {onUpdateTask && (
                  <Tooltip title={`Edit ${TASK_TYPE_LABELS[selectedTask.task_type]}`}>
                    <IconButton
                      size="small"
                      onClick={() => setEditingTask(selectedTask)}
                      sx={{
                        ...ghostButtonSx,
                        p: 0.6,
                        borderRadius: 1,
                      }}
                    >
                      <EditIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title={`Delete ${TASK_TYPE_LABELS[selectedTask.task_type]}`}>
                  <IconButton
                    size="small"
                    onClick={() => setPendingDeleteTaskId(selectedTask.id)}
                    sx={{
                      ...ghostButtonSx,
                      p: 0.6,
                      borderRadius: 1,
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.error.main, 0.1),
                        color: theme.palette.error.main,
                      },
                    }}
                  >
                    <DeleteIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
          </Box>
        )}

        {/* Tasks empty state — dashed inset card */}
        {tasks.length === 0 ? (
          <Box sx={{ px: 2, py: 2.5 }}>
            <Box
              sx={{
                backgroundColor: surfaceInset,
                border: `1px dashed ${alpha(violet, 0.35)}`,
                borderRadius: 1.5,
                px: 2,
                py: 3.5,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 1.25,
                  backgroundColor: violetSoft,
                  color: violet,
                  border: `1px solid ${violetBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AssignmentIcon sx={{ fontSize: 22 }} />
              </Box>
              <Typography
                sx={{
                  ...monoLabelSx,
                  color: 'text.primary',
                  fontSize: '0.72rem',
                  mt: 0.5,
                }}
              >
                No tasks yet
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  fontSize: '0.78rem',
                  textAlign: 'center',
                  maxWidth: 280,
                }}
              >
                Create a task and Orion will run it on schedule, then post results here.
              </Typography>
            </Box>
          </Box>
        ) : (
          <Box sx={{ p: 2, pt: 1.5 }}>
            {filteredResults.length === 0 ? (
              <Box
                sx={{
                  backgroundColor: surfaceInset,
                  border: `1px dashed ${hairline}`,
                  borderRadius: 1.5,
                  px: 2,
                  py: 3,
                  textAlign: 'center',
                }}
              >
                <Typography sx={{ ...monoLabelSx, color: 'text.secondary' }}>
                  No results yet
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}
                >
                  Results will appear here as Orion completes tasks
                </Typography>
              </Box>
            ) : (
              <>
                {groupedResults.map(([date, dateResults]) => (
                  <Box key={date} sx={{ mb: 2 }}>
                    {/* Sticky mono uppercase date label — borderBottom so
                        content scrolling underneath reads as deliberately
                        capped, not visually clipped. */}
                    <Box
                      sx={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 1,
                        backgroundColor: 'background.paper',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        px: 1,
                        py: 0.75,
                        mb: 1
                      }}
                    >
                      <Typography
                        component="span"
                        sx={{
                          ...monoSectionLabelSx,
                          flexShrink: 0,
                        }}
                      >
                        {formatGroupDate(date)}
                      </Typography>
                    </Box>
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
                      onClick={onLoadMore}
                      disabled={loadingMore}
                      startIcon={
                        loadingMore ? (
                          <CircularProgress size={14} thickness={5} />
                        ) : (
                          <ExpandMoreIcon sx={{ fontSize: 16 }} />
                        )
                      }
                      sx={{
                        ...ghostButtonSx,
                        fontSize: '0.78rem',
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 1.25,
                        border: `1px solid ${hairline}`,
                        backgroundColor: surfaceInset,
                        '&:hover': {
                          backgroundColor: alpha(theme.palette.text.primary, 0.05),
                          borderColor: violetBorder,
                        },
                      }}
                    >
                      {loadingMore ? 'Loading…' : 'Load more'}
                    </Button>
                  </Box>
                )}
              </>
            )}
          </Box>
        )}
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
