import React, { useState } from 'react';
import {
  Box,
  Typography,
  Avatar,
  Stack,
  Button,
  alpha,
  useTheme,
  CircularProgress
} from '@mui/material';
import {
  CalendarToday,
  Schedule as ScheduleIcon,
  Restore as RestoreIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { format, isValid, differenceInDays } from 'date-fns';
import { Calendar } from '../../types/calendar';

interface TrashCalendarItemProps {
  calendar: Calendar;
  onRestore: (calendarId: string) => Promise<void>;
  onPermanentDelete: (calendarId: string) => Promise<void>;
}

const safeFormatDate = (
  date: Date | string | undefined | null,
  formatStr: string,
  fallback: string = 'N/A'
): string => {
  if (!date) return fallback;
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (!isValid(dateObj)) return fallback;
  try {
    return format(dateObj, formatStr);
  } catch {
    return fallback;
  }
};

const getDaysUntilDeletion = (autoDeleteAt: Date | string | undefined | null): number => {
  if (!autoDeleteAt) return 30;
  const deleteDate = typeof autoDeleteAt === 'string' ? new Date(autoDeleteAt) : autoDeleteAt;
  if (!isValid(deleteDate)) return 30;
  const days = differenceInDays(deleteDate, new Date());
  return Math.max(0, days);
};

const TrashCalendarItem: React.FC<TrashCalendarItemProps> = ({
  calendar,
  onRestore,
  onPermanentDelete
}) => {
  const theme = useTheme();
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const daysUntilDeletion = getDaysUntilDeletion(calendar.auto_delete_at);

  const handleRestore = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRestoring(true);
    try {
      await onRestore(calendar.id);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);
    try {
      await onPermanentDelete(calendar.id);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1.5,
        p: 1.5,
        borderRadius: 2,
        bgcolor: theme.palette.mode === 'dark'
          ? alpha(theme.palette.background.paper, 0.4)
          : alpha(theme.palette.background.default, 0.6),
        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        transition: 'all 0.2s',
      }}
    >
      {/* Hero Image or Placeholder */}
      <Avatar
        src={calendar.hero_image_url || undefined}
        variant="rounded"
        sx={{
          width: 48,
          height: 48,
          flexShrink: 0,
          bgcolor: alpha(theme.palette.error.main, 0.1),
          opacity: 0.7,
          '& img': {
            objectFit: 'cover'
          }
        }}
      >
        <CalendarToday sx={{ color: theme.palette.text.secondary }} />
      </Avatar>

      {/* Calendar Info */}
      <Box sx={{ flex: 1, minWidth: 120 }}>
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            mb: 0.25
          }}
        >
          {calendar.name}
        </Typography>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <ScheduleIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
          <Typography variant="caption" color="text.secondary">
            {daysUntilDeletion} days
          </Typography>
        </Stack>
      </Box>

      {/* Dates */}
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography variant="caption" color="text.secondary">
          Deleted {safeFormatDate(calendar.deleted_at, 'MMM d, yyyy')}
        </Typography>
      </Box>

      {/* Actions */}
      <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
        <Button
          size="small"
          startIcon={
            isRestoring
              ? <CircularProgress size={14} />
              : <RestoreIcon />
          }
          onClick={handleRestore}
          disabled={isRestoring || isDeleting}
          sx={{
            textTransform: 'none',
            color: 'primary.main',
            fontSize: '0.75rem',
            minWidth: 'auto',
            px: 1
          }}
        >
          Restore
        </Button>
        <Button
          size="small"
          onClick={handleDelete}
          disabled={isRestoring || isDeleting}
          sx={{
            textTransform: 'none',
            color: 'error.main',
            fontSize: '0.75rem',
            minWidth: 'auto',
            px: 0.5
          }}
        >
          {isDeleting
            ? <CircularProgress size={14} />
            : <DeleteIcon sx={{ fontSize: 18 }} />}
        </Button>
      </Stack>
    </Box>
  );
};

export default TrashCalendarItem;
