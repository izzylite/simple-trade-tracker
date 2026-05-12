import React, { createContext, useContext, useMemo } from 'react';
import { Calendar, Trade } from '../types/dualWrite';
import { useCalendarTrades } from '../hooks/useCalendarTrades';
import { useSelectedCalendar } from './SelectedCalendarContext';
import { useAuthState } from './AuthStateContext';

/**
 * App-level trades context — wraps `useCalendarTrades` so any route can read
 * the active calendar's trades without spinning up a fresh subscription.
 * The hook keys on `calendarId`, so switching calendars cleanly tears down
 * the old realtime sub and opens a new one.
 */
interface TradesContextValue {
  calendarId: string;
  calendar: Calendar | null;
  trades: Trade[];
  isLoading: boolean;
  // Raw hook return — consumers pick what they need. Don't add ops wrappers
  // unless a consumer demands them.
  hook: ReturnType<typeof useCalendarTrades>;
}

export const TradesContext = createContext<TradesContextValue | null>(null);

interface TradesProviderProps {
  calendars: Calendar[];
  setLoading: (
    loading: boolean,
    loadingAction?: 'loading' | 'importing' | 'exporting'
  ) => void;
  children: React.ReactNode;
}

export const TradesProvider: React.FC<TradesProviderProps> = ({
  calendars,
  setLoading,
  children,
}) => {
  const { calendarId } = useSelectedCalendar();
  const { user } = useAuthState();
  const calendar = useMemo(
    () => calendars.find((c) => c.id === calendarId) ?? null,
    [calendars, calendarId]
  );
  // Disable realtime when the active calendar isn't owned by the signed-in
  // user (shared / read-only). Mirrors the gate TradeCalendarPage used to
  // apply locally before it consumed this context.
  const isReadOnly = !!calendar && !!user?.uid && calendar.user_id !== user.uid;
  const hook = useCalendarTrades({
    calendarId: calendarId || undefined,
    selectedCalendar: calendar,
    setLoading: (loading, action) => setLoading(loading, action ?? 'loading'),
    enableRealtime: !isReadOnly,
  });
  const value = useMemo<TradesContextValue>(
    () => ({
      calendarId,
      calendar: hook.calendar ?? calendar,
      trades: hook.trades ?? [],
      isLoading: hook.isLoading ?? false,
      hook,
    }),
    [calendarId, calendar, hook]
  );
  return (
    <TradesContext.Provider value={value}>{children}</TradesContext.Provider>
  );
};

export const useTradesContext = (): TradesContextValue => {
  const ctx = useContext(TradesContext);
  if (!ctx) throw new Error('useTradesContext must be used within TradesProvider');
  return ctx;
};

export const useTradesContextOptional = (): TradesContextValue | null =>
  useContext(TradesContext);
