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
  useTheme
} from '@mui/material';
import {
  Check as CheckIcon,
  HourglassEmpty as HourglassEmptyIcon
} from '@mui/icons-material';
import { format, parseISO, isAfter } from 'date-fns';
import { EconomicEvent } from '../../types/economicCalendar';

interface EconomicEventListItemProps {
  event: EconomicEvent;
  showDivider?: boolean;
}

// Helper function to format time and countdown with realtime updates
const formatTimeWithCountdown = (eventTime: string, currentTime: Date) => {
  const eventDate = parseISO(eventTime);
  const now = currentTime;
  const eventDateFormatted = format(eventDate, 'MMM d, HH:mm');

  // Check if event is in the future
  if (isAfter(eventDate, now)) {
    const totalSeconds = Math.floor((eventDate.getTime() - now.getTime()) / 1000);
    const minutesDiff = Math.floor(totalSeconds / 60);
    const hoursDiff = Math.floor(totalSeconds / 3600);
    const daysDiff = Math.floor(hoursDiff / 24);

    let countdown = '';
    let isImminent = false;

    if (minutesDiff < 60) {
      isImminent = minutesDiff <= 30; // Imminent if within 30 minutes

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

const EconomicEventListItem: React.FC<EconomicEventListItemProps> = ({
  event,
  showDivider = true
}) => {
  const theme = useTheme();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Get initial time info to check if event is imminent
  const initialTimeInfo = formatTimeWithCountdown(event.timeUtc, currentTime);

  // Realtime countdown effect for imminent events
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (initialTimeInfo.isImminent && initialTimeInfo.isUpcoming) {
      // Update every second for imminent events
      interval = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [initialTimeInfo.isImminent, initialTimeInfo.isUpcoming]);

  // Get current time info (will be updated in real-time for imminent events)
  const timeInfo = formatTimeWithCountdown(event.timeUtc, currentTime);

  return (
    <ListItem sx={{
      px: 2,
      py: 1,
      backgroundColor: timeInfo.isImminent ? getImminentBackgroundColor(event.impact, theme) : 'transparent',
      borderLeft: timeInfo.isImminent ? `3px solid ${getImpactColor(event.impact, theme)}` : 'none',
      
      mb: 0.5
    }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, width: '100%' }}>
        {/* Flag as Prefix Icon */}
        <Box sx={{ minWidth: 24, mt: 0.5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
          <img
            src={event.flagUrl}
            alt={event.country}
            style={{
              width: 24,
              height: 18,
              borderRadius: 3,
              objectFit: 'cover',
              border: `1px solid ${alpha(theme.palette.divider, 0.2)}`
            }}
          />

          {/* Currency */}
          <Typography variant="body2" sx={{
            fontWeight: 700,
            textAlign: 'center',
            fontSize: '0.875rem',
            color: 'text.primary',
            minWidth: 35
          }}>
            {event.currency}
          </Typography>
        </Box>

        {/* Content Container */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%', flex: 1 }}>
          {/* First Row: Date | Check Icon | Currency | Impact Badge */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%' }}>
            {/* Date */}
            <Typography variant="body2" sx={{
              fontWeight: 600,
              color: timeInfo.isUpcoming ? 'text.primary' : 'text.secondary',
              fontSize: '0.875rem',
              minWidth: 100
            }}>
              {timeInfo.time}
            </Typography>

            {/* Check Icon or Countdown */}
            <Box sx={{   display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {timeInfo.isPassed ? (
                <CheckIcon sx={{
                  color: 'success.main',
                  fontSize: '1.2rem'
                }} />
              ) : timeInfo.countdown ? (
                <Typography variant="caption" sx={{
                  color: timeInfo.isImminent ? 'error.main' : 'warning.main',
                  fontWeight: 700,
                  fontSize: '0.75rem',
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
                height: 22,
                fontSize: '0.65rem',
                fontWeight: 700,
                backgroundColor: getImpactColor(event.impact, theme),
                color: 'white',
                minWidth: 45,
                '& .MuiChip-label': {
                  px: 1
                }
              }}
            />
          </Box>

          {/* Second Row: Event Name | Previous, Forecast, Actual */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
            {/* Event Name */}
            <Typography variant="body2" sx={{
              fontWeight: 500,
              fontSize: '0.875rem',
              color: 'text.primary',
              flex: 1
            }}>
              {event.event}
            </Typography>

            {/* Values */}
            {(event.actual || event.forecast || event.previous) && (
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                {event.actual ? (
                  <Typography variant="caption" sx={{
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    color: 'text.primary'
                  }}>
                    A: {event.actual}
                  </Typography>
                ) : (
                  // Show hourglass if actual is missing but forecast or previous exists
                  (event.forecast || event.previous) && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                     
                      <Typography variant="caption" sx={{
                        fontWeight: 700,
                        alignItems: "center",
                        fontSize: '0.75rem',
                        color: 'text.disabled',
                        opacity: 0.8
                      }}>
                        A:<HourglassEmptyIcon sx={{ fontSize: 16, mb: 0.5, color: 'warning.main', verticalAlign: 'middle' }} />
                      </Typography>
                    </Box>
                  )
                )}
                {event.forecast && (
                  <Typography variant="caption" sx={{
                    color: 'text.secondary',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}>
                    F: {event.forecast}
                  </Typography>
                )}
                {event.previous && (
                  <Typography variant="caption" sx={{
                    color: 'text.disabled',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}>
                    P: {event.previous}
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </ListItem>
  );
};

export default EconomicEventListItem;
