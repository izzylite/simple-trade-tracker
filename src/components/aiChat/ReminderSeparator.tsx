/**
 * Reminder Separator
 *
 * Small system pill rendered above any chat message whose
 * `metadata.triggered_by` starts with 'reminder:'. Marks turns that were
 * fired by a scheduled reminder rather than a user-typed prompt.
 */

import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import AlarmIcon from '@mui/icons-material/Alarm';

interface ReminderSeparatorProps {
  description?: string | null;
}

const ReminderSeparator: React.FC<ReminderSeparatorProps> = ({ description }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        my: 1.5,
        px: 1.5,
        py: 0.75,
        borderRadius: 999,
        alignSelf: 'flex-start',
        bgcolor: theme.palette.action.hover,
        color: theme.palette.text.secondary,
        fontSize: 12,
        width: 'fit-content',
      }}
    >
      <AlarmIcon sx={{ fontSize: 14 }} />
      <Typography variant="caption" sx={{ fontSize: 12 }}>
        Reminder{description ? `: ${description}` : ''}
      </Typography>
    </Box>
  );
};

export default ReminderSeparator;
