import React, { useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Typography,
  useTheme,
  alpha,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Circle as UnreadIcon,
  ChatBubbleOutline as ChatIcon,
  ErrorOutline as ErrorIcon,
  Close as CloseIcon,
  NoteAddOutlined as NoteAddIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import type { OrionTaskResult, Significance } from '../../types/orionTask';
import { TASK_TYPE_LABELS } from '../../types/orionTask';

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'h3', 'h4', 'h5', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span'],
  ALLOWED_ATTR: ['class'],
};

interface TaskResultCardProps {
  result: OrionTaskResult;
  onMarkRead: (resultId: string) => void;
  /** Soft-delete: hides the card from the feed. The row stays in the database
   *  so Orion's dedup context (fetchRecentBriefings) still sees it and avoids
   *  re-reporting the same catalyst the user just dismissed. */
  onHide?: (resultId: string) => void;
  /** Optional: clicking the Follow-up button calls this with the result so the
   *  parent can switch to the Chat tab and seed the input with briefing context. */
  onFollowup?: (result: OrionTaskResult) => void;
  /** Optional: save this briefing as a note. */
  onSaveNote?: (result: OrionTaskResult) => Promise<void>;
}

const SIGNIFICANCE_COLORS: Record<Significance, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#22c55e',
};

const TaskResultCard: React.FC<TaskResultCardProps> = ({
  result,
  onMarkRead,
  onHide,
  onFollowup,
  onSaveNote,
}) => {
  const theme = useTheme();
  const [isSaving, setIsSaving] = useState(false);
  const isError = result.metadata?.error === true;

  const handleSaveNote = async () => {
    if (!onSaveNote || isSaving) return;
    setIsSaving(true);
    try {
      await onSaveNote(result);
    } finally {
      setIsSaving(false);
    }
  };

  const sanitizedHtml = useMemo(
    () => DOMPurify.sanitize(result.content_html, SANITIZE_CONFIG),
    [result.content_html]
  );

  const accentColor = isError
    ? theme.palette.error.main
    : theme.palette.primary.main;

  return (
    <Card
      sx={{
        mb: 1.5,
        borderRadius: '10px',
        border: `1px solid ${isError
            ? alpha(theme.palette.error.main, 0.45)
            : result.is_read
              ? theme.palette.divider
              : alpha(theme.palette.primary.main, 0.3)
          }`,
        backgroundColor: isError
          ? alpha(theme.palette.error.main, 0.05)
          : result.is_read
            ? 'background.paper'
            : alpha(theme.palette.primary.main, 0.03),
        transition: 'all 0.2s ease',
        '&:hover': {
          transform: 'none'
        },
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={TASK_TYPE_LABELS[result.task_type]}
              size="small"
              sx={{
                fontSize: '0.7rem',
                height: 22,
                fontWeight: 600,
              }}
            />
            {isError && (
              <Chip
                icon={<ErrorIcon sx={{ fontSize: '12px !important' }} />}
                label="FAILED"
                size="small"
                sx={{
                  fontSize: '0.65rem',
                  height: 20,
                  fontWeight: 700,
                  backgroundColor: alpha(theme.palette.error.main, 0.15),
                  color: theme.palette.error.main,
                  '& .MuiChip-icon': { color: theme.palette.error.main },
                }}
              />
            )}
            {!isError && result.significance && (
              <Chip
                label={result.significance.toUpperCase()}
                size="small"
                sx={{
                  fontSize: '0.65rem',
                  height: 20,
                  fontWeight: 700,
                  backgroundColor: alpha(
                    SIGNIFICANCE_COLORS[result.significance],
                    0.15
                  ),
                  color: SIGNIFICANCE_COLORS[result.significance],
                }}
              />
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', fontSize: '0.7rem' }}
            >
              {format(new Date(result.created_at), 'MMM d · h:mm a')}
            </Typography>
            {!result.is_read && (
              <Tooltip title="Mark as read">
                <IconButton
                  size="small"
                  onClick={() => onMarkRead(result.id)}
                  sx={{ p: 0.25 }}
                >
                  <UnreadIcon
                    sx={{
                      fontSize: 10,
                      color: accentColor,
                    }}
                  />
                </IconButton>
              </Tooltip>
            )}
            {onHide && (
              <Tooltip title="Dismiss from feed">
                <IconButton
                  size="small"
                  onClick={() => onHide(result.id)}
                  sx={{ p: 0.25 }}
                >
                  <CloseIcon
                    sx={{
                      fontSize: 14,
                      color: 'text.secondary',
                    }}
                  />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        <Typography
          variant="body2"
          sx={{
            fontSize: '0.82rem',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
          }}
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />

        {(onFollowup || onSaveNote) && (
          <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
            {onSaveNote && (
              <Button
                size="small"
                startIcon={isSaving ? <CircularProgress size={12} color="inherit" /> : <NoteAddIcon sx={{ fontSize: 14 }} />}
                onClick={handleSaveNote}
                disabled={isSaving}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  py: 0.25,
                  px: 1,
                  color: 'text.secondary',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.action.active, 0.06),
                  },
                }}
              >
                Save as Note
              </Button>
            )}
            {onFollowup && (
              <Button
                size="small"
                startIcon={<ChatIcon sx={{ fontSize: 14 }} />}
                onClick={() => onFollowup(result)}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  py: 0.25,
                  px: 1,
                  color: theme.palette.primary.main,
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.08),
                  },
                }}
              >
                Follow up with Orion
              </Button>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default TaskResultCard;
