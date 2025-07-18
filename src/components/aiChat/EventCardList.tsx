/**
 * Event Card List Component for AI Chat
 * Displays a list of economic event cards with expand/collapse functionality
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Collapse,
  useTheme,
  alpha
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Event as EventIcon
} from '@mui/icons-material';
import EventCard from './EventCard';
import { EconomicEvent } from '../../types/economicCalendar';
import { DisplayItem } from '../../utils/aiResponseParser';

interface EventCardListProps {
  eventIds: string[];
  title?: string;
  showSummary?: boolean;
  compact?: boolean;
  maxInitialDisplay?: number;
  onEventClick?: (event: EconomicEvent) => void;
}

const EventCardList: React.FC<EventCardListProps> = ({
  eventIds,
  title = 'Economic Events',
  showSummary = true,
  compact = false,
  maxInitialDisplay = 3,
  onEventClick
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  if (!eventIds || eventIds.length === 0) {
    return null;
  }

  const hasMoreEvents = eventIds.length > maxInitialDisplay;
  const displayedEventIds = expanded ? eventIds : eventIds.slice(0, maxInitialDisplay);
  const hiddenCount = eventIds.length - maxInitialDisplay;

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: alpha(theme.palette.divider, 0.3),
        borderRadius: 2,
        backgroundColor: alpha(theme.palette.background.paper, 0.5),
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 1.5,
          backgroundColor: alpha(theme.palette.primary.main, 0.05),
          borderBottom: '1px solid',
          borderBottomColor: alpha(theme.palette.divider, 0.2),
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}
      >
        <EventIcon sx={{ fontSize: 18, color: 'primary.main' }} />
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 600,
            color: 'primary.main',
            flex: 1
          }}
        >
          {title}
        </Typography>
        
        {showSummary && (
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
              px: 1,
              py: 0.25,
              borderRadius: 1,
              fontSize: '0.7rem',
              fontWeight: 500
            }}
          >
            {eventIds.length} event{eventIds.length !== 1 ? 's' : ''}
          </Typography>
        )}
      </Box>

      {/* Event Cards */}
      <Box sx={{ p: 1.5 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {displayedEventIds.map((eventId, index) => (
            <EventCard
              key={eventId}
              eventId={eventId}
              compact={compact}
              onClick={onEventClick}
            />
          ))}
        </Box>

        {/* Expand/Collapse Button */}
        {hasMoreEvents && (
          <Collapse in={!expanded}>
            <Box sx={{ mt: 1.5, textAlign: 'center' }}>
              <Button
                variant="text"
                size="small"
                onClick={() => setExpanded(true)}
                startIcon={<ExpandMoreIcon />}
                sx={{
                  color: 'primary.main',
                  fontSize: '0.8rem',
                  textTransform: 'none',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.05)
                  }
                }}
              >
                Show {hiddenCount} more event{hiddenCount !== 1 ? 's' : ''}
              </Button>
            </Box>
          </Collapse>
        )}

        {/* Collapse Button */}
        {hasMoreEvents && expanded && (
          <Box sx={{ mt: 1.5, textAlign: 'center' }}>
            <Button
              variant="text"
              size="small"
              onClick={() => setExpanded(false)}
              startIcon={<ExpandLessIcon />}
              sx={{
                color: 'primary.main',
                fontSize: '0.8rem',
                textTransform: 'none',
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.05)
                }
              }}
            >
              Show less
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default EventCardList;
