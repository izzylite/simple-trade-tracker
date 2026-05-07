import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Stack,
  CircularProgress,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
} from '@mui/icons-material';
import { useAuthState } from '../contexts/AuthStateContext';
import { useCalendars } from '../hooks/useCalendars';
import { Calendar } from '../types/calendar';
import PerformanceCharts from '../components/PerformanceCharts';
import CalendarLockedOverlay from '../components/calendars/CalendarLockedOverlay';
import CalendarSelectorBar, {
  CalendarSelectorItem,
} from '../components/common/CalendarSelectorBar';

const STORAGE_KEY = 'perf_selected_calendar_id';
const SWITCH_SPINNER_MS = 350;
const APP_HEADER_HEIGHT = 64;

interface PerformancePageProps {
  /** Plumbed from App.tsx so calendar-property edits made from this page persist. */
  onUpdateCalendar?: (id: string, updates: Partial<Calendar>) => Promise<void> | void;
  /** Triggers the Create Calendar dialog when the lock overlay's CTA is clicked. */
  onCreateCalendar?: () => void;
}

/**
 * Cross-calendar entry point for performance analytics. The active calendar
 * for this page is selected via the CalendarSelectorBar header (same trigger
 * pattern as Home, for cohesion). Selection is local to this page and
 * persists in localStorage; switching shows a brief spinner overlay so the
 * PerformanceCharts remount feels intentional rather than abrupt.
 */
const PerformancePage: React.FC<PerformancePageProps> = ({
  onUpdateCalendar,
  onCreateCalendar,
}) => {
  const { user } = useAuthState();
  const { calendars, isLoading } = useCalendars(user?.uid);

  const activeCalendars = useMemo(
    () => (calendars || []).filter((c) => !c.deleted_at),
    [calendars]
  );

  const [selectedId, setSelectedId] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [isSwitching, setIsSwitching] = useState(false);
  const switchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Default to first calendar once data loads (or fall back if stored ID is gone)
  useEffect(() => {
    if (activeCalendars.length === 0) return;
    const stillExists = activeCalendars.some((c) => c.id === selectedId);
    if (!stillExists) {
      const fallback = activeCalendars[0].id;
      setSelectedId(fallback);
      try {
        localStorage.setItem(STORAGE_KEY, fallback);
      } catch {
        // ignore quota / disabled storage
      }
    }
  }, [activeCalendars, selectedId]);

  // Cleanup the switch timer on unmount
  useEffect(() => {
    return () => {
      if (switchTimerRef.current) clearTimeout(switchTimerRef.current);
    };
  }, []);

  const handleSelect = (id: string) => {
    if (id === selectedId) return;
    setIsSwitching(true);
    setSelectedId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore
    }
    if (switchTimerRef.current) clearTimeout(switchTimerRef.current);
    switchTimerRef.current = setTimeout(
      () => setIsSwitching(false),
      SWITCH_SPINNER_MS
    );
  };

  const selectedCalendar = activeCalendars.find((c) => c.id === selectedId);

  // Wrap App's onUpdateCalendar into the (calendarId, updateCallback) signature
  // PerformanceCharts expects.
  const onUpdateCalendarProperty = useMemo(() => {
    if (!onUpdateCalendar || !selectedCalendar) return undefined;
    return async (
      calendarId: string,
      updateCallback: (calendar: Calendar) => Calendar
    ): Promise<Calendar | undefined> => {
      const target = activeCalendars.find((c) => c.id === calendarId);
      if (!target) return undefined;
      const updated = updateCallback(target);
      await onUpdateCalendar(calendarId, updated);
      return updated;
    };
  }, [onUpdateCalendar, selectedCalendar, activeCalendars]);

  // Recent-calendars dropdown items for the header selector
  const recentItems = useMemo<CalendarSelectorItem[]>(() => {
    const sorted = [...activeCalendars].sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
    const top3 = sorted.slice(0, 3);
    const includesActive = top3.some((c) => c.id === selectedId);
    const activeCal = !includesActive
      ? sorted.find((c) => c.id === selectedId)
      : undefined;
    const source = activeCal ? [activeCal, ...top3] : top3;
    return source.map((cal) => ({
      id: cal.id,
      name: cal.name,
      totalTrades: cal.total_trades,
      pnl: cal.total_pnl,
      hero_image_url: cal.hero_image_url,
      active: cal.id === selectedId,
    }));
  }, [activeCalendars, selectedId]);

  const activeSelectorItem = useMemo<CalendarSelectorItem>(() => {
    if (selectedCalendar) {
      return {
        id: selectedCalendar.id,
        name: selectedCalendar.name,
        hero_image_url: selectedCalendar.hero_image_url,
      };
    }
    return { id: '', name: 'Select calendar' };
  }, [selectedCalendar]);

  // ---- Render ----

  if (isLoading && activeCalendars.length === 0) {
    return (
      <Box
        sx={{
          height: `calc(100vh - ${APP_HEADER_HEIGHT}px)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (activeCalendars.length === 0) {
    return (
      <Box
        sx={{
          position: 'relative',
          minHeight: `calc(100vh - ${APP_HEADER_HEIGHT}px)`,
        }}
      >
        <CalendarLockedOverlay
          onCreateCalendar={onCreateCalendar}
          subtitle="Create a calendar to start tracking trades and unlock performance analytics."
        />
      </Box>
    );
  }

  const pnl = selectedCalendar?.total_pnl ?? 0;
  const isPositive = pnl >= 0;
  const totalTrades = selectedCalendar?.total_trades ?? 0;

  return (
    <Box>
      {/* Header */}
      <CalendarSelectorBar
        active={activeSelectorItem}
        recent={recentItems}
        onSelect={handleSelect}
        rightContent={
          <Stack direction="row" spacing={2} alignItems="center" sx={{ pl: 2 }}>
            <Box sx={{ textAlign: 'right' }}>
              <Typography
                sx={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: 'text.secondary',
                  lineHeight: 1.1,
                }}
              >
                Trades
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.9375rem',
                  fontWeight: 700,
                  fontFeatureSettings: "'tnum' on, 'lnum' on",
                  color: 'text.primary',
                  mt: 0.25,
                  lineHeight: 1.1,
                }}
              >
                {totalTrades.toLocaleString()}
              </Typography>
            </Box>

            <Box sx={{ textAlign: 'right' }}>
              <Typography
                sx={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: 'text.secondary',
                  lineHeight: 1.1,
                }}
              >
                Total P&amp;L
              </Typography>
              <Stack
                direction="row"
                spacing={0.5}
                alignItems="center"
                justifyContent="flex-end"
                sx={{ mt: 0.25 }}
              >
                {isPositive ? (
                  <TrendingUpIcon
                    sx={{ fontSize: 14, color: 'success.main' }}
                  />
                ) : (
                  <TrendingDownIcon
                    sx={{ fontSize: 14, color: 'error.main' }}
                  />
                )}
                <Typography
                  sx={{
                    fontSize: '0.9375rem',
                    fontWeight: 700,
                    fontFeatureSettings: "'tnum' on, 'lnum' on",
                    color: isPositive ? 'success.main' : 'error.main',
                    lineHeight: 1.1,
                  }}
                >
                  {isPositive ? '+' : '-'}$
                  {Math.abs(pnl).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Typography>
              </Stack>
            </Box>
          </Stack>
        }
      />

      {/* Body */}
      <Box
        sx={{
          position: 'relative',
          px: { xs: 2, sm: 3, md: 4 },
          py: { xs: 2, sm: 3 },
          maxWidth: 1600,
          mx: 'auto',
        }}
      >
        {isSwitching || !selectedCalendar ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 12,
              gap: 2,
            }}
          >
            <CircularProgress size={28} />
            <Typography
              sx={{
                fontSize: '0.8125rem',
                color: 'text.secondary',
                letterSpacing: '0.02em',
              }}
            >
              Switching calendar
            </Typography>
          </Box>
        ) : (
          <PerformanceCharts
            key={selectedCalendar.id}
            calendarId={selectedCalendar.id}
            calendar={selectedCalendar}
            accountBalance={selectedCalendar.account_balance}
            maxDailyDrawdown={selectedCalendar.max_daily_drawdown}
            monthlyTarget={selectedCalendar.monthly_target}
            scoreSettings={selectedCalendar.score_settings}
            dynamicRiskSettings={{
              account_balance: selectedCalendar.account_balance,
              risk_per_trade: selectedCalendar.risk_per_trade,
              dynamic_risk_enabled: selectedCalendar.dynamic_risk_enabled,
              increased_risk_percentage: selectedCalendar.increased_risk_percentage,
              profit_threshold_percentage: selectedCalendar.profit_threshold_percentage,
            }}
            onUpdateCalendarProperty={onUpdateCalendarProperty}
            isReadOnly
          />
        )}
      </Box>
    </Box>
  );
};

export default PerformancePage;
