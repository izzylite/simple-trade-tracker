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
  PushPin as PinIcon,
  PushPinOutlined as UnpinIcon,
  EventNote as EventsIcon,
  CalendarMonth as DateRangeIcon,
  Check as CheckIcon,
  HourglassEmpty as HourglassEmptyIcon,
  Notifications as NotificationsIcon,
  NotificationsOff as NotificationsOffIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import {
  addDays,
  addWeeks,
  format,
  isAfter,
  isSameDay,
  parseISO,
  startOfWeek,
  endOfWeek,
} from 'date-fns';

import { useEconomicEvents } from '../../hooks/useEconomicEvents';
import { useEventCountdownTime } from '../../hooks/useCurrentTime';
import { useUserPinnedEvents } from '../../contexts/UserPinnedEventsContext';
import { useUserTradeEventCounts } from '../../hooks/useUserTradeEventCounts';
import { Calendar } from '../../types/calendar';
import { Currency, EconomicEvent, ImpactLevel } from '../../types/economicCalendar';
import { TradeOperationsProps } from '../../types/tradeOperations';
import { isEventPinned } from '../../utils/eventNameUtils';
import {
  DEFAULT_FILTER_SETTINGS,
  EconomicCalendarFilterSettings,
} from '../../hooks/useEconomicCalendarFilters';
import EconomicEventShimmer from './EconomicEventShimmer';
import EconomicEventDetailDialog from './EconomicEventDetailDialog';

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

export const formatTime = (timeUtc: string): string => {
  try {
    return format(parseISO(timeUtc), 'h:mm a');
  } catch {
    return '--:--';
  }
};

interface TimeInfo {
  countdown: string | null;
  isUpcoming: boolean;
  isImminent: boolean;
  isPassed: boolean;
}

export const computeTimeInfo = (timeUtc: string, currentTime: Date): TimeInfo => {
  try {
    const target = parseISO(timeUtc);
    if (!isAfter(target, currentTime)) {
      return { countdown: null, isUpcoming: false, isImminent: false, isPassed: true };
    }
    const totalSeconds = Math.floor((target.getTime() - currentTime.getTime()) / 1000);
    const minutesDiff = Math.floor(totalSeconds / 60);
    const hoursDiff = Math.floor(totalSeconds / 3600);
    const daysDiff = Math.floor(hoursDiff / 24);
    let countdown = '';
    let isImminent = false;
    if (minutesDiff < 60) {
      isImminent = true;
      if (minutesDiff < 5) {
        const remM = Math.floor(totalSeconds / 60);
        const remS = totalSeconds % 60;
        countdown = remM > 0 ? `${remM}m ${remS}s` : `${remS}s`;
      } else {
        countdown = `${minutesDiff} min`;
      }
    } else if (hoursDiff < 24) {
      countdown = `${hoursDiff}h`;
    } else if (daysDiff === 1) {
      countdown = '1 day';
    } else {
      countdown = `${daysDiff} days`;
    }
    return { countdown, isUpcoming: true, isImminent, isPassed: false };
  } catch {
    return { countdown: null, isUpcoming: false, isImminent: false, isPassed: false };
  }
};

const getActualResultStyle = (
  actualResultType: string | undefined,
  theme: Theme
): { bg: string; border: string; color: string } => {
  switch (actualResultType) {
    case 'good':
      return {
        bg: alpha(theme.palette.success.main, 0.15),
        border: alpha(theme.palette.success.main, 0.3),
        color: theme.palette.success.light,
      };
    case 'bad':
      return {
        bg: alpha(theme.palette.error.main, 0.15),
        border: alpha(theme.palette.error.main, 0.3),
        color: theme.palette.error.light,
      };
    case 'neutral':
      return {
        bg: alpha(theme.palette.info.main, 0.1),
        border: alpha(theme.palette.info.main, 0.2),
        color: theme.palette.info.light,
      };
    default:
      return {
        bg: alpha(theme.palette.success.main, 0.1),
        border: alpha(theme.palette.success.main, 0.2),
        color: theme.palette.text.primary,
      };
  }
};

/** A "release" is an event whose actual figure has already published. */
export const isReleaseEvent = (e: EconomicEvent): boolean =>
  Boolean(e.actual_value && e.actual_value.trim() !== '');

const impactColor = (impact: ImpactLevel, theme: Theme): string => {
  switch (impact) {
    case 'High': return theme.palette.error.main;
    case 'Medium': return theme.palette.warning.main;
    case 'Low': return theme.palette.success.main;
    default: return theme.palette.text.secondary;
  }
};

// ─── FilterPill ───────────────────────────────────────────────────────────────

export const FilterPill: React.FC<{
  selected: ImpactLevel[];
  onToggle: (v: ImpactLevel) => void;
  onSelectAll: () => void;
  theme: Theme;
}> = ({ selected, onToggle, onSelectAll, theme }) => {
  const allActive =
    selected.length === ALL_IMPACTS.length &&
    ALL_IMPACTS.every((i) => selected.includes(i));

  const impactButtonSx = (active: boolean, color: string) => ({
    px: 1.5, py: 0.75,
    borderRadius: 0.875,
    fontSize: '0.8rem', fontWeight: 600,
    color: active ? '#fff' : color,
    bgcolor: active ? color : 'transparent',
    transition: 'background 150ms, color 150ms',
    '&:hover': {
      color: active ? '#fff' : color,
      bgcolor: active ? alpha(color, 0.85) : alpha(color, 0.12),
    },
  });

  const allButtonSx = (active: boolean) => ({
    px: 1.5, py: 0.75,
    borderRadius: 0.875,
    fontSize: '0.8rem', fontWeight: 600,
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
      spacing={0.5}
      sx={{
        p: 0.5,
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
      <ButtonBase onClick={onSelectAll} sx={allButtonSx(allActive)}>All</ButtonBase>
    </Stack>
  );
};

// ─── CurrencyChips ────────────────────────────────────────────────────────────

export const CurrencyChips: React.FC<{
  selected: Currency[];
  onToggle: (c: Currency) => void;
  theme: Theme;
}> = ({ selected, onToggle, theme }) => {
  const allOff = selected.length === 0;
  return (
    <Stack direction="row" spacing={0.625} flexWrap="wrap" sx={{ rowGap: 0.625 }}>
      {CURRENCY_OPTIONS.map((c) => {
        const active = selected.includes(c);
        const showAsActive = !allOff && active;
        return (
          <ButtonBase
            key={c}
            onClick={() => onToggle(c)}
            sx={{
              px: 1.25, py: 0.5, borderRadius: 999,
              fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.02em',
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
        <ButtonBase
          onClick={() => selected.forEach((c) => onToggle(c))}
          sx={{
            px: 1, py: 0.5, borderRadius: 999,
            fontSize: '0.72rem', fontWeight: 600,
            color: theme.palette.text.disabled,
            '&:hover': { color: theme.palette.text.primary },
          }}
        >
          Clear
        </ButtonBase>
      )}
    </Stack>
  );
};

// ─── HubTabs ──────────────────────────────────────────────────────────────────

export const HubTabs: React.FC<{
  value: HubTab;
  onChange: (v: HubTab) => void;
  disabled?: Partial<Record<HubTab, boolean>>;
  theme: Theme;
}> = ({ value, onChange, disabled, theme }) => (
  <Stack
    direction="row"
    spacing={0.5}
    sx={{
      p: 0.5, borderRadius: 1.5,
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
            px: 2, py: 1, borderRadius: 1,
            fontSize: '0.85rem', fontWeight: 600,
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
}> = ({ days, selectedDay, onSelect, eventsByDate, theme, layout = 'column' }) => {
  const isRow = layout === 'row';
  return (
    <Stack
      component="aside"
      spacing={isRow ? 0.5 : 0.5}
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
          gap: 0.25,
          px: 0.5,
          py: 1,
          borderRadius: 1.25,
          flex: 1,
          minWidth: 0,
          height: 64,
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
                    fontSize: '0.62rem', fontWeight: 700,
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
                    fontSize: '1.05rem', fontWeight: 700,
                    fontFeatureSettings: "'tnum' on",
                    color: isActive ? 'primary.main' : 'text.primary',
                    lineHeight: 1.1,
                  }}
                >
                  {format(d, 'd')}
                </Typography>
                <Box
                  sx={{
                    width: 5, height: 5, borderRadius: '50%',
                    bgcolor: dotColor ?? 'transparent',
                    mt: 0.25,
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

// ─── ValuePill / ImpactBars ───────────────────────────────────────────────────

const ValuePill: React.FC<{ label: string; bg: string; border: string; color: string }> = ({
  label, bg, border, color,
}) => (
  <Box
    sx={{
      px: 0.875, py: 0.25, borderRadius: 0.75,
      bgcolor: bg, border: `1px solid ${border}`, color,
      fontSize: '0.7rem', fontWeight: 700,
      fontFeatureSettings: "'tnum' on, 'lnum' on",
      lineHeight: 1.4,
    }}
  >
    {label}
  </Box>
);

const ImpactBars: React.FC<{ impact: ImpactLevel; theme: Theme }> = ({ impact, theme }) => {
  const filledCount = impact === 'High' ? 3 : impact === 'Medium' ? 2 : impact === 'Low' ? 1 : 0;
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
            width: 6, height: 12, borderRadius: '1.5px',
            bgcolor: i < filledCount ? filledColor : dim,
          }}
        />
      ))}
    </Stack>
  );
};

// ─── EventRow ─────────────────────────────────────────────────────────────────

const EventRow: React.FC<{
  event: EconomicEvent;
  firstRow: boolean;
  isNow: boolean;
  pinned: boolean;
  busy: boolean;
  tradeCount: number;
  currentTime: Date;
  onTogglePin: (e: React.MouseEvent) => void;
  onClick: () => void;
  theme: Theme;
}> = ({
  event, firstRow, isNow, pinned, busy, tradeCount, currentTime, onTogglePin, onClick, theme,
}) => {
  const timeInfo = useMemo(
    () => computeTimeInfo(event.time_utc, currentTime),
    [event.time_utc, currentTime]
  );
  const actualStyle = getActualResultStyle(event.actual_result_type, theme);
  const hasAnyValue = Boolean(event.actual_value || event.forecast_value || event.previous_value);

  const nowDotSx = isNow
    ? {
        '&::before': {
          content: '""', position: 'absolute',
          left: 6, top: '50%', transform: 'translateY(-50%)',
          width: 6, height: 6, borderRadius: '50%',
          bgcolor: theme.palette.primary.main,
          boxShadow: `0 0 8px ${alpha(theme.palette.primary.main, 0.8)}`,
          animation: 'eventNowPulse 2.4s ease-in-out infinite',
        },
        '@keyframes eventNowPulse': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        },
        '@media (prefers-reduced-motion: reduce)': {
          '&::before': { animation: 'none' },
        },
      }
    : {};

  const imminentBg = timeInfo.isImminent ? alpha(impactColor(event.impact, theme), 0.12) : null;

  return (
    <Box
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      sx={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: '52px 1fr auto auto',
        gap: 1.5,
        alignItems: 'flex-start',
        px: 2.25, py: 1.75,
        borderTop: firstRow ? 'none' : `1px solid ${theme.palette.divider}`,
        bgcolor: isNow
          ? alpha(theme.palette.primary.main, 0.16)
          : imminentBg ?? 'transparent',
        opacity: timeInfo.isPassed ? 0.62 : 1,
        cursor: 'pointer',
        transition: 'background 180ms, opacity 180ms',
        '&:hover': {
          bgcolor: isNow
            ? alpha(theme.palette.primary.main, 0.2)
            : alpha(theme.palette.primary.main, 0.04),
        },
        ...nowDotSx,
      }}
    >
      <Box
        sx={{
          minWidth: 36, mt: 0.25,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5,
        }}
      >
        {event.flag_url ? (
          <Box
            component="img"
            src={event.flag_url}
            alt={event.country || event.currency || ''}
            sx={{
              width: 22, height: 16, borderRadius: 0.375, objectFit: 'cover',
              border: `1px solid ${alpha(theme.palette.divider, 0.4)}`,
            }}
          />
        ) : (
          <Box
            sx={{
              width: 22, height: 16, borderRadius: 0.375,
              bgcolor: alpha(theme.palette.text.primary, 0.06),
            }}
          />
        )}
        <Typography
          sx={{
            fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.02em',
            color: 'text.primary', lineHeight: 1,
          }}
        >
          {event.currency}
        </Typography>
      </Box>

      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
          <Typography
            sx={{
              fontSize: '0.78rem', fontWeight: 600,
              color: timeInfo.isUpcoming ? 'text.primary' : 'text.secondary',
              fontFeatureSettings: "'tnum' on",
            }}
          >
            {event.is_all_day ? 'All day' : formatTime(event.time_utc)}
          </Typography>
          {timeInfo.isPassed ? (
            <CheckIcon sx={{ fontSize: 14, color: 'success.main' }} />
          ) : timeInfo.countdown ? (
            <Typography
              sx={{
                fontSize: '0.66rem', fontWeight: 700,
                color: timeInfo.isImminent ? 'error.main' : 'warning.main',
                animation: timeInfo.isImminent ? 'eventCountdownPulse 1s infinite' : 'none',
                '@keyframes eventCountdownPulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.7 },
                },
                '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
              }}
            >
              {timeInfo.countdown}
            </Typography>
          ) : null}
        </Stack>

        <Typography
          sx={{
            fontSize: '0.92rem', fontWeight: 600, letterSpacing: '-0.01em',
            color: 'text.primary',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {event.event_name}
        </Typography>

        {hasAnyValue && (
          <Stack direction="row" spacing={0.875} alignItems="center" flexWrap="wrap"
            sx={{ mt: 0.625, rowGap: 0.5 }}>
            {event.actual_value ? (
              <ValuePill label={`A: ${event.actual_value}`} bg={actualStyle.bg}
                border={actualStyle.border} color={actualStyle.color} />
            ) : (
              (event.forecast_value || event.previous_value) && (
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.disabled' }}>A:</Typography>
                  <HourglassEmptyIcon sx={{ fontSize: 12, color: 'warning.main' }} />
                </Stack>
              )
            )}
            {event.forecast_value && (
              <ValuePill label={`F: ${event.forecast_value}`}
                bg={alpha(theme.palette.info.main, 0.1)}
                border={alpha(theme.palette.info.main, 0.2)}
                color={theme.palette.text.secondary} />
            )}
            {event.previous_value && (
              <ValuePill label={`P: ${event.previous_value}`}
                bg={alpha(theme.palette.grey[500], 0.1)}
                border={alpha(theme.palette.grey[500], 0.2)}
                color={theme.palette.text.disabled} />
            )}
            {tradeCount > 0 && (
              <Tooltip title={`Traded ${tradeCount} time${tradeCount > 1 ? 's' : ''} across all calendars`} placement="top" arrow>
                <Box
                  sx={{
                    display: 'inline-flex', alignItems: 'center', gap: 0.375,
                    px: 0.75, py: 0.25, borderRadius: 0.75,
                    bgcolor: alpha(theme.palette.primary.main, 0.14),
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.28)}`,
                    color: theme.palette.primary.main,
                    fontSize: '0.68rem', fontWeight: 700, lineHeight: 1.4,
                  }}
                >
                  {tradeCount}×
                </Box>
              </Tooltip>
            )}
          </Stack>
        )}
        {!hasAnyValue && tradeCount > 0 && (
          <Tooltip title={`Traded ${tradeCount} time${tradeCount > 1 ? 's' : ''} across all calendars`} placement="top" arrow>
            <Box
              sx={{
                display: 'inline-flex', alignItems: 'center',
                mt: 0.5, px: 0.75, py: 0.25, borderRadius: 0.75,
                bgcolor: alpha(theme.palette.primary.main, 0.14),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.28)}`,
                color: theme.palette.primary.main,
                fontSize: '0.68rem', fontWeight: 700, lineHeight: 1.4,
              }}
            >
              {tradeCount}×
            </Box>
          </Tooltip>
        )}
      </Box>

      <Box sx={{ pt: 0.5 }}>
        <ImpactBars impact={event.impact} theme={theme} />
      </Box>

      <Tooltip title={pinned ? 'Unpin event' : 'Pin event'} placement="left">
        <span>
          <IconButton
            size="small"
            onClick={onTogglePin}
            disabled={busy}
            sx={{
              color: pinned ? 'primary.main' : 'text.disabled',
              '&:hover': {
                color: 'primary.main',
                bgcolor: alpha(theme.palette.primary.main, 0.08),
              },
            }}
          >
            {busy ? (
              <CircularProgress size={14} />
            ) : pinned ? (
              <PinIcon sx={{ fontSize: 16 }} />
            ) : (
              <UnpinIcon sx={{ fontSize: 16 }} />
            )}
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
};

// ─── EventList ────────────────────────────────────────────────────────────────

export const EventList: React.FC<{
  label: string;
  events: EconomicEvent[];
  loading: boolean;
  error: string | null;
  currentTime: Date;
  isPinned: (e: EconomicEvent) => boolean;
  getTradeCount: (e: EconomicEvent) => number;
  pinningEventId: string | null;
  onPin: (e: EconomicEvent) => Promise<void> | void;
  onUnpin: (e: EconomicEvent) => Promise<void> | void;
  onClickRow: (e: EconomicEvent) => void;
  theme: Theme;
}> = ({
  label, events, loading, error, currentTime, isPinned, getTradeCount,
  pinningEventId, onPin, onUnpin, onClickRow, theme,
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
        minHeight: 360,
        height: '100%',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.25}
        sx={{
          px: 2.25, py: 1.75,
          borderBottom: `1px solid ${theme.palette.divider}`,
          flexShrink: 0,
        }}>
        <Box
          sx={{
            width: 26, height: 26, borderRadius: 1,
            bgcolor: alpha(theme.palette.primary.main, 0.16),
            color: 'primary.main',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <EventsIcon sx={{ fontSize: 16 }} />
        </Box>
        <Typography sx={{ fontWeight: 600, fontSize: '0.95rem' }}>{label}</Typography>
        <Box sx={{ flex: 1 }} />
        <Typography
          sx={{
            fontSize: '0.75rem', color: 'text.secondary',
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

  const initialAnchor = initialDate || new Date();
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(initialAnchor, { weekStartsOn: 0 })
  );
  const [selectedDay, setSelectedDay] = useState<Date>(() => initialAnchor);
  const [hubTab, setHubTab] = useState<HubTab>('all');

  // Track when consumers swap calendars / initialDate so we re-anchor.
  useEffect(() => {
    if (initialDate) {
      setWeekStart(startOfWeek(initialDate, { weekStartsOn: 0 }));
      setSelectedDay(initialDate);
    }
  }, [initialDate?.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filter read/write — calendar-level source of truth ────────────────────
  const filterSettings: EconomicCalendarFilterSettings =
    calendar?.economic_calendar_filters || DEFAULT_FILTER_SETTINGS;
  const selectedCurrencies = filterSettings.currencies;
  const selectedImpacts = filterSettings.impacts;
  const notificationsEnabled = filterSettings.notificationsEnabled;

  const updateFilters = useCallback(
    (patch: Partial<EconomicCalendarFilterSettings>) => {
      if (!calendar?.id || !onUpdateCalendarProperty || isReadOnly) return;
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

  const goToWeek = (delta: number) => {
    const next = addWeeks(weekStart, delta);
    setWeekStart(next);
    const offset = Math.max(
      0,
      Math.min(
        6,
        Math.round((selectedDay.getTime() - weekStart.getTime()) / 86_400_000)
      )
    );
    setSelectedDay(addDays(next, offset));
  };
  const goToThisWeek = () => {
    const today = new Date();
    setWeekStart(startOfWeek(today, { weekStartsOn: 0 }));
    setSelectedDay(today);
  };
  const handleDatePick = (d: Date | null) => {
    if (!d) return;
    setWeekStart(startOfWeek(d, { weekStartsOn: 0 }));
    setSelectedDay(d);
  };

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
    [weekStart]
  );

  // Internal detail dialog used when no external onEventClick is wired up.
  const [internalSelected, setInternalSelected] = useState<EconomicEvent | null>(null);
  const handleEventClick = useCallback(
    (ev: EconomicEvent) => {
      if (onEventClick) onEventClick(ev);
      else setInternalSelected(ev);
    },
    [onEventClick]
  );
  const closeInternalDialog = useCallback(() => setInternalSelected(null), []);

  return (
    <Box
      sx={{
        flex: 1, minWidth: 0, minHeight: 0,
        display: 'flex', flexDirection: 'column',
        p: compact ? 2 : 0,
      }}
    >
      {/* Row 1: Tabs (left) + FilterPill + notifications (right) */}
      <Stack direction="row" alignItems="center" spacing={1.5}
        sx={{ mb: 1.75, flexWrap: 'wrap', rowGap: 1 }}>
        <HubTabs value={hubTab} onChange={setHubTab} theme={theme} />
        <Box sx={{ flex: 1 }} />
        <FilterPill
          selected={selectedImpacts}
          onToggle={toggleImpact}
          onSelectAll={setAllImpacts}
          theme={theme}
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

      {/* Row 2: Currency chips */}
      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap"
        sx={{ mb: 1.75, rowGap: 1 }}>
        <CurrencyChips selected={selectedCurrencies} onToggle={toggleCurrency} theme={theme} />
      </Stack>

      {/* Row 3: Date range (left) + week nav (right) */}
      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap"
        sx={{ mb: 2.75, rowGap: 1 }}>
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
              px: 1.25, py: 0.5, borderRadius: 1,
              fontSize: '0.8rem', fontWeight: 600,
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

      {/* DayRail + EventList */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: compact
            ? '1fr'
            : { xs: '1fr', md: '200px 1fr' },
          gridAutoRows: compact ? 'auto 1fr' : undefined,
          gap: { xs: 2, md: 3 },
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
        />
        <EventList
          label={format(selectedDay, 'EEE, MMM d')}
          events={selectedDayEvents}
          loading={loading}
          error={error}
          currentTime={currentTime}
          isPinned={isPinnedFor}
          getTradeCount={getCountForEvent}
          pinningEventId={pinningEventId}
          onPin={pin}
          onUnpin={unpin}
          onClickRow={handleEventClick}
          theme={theme}
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
