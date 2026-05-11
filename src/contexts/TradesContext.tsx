import React, { createContext, useContext, useMemo } from 'react';
import { Calendar, Trade } from '../types/dualWrite';
import { useCalendarTrades } from '../hooks/useCalendarTrades';
import { useSelectedCalendar } from './SelectedCalendarContext';

/**
 * Page-agnostic trade data + mutations for the currently selected calendar.
 *
 * Scope: DATA + DATA OPS only. UI orchestration (open edit dialog, zoom image,
 * open AI chat, etc.) lives on TradeCalendarPage and — when promoted to a
 * shared surface — will move to a separate TradeUIContext. Panels that need
 * UI ops should read them from that future context and gracefully disable
 * their buttons when it is not provided.
 *
 * The active calendar is keyed off SelectedCalendarContext so any panel
 * rendered anywhere in the app reflects the user's current calendar without
 * prop drilling. `useCalendarTrades` has a module-level cache, so two
 * instances of the hook for the same calendar (e.g. TradeCalendarPage + this
 * provider during the migration window) share cached data and don't
 * double-fetch.
 */

type CalendarTradesHookReturn = ReturnType<typeof useCalendarTrades>;

export interface TradesContextOps {
  addTrade: CalendarTradesHookReturn['addTrade'];
  deleteTrades: CalendarTradesHookReturn['deleteTrades'];
  handleUpdateTradeProperty: CalendarTradesHookReturn['handleUpdateTradeProperty'];
  handleUpdateCalendarProperty: CalendarTradesHookReturn['handleUpdateCalendarProperty'];
  handleImportTrades: CalendarTradesHookReturn['handleImportTrades'];
  handleAccountBalanceChange: CalendarTradesHookReturn['handleAccountBalanceChange'];
  handleToggleDynamicRisk: CalendarTradesHookReturn['handleToggleDynamicRisk'];
  loadMonthTrades: CalendarTradesHookReturn['loadMonthTrades'];
  loadVisibleRangeTrades: CalendarTradesHookReturn['loadVisibleRangeTrades'];
  onTagUpdated: CalendarTradesHookReturn['onTagUpdated'];
  isTradeUpdating: CalendarTradesHookReturn['isTradeUpdating'];
}

interface TradesContextValue {
  /** The active calendar id (from SelectedCalendarContext). Empty string when nothing is selected. */
  calendarId: string;
  /** The active Calendar object resolved from the calendars list, or null if not found. */
  calendar: Calendar | null;
  /** Trades for the active calendar — empty array while loading or when no calendar is selected. */
  trades: Trade[];
  /** True while the trades hook is fetching. */
  isLoading: boolean;
  /** Trade-data mutations (page-agnostic). Null when no calendar is selected. */
  ops: TradesContextOps | null;
}

const TradesContext = createContext<TradesContextValue | null>(null);

interface TradesProviderProps {
  /** All user calendars — used to resolve `calendarId` to the Calendar object. */
  calendars: Calendar[];
  /** Plumbed from App.tsx so the trades hook can drive the global loading indicator. */
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
  const selectedCalendar = useMemo(
    () => calendars.find((c) => c.id === calendarId) ?? null,
    [calendars, calendarId]
  );

  // When calendarId is empty (e.g. user not yet on a calendar), pass
  // undefined — the hook returns empty state without subscribing.
  const hook = useCalendarTrades({
    calendarId: calendarId || undefined,
    selectedCalendar,
    setLoading: (loading, action) => setLoading(loading, action ?? 'loading'),
  });

  const ops = useMemo<TradesContextOps | null>(() => {
    if (!calendarId) return null;
    return {
      addTrade: hook.addTrade,
      deleteTrades: hook.deleteTrades,
      handleUpdateTradeProperty: hook.handleUpdateTradeProperty,
      handleUpdateCalendarProperty: hook.handleUpdateCalendarProperty,
      handleImportTrades: hook.handleImportTrades,
      handleAccountBalanceChange: hook.handleAccountBalanceChange,
      handleToggleDynamicRisk: hook.handleToggleDynamicRisk,
      loadMonthTrades: hook.loadMonthTrades,
      loadVisibleRangeTrades: hook.loadVisibleRangeTrades,
      onTagUpdated: hook.onTagUpdated,
      isTradeUpdating: hook.isTradeUpdating,
    };
  }, [
    calendarId,
    hook.addTrade,
    hook.deleteTrades,
    hook.handleUpdateTradeProperty,
    hook.handleUpdateCalendarProperty,
    hook.handleImportTrades,
    hook.handleAccountBalanceChange,
    hook.handleToggleDynamicRisk,
    hook.loadMonthTrades,
    hook.loadVisibleRangeTrades,
    hook.onTagUpdated,
    hook.isTradeUpdating,
  ]);

  const value = useMemo<TradesContextValue>(
    () => ({
      calendarId,
      calendar: hook.calendar ?? selectedCalendar,
      trades: hook.trades ?? [],
      isLoading: hook.isLoading ?? false,
      ops,
    }),
    [calendarId, hook.calendar, selectedCalendar, hook.trades, hook.isLoading, ops]
  );

  return <TradesContext.Provider value={value}>{children}</TradesContext.Provider>;
};

export const useTradesContext = (): TradesContextValue => {
  const ctx = useContext(TradesContext);
  if (!ctx) {
    throw new Error('useTradesContext must be used within TradesProvider');
  }
  return ctx;
};

export const useTradesContextOptional = (): TradesContextValue | null => {
  return useContext(TradesContext);
};
