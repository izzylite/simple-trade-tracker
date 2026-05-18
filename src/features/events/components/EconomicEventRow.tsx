/**
 * EconomicEventRow
 *
 * Canonical single-event row used by every events surface in the app
 * (the standalone events page, the side panel, the trade-gallery
 * Events panel). Extracted out of EconomicEventsView so multiple hosts
 * can share one layout — no more parallel item implementations.
 *
 * Includes the realtime countdown badge, "now" pulsing indicator,
 * imminent/passed states, actual/forecast/previous value pills,
 * impact bars, trade-count chip, and pin toggle.
 */

import React, { useMemo } from 'react';
import {
  Box,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import {
  Check as CheckIcon,
  HourglassEmpty as HourglassEmptyIcon,
  PushPin as PinIcon,
  PushPinOutlined as UnpinIcon,
  StickyNote2 as NoteIcon,
} from '@mui/icons-material';

import { format, isAfter, parseISO } from 'date-fns';

import { EconomicEvent, ImpactLevel } from 'features/events/types/economicCalendar';

// ─── Time helpers ─────────────────────────────────────────────────────────────
// Live in this file (not EconomicEventsView) so importing this row
// component doesn't create a circular dependency with the view, which
// previously broke the dev bundle with "Cannot access
// '__WEBPACK_DEFAULT_EXPORT__' before initialization".

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

export const computeTimeInfo = (
  timeUtc: string,
  currentTime: Date,
): TimeInfo => {
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

// ─── Visual helpers ───────────────────────────────────────────────────────────

export const impactColor = (impact: ImpactLevel, theme: Theme): string => {
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

export const getActualResultStyle = (
  actualResultType: string | undefined,
  theme: Theme,
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

// ─── ValuePill ────────────────────────────────────────────────────────────────

export const ValuePill: React.FC<{
  label: string;
  bg: string;
  border: string;
  color: string;
}> = ({ label, bg, border, color }) => (
  <Box
    sx={{
      px: 0.875,
      py: 0.25,
      borderRadius: 0.75,
      bgcolor: bg,
      border: `1px solid ${border}`,
      color,
      fontSize: '0.7rem',
      fontWeight: 700,
      fontFeatureSettings: "'tnum' on, 'lnum' on",
      lineHeight: 1.4,
    }}
  >
    {label}
  </Box>
);

// ─── ImpactBars ───────────────────────────────────────────────────────────────

export const ImpactBars: React.FC<{ impact: ImpactLevel; theme: Theme }> = ({
  impact,
  theme,
}) => {
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

// ─── EconomicEventRow ─────────────────────────────────────────────────────────

export interface EconomicEventRowProps {
  event: EconomicEvent;
  firstRow?: boolean;
  isNow?: boolean;
  pinned?: boolean;
  busy?: boolean;
  tradeCount?: number;
  /** User notes attached to the pin record. Renders a tooltip-icon
   *  inline with the time stack when set. */
  pinnedNotes?: string;
  currentTime: Date;
  onTogglePin?: (e: React.MouseEvent) => void;
  onClick?: () => void;
  theme: Theme;
}

const EconomicEventRow: React.FC<EconomicEventRowProps> = ({
  event,
  firstRow = false,
  isNow = false,
  pinned = false,
  busy = false,
  tradeCount = 0,
  pinnedNotes,
  currentTime,
  onTogglePin,
  onClick,
  theme,
}) => {
  const timeInfo = useMemo(
    () => computeTimeInfo(event.time_utc, currentTime),
    [event.time_utc, currentTime],
  );
  const actualStyle = getActualResultStyle(event.actual_result_type, theme);
  const hasAnyValue = Boolean(
    event.actual_value || event.forecast_value || event.previous_value,
  );

  const nowDotSx = isNow
    ? {
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 6,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 6,
          height: 6,
          borderRadius: '50%',
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

  const imminentBg = timeInfo.isImminent
    ? alpha(impactColor(event.impact, theme), 0.12)
    : null;

  return (
    <Box
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        px: 2.25,
        py: 1.75,
        borderTop: firstRow ? 'none' : `1px solid ${theme.palette.divider}`,
        bgcolor: isNow
          ? alpha(theme.palette.primary.main, 0.16)
          : imminentBg ?? 'transparent',
        opacity: timeInfo.isPassed ? 0.62 : 1,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 180ms, opacity 180ms',
        '&:hover': onClick
          ? {
              bgcolor: isNow
                ? alpha(theme.palette.primary.main, 0.2)
                : alpha(theme.palette.primary.main, 0.04),
            }
          : undefined,
        ...nowDotSx,
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '52px 1fr auto auto',
          gap: 1.5,
          alignItems: 'flex-start',
        }}
      >
      <Box
        sx={{
          minWidth: 36,
          mt: 0.25,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.5,
        }}
      >
        {event.flag_url ? (
          <Box
            component="img"
            src={event.flag_url}
            alt={event.country || event.currency || ''}
            sx={{
              width: 22,
              height: 16,
              borderRadius: 0.375,
              objectFit: 'cover',
              border: `1px solid ${alpha(theme.palette.divider, 0.4)}`,
            }}
          />
        ) : (
          <Box
            sx={{
              width: 22,
              height: 16,
              borderRadius: 0.375,
              bgcolor: alpha(theme.palette.text.primary, 0.06),
            }}
          />
        )}
        <Typography
          sx={{
            fontSize: '0.66rem',
            fontWeight: 700,
            letterSpacing: '0.02em',
            color: 'text.primary',
            lineHeight: 1,
          }}
        >
          {event.currency}
        </Typography>
      </Box>

      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
          <Typography
            sx={{
              fontSize: '0.78rem',
              fontWeight: 600,
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
                fontSize: '0.66rem',
                fontWeight: 700,
                color: timeInfo.isImminent ? 'error.main' : 'warning.main',
                animation: timeInfo.isImminent
                  ? 'eventCountdownPulse 1s infinite'
                  : 'none',
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
          {pinnedNotes && (
            <Tooltip title={pinnedNotes} arrow placement="top">
              <NoteIcon
                sx={{
                  fontSize: 13,
                  color: alpha(theme.palette.info.main, 0.7),
                  cursor: 'help',
                }}
              />
            </Tooltip>
          )}
        </Stack>

        <Typography
          sx={{
            fontSize: '0.92rem',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: 'text.primary',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {event.event_name}
        </Typography>

      </Box>

      <Box sx={{ pt: 0.5 }}>
        <ImpactBars impact={event.impact} theme={theme} />
      </Box>

      {onTogglePin && (
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
      )}
      </Box>

      {(hasAnyValue || tradeCount > 0) && (
        <Stack
          direction="row"
          spacing={0.875}
          alignItems="center"
          flexWrap="nowrap"
          sx={{
            mt: 0.875,
            pl: '64px',
            minWidth: 0,
            overflowX: 'auto',
            '&::-webkit-scrollbar': { display: 'none' },
            scrollbarWidth: 'none',
            '& > *': { flexShrink: 0 },
          }}
        >
          {hasAnyValue && (
            <>
              {event.actual_value ? (
                <ValuePill
                  label={`A: ${event.actual_value}`}
                  bg={actualStyle.bg}
                  border={actualStyle.border}
                  color={actualStyle.color}
                />
              ) : (
                (event.forecast_value || event.previous_value) && (
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Typography
                      sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.disabled' }}
                    >
                      A:
                    </Typography>
                    <HourglassEmptyIcon sx={{ fontSize: 12, color: 'warning.main' }} />
                  </Stack>
                )
              )}
              {event.forecast_value && (
                <ValuePill
                  label={`F: ${event.forecast_value}`}
                  bg={alpha(theme.palette.info.main, 0.1)}
                  border={alpha(theme.palette.info.main, 0.2)}
                  color={theme.palette.text.secondary}
                />
              )}
              {event.previous_value && (
                <ValuePill
                  label={`P: ${event.previous_value}`}
                  bg={alpha(theme.palette.grey[500], 0.1)}
                  border={alpha(theme.palette.grey[500], 0.2)}
                  color={theme.palette.text.disabled}
                />
              )}
            </>
          )}
          {tradeCount > 0 && (
            <Tooltip
              title={`Traded ${tradeCount} time${tradeCount > 1 ? 's' : ''} across all calendars`}
              placement="top"
              arrow
            >
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.375,
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 0.75,
                  bgcolor: alpha(theme.palette.primary.main, 0.14),
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.28)}`,
                  color: theme.palette.primary.main,
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  lineHeight: 1.4,
                }}
              >
                {tradeCount}×
              </Box>
            </Tooltip>
          )}
        </Stack>
      )}
    </Box>
  );
};

export default EconomicEventRow;
