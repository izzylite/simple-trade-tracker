/**
 * Full pinned-events list rendered as side panel content. The panel header
 * (close button, title) is supplied by SidePanelHeader; this component just
 * renders the scrollable body.
 */

import React, { useMemo } from 'react';
import { Box, Stack, Typography, alpha, useTheme } from '@mui/material';
import { differenceInMilliseconds, format, parseISO } from 'date-fns';
import {
  Currency,
  EconomicEvent,
  ImpactLevel,
} from 'features/events/types/economicCalendar';
import { PinnedEvent } from 'features/calendar/types/dualWrite';
import { useEventCountdownTime } from 'hooks/useCurrentTime';

interface AllPinnedEventsContentProps {
  pins: PinnedEvent[];
  allEvents: EconomicEvent[];
  getTradeCount: (e: EconomicEvent) => number;
  onClickEvent: (e: EconomicEvent) => void;
}

const formatTime = (timeUtc: string): string => {
  try {
    return format(parseISO(timeUtc), 'h:mm a');
  } catch {
    return '--:--';
  }
};

const formatRelativeTime = (timeUtc: string, now: Date): string => {
  try {
    const target = parseISO(timeUtc);
    const ms = differenceInMilliseconds(target, now);
    const abs = Math.abs(ms);
    const minutes = Math.floor(abs / 60_000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (ms < 0) {
      if (days >= 1) return `${days}d ago`;
      if (hours >= 1) return `${hours}h ago`;
      if (minutes >= 1) return `${minutes}m ago`;
      return 'just now';
    }
    if (days >= 1) return `In ${days} day${days === 1 ? '' : 's'}`;
    if (hours >= 1) return `In ${hours}h ${minutes - hours * 60}m`;
    if (minutes >= 1) return `In ${minutes}m`;
    return 'Now';
  } catch {
    return '';
  }
};

const pinnedEventToEconomicEvent = (pin: PinnedEvent): EconomicEvent => ({
  id: pin.event_id,
  event_name: pin.event,
  currency: (pin.currency ?? 'USD') as Currency,
  impact: (pin.impact ?? 'High') as ImpactLevel,
  actual_result_type: '',
  event_time: '',
  time_utc: '',
  actual_value: '',
  forecast_value: '',
  previous_value: '',
  event_date: '',
  flag_url: pin.flag_url,
  country: pin.country,
  is_all_day: true,
});

const AllPinnedEventsContent: React.FC<AllPinnedEventsContentProps> = ({
  pins,
  allEvents,
  getTradeCount,
  onClickEvent,
}) => {
  const theme = useTheme();
  const { currentTime } = useEventCountdownTime(allEvents, true);

  const rows = useMemo(() => {
    return pins.map((p) => {
      const live = allEvents.find((e) => e.id === p.event_id);
      const event = live ?? pinnedEventToEconomicEvent(p);
      return { pin: p, event };
    });
  }, [pins, allEvents]);

  if (pins.length === 0) {
    return (
      <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0, p: 2.5 }}>
        <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', textAlign: 'center', py: 3 }}>
          No pinned events.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        flex: 1,
        overflowY: 'auto',
        minHeight: 0,
        px: 2.5,
        '&::-webkit-scrollbar': { width: 8 },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: alpha(theme.palette.text.primary, 0.12),
          borderRadius: 8,
          border: `2px solid ${theme.palette.background.paper}`,
        },
      }}
    >
      <Stack divider={<Box sx={{ height: 1, bgcolor: 'divider' }} />}>
        {rows.map(({ pin, event }) => {
          const tradeCount = getTradeCount(event);
          const hasTime = !event.is_all_day && event.time_utc;
          return (
            <Box
              key={pin.event_id}
              onClick={() => onClickEvent(event)}
              sx={{
                py: 1.5,
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 1.5,
                alignItems: 'center',
                cursor: 'pointer',
                borderRadius: 1,
                transition: 'background 120ms',
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  sx={{
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    color: 'text.primary',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {event.event_name}
                </Typography>
                <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 0.25 }}>
                  <Typography
                    sx={{
                      fontSize: '0.74rem',
                      color: 'text.secondary',
                      fontFeatureSettings: "'tnum' on",
                    }}
                  >
                    {hasTime
                      ? `${formatTime(event.time_utc)} · ${formatRelativeTime(event.time_utc, currentTime)}`
                      : pin.currency ?? '—'}
                  </Typography>
                  {tradeCount > 0 && (
                    <Box
                      sx={{
                        px: 0.625,
                        py: 0.125,
                        borderRadius: 0.5,
                        bgcolor: alpha(theme.palette.primary.main, 0.14),
                        color: theme.palette.primary.main,
                        fontSize: '0.65rem',
                        fontWeight: 700,
                      }}
                    >
                      {tradeCount}×
                    </Box>
                  )}
                </Stack>
              </Box>
              <ImpactBars impact={event.impact} />
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
};

const ImpactBars: React.FC<{ impact: ImpactLevel }> = ({ impact }) => {
  const theme = useTheme();
  const filledCount =
    impact === 'High' ? 3 : impact === 'Medium' ? 2 : impact === 'Low' ? 1 : 0;
  const filledColor =
    impact === 'High'
      ? theme.palette.error.main
      : impact === 'Medium'
        ? theme.palette.warning.main
        : impact === 'Low'
          ? theme.palette.success.main
          : alpha(theme.palette.text.primary, 0.18);
  const dim = alpha(theme.palette.text.primary, 0.12);
  return (
    <Stack direction="row" spacing={0.375} aria-label={`${impact} impact`}>
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          sx={{
            width: 6,
            height: 12,
            borderRadius: '1.5px',
            bgcolor: i < filledCount ? filledColor : dim,
          }}
        />
      ))}
    </Stack>
  );
};

export default AllPinnedEventsContent;
