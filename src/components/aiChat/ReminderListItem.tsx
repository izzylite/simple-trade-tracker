/**
 * Reminder List Item
 *
 * Single-row presentation of a pending reminder, used inside the upcoming
 * reminders panel. Shows description, relative + absolute trigger time, and
 * (when present) the originating conversation title. Clicking the row opens
 * the reminder; the cancel button stops propagation so the row click doesn't
 * also fire.
 */

import React from 'react';
import {
  Box,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import CancelIcon from '@mui/icons-material/Cancel';
import AlarmIcon from '@mui/icons-material/Alarm';
import type { Reminder } from 'features/notes/services/remindersService';

interface ReminderListItemProps {
  reminder: Reminder;
  onCancel: (id: string) => void;
  onClick: (reminder: Reminder) => void;
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

const ReminderListItem: React.FC<ReminderListItemProps> = ({
  reminder,
  onCancel,
  onClick,
}) => {
  const theme = useTheme();
  return (
    <Box
      onClick={() => onClick(reminder)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(reminder);
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
      <AlarmIcon
        aria-hidden
        sx={{ mt: 0.25, color: theme.palette.text.secondary }}
        fontSize="small"
      />
      <Stack flex={1} minWidth={0} spacing={0.25}>
        <Typography variant="body2" noWrap fontWeight={500}>
          {reminder.description ?? '(untitled)'}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {formatRelative(reminder.trigger_at)} · {formatAbsolute(reminder.trigger_at)}
        </Typography>
        {reminder.conversation_title && (
          <Typography variant="caption" color="text.secondary" noWrap>
            in {reminder.conversation_title}
          </Typography>
        )}
      </Stack>
      <Tooltip title="Cancel reminder">
        <IconButton
          size="small"
          aria-label="Cancel reminder"
          onClick={(e) => {
            e.stopPropagation();
            onCancel(reminder.id);
          }}
        >
          <CancelIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

export default ReminderListItem;
