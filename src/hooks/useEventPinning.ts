/**
 * useEventPinning Hook
 * Reusable hook for pinning/unpinning economic events to a calendar
 */

import { useState, useCallback } from 'react';
import { Calendar } from '../types/calendar';
import { EconomicEvent } from '../types/economicCalendar';
import { cleanEventNameForPinning, isEventPinned } from '../utils/eventNameUtils';
import { logger } from '../utils/logger';

interface UseEventPinningOptions {
  calendar?: Calendar;
  onUpdateCalendarProperty?: (
    calendarId: string,
    updateFn: (calendar: Calendar) => Calendar
  ) => Promise<Calendar | undefined>;
}

interface UseEventPinningResult {
  pinningEventId: string | null;
  handlePinEvent: (event: EconomicEvent) => Promise<void>;
  handleUnpinEvent: (event: EconomicEvent) => Promise<void>;
  isEventCurrentlyPinned: (event: EconomicEvent) => boolean;
}

export function useEventPinning({
  calendar,
  onUpdateCalendarProperty
}: UseEventPinningOptions): UseEventPinningResult {
  const [pinningEventId, setPinningEventId] = useState<string | null>(null);

  const handlePinEvent = useCallback(async (event: EconomicEvent) => {
    if (!calendar?.id || !onUpdateCalendarProperty) {
      logger.warn('Cannot pin event: calendar or onUpdateCalendarProperty not available');
      return;
    }

    try {
      setPinningEventId(event.id);
      await onUpdateCalendarProperty(calendar.id, (cal: Calendar) => {
        const currentPinnedEvents = cal.pinned_events || [];
        const cleanedEventName = cleanEventNameForPinning(event.event_name);

        // Check if already pinned to prevent duplicates
        if (isEventPinned(event, currentPinnedEvents)) {
          logger.log(`Event already pinned: ${event.event_name}`);
          return cal;
        }

        return {
          ...cal,
          pinned_events: [...currentPinnedEvents, {
            event: cleanedEventName,
            event_id: event.id,
            notes: '',
            impact: event.impact,
            currency: event.currency,
            flag_url: event.flag_url,
            country: event.country
          }]
        };
      });
      logger.log(`📌 Successfully pinned event: ${event.event_name} (ID: ${event.id})`);
    } catch (error) {
      logger.error('Error pinning event:', error);
    } finally {
      setPinningEventId(null);
    }
  }, [calendar?.id, onUpdateCalendarProperty]);

  const handleUnpinEvent = useCallback(async (event: EconomicEvent) => {
    if (!calendar?.id || !onUpdateCalendarProperty) {
      logger.warn('Cannot unpin event: calendar or onUpdateCalendarProperty not available');
      return;
    }

    try {
      setPinningEventId(event.id);
      await onUpdateCalendarProperty(calendar.id, (cal: Calendar) => {
        const currentPinnedEvents = cal.pinned_events || [];
        return {
          ...cal,
          pinned_events: currentPinnedEvents.filter(pinnedEvent =>
            pinnedEvent.event_id
              ? pinnedEvent.event_id !== event.id
              : pinnedEvent.event.toLowerCase() !==
                  cleanEventNameForPinning(event.event_name).toLowerCase()
          )
        };
      });
      logger.log(`📌 Successfully unpinned event: ${event.event_name} (ID: ${event.id})`);
    } catch (error) {
      logger.error('Error unpinning event:', error);
    } finally {
      setPinningEventId(null);
    }
  }, [calendar?.id, onUpdateCalendarProperty]);

  const isEventCurrentlyPinned = useCallback((event: EconomicEvent): boolean => {
    return isEventPinned(event, calendar?.pinned_events || []);
  }, [calendar?.pinned_events]);

  return {
    pinningEventId,
    handlePinEvent,
    handleUnpinEvent,
    isEventCurrentlyPinned
  };
}
