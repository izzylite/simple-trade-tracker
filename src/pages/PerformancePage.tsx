import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Stack,
  FormControl,
  Select,
  MenuItem,
  CircularProgress,
  Avatar,
  alpha,
  useTheme,
  SelectChangeEvent,
} from '@mui/material';
import {
  ShowChart as PerformanceIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { useAuthState } from '../contexts/AuthStateContext';
import { useCalendars } from '../hooks/useCalendars';
import { Calendar } from '../types/calendar';
import PerformanceCharts from '../components/PerformanceCharts';
import { formatCurrency } from '../utils/formatters';

const STORAGE_KEY = 'perf_selected_calendar_id';
const SWITCH_SPINNER_MS = 350;

interface PerformancePageProps {
  /** Plumbed from App.tsx so calendar-property edits made from this page persist. */
  onUpdateCalendar?: (id: string, updates: Partial<Calendar>) => Promise<void> | void;
}

/**
 * Cross-calendar entry point for performance analytics. Picks one calendar at
 * a time via local dropdown (no global active-calendar sync) and renders the
 * existing PerformanceCharts component for it. Selection persists in
 * localStorage; switching shows a brief spinner so the transition feels
 * intentional.
 */
const PerformancePage: React.FC<PerformancePageProps> = ({
  onUpdateCalendar,
}) => {
  const theme = useTheme();
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

  const handleChange = (event: SelectChangeEvent<string>) => {
    const id = event.target.value;
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

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={{ xs: 2, sm: 3 }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        sx={{ mb: { xs: 2, sm: 3 } }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.12),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PerformanceIcon sx={{ color: 'primary.main' }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              Performance
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Detailed analytics for a single calendar
            </Typography>
          </Box>
        </Stack>

        {/* Calendar selector */}
        {activeCalendars.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 240 }}>
            <Select
              value={selectedId}
              onChange={handleChange}
              displayEmpty
              renderValue={(value) => {
                const cal = activeCalendars.find((c) => c.id === value);
                if (!cal) return <em>Select a calendar</em>;
                return (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Avatar
                      src={cal.hero_image_url || undefined}
                      variant="rounded"
                      sx={{
                        width: 24,
                        height: 24,
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                      }}
                    >
                      <CalendarIcon sx={{ fontSize: 14, color: 'primary.main' }} />
                    </Avatar>
                    <Typography
                      sx={{
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {cal.name}
                    </Typography>
                  </Stack>
                );
              }}
            >
              {activeCalendars.map((cal) => {
                const pnl = cal.total_pnl || 0;
                const isPositive = pnl >= 0;
                return (
                  <MenuItem key={cal.id} value={cal.id}>
                    <Stack
                      direction="row"
                      spacing={1.5}
                      alignItems="center"
                      sx={{ width: '100%' }}
                    >
                      <Avatar
                        src={cal.hero_image_url || undefined}
                        variant="rounded"
                        sx={{
                          width: 28,
                          height: 28,
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                        }}
                      >
                        <CalendarIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          sx={{
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {cal.name}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            color: isPositive ? 'success.main' : 'error.main',
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                          }}
                        >
                          {isPositive ? '+' : ''}
                          {formatCurrency(pnl)}
                          {' · '}
                          <Typography
                            component="span"
                            variant="caption"
                            color="text.secondary"
                            sx={{ fontSize: '0.6875rem' }}
                          >
                            {cal.total_trades || 0} trades
                          </Typography>
                        </Typography>
                      </Box>
                    </Stack>
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
        )}
      </Stack>

      {/* Body */}
      {isLoading ? (
        <CenteredSpinner label="Loading calendars" />
      ) : activeCalendars.length === 0 ? (
        <EmptyState />
      ) : isSwitching || !selectedCalendar ? (
        <CenteredSpinner label="Switching calendar" />
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
  );
};

const CenteredSpinner: React.FC<{ label: string }> = ({ label }) => (
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
    <CircularProgress size={32} />
    <Typography variant="body2" color="text.secondary">
      {label}…
    </Typography>
  </Box>
);

const EmptyState: React.FC = () => (
  <Box sx={{ textAlign: 'center', py: 12 }}>
    <PerformanceIcon
      sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }}
    />
    <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
      No calendars yet
    </Typography>
    <Typography variant="body2" color="text.secondary">
      Create a calendar to view performance analytics.
    </Typography>
  </Box>
);

export default PerformancePage;
