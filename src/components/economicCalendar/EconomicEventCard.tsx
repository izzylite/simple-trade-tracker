/**
 * Economic Event Card Component
 * Displays individual economic events with impact indicators
 */

import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Chip,
  Box,
  IconButton,
  Tooltip,
  useTheme
} from '@mui/material';
import {
  Schedule as TimeIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Remove as NeutralIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { 
  EconomicEvent, 
  EconomicEventCardProps,
  IMPACT_COLORS,
  CURRENCY_FLAGS 
} from '../../types/economicCalendar';

const EconomicEventCard: React.FC<EconomicEventCardProps> = ({
  event,
  showDate = false,
  compact = false,
  onClick
}) => {
  const theme = useTheme();

  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (timeString: string) => {
    const date = new Date(timeString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getActualTrend = () => {
    if (!event.actual || !event.previous) return null;
    
    const actual = parseFloat(event.actual.replace(/[^\d.-]/g, ''));
    const previous = parseFloat(event.previous.replace(/[^\d.-]/g, ''));
    
    if (isNaN(actual) || isNaN(previous)) return null;
    
    if (actual > previous) return 'up';
    if (actual < previous) return 'down';
    return 'neutral';
  };

  const getTrendIcon = () => {
    const trend = getActualTrend();
    switch (trend) {
      case 'up':
        return <TrendingUpIcon sx={{ fontSize: 16, color: 'success.main' }} />;
      case 'down':
        return <TrendingDownIcon sx={{ fontSize: 16, color: 'error.main' }} />;
      case 'neutral':
        return <NeutralIcon sx={{ fontSize: 16, color: 'text.secondary' }} />;
      default:
        return null;
    }
  };

  const getTimeUntilEvent = (timeString: string) => {
    const eventTime = new Date(timeString);
    const now = new Date();
    const diffMs = eventTime.getTime() - now.getTime();

    if (diffMs <= 0) return 'Now';

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 24) {
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d`;
    } else if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    } else {
      return `${diffMinutes}m`;
    }
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick(event);
    }
  };

  return (
    <Card
      sx={{
        mb: compact ? 1 : 1.5,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease-in-out',
        '&:hover': onClick ? {
          transform: 'translateY(-2px)',
          boxShadow: theme.shadows[4]
        } : {},
        borderLeft: `4px solid ${IMPACT_COLORS[event.impact]}`,
        ...(compact && {
          '& .MuiCardContent-root': {
            padding: '12px !important'
          }
        })
      }}
      onClick={handleCardClick}
    >
      <CardContent>
        {/* Header with time and currency */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Box display="flex" alignItems="center" gap={1}>
            <TimeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              {showDate && `${formatDate(event.time)} `}
              {formatTime(event.time)}
            </Typography>
            {/* Show countdown for upcoming events */}
            {new Date(event.time) > new Date() && (
              <Chip
                label={getTimeUntilEvent(event.time)}
                size="small"
                variant="outlined"
                sx={{
                  fontSize: '0.7rem',
                  height: 20,
                  color: 'primary.main',
                  borderColor: 'primary.main'
                }}
              />
            )}
          </Box>

          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="body2" sx={{ fontSize: '1.2em' }}>
              {CURRENCY_FLAGS[event.currency] || '🌍'}
            </Typography>
            <Chip
              label={event.currency}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.75rem', height: 24 }}
            />
          </Box>
        </Box>

        {/* Event title */}
        <Typography
          variant={compact ? "body2" : "subtitle2"}
          component="h3"
          sx={{
            fontWeight: 600,
            mb: 1,
            lineHeight: 1.3,
            display: '-webkit-box',
            WebkitLineClamp: compact ? 2 : 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}
        >
          {event.event}
        </Typography>

        {/* Impact indicator */}
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <Chip
            label={event.impact}
            size="small"
            sx={{
              backgroundColor: IMPACT_COLORS[event.impact],
              color: 'white',
              fontWeight: 600,
              fontSize: '0.7rem'
            }}
          />
          {event.isAllDay && (
            <Chip
              label="All Day"
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.7rem' }}
            />
          )}
        </Box>

        {/* Economic data */}
        {!compact && (event.actual || event.forecast || event.previous) && (
          <Box 
            display="grid" 
            gridTemplateColumns="1fr 1fr 1fr" 
            gap={1}
            sx={{
              mt: 1,
              p: 1,
              backgroundColor: 'action.hover',
              borderRadius: 1
            }}
          >
            <Box textAlign="center">
              <Typography variant="caption" color="text.secondary" display="block">
                Actual
              </Typography>
              <Box display="flex" alignItems="center" justifyContent="center" gap={0.5}>
                <Typography variant="body2" fontWeight={event.actual ? 600 : 400}>
                  {event.actual || '-'}
                </Typography>
                {getTrendIcon()}
              </Box>
            </Box>
            
            <Box textAlign="center">
              <Typography variant="caption" color="text.secondary" display="block">
                Forecast
              </Typography>
              <Typography variant="body2">
                {event.forecast || '-'}
              </Typography>
            </Box>
            
            <Box textAlign="center">
              <Typography variant="caption" color="text.secondary" display="block">
                Previous
              </Typography>
              <Typography variant="body2">
                {event.previous || '-'}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Compact view data */}
        {compact && (event.actual || event.forecast) && (
          <Box display="flex" gap={2} mt={1}>
            {event.actual && (
              <Box display="flex" alignItems="center" gap={0.5}>
                <Typography variant="caption" color="text.secondary">
                  Actual:
                </Typography>
                <Typography variant="caption" fontWeight={600}>
                  {event.actual}
                </Typography>
                {getTrendIcon()}
              </Box>
            )}
            {event.forecast && (
              <Box display="flex" alignItems="center" gap={0.5}>
                <Typography variant="caption" color="text.secondary">
                  Forecast:
                </Typography>
                <Typography variant="caption">
                  {event.forecast}
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default EconomicEventCard;
