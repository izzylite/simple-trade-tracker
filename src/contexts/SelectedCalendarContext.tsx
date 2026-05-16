import React, { createContext, useCallback, useContext, useState } from 'react';

export const SELECTED_CALENDAR_STORAGE_KEY = 'last_active_calendar_id';

interface SelectedCalendarContextValue {
  calendarId: string;
  setCalendarId: (id: string) => void;
}

const SelectedCalendarContext = createContext<SelectedCalendarContextValue | null>(null);

const readInitial = (): string => {
  try {
    return localStorage.getItem(SELECTED_CALENDAR_STORAGE_KEY) || '';
  } catch {
    return '';
  }
};

export const SelectedCalendarProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [calendarId, setCalendarIdState] = useState<string>(readInitial);

  const setCalendarId = useCallback((id: string) => {
    setCalendarIdState(id);
    try {
      if (id) localStorage.setItem(SELECTED_CALENDAR_STORAGE_KEY, id);
      else localStorage.removeItem(SELECTED_CALENDAR_STORAGE_KEY);
    } catch {
      // ignore quota / disabled storage
    }
  }, []);

  return (
    <SelectedCalendarContext.Provider value={{ calendarId, setCalendarId }}>
      {children}
    </SelectedCalendarContext.Provider>
  );
};

export const useSelectedCalendar = (): SelectedCalendarContextValue => {
  const ctx = useContext(SelectedCalendarContext);
  if (!ctx) {
    throw new Error('useSelectedCalendar must be used within SelectedCalendarProvider');
  }
  return ctx;
};
