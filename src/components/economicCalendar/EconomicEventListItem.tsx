/**
 * Economic Event List Item Component
 * Displays individual economic calendar events in list format with realtime countdown
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Chip,
  ListItem,
  alpha,
  useTheme,
  IconButton,
  CircularProgress
} from '@mui/material';
import {
  Check as CheckIcon,
  HourglassEmpty as HourglassEmptyIcon,
  PushPin as PinIcon,
  PushPinOutlined as UnpinIcon
} from '@mui/icons-material';
import { format, parseISO, isAfter } from 'date-fns';
import { EconomicEvent } from '../../types/economicCalendar';
import { isEventPinned } from '../../utils/eventNameUtils';

interface EconomicEventListItemProps {
  event: EconomicEvent;
  px: number,
  py: number,
  showDivider?: boolean;
  pinnedEvents?: string[];
  onPinEvent?: (eventName: string) => void;
  onUnpinEvent?: (eventName: string) => void;
  isPinning?: boolean;
}

// Helper function to format time and countdown with realtime updates
const formatTimeWithCountdown = (eventTime: string, currentTime: Date) => {
  const eventDate = parseISO(eventTime);
  const now = currentTime;
  const eventDateFormatted = format(eventDate, 'MMM d, h:mm a');

  // Check if event is in the future
  if (isAfter(eventDate, now)) {
    const totalSeconds = Math.floor((eventDate.getTime() - now.getTime()) / 1000);
    const minutesDiff = Math.floor(totalSeconds / 60);
    const hoursDiff = Math.floor(totalSeconds / 3600);
    const daysDiff = Math.floor(hoursDiff / 24);

    let countdown = '';
    let isImminent = false;

    if (minutesDiff < 60) {
      isImminent = true; // Imminent if within 60 minutes

      if (isImminent && minutesDiff < 5) {
        // Show seconds for very imminent events (less than 5 minutes)
        const remainingMinutes = Math.floor(totalSeconds / 60);
        const remainingSeconds = totalSeconds % 60;
        countdown = remainingMinutes > 0
          ? `${remainingMinutes}m ${remainingSeconds}s`
          : `${remainingSeconds}s`;
      } else {
        countdown = `${minutesDiff} min`;
      }
    } else if (hoursDiff < 24) {
      countdown = `${hoursDiff}h`;
      isImminent = false;
    } else if (daysDiff === 1) {
      countdown = '1 day';
      isImminent = false;
    } else if (daysDiff > 1) {
      countdown = `${daysDiff} days`;
      isImminent = false;
    }

    return {
      time: eventDateFormatted,
      countdown,
      isUpcoming: true,
      isImminent,
      isPassed: false
    };
  }

  return {
    time: eventDateFormatted,
    countdown: null,
    isUpcoming: false,
    isImminent: false,
    isPassed: true
  };
};

// Helper function to get impact colors
const getImpactColor = (impact: string, theme: any) => {
  switch (impact) {
    case 'High':
      return theme.palette.error.main;
    case 'Medium':
      return theme.palette.warning.main;
    case 'Low':
      return theme.palette.success.main;
    default:
      return theme.palette.text.secondary;
  }
};

// Helper function to get impact background color for imminent events
const getImminentBackgroundColor = (impact: string, theme: any) => {
  switch (impact) {
    case 'High':
      return alpha(theme.palette.error.main, 0.1);
    case 'Medium':
      return alpha(theme.palette.warning.main, 0.1);
    case 'Low':
      return alpha(theme.palette.success.main, 0.1);
    default:
      return alpha(theme.palette.text.secondary, 0.05);
  }
};

// Helper function to get actual result background color and border
const getActualResultStyle = (actualResultType: string, theme: any) => {
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

const EconomicEventListItem: React.FC<EconomicEventListItemProps> = ({
  event,
  px= 2.5,
   py= 1.5,
  showDivider = true,
  pinnedEvents = [],
  onPinEvent,
  onUnpinEvent,
  isPinning = false
}) => {
  const theme = useTheme();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Check if this event is pinned
  const eventIsPinned = isEventPinned(event.event_name, pinnedEvents);

  // Handle pin/unpin toggle
  const handleTogglePin = () => {
    if (isPinning) return;

    if (eventIsPinned) {
      onUnpinEvent?.(event.event_name);
    } else {
      onPinEvent?.(event.event_name);
    }
  };

  // Get initial time info to check if event is imminent
  const initialTimeInfo = formatTimeWithCountdown(event.time_utc, currentTime);

  // Realtime countdown effect for imminent events
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (initialTimeInfo.isImminent && initialTimeInfo.isUpcoming) {
      // Update every second for imminent events
      interval = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000);
    }
    else {
      // For non-imminent events, we still want to update the current time,
      // but we can do so less frequently to avoid unnecessary re-renders.
      // Here, we update every 10 min (1000 ms * 60 * 10).
      interval = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000 * 60 * 10);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [initialTimeInfo.isImminent, initialTimeInfo.isUpcoming]);

  // Get current time info (will be updated in real-time for imminent events)
  const timeInfo = formatTimeWithCountdown(event.time_utc, currentTime);

  return (
    <ListItem sx={{
      px,
      py,
      backgroundColor: timeInfo.isImminent ? alpha(getImpactColor(event.impact, theme), 0.12) : 'transparent',
      borderLeft: 'none',
      mb: 0,
      minHeight: 'auto'
    }}>

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

          {/* Currency */}
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
              color: timeInfo.isUpcoming ? 'text.primary' : 'text.secondary',
              fontSize: '0.75rem',
              minWidth: 80
            }}>
              {timeInfo.time}
            </Typography>

            {/* Status Icon or Countdown */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 24 }}>
              {timeInfo.isPassed ? (
                <CheckIcon sx={{
                  color: 'success.main',
                  fontSize: '1rem'
                }} />
              ) : timeInfo.countdown ? (
                <Typography variant="caption" sx={{
                  color: timeInfo.isImminent ? 'error.main' : 'warning.main',
                  fontWeight: 700,
                  fontSize: '0.65rem',
                  animation: timeInfo.isImminent ? 'pulse 1s infinite' : 'none',
                  '@keyframes pulse': {
                    '0%': { opacity: 1 },
                    '50%': { opacity: 0.7 },
                    '100%': { opacity: 1 }
                  }
                }}>
                  {timeInfo.countdown}
                </Typography>
              ) : null}
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
                backgroundColor: getImpactColor(event.impact, theme),
                color: 'white',
                minWidth: 40,
                borderRadius: 1,
                '& .MuiChip-label': {
                  px: 0.75,
                  py: 0.25
                }
              }}
            />

            {/* Pin Button */}
            {(onPinEvent || onUnpinEvent) && (
              <IconButton
                onClick={handleTogglePin}
                disabled={isPinning}
                size="small"
                sx={{
                  ml: 0.5,
                  color: eventIsPinned ? 'primary.main' : 'text.secondary',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    color: 'primary.main'
                  },
                  '&:disabled': {
                    color: 'text.disabled'
                  }
                }}
              >
                {isPinning ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  eventIsPinned ? <PinIcon sx={{ fontSize: 16 }} /> : <UnpinIcon sx={{ fontSize: 16 }} />
                )}
              </IconButton>
            )}
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
              {event.actual_value ? (
                <Typography variant="caption" sx={{
                  fontWeight: 700,
                  fontSize: '0.7rem',
                  px: 1,
                  py: 0.25,
                  borderRadius: 1,
                  ...getActualResultStyle(event.actual_result_type, theme)
                }}>
                  A: {event.actual_value}
                </Typography>
              ) : (
                // Show hourglass if actual is missing but forecast or previous exists
                (event.forecast_value || event.previous_value) && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="caption" sx={{
                      fontWeight: 700,
                      fontSize: '0.7rem',
                      color: 'text.disabled',
                      opacity: 0.8
                    }}>
                      A: <HourglassEmptyIcon sx={{ fontSize: 12, mb: 0.25, color: 'warning.main', verticalAlign: 'middle' }} />
                    </Typography>
                  </Box>
                )
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

    </ListItem>
  );
};

export default EconomicEventListItem;
