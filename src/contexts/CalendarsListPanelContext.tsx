import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Calendar } from '../types/calendar';

/**
 * Bundles every callback CalendarsListContent needs (select / edit / duplicate
 * / link / delete / restore / permanent-delete + the property updater). Built
 * once at App level so the inline panel (lg+) and drawer (<lg) share wiring.
 */
export interface CalendarsListPanelActions {
  onCalendarClick: (id: string) => void;
  onEditCalendar: (cal: Calendar) => void;
  onDuplicateCalendar: (cal: Calendar) => void;
  onLinkCalendar: (cal: Calendar) => void;
  onDeleteCalendar: (id: string) => void;
  onUpdateCalendarProperty: (
    id: string,
    updateCallback: (calendar: Calendar) => Calendar
  ) => Promise<Calendar | undefined>;
  onRestoreCalendar: (id: string) => Promise<void>;
  onPermanentDeleteCalendar: (id: string) => Promise<void>;
}

interface CalendarsListPanelContextValue {
  open: boolean;
  openPanel: () => void;
  closePanel: () => void;
  actions: CalendarsListPanelActions;
}

const CalendarsListPanelContext = createContext<CalendarsListPanelContextValue | null>(null);

interface CalendarsListPanelProviderProps {
  actions: CalendarsListPanelActions;
  children: React.ReactNode;
}

export const CalendarsListPanelProvider: React.FC<CalendarsListPanelProviderProps> = ({
  actions,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const openPanel = useCallback(() => setOpen(true), []);
  const closePanel = useCallback(() => setOpen(false), []);

  const value = useMemo<CalendarsListPanelContextValue>(
    () => ({ open, openPanel, closePanel, actions }),
    [open, openPanel, closePanel, actions]
  );

  return (
    <CalendarsListPanelContext.Provider value={value}>
      {children}
    </CalendarsListPanelContext.Provider>
  );
};

/**
 * Returns the panel state + wired actions. Throws when used outside the
 * provider, so callers fail fast rather than silently no-op.
 */
export const useCalendarsListPanel = (): CalendarsListPanelContextValue => {
  const ctx = useContext(CalendarsListPanelContext);
  if (!ctx) {
    throw new Error(
      'useCalendarsListPanel must be used within a CalendarsListPanelProvider'
    );
  }
  return ctx;
};

/** Optional variant — returns null when outside a provider. Used by trees
 *  (e.g. signed-out routes) that conditionally render the trigger. */
export const useCalendarsListPanelOptional = (): CalendarsListPanelContextValue | null => {
  return useContext(CalendarsListPanelContext);
};
