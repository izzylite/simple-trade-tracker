/**
 * EconomicEventsView
 *
 * Shared events-layout used by the standalone Events page and the Home
 * panel/drawer. Owns the filter row (impact pill + notifications), currency
 * chips, upcoming toggle, hub tabs (Calendar / Releases), week navigation,
 * day rail, and event list. Filters live on `calendar.economic_calendar_filters`
 * so changes propagate to every surface that renders this view.
 *
 * Page-specific chrome (eyebrow, sidebar cards, side panel) lives on the
 * pages themselves. This component only renders the reusable core.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  ButtonBase,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Close as CloseIcon,
  EventNote as EventsIcon,
  CalendarMonth as DateRangeIcon,
  Notifications as NotificationsIcon,
  NotificationsOff as NotificationsOffIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import {
  addDays,
  addWeeks,
  format,
  isSameDay,
  parseISO,
  endOfWeek,
} from 'date-fns';

import { useEconomicEvents } from 'features/events/hooks/useEconomicEvents';
import { useEventCountdownTime } from 'hooks/useCurrentTime';
import { useUserPinnedEvents } from 'features/events/contexts/UserPinnedEventsContext';
import { useUserTradeEventCounts } from 'features/events/hooks/useUserTradeEventCounts';
import { useEventsPanelState } from 'features/events/contexts/EventsPanelStateContext';
import { Calendar } from 'features/calendar/types/calendar';
import { Currency, EconomicEvent, ImpactLevel } from 'features/events/types/economicCalendar';
import { TradeOperationsProps } from 'features/calendar/types/tradeOperations';
import { isEventPinned } from 'features/events/utils/eventNameUtils';
import {
  DEFAULT_FILTER_SETTINGS,
  EconomicCalendarFilterSettings,
} from 'features/events/hooks/useEconomicCalendarFilters';
import EconomicEventShimmer from 'features/events/components/EconomicEventShimmer';
import EconomicEventDetailDialog from 'features/events/components/EconomicEventDetailDialog';
import EconomicEventRow, { impactColor } from 'features/events/components/EconomicEventRow';

// ─── Public types ─────────────────────────────────────────────────────────────

export type HubTab = 'all' | 'upcoming' | 'releases';

export interface EconomicEventsViewProps {
  calendar: Calendar | null;
  isReadOnly?: boolean;
  onUpdateCalendarProperty?: (
    calendarId: string,
    updater: (cal: Calendar) => Calendar
  ) => Promise<Calendar | undefined | void>;
  enabled?: boolean;
  /** Locks the visible week to this date and disables week nav. */
  initialDate?: Date;
  /**
   * Called when the user clicks an event row. When omitted, the view opens
   * its own EconomicEventDetailDialog (requires `tradeOperations`).
   */
  onEventClick?: (ev: EconomicEvent) => void;
  /** Forwarded to the internal detail dialog when `onEventClick` is omitted. */
  tradeOperations?: TradeOperationsProps;
  /**
   * `page` keeps the day-rail in the left column on md+; `compact` always
   * stacks vertically so a narrow drawer/panel renders sensibly.
   */
  variant?: 'page' | 'compact';
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const CURRENCY_OPTIONS: Currency[] = [
  'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'CNY',
];

export const IMPACT_LEVELS: Array<{ value: ImpactLevel; label: string }> = [
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Med' },
  { value: 'Low', label: 'Low' },
];

export const ALL_IMPACTS: ImpactLevel[] = ['High', 'Medium', 'Low'];

const HUB_TABS: Array<{ value: HubTab; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'releases', label: 'Releases' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
// `formatTime` and `computeTimeInfo` live in EconomicEventRow now —
// keeping them here too caused a circular import (Row imports them from
// View, View imports Row). Re-exported for any future external caller.
export { formatTime, computeTimeInfo } from 'features/events/components/EconomicEventRow';

/** A "release" is an event whose actual figure has already published. */
export const isReleaseEvent = (e: EconomicEvent): boolean =>
  Boolean(e.actual_value && e.actual_value.trim() !== '');

// ─── FilterPill ───────────────────────────────────────────────────────────────

export const FilterPill: React.FC<{
  selected: ImpactLevel[];
  onToggle: (v: ImpactLevel) => void;
  /** Kept in the API for the page variant — compact panel hides the All button. */
  onSelectAll?: () => void;
  theme: Theme;
  compact?: boolean;
}> = ({ selected, onToggle, onSelectAll, theme, compact = false }) => {
  const allActive =
    selected.length === ALL_IMPACTS.length &&
    ALL_IMPACTS.every((i) => selected.includes(i));

  const px = compact ? 1 : 1.5;
  const py = compact ? 0.5 : 0.75;
  const fontSize = compact ? '0.72rem' : '0.8rem';

  const impactButtonSx = (active: boolean, color: string) => ({
    px, py,
    borderRadius: 0.875,
    fontSize, fontWeight: 600,
    color: active ? '#fff' : color,
    bgcolor: active ? color : 'transparent',
    transition: 'background 150ms, color 150ms',
    '&:hover': {
      color: active ? '#fff' : color,
      bgcolor: active ? alpha(color, 0.85) : alpha(color, 0.12),
    },
  });

  const allButtonSx = (active: boolean) => ({
    px, py,
    borderRadius: 0.875,
    fontSize, fontWeight: 600,
    color: active ? theme.palette.primary.contrastText : theme.palette.text.secondary,
    bgcolor: active ? 'primary.main' : 'transparent',
    transition: 'background 150ms, color 150ms',
    '&:hover': {
      color: active ? theme.palette.primary.contrastText : theme.palette.text.primary,
      bgcolor: active ? theme.palette.primary.dark : theme.palette.action.hover,
    },
  });

  return (
    <Stack
      direction="row"
      spacing={compact ? 0.25 : 0.5}
      sx={{
        p: compact ? 0.375 : 0.5,
        borderRadius: 1.25,
        border: `1px solid ${theme.palette.divider}`,
        bgcolor: alpha(theme.palette.background.paper, 0.4),
      }}
    >
      {IMPACT_LEVELS.map((opt) => {
        const active = selected.includes(opt.value);
        const color = impactColor(opt.value, theme);
        return (
          <ButtonBase
            key={opt.value}
            onClick={() => onToggle(opt.value)}
            sx={impactButtonSx(active, color)}
          >
            {opt.label}
          </ButtonBase>
        );
      })}
      {!compact && onSelectAll && (
        <ButtonBase onClick={onSelectAll} sx={allButtonSx(allActive)}>All</ButtonBase>
      )}
    </Stack>
  );
};

// ─── CurrencyChips ────────────────────────────────────────────────────────────

export const CurrencyChips: React.FC<{
  selected: Currency[];
  onToggle: (c: Currency) => void;
  theme: Theme;
  /** Compact mode: tighter chip padding/font. Wrap behavior is the same. */
  compact?: boolean;
}> = ({ selected, onToggle, theme, compact = false }) => {
  const allOff = selected.length === 0;
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: compact ? 0.5 : 0.625,
        rowGap: compact ? 0.5 : 0.625,
        minWidth: 0,
      }}
    >
      {CURRENCY_OPTIONS.map((c) => {
        const active = selected.includes(c);
        const showAsActive = !allOff && active;
        return (
          <ButtonBase
            key={c}
            onClick={() => onToggle(c)}
            sx={{
              flexShrink: 0,
              px: compact ? 1 : 1.25,
              py: compact ? 0.375 : 0.5,
              borderRadius: 999,
              fontSize: compact ? '0.68rem' : '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.02em',
              fontFamily: 'inherit',
              border: `1px solid ${
                showAsActive ? alpha(theme.palette.primary.main, 0.45) : theme.palette.divider
              }`,
              bgcolor: showAsActive ? alpha(theme.palette.primary.main, 0.16) : 'transparent',
              color: showAsActive ? theme.palette.primary.main : theme.palette.text.secondary,
              transition: 'background 150ms, color 150ms, border-color 150ms',
              '&:hover': {
                color: theme.palette.text.primary,
                borderColor: alpha(theme.palette.primary.main, 0.4),
              },
            }}
          >
            {c}
          </ButtonBase>
        );
      })}
      {!allOff && (
        <Tooltip title="Clear currency filter" placement="top" arrow>
          <IconButton
            size="small"
            onClick={() => selected.forEach((c) => onToggle(c))}
            aria-label="Clear currency filter"
            sx={{
              flexShrink: 0,
              width: compact ? 22 : 26,
              height: compact ? 22 : 26,
              borderRadius: 999,
              color: theme.palette.text.disabled,
              border: `1px solid ${theme.palette.divider}`,
              '&:hover': {
                color: theme.palette.text.primary,
                borderColor: alpha(theme.palette.primary.main, 0.4),
                bgcolor: alpha(theme.palette.primary.main, 0.06),
              },
            }}
          >
            <CloseIcon sx={{ fontSize: compact ? 13 : 15 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};

// ─── HubTabs ──────────────────────────────────────────────────────────────────

export const HubTabs: React.FC<{
  value: HubTab;
  onChange: (v: HubTab) => void;
  disabled?: Partial<Record<HubTab, boolean>>;
  theme: Theme;
  compact?: boolean;
}> = ({ value, onChange, disabled, theme, compact = false }) => (
  <Stack
    direction="row"
    spacing={compact ? 0.25 : 0.5}
    sx={{
      p: compact ? 0.375 : 0.5,
      borderRadius: 1.5,
      border: `1px solid ${theme.palette.divider}`,
      bgcolor: alpha(theme.palette.background.paper, 0.4),
    }}
  >
    {HUB_TABS.map((opt) => {
      const active = opt.value === value;
      const isDisabled = disabled?.[opt.value] ?? false;
      const button = (
        <ButtonBase
          key={opt.value}
          onClick={isDisabled ? undefined : () => onChange(opt.value)}
          disabled={isDisabled}
          sx={{
            px: compact ? 1.25 : 2,
            py: compact ? 0.5 : 1,
            borderRadius: 1,
            fontSize: compact ? '0.76rem' : '0.85rem',
            fontWeight: 600,
            color: active
              ? theme.palette.primary.contrastText
              : isDisabled
                ? theme.palette.text.disabled
                : theme.palette.text.secondary,
            bgcolor: active ? 'primary.main' : 'transparent',
            opacity: isDisabled ? 0.5 : 1,
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            transition: 'background 150ms, color 150ms',
            '&:hover': {
              color: active
                ? theme.palette.primary.contrastText
                : isDisabled
                  ? theme.palette.text.disabled
                  : theme.palette.text.primary,
              bgcolor: active
                ? theme.palette.primary.dark
                : isDisabled
                  ? 'transparent'
                  : theme.palette.action.hover,
            },
          }}
        >
          {opt.label}
        </ButtonBase>
      );
      if (isDisabled) {
        return (
          <Tooltip key={opt.value} title="Releases is only available for today" placement="top">
            <span>{button}</span>
          </Tooltip>
        );
      }
      return button;
    })}
  </Stack>
);

// ─── DatePickerTrigger ────────────────────────────────────────────────────────

const DatePickerTrigger: React.FC<any> = (props) => {
  const { weekRangeLabel, InputProps, inputProps, ...rest } = props;
  const theme = useTheme();
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    InputProps?.endAdornment?.props?.children?.props?.onClick?.(e);
    rest.onClick?.(e);
  };
  return (
    <ButtonBase
      ref={InputProps?.ref}
      onClick={handleClick}
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.625,
        px: 1.25, py: 0.5, borderRadius: 999,
        border: `1px solid ${theme.palette.divider}`,
        color: theme.palette.text.secondary,
        fontSize: '0.78rem', fontWeight: 600,
        fontFamily: 'inherit',
        bgcolor: alpha(theme.palette.background.paper, 0.4),
        transition: 'background 150ms, color 150ms, border-color 150ms',
        '&:hover': {
          color: theme.palette.text.primary,
          borderColor: alpha(theme.palette.primary.main, 0.4),
          bgcolor: theme.palette.action.hover,
        },
      }}
    >
      <DateRangeIcon sx={{ fontSize: 16 }} />
      {weekRangeLabel}
    </ButtonBase>
  );
};

// ─── DayRail ──────────────────────────────────────────────────────────────────

export const DayRail: React.FC<{
  days: Date[];
  selectedDay: Date;
  onSelect: (d: Date, idx: number) => void;
  eventsByDate: Map<string, EconomicEvent[]>;
  theme: Theme;
  /**
   * `column`: vertical stack (used by page sidebar).
   * `row`: horizontal grid of 7 equal-width cards (used in narrow panel /
   * drawer). No horizontal scroll — all 7 fit, content compresses.
   */
  layout?: 'column' | 'row';
  compact?: boolean;
}> = ({ days, selectedDay, onSelect, eventsByDate, theme, layout = 'column', compact = false }) => {
  const isRow = layout === 'row';
  return (
    <Stack
      component="aside"
      spacing={compact && isRow ? 0.375 : 0.5}
      direction={isRow ? 'row' : 'column'}
      sx={{ width: '100%' }}
    >
      {days.map((d, idx) => {
        const key = format(d, 'yyyy-MM-dd');
        const dayEvents = eventsByDate.get(key) || [];
        const isActive = isSameDay(d, selectedDay);
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        const hasHigh = dayEvents.some((e) => e.impact === 'High');
        const hasMed = dayEvents.some((e) => e.impact === 'Medium');
        const hasLow = dayEvents.some((e) => e.impact === 'Low');
        const dotColor = hasHigh
          ? theme.palette.error.main
          : hasMed
            ? theme.palette.warning.main
            : hasLow
              ? theme.palette.success.main
              : null;

        const rowSx = {
          display: 'flex',
          flexDirection: 'column' as const,
          alignItems: 'center',
          justifyContent: 'center',
          gap: compact ? 0.125 : 0.25,
          px: compact ? 0.375 : 0.5,
          py: compact ? 0.75 : 1,
          borderRadius: 1.25,
          flex: 1,
          minWidth: 0,
          height: compact ? 52 : 64,
          opacity: isWeekend && dayEvents.length === 0 ? 0.55 : 1,
          bgcolor: isActive
            ? alpha(theme.palette.primary.main, 0.16)
            : 'transparent',
          border: `1px solid ${
            isActive ? alpha(theme.palette.primary.main, 0.32) : theme.palette.divider
          }`,
          transition: 'background 150ms, border-color 150ms',
          '&:hover': {
            bgcolor: isActive
              ? alpha(theme.palette.primary.main, 0.2)
              : theme.palette.action.hover,
          },
        };

        const columnSx = {
          display: 'flex',
          flexDirection: 'row' as const,
          alignItems: 'center',
          gap: 1.25,
          px: 1.25,
          py: 1.125,
          borderRadius: 1.25,
          minWidth: { xs: 152, md: 'auto' },
          flexShrink: 0,
          opacity: isWeekend && dayEvents.length === 0 ? 0.45 : 1,
          bgcolor: isActive ? alpha(theme.palette.primary.main, 0.16) : 'transparent',
          transition: 'background 150ms',
          '&:hover': {
            bgcolor: isActive
              ? alpha(theme.palette.primary.main, 0.2)
              : theme.palette.action.hover,
          },
          justifyContent: 'flex-start',
        };

        return (
          <ButtonBase key={key} onClick={() => onSelect(d, idx)} sx={isRow ? rowSx : columnSx}>
            {isRow ? (
              <>
                <Typography
                  sx={{
                    fontSize: compact ? '0.58rem' : '0.62rem',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'text.secondary',
                    lineHeight: 1,
                  }}
                >
                  {format(d, 'EEE')}
                </Typography>
                <Typography
                  sx={{
                    fontSize: compact ? '0.95rem' : '1.05rem',
                    fontWeight: 700,
                    fontFeatureSettings: "'tnum' on",
                    color: isActive ? 'primary.main' : 'text.primary',
                    lineHeight: 1.1,
                  }}
                >
                  {format(d, 'd')}
                </Typography>
                <Box
                  sx={{
                    width: compact ? 4 : 5,
                    height: compact ? 4 : 5,
                    borderRadius: '50%',
                    bgcolor: dotColor ?? 'transparent',
                    mt: compact ? 0.125 : 0.25,
                  }}
                />
              </>
            ) : (
              <>
                <Typography
                  sx={{
                    fontSize: '1.3rem', fontWeight: 700, letterSpacing: '-0.025em',
                    minWidth: 32, textAlign: 'center',
                    fontFeatureSettings: "'tnum' on",
                    color: isActive ? 'primary.main' : 'text.primary',
                    lineHeight: 1,
                  }}
                >
                  {format(d, 'd')}
                </Typography>
                <Box sx={{ flex: 1, textAlign: 'left' }}>
                  <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>
                    {format(d, 'EEE')}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '0.7rem', color: 'text.secondary', fontWeight: 500,
                      fontFeatureSettings: "'tnum' on", lineHeight: 1.3,
                    }}
                  >
                    {dayEvents.length === 0
                      ? '—'
                      : `${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}`}
                  </Typography>
                </Box>
                {dotColor && (
                  <Box
                    sx={{
                      width: 6, height: 6, borderRadius: '50%',
                      bgcolor: dotColor, opacity: 0.8, flexShrink: 0,
                    }}
                  />
                )}
              </>
            )}
          </ButtonBase>
        );
      })}
    </Stack>
  );
};


// ─── EventRow ─────────────────────────────────────────────────────────────────
// Layout extracted to EconomicEventRow.tsx so other surfaces (e.g. the
// trade-gallery Events panel) can share one canonical event row. The
// local alias keeps EventList's existing call sites unchanged.

const EventRow = EconomicEventRow;


// ─── EventList ────────────────────────────────────────────────────────────────

export const EventList: React.FC<{
  label: string;
  events: EconomicEvent[];
  loading: boolean;
  error: string | null;
  currentTime: Date;
  isPinned: (e: EconomicEvent) => boolean;
  getTradeCount: (e: EconomicEvent) => number;
  /** Optional — surfaces user notes attached to a pinned event as a
   *  tooltip-icon in the row's time stack. */
  getPinnedNotes?: (e: EconomicEvent) => string | undefined;
  pinningEventId: string | null;
  onPin: (e: EconomicEvent) => Promise<void> | void;
  onUnpin: (e: EconomicEvent) => Promise<void> | void;
  onClickRow: (e: EconomicEvent) => void;
  theme: Theme;
  compact?: boolean;
}> = ({
  label, events, loading, error, currentTime, isPinned, getTradeCount, getPinnedNotes,
  pinningEventId, onPin, onUnpin, onClickRow, theme, compact = false,
}) => {
  const highCount = events.filter((e) => e.impact === 'High').length;

  const nowEventId = useMemo(() => {
    const now = currentTime.getTime();
    const upcoming = events
      .filter((e) => parseISO(e.time_utc).getTime() >= now - 30 * 60_000)
      .sort((a, b) => parseISO(a.time_utc).getTime() - parseISO(b.time_utc).getTime());
    return upcoming[0]?.id ?? null;
  }, [events, currentTime]);

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        flex: 1,
        minHeight: compact ? 240 : 360,
        height: '100%',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={compact ? 1 : 1.25}
        sx={{
          px: compact ? 1.5 : 2.25,
          py: compact ? 1.125 : 1.75,
          borderBottom: `1px solid ${theme.palette.divider}`,
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            width: compact ? 22 : 26,
            height: compact ? 22 : 26,
            borderRadius: 1,
            bgcolor: alpha(theme.palette.primary.main, 0.16),
            color: 'primary.main',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <EventsIcon sx={{ fontSize: compact ? 13 : 16 }} />
        </Box>
        <Typography sx={{ fontWeight: 600, fontSize: compact ? '0.85rem' : '0.95rem' }}>
          {label}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography
          sx={{
            fontSize: compact ? '0.7rem' : '0.75rem',
            color: 'text.secondary',
            fontFeatureSettings: "'tnum' on",
          }}
        >
          {loading
            ? 'Loading…'
            : events.length === 0
              ? 'No events'
              : `${events.length} event${events.length === 1 ? '' : 's'}${
                  highCount > 0 ? ` · ${highCount} high` : ''
                }`}
        </Typography>
      </Stack>

      <Box
        sx={{
          overflowY: 'auto', flex: 1,
          '&::-webkit-scrollbar': { width: 10 },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: alpha(theme.palette.text.primary, 0.12),
            borderRadius: 8,
            border: `2px solid ${theme.palette.background.paper}`,
          },
          '&::-webkit-scrollbar-thumb:hover': {
            backgroundColor: alpha(theme.palette.text.primary, 0.22),
          },
        }}
      >
        {error && (
          <Box sx={{ px: 2.25, py: 2, color: 'error.main', fontSize: '0.85rem' }}>{error}</Box>
        )}

        {loading && events.length === 0 && <EconomicEventShimmer count={6} />}

        {!loading && events.length === 0 && (
          <Box sx={{ px: 2.25, py: 5, textAlign: 'center', color: 'text.secondary', fontSize: '0.875rem' }}>
            No events on this day.
          </Box>
        )}

        {events.map((ev, idx) => {
          const pinned = isPinned(ev);
          const isNowRow = ev.id === nowEventId;
          const busy = pinningEventId === ev.id;
          return (
            <EventRow
              key={ev.id}
              event={ev}
              firstRow={idx === 0}
              isNow={isNowRow}
              pinned={pinned}
              busy={busy}
              tradeCount={getTradeCount(ev)}
              pinnedNotes={getPinnedNotes?.(ev)}
              currentTime={currentTime}
              onTogglePin={(e) => {
                e.stopPropagation();
                if (pinned) onUnpin(ev);
                else onPin(ev);
              }}
              onClick={() => onClickRow(ev)}
              theme={theme}
            />
          );
        })}
      </Box>
    </Box>
  );
};

// ─── Main orchestrator ────────────────────────────────────────────────────────

const EconomicEventsView: React.FC<EconomicEventsViewProps> = ({
  calendar,
  isReadOnly = false,
  onUpdateCalendarProperty,
  enabled = true,
  initialDate,
  onEventClick,
  tradeOperations,
  variant = 'page',
}) => {
  const theme = useTheme();
  const compact = variant === 'compact';

  const {
    weekStart,
    setWeekStart,
    selectedDay,
    setSelectedDay,
    hubTab,
    setHubTab,
    internalSelected,
    setInternalSelected,
    goToWeek,
    goToThisWeek,
    handleDatePick,
    anchorToDate,
  } = useEventsPanelState();

  // Re-anchor when consumers pass a new `initialDate` (e.g. user clicks a
  // specific calendar day to open events for that day).
  useEffect(() => {
    if (initialDate) anchorToDate(initialDate);
  }, [initialDate?.getTime(), anchorToDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filter read/write — calendar-level source of truth ────────────────────
  const persistedFilters: EconomicCalendarFilterSettings =
    calendar?.economic_calendar_filters || DEFAULT_FILTER_SETTINGS;

  // Optimistic local copy so impact/currency pill toggles reflect instantly,
  // before the async onUpdateCalendarProperty write round-trips back through
  // the calendar prop. Reconciled below when the persisted source changes.
  const [filterSettings, setFilterSettings] =
    useState<EconomicCalendarFilterSettings>(persistedFilters);

  // Re-sync when the persisted source changes (calendar switch or the write
  // landing). Keyed on the filters reference, which is fresh after each write.
  useEffect(() => {
    setFilterSettings(persistedFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendar?.id, calendar?.economic_calendar_filters]);

  const selectedCurrencies = filterSettings.currencies;
  const selectedImpacts = filterSettings.impacts;
  const notificationsEnabled = filterSettings.notificationsEnabled;

  const updateFilters = useCallback(
    (patch: Partial<EconomicCalendarFilterSettings>) => {
      if (!calendar?.id || !onUpdateCalendarProperty || isReadOnly) return;
      // Optimistic: reflect the change locally immediately.
      setFilterSettings((prev) => ({ ...prev, ...patch }));
      void onUpdateCalendarProperty(calendar.id, (cal) => ({
        ...cal,
        economic_calendar_filters: {
          ...(cal.economic_calendar_filters || DEFAULT_FILTER_SETTINGS),
          ...patch,
        },
      }));
    },
    [calendar?.id, onUpdateCalendarProperty, isReadOnly]
  );

  const toggleCurrency = useCallback(
    (c: Currency) => {
      const next = selectedCurrencies.includes(c)
        ? selectedCurrencies.filter((x) => x !== c)
        : [...selectedCurrencies, c];
      updateFilters({ currencies: next });
    },
    [selectedCurrencies, updateFilters]
  );
  const toggleImpact = useCallback(
    (i: ImpactLevel) => {
      const next = selectedImpacts.includes(i)
        ? selectedImpacts.filter((x) => x !== i)
        : [...selectedImpacts, i];
      updateFilters({ impacts: next });
    },
    [selectedImpacts, updateFilters]
  );
  const setAllImpacts = useCallback(
    () => updateFilters({ impacts: ALL_IMPACTS }),
    [updateFilters]
  );
  const setNotificationsEnabled = useCallback(
    (v: boolean) => updateFilters({ notificationsEnabled: v }),
    [updateFilters]
  );

  // ── Data ─────────────────────────────────────────────────────────────────
  const { events, loading, error } = useEconomicEvents({
    viewType: 'week',
    currentDate: weekStart,
    currencies: selectedCurrencies,
    impacts: selectedImpacts,
    onlyUpcoming: false,
    enabled,
    pageSize: 300,
  });

  const { currentTime } = useEventCountdownTime(events, enabled);

  const visibleEvents = useMemo(() => {
    if (hubTab === 'releases') return events.filter(isReleaseEvent);
    if (hubTab === 'upcoming') {
      const nowMs = currentTime.getTime();
      return events.filter((e) => {
        try {
          return parseISO(e.time_utc).getTime() >= nowMs;
        } catch {
          return false;
        }
      });
    }
    return events;
  }, [events, hubTab, currentTime]);
  const { pins: userPins, pin, unpin, pinningEventId } = useUserPinnedEvents();
  const { getCountForEvent } = useUserTradeEventCounts();

  const isPinnedFor = useCallback((ev: EconomicEvent) => isEventPinned(ev, userPins), [userPins]);
  const getPinnedNotesFor = useCallback(
    (ev: EconomicEvent) =>
      userPins.find((p) =>
        p.event_id ? p.event_id === ev.id : p.event.toLowerCase() === ev.event_name.toLowerCase(),
      )?.notes,
    [userPins],
  );

  const eventsByDate = useMemo(() => {
    const map = new Map<string, EconomicEvent[]>();
    for (const ev of visibleEvents) {
      const list = map.get(ev.event_date);
      if (list) list.push(ev);
      else map.set(ev.event_date, [ev]);
    }
    for (const list of Array.from(map.values())) {
      list.sort((a, b) => a.time_utc.localeCompare(b.time_utc));
    }
    return map;
  }, [visibleEvents]);

  const selectedDayKey = format(selectedDay, 'yyyy-MM-dd');
  const selectedDayEvents = eventsByDate.get(selectedDayKey) || [];

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const weekRangeLabel = useMemo(() => {
    const start = format(weekStart, 'MMM d');
    const end = format(endOfWeek(weekStart, { weekStartsOn: 0 }), 'MMM d');
    return `${start} – ${end}`;
  }, [weekStart]);

  // Edge-of-rail click shifts week so users can navigate without the
  // chevron. Clicking Sun (idx 0) rewinds; clicking Sat (idx 6) advances.
  const handleDaySelect = useCallback(
    (d: Date, idx: number) => {
      if (idx === 0) {
        const prev = addWeeks(weekStart, -1);
        setWeekStart(prev);
        setSelectedDay(addDays(prev, 6));
      } else if (idx === 6) {
        const next = addWeeks(weekStart, 1);
        setWeekStart(next);
        setSelectedDay(next);
      } else {
        setSelectedDay(d);
      }
    },
    [weekStart, setWeekStart, setSelectedDay],
  );

  // Internal detail dialog used when no external onEventClick is wired up.
  const handleEventClick = useCallback(
    (ev: EconomicEvent) => {
      if (onEventClick) onEventClick(ev);
      else setInternalSelected(ev);
    },
    [onEventClick, setInternalSelected],
  );
  const closeInternalDialog = useCallback(
    () => setInternalSelected(null),
    [setInternalSelected],
  );

  return (
    <Box
      sx={{
        flex: 1, minWidth: 0, minHeight: 0,
        display: 'flex', flexDirection: 'column',
        p: compact ? 1.5 : 0,
      }}
    >
      {/* Row 1: Tabs (left) + Impact filter + notifications (right) */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ mb: compact ? 1 : 1.75, flexWrap: 'wrap', rowGap: 0.75 }}
      >
        <HubTabs value={hubTab} onChange={setHubTab} theme={theme} compact={compact} />
        <Box sx={{ flex: 1 }} />
        <FilterPill
          selected={selectedImpacts}
          onToggle={toggleImpact}
          onSelectAll={compact ? undefined : setAllImpacts}
          theme={theme}
          compact={compact}
        />
        <Tooltip
          title={
            isReadOnly
              ? 'Notification settings are read-only for shared calendars'
              : notificationsEnabled
              ? 'Disable event notifications'
              : 'Enable event notifications'
          }
          placement="top"
        >
          <span>
            <IconButton
              size="small"
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              disabled={isReadOnly}
              sx={{
                color: notificationsEnabled ? 'primary.main' : 'text.disabled',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  transform: 'scale(1.1)',
                },
              }}
            >
              {notificationsEnabled ? <NotificationsIcon /> : <NotificationsOffIcon />}
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {/* Row 2: Date range pill (left) + week nav (right) */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ mb: compact ? 1 : 1.75, flexWrap: 'wrap', rowGap: 0.75 }}
      >
        <DatePicker
          value={selectedDay}
          onChange={handleDatePick}
          slots={{ field: DatePickerTrigger }}
          slotProps={{ field: { weekRangeLabel } as any }}
        />
        <Box sx={{ flex: 1 }} />
        <Stack direction="row" spacing={0.25} alignItems="center">
          <IconButton size="small" onClick={() => goToWeek(-1)} aria-label="Previous week">
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
          <ButtonBase
            onClick={goToThisWeek}
            sx={{
              px: compact ? 1 : 1.25,
              py: 0.5,
              borderRadius: 1,
              fontSize: compact ? '0.74rem' : '0.8rem',
              fontWeight: 600,
              color: 'text.secondary',
              '&:hover': { color: 'text.primary' },
            }}
          >
            Today
          </ButtonBase>
          <IconButton size="small" onClick={() => goToWeek(1)} aria-label="Next week">
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>

      {/* Row 3: Currency strip — full width, horizontal scroll in compact */}
      <Box sx={{ mb: compact ? 1.25 : 2.75, minWidth: 0 }}>
        <CurrencyChips
          selected={selectedCurrencies}
          onToggle={toggleCurrency}
          theme={theme}
          compact={compact}
        />
      </Box>

      {/* DayRail + EventList */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: compact
            ? '1fr'
            : { xs: '1fr', md: '200px 1fr' },
          gridAutoRows: compact ? 'auto 1fr' : undefined,
          gap: compact ? 1.25 : { xs: 2, md: 3 },
          alignItems: 'stretch',
          flex: 1,
          minHeight: 0,
        }}
      >
        <DayRail
          days={weekDays}
          selectedDay={selectedDay}
          onSelect={handleDaySelect}
          eventsByDate={eventsByDate}
          theme={theme}
          layout={compact ? 'row' : 'column'}
          compact={compact}
        />
        <EventList
          label={format(selectedDay, 'EEE, MMM d')}
          events={selectedDayEvents}
          loading={loading}
          error={error}
          currentTime={currentTime}
          isPinned={isPinnedFor}
          getTradeCount={getCountForEvent}
          getPinnedNotes={getPinnedNotesFor}
          pinningEventId={pinningEventId}
          onPin={pin}
          onUnpin={unpin}
          onClickRow={handleEventClick}
          theme={theme}
          compact={compact}
        />
      </Box>

      {!onEventClick && internalSelected && calendar && tradeOperations && (
        <EconomicEventDetailDialog
          open={!!internalSelected}
          onClose={closeInternalDialog}
          event={internalSelected}
          calendarId={calendar.id}
          tradeOperations={tradeOperations}
          isReadOnly={isReadOnly}
        />
      )}
    </Box>
  );
};

export default EconomicEventsView;
