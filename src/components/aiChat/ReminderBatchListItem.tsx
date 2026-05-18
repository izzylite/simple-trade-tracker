/**
 * Reminder Batch List Item
 *
 * Groups every pending reminder sharing the same `batch_id` into a single
 * card. The model creates batches when the user asks for a polling loop
 * ("monitor X every 5min for 30min") or a multi-event group ("remind me
 * before NFP and CPI"), so showing N rows would be noisy. We render: the
 * shared description (first row), a count chip, the NEXT fire time, and a
 * single cancel button that calls cancelReminderBatch (atomic).
 */

import React from 'react';
import {
  Box,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import CancelIcon from '@mui/icons-material/Cancel';
import RepeatIcon from '@mui/icons-material/Repeat';
import type { Reminder } from 'features/notes/services/remindersService';

interface ReminderBatchListItemProps {
  batchId: string;
  reminders: Reminder[]; // sorted ascending by trigger_at
  onCancelBatch: (batchId: string) => void;
  onClick: (conversationId: string) => void;
}

function formatRelative(isoTime: string): string {
  const ms = new Date(isoTime).getTime() - Date.now();
  if (ms < 0) return 'overdue';
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.round(hours / 24);
  return `in ${days}d`;
}

function formatAbsolute(isoTime: string): string {
  return new Date(isoTime).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const ReminderBatchListItem: React.FC<ReminderBatchListItemProps> = ({
  batchId,
  reminders,
  onCancelBatch,
  onClick,
}) => {
  const theme = useTheme();
  const next = reminders[0];
  // Siblings always share a conversation (FK) and usually a description.
  const title = next.description ?? '(untitled)';
  const conversationId = next.conversation_id;
  const conversationTitle = next.conversation_title;
  const count = reminders.length;

  return (
    <Box
      onClick={() => onClick(conversationId)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(conversationId);
        }
      }}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
        p: 1.5,
        borderRadius: 2,
        cursor: 'pointer',
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) },
        '&:focus-visible': {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: 2,
        },
      }}
    >
      <RepeatIcon
        aria-hidden
        sx={{ mt: 0.25, color: theme.palette.primary.main }}
        fontSize="small"
      />
      <Stack flex={1} minWidth={0} spacing={0.25}>
        <Stack direction="row" alignItems="center" spacing={0.75} minWidth={0}>
          <Typography variant="body2" noWrap fontWeight={500}>
            {title}
          </Typography>
          <Chip
            label={`${count} left`}
            size="small"
            sx={{
              height: 18,
              fontSize: '0.7rem',
              fontWeight: 600,
              bgcolor: alpha(theme.palette.primary.main, 0.12),
              color: theme.palette.primary.main,
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        </Stack>
        <Typography variant="caption" color="text.secondary" noWrap>
          next {formatRelative(next.trigger_at)} · {formatAbsolute(next.trigger_at)}
        </Typography>
        {conversationTitle && (
          <Typography variant="caption" color="text.secondary" noWrap>
            in {conversationTitle}
          </Typography>
        )}
      </Stack>
      <Tooltip title={`Cancel all ${count} reminders`}>
        <IconButton
          size="small"
          aria-label={`Cancel all ${count} reminders in this batch`}
          onClick={(e) => {
            e.stopPropagation();
            onCancelBatch(batchId);
          }}
        >
          <CancelIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

export default ReminderBatchListItem;
