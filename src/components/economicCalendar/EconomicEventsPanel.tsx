/**
 * EconomicEventsPanel
 *
 * Slide-in panel that lists the economic events overlapping a single
 * trade's session window. Mirrors NoteViewerPanel / OrionPanel shape so
 * TradeGalleryDialog can host all three in the same mutex right slot
 * (one open at a time, same width tier, same flex-collapse animation).
 *
 * Owns the events fetch, the impact / name filter, and the realtime
 * subscription that keeps "today's" events fresh. Lifted out of
 * TradeDetailExpanded so the trade detail body stays focused on the
 * trade itself — events are now exposed only via the gallery header.
 *
 * Renders rows via the shared EconomicEventRow so the layout matches
 * every other events surface in the app (page, side panel, here).
 *
 * Parent must mount this inside a `display:flex; flex-direction:row`
 * container.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  TextField,
  Toolbar,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  EventNote as EventIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { isToday, parseISO } from 'date-fns';

import { Trade } from '../../types/dualWrite';
import {
  Currency,
  EconomicEvent,
  ImpactLevel,
} from '../../types/economicCalendar';
import {
  DEFAULT_FILTER_SETTINGS as DEFAULT_ECONOMIC_EVENT_FILTER_SETTINGS,
  EconomicCalendarFilterSettings,
} from '../../hooks/useEconomicCalendarFilters';
import { economicCalendarService } from '../../services/economicCalendarService';
import { tradeEconomicEventService } from '../../services/tradeEconomicEventService';
import { useEventPinning } from '../../hooks/useEventPinning';
import { useUserPinnedEvents } from '../../contexts/UserPinnedEventsContext';
import { useEventCountdownTime } from '../../hooks/useCurrentTime';
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription';
import { isEventPinned } from '../../utils/eventNameUtils';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import { formatCount } from '../../utils/formatters';
import { logger } from '../../utils/logger';
import EconomicEventShimmer from './EconomicEventShimmer';
import EconomicEventRow, { impactColor } from './EconomicEventRow';

// Same width tier as NoteViewerPanel / OrionPanel — keeps the slide-in
// slot consistent when the three panels share the right rail.
const PANEL_WIDTH = { xs: '100%', sm: 'min(45%, 380px)' } as const;
const INNER_WIDTH = { xs: '100%', sm: 'min(45vw, 380px)' } as const;

interface EconomicEventsPanelProps {
  open: boolean;
  onClose: () => void;
  trade: Trade | null;
  /** Calendar-level filter settings (currencies + impacts). */
  filterSettings?: EconomicCalendarFilterSettings;
}

const EconomicEventsPanel: React.FC<EconomicEventsPanelProps> = ({
  open,
  onClose,
  trade,
  filterSettings = DEFAULT_ECONOMIC_EVENT_FILTER_SETTINGS,
}) => {
  const theme = useTheme();
  const { pins: userPinnedEvents } = useUserPinnedEvents();
  const { pinningEventId, handlePinEvent, handleUnpinEvent } = useEventPinning();

  const [allEvents, setAllEvents] = useState<EconomicEvent[]>([]);
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventNameSearch, setEventNameSearch] = useState('');
  const [selectedImpacts, setSelectedImpacts] = useState<ImpactLevel[]>([
    'High',
  ]);
  // Monotonic token for the in-flight fetch — a late resolution whose
  // token no longer matches is dropped. Without this, navigating to a
  // new trade (or closing the panel) before the previous fetch resolves
  // would write stale data into state.
  const fetchTokenRef = useRef(0);

  // Live ticking time for the row countdown / passed / imminent states.
  // The hook adapts its interval based on the nearest event so we don't
  // re-render every second when nothing's about to fire.
  const { currentTime } = useEventCountdownTime(events, open);

  // Stable trade-date string keeps the fetch effect from re-firing on
  // unrelated trade prop renders.
  const tradeDateString = trade?.trade_date
    ? typeof trade.trade_date === 'string'
      ? trade.trade_date
      : trade.trade_date.toISOString()
    : '';

  const tradeDate = trade?.trade_date
    ? typeof trade.trade_date === 'string'
      ? parseISO(trade.trade_date)
      : trade.trade_date
    : null;

  const fetchEvents = useCallback(async () => {
    if (!trade || !trade.trade_date) return;

    const token = ++fetchTokenRef.current;
    try {
      setLoading(true);
      setError(null);

      const date =
        typeof trade.trade_date === 'string'
          ? parseISO(trade.trade_date)
          : trade.trade_date;
      const sessionRange = tradeEconomicEventService.getSessionTimeRange(
        trade.session!,
        date,
      );
      const fetched = await economicCalendarService.fetchEvents(
        { start: sessionRange.start, end: sessionRange.end },
        {
          currencies: filterSettings.currencies as Currency[],
          impacts: filterSettings.impacts as ImpactLevel[],
          limit: 100,
        },
      );

      // Drop stale resolutions — token mismatch means the trade
      // changed, the panel closed, or the user retried since.
      if (token !== fetchTokenRef.current) return;

      const sorted = fetched.sort(
        (a, b) =>
          new Date(a.time_utc).getTime() - new Date(b.time_utc).getTime(),
      );
      setAllEvents(sorted);
    } catch (err) {
      if (token !== fetchTokenRef.current) return;
      logger.error('Error fetching economic events:', err);
      setError('Failed to load economic events');
    } finally {
      if (token === fetchTokenRef.current) setLoading(false);
    }
  }, [trade, filterSettings.currencies, filterSettings.impacts]);

  // Fetch on open + when trade changes. The cleanup bumps the token so
  // any in-flight fetch from the previous (open, trade, session) is
  // ignored on resolve.
  useEffect(() => {
    if (!open) return;
    setAllEvents([]);
    setError(null);
    fetchEvents();
    return () => {
      fetchTokenRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, trade?.id, tradeDateString, trade?.session]);

  // Apply local impact + name filters whenever any input changes.
  useEffect(() => {
    setEvents(
      allEvents.filter(
        (event) =>
          selectedImpacts.includes(event.impact) &&
          event.event_name.toLowerCase().includes(eventNameSearch.toLowerCase()),
      ),
    );
  }, [allEvents, selectedImpacts, eventNameSearch]);

  // Realtime: re-fetch when the underlying economic_events table changes
  // for "today" trades. Past dates are immutable, no point subscribing.
  const tradeDateIsToday = tradeDate ? isToday(tradeDate) : false;
  const { createChannel } = useRealtimeSubscription({
    channelName: `events-panel-${trade?.id ?? 'none'}`,
    enabled: open && tradeDateIsToday && !!trade,
    onChannelCreated: (channel) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'economic_events' },
        () => {
          fetchEvents();
        },
      );
    },
    onError: (err) => logger.error('Events panel subscription error:', err),
  });

  useEffect(() => {
    if (!open || !tradeDateIsToday || !trade) return;
    createChannel();
  }, [open, tradeDateIsToday, trade, createChannel]);

  return (
    <Box
      sx={{
        width: open ? PANEL_WIDTH : 0,
        flexShrink: 0,
        overflow: 'hidden',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        borderLeft: open
          ? `1px solid ${alpha(theme.palette.divider, 0.12)}`
          : 'none',
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          width: INNER_WIDTH,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        <Toolbar
          sx={{
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            gap: 1,
            minHeight: 56,
          }}
        >
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ flex: 1, minWidth: 0 }}
          >
            <EventIcon
              sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }}
            />
            <Typography variant="h6" noWrap>
              Economic Events
            </Typography>
          </Stack>

          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Toolbar>

        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            ...scrollbarStyles(theme),
          }}
        >
          {loading ? (
            <EconomicEventShimmer count={10} />
          ) : error ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography
                variant="body2"
                color="error.main"
                sx={{ mb: 2, fontWeight: 500 }}
              >
                {error}
              </Typography>
              <Button
                size="small"
                variant="outlined"
                onClick={fetchEvents}
                sx={{ fontSize: '0.8rem', textTransform: 'none', fontWeight: 600 }}
              >
                Retry
              </Button>
            </Box>
          ) : (
            <>
              {allEvents.length > 0 && (
                <Box
                  sx={{
                    p: 1.5,
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    backgroundColor: alpha(theme.palette.background.default, 0.3),
                  }}
                >
                  <Stack spacing={1.25}>
                    <TextField
                      variant="outlined"
                      size="small"
                      placeholder="Search by event name"
                      value={eventNameSearch}
                      onChange={(e) => setEventNameSearch(e.target.value)}
                      sx={{
                        width: '100%',
                        '& .MuiInputBase-input': { fontSize: '0.85rem' },
                      }}
                    />

                    <Box>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          mb: 0.75,
                        }}
                      >
                        <FilterIcon
                          sx={{ fontSize: 14, color: 'text.secondary' }}
                        />
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                        >
                          Impact
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {filterSettings.impacts.map((impact: ImpactLevel) => {
                          const selected = selectedImpacts.includes(impact);
                          const color = impactColor(impact, theme);
                          return (
                            <Chip
                              key={impact}
                              label={impact}
                              size="small"
                              variant={selected ? 'filled' : 'outlined'}
                              onClick={() =>
                                setSelectedImpacts((prev) =>
                                  prev.includes(impact)
                                    ? prev.filter((i) => i !== impact)
                                    : [...prev, impact],
                                )
                              }
                              sx={{
                                fontSize: '0.7rem',
                                height: 24,
                                fontWeight: 600,
                                borderRadius: 1.5,
                                backgroundColor: selected ? color : 'transparent',
                                color: selected ? 'white' : color,
                                borderColor: color,
                                borderWidth: selected ? 0 : 1.5,
                                '& .MuiChip-label': { px: 1 },
                                '&:hover': {
                                  backgroundColor: selected
                                    ? alpha(color, 0.8)
                                    : alpha(color, 0.08),
                                },
                              }}
                            />
                          );
                        })}
                      </Box>
                    </Box>

                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontSize: '0.7rem' }}
                    >
                      Showing {formatCount(events.length)} of{' '}
                      {formatCount(allEvents.length)} events
                    </Typography>
                  </Stack>
                </Box>
              )}

              {events.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <EventIcon
                    sx={{
                      fontSize: 40,
                      color: 'text.disabled',
                      mb: 1.5,
                      opacity: 0.5,
                    }}
                  />
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontWeight: 500 }}
                  >
                    {allEvents.length === 0
                      ? 'No economic events found for this session'
                      : 'No events match the selected filters'}
                  </Typography>
                </Box>
              ) : (
                <Box>
                  {events.map((event, idx) => {
                    const pinned = isEventPinned(event, userPinnedEvents);
                    const busy = pinningEventId === event.id;
                    const pinnedNotes = pinned
                      ? userPinnedEvents.find((p) =>
                          p.event_id
                            ? p.event_id === event.id
                            : p.event.toLowerCase() === event.event_name.toLowerCase(),
                        )?.notes
                      : undefined;
                    return (
                      <EconomicEventRow
                        key={`${event.id}-${event.time_utc}-${idx}`}
                        event={event}
                        firstRow={idx === 0}
                        pinned={pinned}
                        busy={busy}
                        pinnedNotes={pinnedNotes}
                        currentTime={currentTime}
                        theme={theme}
                        onTogglePin={(e) => {
                          e.stopPropagation();
                          if (pinned) handleUnpinEvent(event);
                          else handlePinEvent(event);
                        }}
                      />
                    );
                  })}
                </Box>
              )}
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default EconomicEventsPanel;
