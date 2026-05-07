import React from 'react';
import { Box, Typography } from '@mui/material';

const NotificationsEmpty: React.FC = () => (
  <Box
    sx={{
      px: 4,
      py: 6,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 0.75,
      textAlign: 'center',
    }}
  >
    <Typography
      sx={{
        fontSize: '0.875rem',
        fontWeight: 500,
        color: 'text.secondary',
      }}
    >
      No notifications yet
    </Typography>
    <Typography
      sx={{
        fontSize: '0.8125rem',
        fontWeight: 400,
        color: 'text.disabled',
        maxWidth: 260,
        lineHeight: 1.5,
      }}
    >
      Reminders Orion fires for you appear here.
    </Typography>
  </Box>
);

export default NotificationsEmpty;
