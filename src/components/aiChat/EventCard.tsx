/**
 * Event Card Component for AI Chat
 * Displays economic event details with dynamic fetching
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  useTheme,
  alpha
} from '@mui/material';
import {
  Check as CheckIcon,
  HourglassEmpty as HourglassEmptyIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Remove as NeutralIcon
} from '@mui/icons-material';
import { format, parseISO, isAfter } from 'date-fns';
import { EconomicEvent } from '../../types/economicCalendar';
import { economicCalendarService } from '../../services/economicCalendarService';
import { logger } from '../../utils/logger';

interface EventCardProps {
  eventId: string;
  eventData?: EconomicEvent; // Optional: pre-fetched event data from backend
  compact?: boolean;
  onClick?: (event: EconomicEvent) => void;
}

// Helper function to format numeric values with commas
const formatEventValue = (value: string): string => {
  if (!value) return value;

  // Try to parse as number
  const numericValue = parseFloat(value.replace(/[^\d.-]/g, ''));

  if (isNaN(numericValue)) return value;

  // Format with commas and preserve original suffix (%, K, M, etc.)
  const suffix = value.replace(/[0-9.-]/g, '').trim();
  const formatted = numericValue.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });

  return suffix ? `${formatted}${suffix}` : formatted;
};

// Helper function to get impact color
const getImpactColor = (impact: string, theme: any) => {
  switch (impact?.toLowerCase()) {
    case 'high':
      return theme.palette.error.main;
    case 'medium':
      return theme.palette.warning.main;
    case 'low':
      return theme.palette.info.main;
    default:
      return theme.palette.success.main;
  }
};

// Helper function to format time with status
const formatTimeWithStatus = (time_utc: string) => {
  const eventTime = parseISO(time_utc);
  const now = new Date();
  const isPassed = isAfter(now, eventTime);

  return {
    time: format(eventTime, 'MMM dd, h:mm a'),
    isPassed,
    isUpcoming: !isPassed
  };
};

// Helper function to get trend info from actual vs forecast
const getTrendInfo = (actual_value: string, forecast_value: string, theme: any) => {
  if (!actual_value || !forecast_value) return null;

  const actualNum = parseFloat(actual_value.replace(/[^\d.-]/g, ''));
  const forecastNum = parseFloat(forecast_value.replace(/[^\d.-]/g, ''));
  
  if (isNaN(actualNum) || isNaN(forecastNum)) return null;
  
  if (actualNum > forecastNum) {
    return {
      icon: <TrendingUpIcon sx={{ fontSize: 16, color: theme.palette.success.main }} />,
      text: 'Above',
      color: theme.palette.success.main
    };
  } else if (actualNum < forecastNum) {
    return {
      icon: <TrendingDownIcon sx={{ fontSize: 16, color: theme.palette.error.main }} />,
      text: 'Below',
      color: theme.palette.error.main
    };
  } else {
    return {
      icon: <NeutralIcon sx={{ fontSize: 16, color: theme.palette.text.secondary }} />,
      text: 'As Expected',
      color: theme.palette.text.secondary
    };
  }
};

const EventCard: React.FC<EventCardProps> = ({
  eventId,
  eventData,
  compact = false,
  onClick
}) => {
  const theme = useTheme();
  const [event, setEvent] = useState<EconomicEvent | null>(eventData || null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Skip fetching if event data was provided
    if (eventData) {
      setEvent(eventData);
      return;
    }

    const fetchEvent = async () => {
      try {
        setError(null);

        // Fetch event by ID from economic calendar service
        const fetchedEvent = await economicCalendarService.getEventById(eventId);

        if (fetchedEvent) {
          setEvent(fetchedEvent);
        } else {
          setError('Event not found');
        }
      } catch (err) {
        logger.error('Failed to fetch economic event:', err);
        setError('Failed to load event');
      }
    };

    fetchEvent();
  }, [eventId, eventData]);

  // Show error state
  if (error || !event) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: compact ? 1.5 : 2,
          border: '1px solid',
          borderColor: alpha(theme.palette.error.main, 0.3),
          borderRadius: 2,
          backgroundColor: alpha(theme.palette.error.main, 0.05),
          minHeight: compact ? 80 : 100
        }}
      >
        <Typography variant="body2" color="error" sx={{ textAlign: 'center' }}>
          {error || 'Event not found'}
        </Typography>
      </Paper>
    );
  }

  const timeInfo = formatTimeWithStatus(event.time_utc);
  const trendInfo = getTrendInfo(event.actual_value, event.forecast_value, theme);

  return (
    <Paper
      elevation={0}
      sx={{
        p: compact ? 1.5 : 2,
        border: '1px solid',
        borderColor: alpha(theme.palette.divider, 0.3),
        borderRadius: 2,
        backgroundColor: alpha(theme.palette.background.paper, 0.8),
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease-in-out',
        '&:hover': onClick ? {
          borderColor: alpha(theme.palette.primary.main, 0.5),
          backgroundColor: alpha(theme.palette.primary.main, 0.02),
          transform: 'translateY(-1px)',
          boxShadow: theme.shadows[2]
        } : {}
      }}
      onClick={() => onClick?.(event)}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, width: '100%' }}>
        {/* Flag and Currency */}
        <Box sx={{ minWidth: 32, maxWidth: 32, mt: 0.25, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, alignSelf: 'flex-start' }}>
          {event.flag_url && (
            <img
              src={event.flag_url}
              alt={event.country}
              style={{
                width: 20,
                height: 15,
                maxHeight: 15,
                minHeight: 15,
                display: 'block',
                borderRadius: 2,
                objectFit: 'cover',
                border: `1px solid ${alpha(theme.palette.divider, 0.2)}`
              }}
            />
          )}

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
        <Box sx={{ display: 'flex', flexDirection: 'column',   width: '100%', flex: 1 }}>
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

            {/* Status Icon */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 24 }}>
              {timeInfo.isPassed ? (
                <CheckIcon sx={{
                  color: 'success.main',
                  fontSize: '1rem'
                }} />
              ) : (
                <HourglassEmptyIcon sx={{
                  color: 'warning.main',
                  fontSize: '1rem'
                }} />
              )}
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
          </Box>

          {/* Second Row: Event Name */}
          <Typography variant="body2" sx={{
            fontWeight: 600,
            fontSize: compact ? '0.85rem' : '0.9rem',
            color: 'text.primary',
            lineHeight: 1.3
          }}>
            {event.event_name}
          </Typography>

          {/* Third Row: Values (if available and not compact) */}
          {!compact && (event.actual_value || event.forecast_value || event.previous_value) && (
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
              {event.actual_value && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                    A:
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.7rem' }}>
                    {formatEventValue(event.actual_value)}
                  </Typography>
                  {trendInfo && trendInfo.icon}
                </Box>
              )}

              {event.forecast_value && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                    F:
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.7rem' }}>
                    {formatEventValue(event.forecast_value)}
                  </Typography>
                </Box>
              )}

              {event.previous_value && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                    P:
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.7rem' }}>
                    {formatEventValue(event.previous_value)}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Paper>
  );
};

export default EventCard;
