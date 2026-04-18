import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Typography,
  useTheme,
  alpha,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Circle as UnreadIcon,
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
}

const SIGNIFICANCE_COLORS: Record<Significance, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#22c55e',
};

const TaskResultCard: React.FC<TaskResultCardProps> = ({
  result,
  onMarkRead,
}) => {
  const theme = useTheme();

  const sanitizedHtml = useMemo(
    () => DOMPurify.sanitize(result.content_html, SANITIZE_CONFIG),
    [result.content_html]
  );

  return (
    <Card
      sx={{
        mb: 1.5,
        borderRadius: '10px',
        border: `1px solid ${
          result.is_read
            ? theme.palette.divider
            : alpha(theme.palette.primary.main, 0.3)
        }`,
        backgroundColor: result.is_read
          ? 'background.paper'
          : alpha(theme.palette.primary.main, 0.03),
        transition: 'all 0.2s ease',
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
            {result.significance && (
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
              {format(new Date(result.created_at), 'HH:mm')}
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
                      color: theme.palette.primary.main,
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
      </CardContent>
    </Card>
  );
};

export default TaskResultCard;
