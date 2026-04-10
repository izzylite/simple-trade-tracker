import React from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Divider,
  useTheme,
  alpha
} from '@mui/material';
import { CalendarToday as CalendarIcon } from '@mui/icons-material';
import { parseISO, isToday, isTomorrow, format } from 'date-fns';
import { EconomicEvent } from '../../types/economicCalendar';
import { PinnedEvent } from '../../types/dualWrite';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import EconomicEventListItem from './EconomicEventListItem';
import EconomicEventShimmer from './EconomicEventShimmer';

interface EconomicCalendarEventListProps {
  loading: boolean;
  error: string | null;
  events: EconomicEvent[];
  groupedEvents: { date: string; events: EconomicEvent[] }[];
  hasMore: boolean;
  loadingMore: boolean;
  pinnedEvents: PinnedEvent[];
  pinningEventId: string | null;
  eventTradeCountMap: Map<string, number>;
  currentTime: Date;
  onPinEvent: (event: EconomicEvent) => void;
  onUnpinEvent: (event: EconomicEvent) => void;
  onEventClick: (event: EconomicEvent) => void;
  onLoadMore: () => void;
  onRefresh: () => void;
  onScroll: (event: React.UIEvent<HTMLDivElement>) => void;
}

const getDateHeader = (date: string) => {
  const eventDate = parseISO(date);
  if (isToday(eventDate)) return 'Today';
  if (isTomorrow(eventDate)) return 'Tomorrow';
  return format(eventDate, 'EEE, MMM d');
};

const EconomicCalendarEventList: React.FC<EconomicCalendarEventListProps> = ({
  loading, error, events, groupedEvents, hasMore, loadingMore,
  pinnedEvents, pinningEventId, eventTradeCountMap, currentTime,
  onPinEvent, onUnpinEvent, onEventClick, onLoadMore, onRefresh, onScroll,
}) => {
  const theme = useTheme();

  return (
    <Box
      sx={{ flex: 1, overflow: 'auto', ...scrollbarStyles(theme) }}
      onScroll={onScroll}
    >
      {loading ? (
        <EconomicEventShimmer />
      ) : error ? (
        <Box sx={{ textAlign: 'center', py: 4, px: 3 }}>
          <CalendarIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            {error}
          </Typography>
          <Button variant="outlined" onClick={onRefresh}>Retry</Button>
        </Box>
      ) : events.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4, px: 3 }}>
          <CalendarIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
            No events found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Try adjusting your filters or date range
          </Typography>
        </Box>
      ) : (
        <Box>
          {groupedEvents.map((dayGroup) => (
            <Box key={dayGroup.date}>
              <Box sx={{
                position: 'sticky', top: 0, zIndex: 10,
                bgcolor: 'background.paper',
                borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                px: 3, py: 1.5,
              }}>
                <Typography variant="subtitle2" sx={{
                  fontWeight: 600, color: 'primary.main', fontSize: '0.875rem'
                }}>
                  {getDateHeader(dayGroup.date)}
                </Typography>
              </Box>
              <Box>
                {dayGroup.events.map((event, eventIndex) => (
                  <React.Fragment key={`${event.id}-${eventIndex}`}>
                    <EconomicEventListItem
                      px={2.5} py={1.5}
                      event={event}
                      pinnedEvents={pinnedEvents}
                      onPinEvent={onPinEvent}
                      onUnpinEvent={onUnpinEvent}
                      isPinning={pinningEventId === event.id}
                      tradeCount={eventTradeCountMap.get(event.id) || 0}
                      currentTime={currentTime}
                      onClick={onEventClick}
                    />
                    {eventIndex < dayGroup.events.length - 1 && (
                      <Divider sx={{ ml: 3 }} />
                    )}
                  </React.Fragment>
                ))}
              </Box>
            </Box>
          ))}

          {hasMore && (
            <Box sx={{ p: 3 }}>
              <Button
                onClick={onLoadMore}
                disabled={loadingMore}
                variant="outlined"
                fullWidth
                startIcon={loadingMore ? <CircularProgress size={16} /> : undefined}
                sx={{
                  borderRadius: 2, py: 1.5, textTransform: 'none', fontWeight: 500,
                  borderColor: alpha(theme.palette.primary.main, 0.3),
                  color: 'primary.main',
                  '&:hover': {
                    borderColor: 'primary.main',
                    backgroundColor: alpha(theme.palette.primary.main, 0.04),
                  }
                }}
              >
                {loadingMore ? 'Loading more events...' : 'Load more events'}
              </Button>
            </Box>
          )}

          {!hasMore && events.length > 0 && !loading && (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                No more events to load
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default EconomicCalendarEventList;
