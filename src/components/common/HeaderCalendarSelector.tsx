// src/components/common/HeaderCalendarSelector.tsx
import React, { useMemo } from 'react';
import { useNavigate, useMatch } from 'react-router-dom';
import { useAuthState } from '../../contexts/AuthStateContext';
import { useCalendars } from '../../hooks/useCalendars';
import { useSelectedCalendar } from '../../contexts/SelectedCalendarContext';
import CalendarSelectorBar, { CalendarSelectorItem } from './CalendarSelectorBar';

/**
 * Header-mounted calendar selector. Drives the global SelectedCalendarContext
 * and, when the user is on `/calendar/:calendarId`, navigates to the newly
 * selected calendar so the URL stays canonical.
 *
 * Returns null when there are no active calendars (lock-overlay surface
 * already prompts the user to create one).
 */
const HeaderCalendarSelector: React.FC = () => {
  const { user } = useAuthState();
  const { calendars } = useCalendars(user?.uid);
  const { calendarId, setCalendarId } = useSelectedCalendar();
  const navigate = useNavigate();
  const calendarRouteMatch = useMatch('/calendar/:calendarId');

  const activeCalendars = useMemo(
    () => (calendars || []).filter((c) => !c.deleted_at),
    [calendars]
  );

  const active = useMemo<CalendarSelectorItem>(() => {
    const cal = activeCalendars.find((c) => c.id === calendarId);
    if (cal) {
      return { id: cal.id, name: cal.name, hero_image_url: cal.hero_image_url };
    }
    return { id: '', name: 'Select calendar' };
  }, [activeCalendars, calendarId]);

  const recent = useMemo<CalendarSelectorItem[]>(() => {
    const sorted = [...activeCalendars].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
    const top3 = sorted.slice(0, 3);
    const includesActive = top3.some((c) => c.id === calendarId);
    const activeCal = !includesActive
      ? sorted.find((c) => c.id === calendarId)
      : undefined;
    const source = activeCal ? [activeCal, ...top3] : top3;
    return source.map((c) => ({
      id: c.id,
      name: c.name,
      totalTrades: c.total_trades,
      pnl: c.total_pnl,
      hero_image_url: c.hero_image_url,
      active: c.id === calendarId,
    }));
  }, [activeCalendars, calendarId]);

  if (activeCalendars.length === 0) return null;

  const handleSelect = (id: string) => {
    if (id === calendarId) return;
    setCalendarId(id);
    // When the user is on the Calendar surface, navigate so the URL reflects
    // the selection. On other routes (Performance, Notes) the context update
    // is enough — those pages read it directly.
    if (calendarRouteMatch) {
      navigate(`/calendar/${id}`);
    }
  };

  return (
    <CalendarSelectorBar
      active={active}
      recent={recent}
      onSelect={handleSelect}
    />
  );
};

export default HeaderCalendarSelector;
