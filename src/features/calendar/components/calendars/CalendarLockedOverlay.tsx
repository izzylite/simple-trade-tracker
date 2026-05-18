import React from 'react';
import { Box, Typography, alpha, useTheme } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';

interface CalendarLockedOverlayProps {
  /** Override the hint copy. */
  hint?: string;
  /**
   * When `false` (default) the overlay fills its parent. Set `true` for a
   * fixed-position blocking overlay covering the viewport.
   */
  fullscreen?: boolean;
}

/**
 * Dim/blur backdrop shown over the main content area when the signed-in user
 * has zero calendars. Blocks interaction with whatever is mounted beneath it
 * and points the user at the side nav's "Create" button — which is now the
 * single entry point for creating a calendar.
 *
 * The overlay is rendered inside the main content column by `AppLayout`, so
 * the side nav itself stays interactive.
 */
const CalendarLockedOverlay: React.FC<CalendarLockedOverlayProps> = ({
  hint = 'Create a calendar from the side navigation to unlock the app.',
  fullscreen = false,
}) => {
  const theme = useTheme();

  const wrapperSx = fullscreen
    ? {
        position: 'fixed' as const,
        inset: 0,
        zIndex: theme.zIndex.modal,
      }
    : {
        position: 'absolute' as const,
        inset: 0,
        zIndex: 10,
      };

  return (
    <Box
      sx={{
        ...wrapperSx,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: alpha(theme.palette.background.default, 0.7),
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        px: 3,
        // Block all pointer events on whatever's underneath.
        pointerEvents: 'auto',
      }}
      aria-live="polite"
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          px: 2,
          py: 1.25,
          borderRadius: 999,
          bgcolor: alpha(theme.palette.background.paper, 0.92),
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: theme.shadows[2],
        }}
      >
        <ArrowBackIcon sx={{ fontSize: 18, color: 'primary.main' }} />
        <Typography
          variant="body2"
          sx={{ color: 'text.primary', fontWeight: 500 }}
        >
          {hint}
        </Typography>
      </Box>
    </Box>
  );
};

export default CalendarLockedOverlay;
