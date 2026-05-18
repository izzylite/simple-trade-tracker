/**
 * Economic Event Notification Slider
 * Shows a sliding notification when economic events are updated
 */

import React, { useState, useEffect } from 'react';
import {
  Slide,
  Paper,
  Typography,
  Box,
  Chip,
  IconButton,
  useTheme
} from '@mui/material';
import {
  Close as CloseIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Remove as NeutralIcon
} from '@mui/icons-material';
import { EconomicEvent, ImpactLevel, Currency } from '../../types/economicCalendar';
import { alpha } from '@mui/material/styles';
import { format, parseISO } from 'date-fns';

interface EconomicEventNotificationProps {
  event: EconomicEvent | null;
  onClose: () => void;
  autoHideDuration?: number; // Duration in milliseconds
  isRemoving?: boolean; // Whether this notification is being removed
}

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

  // Determine impact color
  const getImpactColor = (impact: string) => {
    switch (impact.toLowerCase()) {
      case 'high': return theme.palette.error.main;
      case 'medium': return theme.palette.warning.main;
      case 'low': return theme.palette.info.main;
      default: return theme.palette.grey[500];
    }
  };

  // Helper function to get actual result background color and border
  const getActualResultStyle = (actualResultType: string) => {
    switch (actualResultType) {
      case 'good':
        return {
          backgroundColor: alpha(theme.palette.success.main, 0.15),
          border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
          color: theme.palette.success.dark
        };
      case 'bad':
        return {
          backgroundColor: alpha(theme.palette.error.main, 0.15),
          border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
          color: theme.palette.error.dark
        };
      case 'neutral':
        return {
          backgroundColor: alpha(theme.palette.info.main, 0.1),
          border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
          color: theme.palette.info.dark
        };
      default:
        return {
          backgroundColor: alpha(theme.palette.success.main, 0.1),
          border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
          color: 'text.primary'
        };
    }
  };

  // Determine trend icon and color based on actualResultType
  const getTrendInfo = () => {
    if (!event.actual_value) {
      return { icon: <NeutralIcon />, color: theme.palette.grey[500], text: 'Updated' };
    }

    // Use actualResultType if available, otherwise fall back to comparison logic
    if (event.actual_result_type) {
      switch (event.actual_result_type) {
        case 'good':
          return { icon: <TrendingUpIcon />, color: theme.palette.success.main, text: 'Good Result' };
        case 'bad':
          return { icon: <TrendingDownIcon />, color: theme.palette.error.main, text: 'Bad Result' };
        case 'neutral':
          return { icon: <NeutralIcon />, color: theme.palette.info.main, text: 'As Expected' };
        default:
          return { icon: <NeutralIcon />, color: theme.palette.grey[500], text: 'Updated' };
      }
    }

    // Fallback to old comparison logic if actualResultType is not available
    if (!event.forecast_value) {
      return { icon: <NeutralIcon />, color: theme.palette.grey[500], text: 'Updated' };
    }

    const actual = parseFloat(event.actual_value.replace(/[^\d.-]/g, ''));
    const forecast = parseFloat(event.forecast_value.replace(/[^\d.-]/g, ''));

    if (isNaN(actual) || isNaN(forecast)) {
      return { icon: <NeutralIcon />, color: theme.palette.grey[500], text: 'Updated' };
    }

    if (actual > forecast) {
      return { icon: <TrendingUpIcon />, color: theme.palette.success.main, text: 'Above Forecast' };
    } else if (actual < forecast) {
      return { icon: <TrendingDownIcon />, color: theme.palette.error.main, text: 'Below Forecast' };
    } else {
      return { icon: <NeutralIcon />, color: theme.palette.info.main, text: 'As Expected' };
    }
  };

  const trendInfo = getTrendInfo();

  return (
    <Box sx={{ pointerEvents: 'auto' }}>
      <Slide direction="right" in={open} mountOnEnter unmountOnExit>
          <Paper
            elevation={8}
        sx={{
          width: 320,
          maxWidth: 'calc(100vw - 24px)',
          borderRadius: 1,
          overflow: 'hidden',
          background: theme.palette.mode === 'dark'
            ? theme.palette.background.default
            : `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`,
          border: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.3 : 0.15)}`,
          boxShadow: theme.shadows[8],
          borderLeft: `4px solid ${getImpactColor(event.impact)}`,
          pointerEvents: 'auto' // Enable clicks (container has pointerEvents: none)
        }}
      >
        {/* Compact Header with Close Button */}
        <Box
          sx={{
            background: `linear-gradient(90deg, ${getImpactColor(event.impact)} 0%, ${alpha(getImpactColor(event.impact), 0.8)} 100%)`,
            color: theme.palette.getContrastText(getImpactColor(event.impact)),
            p: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: 32
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            {trendInfo.icon}
            <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.8rem' }}>
              Economic Event Updated
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={handleClose}
            sx={{ color: 'white', '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' }, p: 0.25 }}
          >
            <CloseIcon sx={{ fontSize: '1rem' }} />
          </IconButton>
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
                  border: `1px solid ${alpha(theme.palette.divider, 0.2)}`
                }}
              />
              <Typography variant="caption" sx={{
                fontWeight: 700,
                textAlign: 'center',
                fontSize: '0.7rem',
                color: 'text.primary',
                minWidth: 32
              }}>
                {event.currency}
              </Typography>
            </Box>

            {/* Content Container */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%', flex: 1 }}>
              {/* First Row: Time | Status | Impact Badge */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                {/* Time */}
                <Typography variant="caption" sx={{
                  fontWeight: 600,
                  color: 'text.primary',
                  fontSize: '0.75rem',
                  minWidth: 80
                }}>
                  {format(parseISO(event.time_utc), 'h:mm a')}
                </Typography>

                {/* Status Icon */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 24 }}>
                  <Typography variant="caption" sx={{
                    color: trendInfo.color,
                    fontWeight: 700,
                    fontSize: '0.65rem'
                  }}>
                    {trendInfo.text}
                  </Typography>
                </Box>

                {/* Spacer */}
                <Box sx={{ flex: 1 }} />

                {/* Impact Badge */}
                <Chip
                  label={event.impact.toUpperCase()}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    backgroundColor: getImpactColor(event.impact),
                    color: 'white',
                    minWidth: 40,
                    borderRadius: 1,
                    '& .MuiChip-label': {
                      px: 0.75,
                      py: 0.25
                    }
                  }}
                />
              </Box>

              {/* Second Row: Event Name */}
              <Typography variant="body2" sx={{
                fontWeight: 600,
                fontSize: '0.9rem',
                color: 'text.primary',
                lineHeight: 1.3,
                mb: 0.5
              }}>
                {event.event_name}
              </Typography>

              {/* Third Row: Values (if available) */}
              {(event.actual_value || event.forecast_value || event.previous_value) && (
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                  {event.actual_value && (
                    <Typography variant="caption" sx={{
                      fontWeight: 700,
                      fontSize: '0.7rem',
                      px: 1,
                      py: 0.25,
                      borderRadius: 1,
                      ...getActualResultStyle(event.actual_result_type)
                    }}>
                      A: {event.actual_value}
                    </Typography>
                  )}
                  {event.forecast_value && (
                    <Typography variant="caption" sx={{
                      color: 'text.secondary',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      backgroundColor: alpha(theme.palette.info.main, 0.1),
                      px: 1,
                      py: 0.25,
                      borderRadius: 1,
                      border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`
                    }}>
                      F: {event.forecast_value}
                    </Typography>
                  )}
                  {event.previous_value && (
                    <Typography variant="caption" sx={{
                      color: 'text.disabled',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      backgroundColor: alpha(theme.palette.grey[500], 0.1),
                      px: 1,
                      py: 0.25,
                      borderRadius: 1,
                      border: `1px solid ${alpha(theme.palette.grey[500], 0.2)}`
                    }}>
                      P: {event.previous_value}
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      </Paper>
      </Slide>
    </Box>
  );
};

export default EconomicEventNotification;
