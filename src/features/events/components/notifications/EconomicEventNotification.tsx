/**
 * Economic Event Notification Slider
 * Shows a sliding notification when economic events are updated.
 *
 * Visual contract aligned with the JournoTrades style concept:
 * - Outer surface uses `getCardShellSx(theme, 'lg')` + theme.shadows[6] for
 *   the truly-floating toast lift.
 * - Impact level → semantic color via `impactToColor`.
 * - Actual-vs-forecast result indicator → semantic accent via `resultToAccent`
 *   (semantic only, no inline alpha factories).
 * - Eyebrow / tnum / radius / divider all come from design tokens.
 *
 * Business logic preserved verbatim: props, hooks, callbacks, Slide
 * animation, auto-dismiss timer, removal animation.
 */

import React, { useState, useEffect } from 'react';
import {
  Slide,
  Typography,
  Box,
  IconButton,
  useTheme,
  Theme
} from '@mui/material';
import {
  Close as CloseIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Remove as NeutralIcon
} from '@mui/icons-material';
import { EconomicEvent } from 'features/events/types/economicCalendar';
import { alpha } from '@mui/material/styles';
import { format, parseISO } from 'date-fns';
import { EYEBROW_SX, TNUM, getCardShellSx, getInsetTileSx, getShadow } from 'styles/designTokens';

interface EconomicEventNotificationProps {
  event: EconomicEvent | null;
  onClose: () => void;
  autoHideDuration?: number; // Duration in milliseconds
  isRemoving?: boolean; // Whether this notification is being removed
}

// Map impact level → semantic palette color (error / warning / success / neutral).
const impactToColor = (theme: Theme, level: string): string => {
  switch (level.toLowerCase()) {
    case 'high':
      return theme.palette.error.main;
    case 'medium':
      return theme.palette.warning.main;
    case 'low':
      return theme.palette.success.main;
    default:
      return theme.palette.text.secondary;
  }
};

// Map actual_result_type → semantic accent (good / bad / neutral / fallback).
const resultToAccent = (theme: Theme, resultType?: string): string => {
  switch (resultType) {
    case 'good':
      return theme.palette.success.main;
    case 'bad':
      return theme.palette.error.main;
    case 'neutral':
      return theme.palette.warning.main;
    default:
      return theme.palette.text.secondary;
  }
};

const EconomicEventNotification: React.FC<EconomicEventNotificationProps> = ({
  event,
  onClose,
  autoHideDuration = 5000, // 5 seconds default
  isRemoving = false
}) => {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (event && !isRemoving) {
      setOpen(true);

      // Auto-hide after specified duration
      const timer = setTimeout(() => {
        handleClose();
      }, autoHideDuration);

      return () => clearTimeout(timer);
    }
  }, [event, autoHideDuration, isRemoving]);

  const handleClose = () => {
    if (isRemoving) return; // Prevent double-closing

    setOpen(false);
    // Wait for slide animation to complete before calling onClose
    setTimeout(() => {
      onClose();
    }, 300);
  };

  // Handle removal animation
  useEffect(() => {
    if (isRemoving) {
      setOpen(false);
    }
  }, [isRemoving]);

  if (!event) return null;

  const impactColor = impactToColor(theme, event.impact);

  // Determine trend icon and color based on actualResultType
  const getTrendInfo = () => {
    if (!event.actual_value) {
      return { icon: <NeutralIcon />, color: theme.palette.text.secondary, text: 'Updated' };
    }

    // Use actualResultType if available, otherwise fall back to comparison logic
    if (event.actual_result_type) {
      switch (event.actual_result_type) {
        case 'good':
          return { icon: <TrendingUpIcon />, color: theme.palette.success.main, text: 'Good Result' };
        case 'bad':
          return { icon: <TrendingDownIcon />, color: theme.palette.error.main, text: 'Bad Result' };
        case 'neutral':
          return { icon: <NeutralIcon />, color: theme.palette.warning.main, text: 'As Expected' };
        default:
          return { icon: <NeutralIcon />, color: theme.palette.text.secondary, text: 'Updated' };
      }
    }

    // Fallback to old comparison logic if actualResultType is not available
    if (!event.forecast_value) {
      return { icon: <NeutralIcon />, color: theme.palette.text.secondary, text: 'Updated' };
    }

    const actual = parseFloat(event.actual_value.replace(/[^\d.-]/g, ''));
    const forecast = parseFloat(event.forecast_value.replace(/[^\d.-]/g, ''));

    if (isNaN(actual) || isNaN(forecast)) {
      return { icon: <NeutralIcon />, color: theme.palette.text.secondary, text: 'Updated' };
    }

    if (actual > forecast) {
      return { icon: <TrendingUpIcon />, color: theme.palette.success.main, text: 'Above Forecast' };
    } else if (actual < forecast) {
      return { icon: <TrendingDownIcon />, color: theme.palette.error.main, text: 'Below Forecast' };
    } else {
      return { icon: <NeutralIcon />, color: theme.palette.warning.main, text: 'As Expected' };
    }
  };

  const trendInfo = getTrendInfo();

  // Canonical inset-tile style for the A/F/P value chips, parameterized by accent.
  const valueChipSx = (accent: string) => ({
    ...getInsetTileSx(theme),
    p: 0,
    px: 1,
    py: 0.25,
    borderRadius: `${theme.palette.custom.radius.md}px`,
    bgcolor: alpha(accent, 0.1),
    border: `1px solid ${alpha(accent, 0.2)}`,
    color: accent,
    fontSize: '0.7rem',
    fontWeight: 700,
    fontFeatureSettings: TNUM,
    letterSpacing: '-0.01em',
    display: 'inline-flex',
    alignItems: 'center',
  });

  return (
    <Box sx={{ pointerEvents: 'auto' }}>
      <Slide direction="right" in={open} mountOnEnter unmountOnExit>
        <Box
          sx={{
            ...getCardShellSx(theme, 'lg'),
            width: 320,
            maxWidth: 'calc(100vw - 24px)',
            boxShadow: getShadow(theme, 'lg'),
            pointerEvents: 'auto', // Enable clicks (container has pointerEvents: none)
          }}
        >
          {/* Compact Header with Close Button */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              px: 1.5,
              py: 1,
              borderBottom: `1px solid ${theme.palette.divider}`,
              minHeight: 36,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
              <Box
                sx={{
                  width: 22,
                  height: 22,
                  borderRadius: `${theme.palette.custom.radius.md}px`,
                  bgcolor: alpha(impactColor, 0.12),
                  color: impactColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  '& svg': { fontSize: 14 },
                }}
              >
                {trendInfo.icon}
              </Box>
              <Typography sx={{ ...EYEBROW_SX, color: 'text.primary' }}>
                Economic Event Updated
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Typography
                sx={{
                  ...EYEBROW_SX,
                  color: impactColor,
                  fontSize: '0.625rem',
                }}
              >
                {event.impact.toUpperCase()}
              </Typography>
              <IconButton
                size="small"
                onClick={handleClose}
                sx={{
                  p: 0.25,
                  color: 'text.tertiary',
                  '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.06) },
                }}
              >
                <CloseIcon sx={{ fontSize: '1rem' }} />
              </IconButton>
            </Box>
          </Box>

          {/* Compact Content */}
          <Box sx={{ p: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, width: '100%' }}>
              {/* Flag and Currency */}
              <Box sx={{ minWidth: 32, mt: 0.25, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                <img
                  src={event.flag_url}
                  alt={event.country}
                  style={{
                    width: 20,
                    height: 15,
                    borderRadius: 2,
                    objectFit: 'cover',
                    border: `1px solid ${theme.palette.divider}`
                  }}
                />
                <Typography
                  sx={{
                    ...EYEBROW_SX,
                    color: 'text.primary',
                    fontSize: '0.625rem',
                    textAlign: 'center',
                    minWidth: 32,
                  }}
                >
                  {event.currency}
                </Typography>
              </Box>

              {/* Content Container */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%', flex: 1 }}>
                {/* First Row: Time | Status */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                  {/* Time */}
                  <Typography
                    sx={{
                      fontWeight: 600,
                      color: 'text.primary',
                      fontSize: '0.75rem',
                      fontFeatureSettings: TNUM,
                      letterSpacing: '-0.01em',
                      minWidth: 80,
                    }}
                  >
                    {format(parseISO(event.time_utc), 'h:mm a')}
                  </Typography>

                  {/* Status text — semantic color, arrow encoded by icon above */}
                  <Typography
                    sx={{
                      ...EYEBROW_SX,
                      color: trendInfo.color,
                      fontSize: '0.625rem',
                    }}
                  >
                    {trendInfo.text}
                  </Typography>
                </Box>

                {/* Second Row: Event Name */}
                <Typography
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    color: 'text.primary',
                    lineHeight: 1.3,
                    letterSpacing: '-0.01em',
                    mb: 0.5,
                  }}
                >
                  {event.event_name}
                </Typography>

                {/* Third Row: Values (if available) */}
                {(event.actual_value || event.forecast_value || event.previous_value) && (
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                    {event.actual_value && (
                      <Typography sx={valueChipSx(resultToAccent(theme, event.actual_result_type))}>
                        A: {event.actual_value}
                      </Typography>
                    )}
                    {event.forecast_value && (
                      <Typography sx={valueChipSx(theme.palette.text.secondary)}>
                        F: {event.forecast_value}
                      </Typography>
                    )}
                    {event.previous_value && (
                      <Typography sx={valueChipSx(theme.palette.text.tertiary ?? theme.palette.text.secondary)}>
                        P: {event.previous_value}
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        </Box>
      </Slide>
    </Box>
  );
};

export default EconomicEventNotification;
