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
  Delete as DeleteIcon,
  DoneAll as DoneAllIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  Pause as PauseIcon,
  PlayArrow as PlayArrowIcon,
  ManageSearch as ManageSearchIcon,
} from '@mui/icons-material';
import { IconButton, Tooltip } from '@mui/material';
import { format, isToday, isYesterday } from 'date-fns';
import { scrollbarStyles } from 'styles/scrollbarStyles';
import { useDialogTokens } from 'styles/dialogTokens';
import EconomicEventShimmer from 'features/events/components/EconomicEventShimmer';
import ConfirmationDialog from 'components/common/ConfirmationDialog';
import TaskResultCard from 'features/orion/components/orionTasks/TaskResultCard';
import MarketResearchSettingsDialog from 'features/orion/components/orionTasks/MarketResearchSettingsDialog';
import type {
  OrionTask,
  OrionTaskResult,
  TaskConfig,
} from 'features/orion/types/orionTask';
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
  onCreateTask: (config: TaskConfig) => Promise<OrionTask | undefined>;
  onUpdateTask?: (
    taskId: string,
    updates: { status?: OrionTask['status']; config?: TaskConfig }
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
  } = useDialogTokens();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingDeleteTaskId, setPendingDeleteTaskId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // The unique-index in the DB guarantees at most one MR task per user.
  const mrTask = tasks[0] ?? null;

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

  const togglePause = async () => {
    if (!mrTask || !onUpdateTask) return;
    const nextStatus: OrionTask['status'] = mrTask.status === 'paused' ? 'active' : 'paused';
    await onUpdateTask(mrTask.id, { status: nextStatus });
  };

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
      {/* Status strip — only shown when MR task exists */}
      {mrTask && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.25,
            borderBottom: `1px solid ${hairline}`,
            backgroundColor: 'background.paper',
          }}
        >
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
            <Typography component="span" sx={monoSectionLabelSx}>
              MARKET RESEARCH
            </Typography>
            <Box
              component="span"
              sx={{
                ...monoLabelSx,
                fontSize: '0.62rem',
                px: 0.75,
                py: 0.15,
                borderRadius: 999,
                backgroundColor:
                  mrTask.status === 'active'
                    ? violetSofter
                    : mrTask.status === 'disabled'
                      ? alpha(theme.palette.error.main, 0.12)
                      : alpha(theme.palette.text.secondary, 0.08),
                color:
                  mrTask.status === 'active'
                    ? violet
                    : mrTask.status === 'disabled'
                      ? theme.palette.error.main
                      : 'text.secondary',
                border: `1px solid ${
                  mrTask.status === 'active'
                    ? violetBorder
                    : mrTask.status === 'disabled'
                      ? alpha(theme.palette.error.main, 0.35)
                      : hairline
                }`,
              }}
            >
              {mrTask.status.toUpperCase()}
            </Box>
            {/* Threshold-gated failure summary. Stays hidden for 1-2 transient
                blips (Gemini 503s etc.) and surfaces only when failures
                accumulate. Once we hit 10 the server auto-disables and the
                status pill above flips to DISABLED, so this indicator is the
                bridge between "all green" and "fully off". */}
            {(mrTask.consecutive_failures ?? 0) >= 3 && mrTask.status !== 'disabled' && (
              <Tooltip
                title={
                  mrTask.last_error_at
                    ? `${mrTask.consecutive_failures} runs failed. Last at ${format(new Date(mrTask.last_error_at), 'MMM d, h:mm a')}.`
                    : `${mrTask.consecutive_failures} runs failed.`
                }
              >
                <Typography
                  component="span"
                  variant="caption"
                  sx={{ color: theme.palette.warning.main, fontSize: '0.7rem', cursor: 'help' }}
                >
                  {mrTask.consecutive_failures} runs failed
                </Typography>
              </Tooltip>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {onMarkAllRead && unreadCount > 0 && (
              <Tooltip title="Mark all results as read">
                <IconButton
                  size="small"
                  onClick={() => onMarkAllRead()}
                  sx={{ ...ghostButtonSx, p: 0.6, borderRadius: 1 }}
                >
                  <DoneAllIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Edit Market Research">
              <IconButton
                size="small"
                onClick={() => setSettingsOpen(true)}
                sx={{ ...ghostButtonSx, p: 0.6, borderRadius: 1 }}
              >
                <EditIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={mrTask.status === 'paused' ? 'Resume' : 'Pause'}>
              <IconButton
                size="small"
                onClick={togglePause}
                sx={{ ...ghostButtonSx, p: 0.6, borderRadius: 1 }}
              >
                {mrTask.status === 'paused' ? (
                  <PlayArrowIcon sx={{ fontSize: 15 }} />
                ) : (
                  <PauseIcon sx={{ fontSize: 15 }} />
                )}
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete Market Research">
              <IconButton
                size="small"
                onClick={() => setPendingDeleteTaskId(mrTask.id)}
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
        </Box>
      )}

      {/* Scroll region */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          // Empty state centers within the available height; once results
          // exist, the scroll region returns to top-aligned (the result feed
          // would otherwise float-center awkwardly as it grows).
          ...(tasks.length === 0 && {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }),
          ...scrollbarStyles(theme),
        }}
      >
        {/* No task yet — empty state */}
        {tasks.length === 0 ? (
          <Box sx={{ px: 2, py: 2.5, width: '100%' }}>
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
                <ManageSearchIcon sx={{ fontSize: 22 }} />
              </Box>
              <Typography
                sx={{
                  ...monoLabelSx,
                  color: 'text.primary',
                  fontSize: '0.72rem',
                  mt: 0.5,
                }}
              >
                Set up Market Research
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
                Orion sweeps live news on your schedule and posts briefings here when
                a market-moving catalyst is detected.
              </Typography>
              <Button
                size="small"
                onClick={() => setSettingsOpen(true)}
                sx={{
                  ...primaryButtonSx,
                  mt: 0.5,
                  fontSize: '0.78rem',
                  px: 1.5,
                  py: 0.5,
                  minHeight: 0,
                }}
              >
                Set up Market Research
              </Button>
            </Box>
          </Box>
        ) : tasks.length > 0 ? (
          <Box sx={{ p: 2, pt: 1.5 }}>
            {results.length === 0 ? (
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
                  Results will appear here as Orion detects market-moving catalysts
                </Typography>
              </Box>
            ) : (
              <>
                {groupedResults.map(([date, dateResults]) => (
                  <Box key={date} sx={{ mb: 2 }}>
                    {/* Sticky mono uppercase date label */}
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
                        mb: 1,
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
                {hasMore && (
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
        ) : null}
      </Box>

      <MarketResearchSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        existingTask={mrTask}
        onSave={async (config) => {
          if (mrTask) {
            await onUpdateTask?.(mrTask.id, { config });
          } else {
            await onCreateTask(config);
          }
        }}
      />

      <ConfirmationDialog
        open={!!pendingDeleteTaskId}
        title="Delete Market Research?"
        message="Delete this Market Research task? Orion will stop posting briefings. Past results remain in your history."
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
