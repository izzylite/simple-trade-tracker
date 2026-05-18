import { render, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import {
  SelectedCalendarProvider,
  useSelectedCalendar,
  SELECTED_CALENDAR_STORAGE_KEY,
} from 'features/calendar/contexts/SelectedCalendarContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SelectedCalendarProvider>{children}</SelectedCalendarProvider>
);

describe('SelectedCalendarContext', () => {
  beforeEach(() => localStorage.clear());

  it('hydrates from localStorage on mount', () => {
    localStorage.setItem(SELECTED_CALENDAR_STORAGE_KEY, 'cal-123');
    const { result } = renderHook(() => useSelectedCalendar(), { wrapper });
    expect(result.current.calendarId).toBe('cal-123');
  });

  it('returns empty string when no stored value', () => {
    const { result } = renderHook(() => useSelectedCalendar(), { wrapper });
    expect(result.current.calendarId).toBe('');
  });

  it('persists setCalendarId writes', () => {
    const { result } = renderHook(() => useSelectedCalendar(), { wrapper });
    act(() => result.current.setCalendarId('cal-456'));
    expect(result.current.calendarId).toBe('cal-456');
    expect(localStorage.getItem(SELECTED_CALENDAR_STORAGE_KEY)).toBe('cal-456');
  });

  it('throws when used outside provider', () => {
    const renderOutside = () => renderHook(() => useSelectedCalendar());
    expect(renderOutside).toThrow(/SelectedCalendarProvider/);
  });
});
