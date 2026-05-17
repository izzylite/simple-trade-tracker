import React from 'react';
import {
  Box,
  Typography,
  Button,
  alpha,
  useTheme,
} from '@mui/material';
import { AddCircleOutline as AddIcon } from '@mui/icons-material';

interface CalendarLockedOverlayProps {
  /** Callback that opens the Create Calendar dialog. When omitted the CTA is disabled. */
  onCreateCalendar?: () => void;
  /** Override the title copy. */
  title?: string;
  /** Override the subtitle copy. */
  subtitle?: string;
  /** Override the CTA button text. */
  ctaLabel?: string;
  /**
   * When `false` (default) the overlay fills its parent without blocking
   * interaction outside its bounds — so a page can mount it inside its main
   * content area. Set `true` to render a fullscreen blocking overlay.
   */
  fullscreen?: boolean;
}

/**
 * Empty-state lock used on pages that require at least one calendar (Home,
 * Performance). Shown when the user has zero calendars; the CTA opens the
 * Create Calendar dialog. Notes + Assistant pages do NOT use this — Notes is
 * cross-calendar and Assistant supports an "All Calendars" mode.
 */
const CalendarLockedOverlay: React.FC<CalendarLockedOverlayProps> = ({
  onCreateCalendar,
  title = 'Create your first calendar',
  subtitle = "Calendars are where you log and analyse trades. You'll need at least one before this section unlocks.",
  ctaLabel = 'Create Calendar',
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
      };

  return (
    <Box
      sx={{
        ...wrapperSx,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: alpha(theme.palette.background.default, 0.85),
        backdropFilter: 'blur(4px)',
        px: 3,
      }}
    >
      <Box
        sx={{
          maxWidth: 440,
          width: '100%',
          textAlign: 'center',
          p: { xs: 3, sm: 5 },
          borderRadius: 3,
          bgcolor: 'background.paper',
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: theme.shadows[6],
        }}
      >
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: 2,
            mx: 'auto',
            mb: 2.5,
            bgcolor: alpha(theme.palette.primary.main, 0.12),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AddIcon sx={{ fontSize: 36, color: 'primary.main' }} />
        </Box>

        <Typography
          variant="h6"
          sx={{ fontWeight: 700, mb: 1, fontSize: '1.125rem' }}
        >
          {title}
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 3, lineHeight: 1.55 }}
        >
          {subtitle}
        </Typography>

        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={onCreateCalendar}
          disabled={!onCreateCalendar}
          sx={{
            borderRadius: 999,
            textTransform: 'none',
            fontWeight: 600,
            px: 3,
            py: 1,
          }}
        >
          {ctaLabel}
        </Button>
      </Box>
    </Box>
  );
};

export default CalendarLockedOverlay;
