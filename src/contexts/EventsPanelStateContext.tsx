/**
 * EventsPanelStateContext
 *
 * Owns every piece of user-meaningful UI state for the Economic Events
 * panel so it survives the lg↔︎drawer breakpoint handoff (EconomicEventsView
 * unmounts in the inline slot and remounts in the <lg drawer). Without
 * this context, week navigation, selected day, active hub tab, and an
 * open detail dialog all reset on every resize across `lg`.
 *
 * Mounted once inside TradeCalendarPage above both the inline panel and
 * the <lg drawer. Filters (currencies, impacts, notifications) are NOT
 * hoisted because they already live on `calendar.economic_calendar_filters`
 * and are persisted server-side. Data (`useEconomicEvents`, pins, trade
 * counts) is fetched fresh per mount keyed off the hoisted week.
 */

import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { addDays, addWeeks, startOfWeek } from 'date-fns';
import { EconomicEvent } from '../types/economicCalendar';
import { HubTab } from '../components/economicCalendar/EconomicEventsView';

interface EventsPanelStateContextValue {
  // Week + day selection
  weekStart: Date;
  setWeekStart: React.Dispatch<React.SetStateAction<Date>>;
  selectedDay: Date;
  setSelectedDay: React.Dispatch<React.SetStateAction<Date>>;

  // Active hub tab (All / Upcoming / Releases)
  hubTab: HubTab;
  setHubTab: React.Dispatch<React.SetStateAction<HubTab>>;

  // Internal detail dialog (open event)
  internalSelected: EconomicEvent | null;
  setInternalSelected: React.Dispatch<React.SetStateAction<EconomicEvent | null>>;

  // Convenience navigation helpers (keep callsites slim)
  goToWeek: (delta: number) => void;
  goToThisWeek: () => void;
  handleDatePick: (d: Date | null) => void;
  /** Anchor week + day to a specific date (used by the `initialDate` prop). */
  anchorToDate: (d: Date) => void;
}

const EventsPanelStateContext =
  createContext<EventsPanelStateContextValue | null>(null);

interface ProviderProps {
  /** Optional seed for the initially selected day/week. Defaults to today. */
  initialDate?: Date;
  children: ReactNode;
}

export const EventsPanelStateProvider: React.FC<ProviderProps> = ({
  initialDate,
  children,
}) => {
  const initialAnchor = useMemo(() => initialDate || new Date(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(initialAnchor, { weekStartsOn: 0 }),
  );
  const [selectedDay, setSelectedDay] = useState<Date>(() => initialAnchor);
  const [hubTab, setHubTab] = useState<HubTab>('all');
  const [internalSelected, setInternalSelected] =
    useState<EconomicEvent | null>(null);

  const goToWeek = useCallback(
    (delta: number) => {
      const next = addWeeks(weekStart, delta);
      const offset = Math.max(
        0,
        Math.min(
          6,
          Math.round((selectedDay.getTime() - weekStart.getTime()) / 86_400_000),
        ),
      );
      setWeekStart(next);
      setSelectedDay(addDays(next, offset));
    },
    [weekStart, selectedDay],
  );

  const goToThisWeek = useCallback(() => {
    const today = new Date();
    setWeekStart(startOfWeek(today, { weekStartsOn: 0 }));
    setSelectedDay(today);
  }, []);

  const handleDatePick = useCallback((d: Date | null) => {
    if (!d) return;
    setWeekStart(startOfWeek(d, { weekStartsOn: 0 }));
    setSelectedDay(d);
  }, []);

  const anchorToDate = useCallback((d: Date) => {
    setWeekStart(startOfWeek(d, { weekStartsOn: 0 }));
    setSelectedDay(d);
  }, []);

  const value = useMemo<EventsPanelStateContextValue>(
    () => ({
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
    }),
    [
      weekStart,
      selectedDay,
      hubTab,
      internalSelected,
      goToWeek,
      goToThisWeek,
      handleDatePick,
      anchorToDate,
    ],
  );

  return (
    <EventsPanelStateContext.Provider value={value}>
      {children}
    </EventsPanelStateContext.Provider>
  );
};

export const useEventsPanelState = (): EventsPanelStateContextValue => {
  const ctx = useContext(EventsPanelStateContext);
  if (!ctx) {
    throw new Error(
      'useEventsPanelState must be used within EventsPanelStateProvider',
    );
  }
  return ctx;
};
