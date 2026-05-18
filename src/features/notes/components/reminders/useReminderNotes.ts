/**
 * useReminderNotes Hook
 * Manages reminder notes data fetching and real-time updates
 * Uses postgres_changes for reliable subscriptions
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { Note, DayAbbreviation } from 'features/notes/types/note';
import { getReminderNotesForDay } from 'features/notes/services/notesService';
import { logger } from 'utils/logger';
import { supabase } from 'config/supabase';

interface UseReminderNotesResult {
  notes: Note[];
  isLoading: boolean;
  currentDayAbbr: DayAbbreviation;
  fullDayName: string;
  reloadNotes: () => Promise<void>;
  updateNote: (updatedNote: Note) => void;
  removeNote: (noteId: string) => void;
}

/**
 * Module-level cache for reminder notes, keyed by `${calendarId}|${dayAbbr}`.
 * Survives hook unmount so navigating Home → Performance → Home doesn't
 * trigger a refetch + flicker. Realtime postgres_changes subscription mutates
 * the cached array in place via updateNote/removeNote, keeping it fresh.
 */
const reminderNotesCache = new Map<string, Note[]>();

function makeReminderCacheKey(calendarId: string, dayAbbr: DayAbbreviation) {
  return `${calendarId}|${dayAbbr}`;
}

export function useReminderNotes(calendarId: string): UseReminderNotesResult {
  const currentDayAbbr = format(new Date(), 'EEE') as DayAbbreviation;
  const fullDayName = format(new Date(), 'EEEE');

  // Hydrate from module cache on first render so cards show instantly on
  // remount. Background revalidate runs after.
  const [notes, setNotes] = useState<Note[]>(
    () => reminderNotesCache.get(makeReminderCacheKey(calendarId, currentDayAbbr)) ?? []
  );
  const [isLoading, setIsLoading] = useState(
    () => !reminderNotesCache.has(makeReminderCacheKey(calendarId, currentDayAbbr))
  );

  const loadReminderNotes = useCallback(async () => {
    const cacheKey = makeReminderCacheKey(calendarId, currentDayAbbr);
    // Only show shimmer when we have nothing to display yet.
    if (!reminderNotesCache.has(cacheKey)) {
      setIsLoading(true);
    }
    try {
      const fetchedNotes = await getReminderNotesForDay(
        calendarId, currentDayAbbr
      );
      setNotes(fetchedNotes);
      reminderNotesCache.set(cacheKey, fetchedNotes);
    } catch (error) {
      logger.error('Error loading reminder notes:', error);
      setNotes([]);
    } finally {
      setIsLoading(false);
    }
  }, [calendarId, currentDayAbbr]);

  useEffect(() => {
    loadReminderNotes();
  }, [loadReminderNotes]);

  const isReminderForToday = useCallback(
    (note: Note | null): boolean => {
      if (!note || !note.is_reminder_active || note.is_archived) {
        return false;
      }
      return (
        note.reminder_type === 'weekly' &&
        !!note.reminder_days?.includes(currentDayAbbr)
      );
    },
    [currentDayAbbr]
  );

  // Refs for stable subscription callbacks
  const isReminderForTodayRef = useRef(isReminderForToday);
  isReminderForTodayRef.current = isReminderForToday;
  const calendarIdRef = useRef(calendarId);
  calendarIdRef.current = calendarId;

  // Unique channel per hook instance (postgres_changes doesn't
  // need to match a specific topic like broadcast does)
  const channelIdRef = useRef(
    `notes-pg-${Math.random().toString(36).slice(2, 8)}`
  );

  // Direct postgres_changes subscription
  useEffect(() => {
    if (!calendarId) return;

    const channelName = channelIdRef.current;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          // No filter — global notes have calendar_id=null,
          // so we filter in the handler instead
        },
        (payload: any) => {
          const { eventType } = payload;
          const newNote = payload.new as Note | undefined;
          const oldNote = payload.old as Note | undefined;

          // Allow global notes (calendar_id is null/undefined) and
          // notes belonging to this calendar. Skip other calendars.
          const noteCalendarId = newNote?.calendar_id;
          if (noteCalendarId && noteCalendarId !== calendarIdRef.current) {
            return;
          }

          const cacheKey = makeReminderCacheKey(
            calendarIdRef.current,
            currentDayAbbr,
          );

          if (eventType === 'INSERT' && newNote) {
            if (isReminderForTodayRef.current(newNote)) {
              setNotes((prev) => {
                if (prev.some((n) => n.id === newNote.id)) return prev;
                const next = [newNote, ...prev];
                reminderNotesCache.set(cacheKey, next);
                return next;
              });
            }
          } else if (eventType === 'UPDATE' && newNote) {
            const isRelevant = isReminderForTodayRef.current(newNote);
            const wasRelevant = oldNote
              ? isReminderForTodayRef.current(oldNote)
              : false;

            if (isRelevant) {
              setNotes((prev) => {
                const idx = prev.findIndex((n) => n.id === newNote.id);
                let next: Note[];
                if (idx >= 0) {
                  next = [...prev];
                  next[idx] = newNote;
                } else {
                  next = [newNote, ...prev];
                }
                reminderNotesCache.set(cacheKey, next);
                return next;
              });
            } else if (wasRelevant && !isRelevant) {
              setNotes((prev) => {
                const next = prev.filter((n) => n.id !== newNote.id);
                reminderNotesCache.set(cacheKey, next);
                return next;
              });
            }
          } else if (eventType === 'DELETE' && oldNote) {
            setNotes((prev) => {
              const next = prev.filter((n) => n.id !== oldNote.id);
              reminderNotesCache.set(cacheKey, next);
              return next;
            });
          }
        }
      )
      .subscribe((status: string) => {
        // eslint-disable-next-line no-console
        console.log(`[ReminderNotes] channel ${channelName}: ${status}`);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [calendarId]);

  const updateNote = useCallback((updatedNote: Note) => {
    setNotes((prev) => {
      const index = prev.findIndex((n) => n.id === updatedNote.id);
      if (index < 0) return prev;
      const updated = [...prev];
      updated[index] = updatedNote;
      reminderNotesCache.set(
        makeReminderCacheKey(calendarId, currentDayAbbr),
        updated,
      );
      return updated;
    });
  }, [calendarId, currentDayAbbr]);

  const removeNote = useCallback((noteId: string) => {
    setNotes((prev) => {
      const filtered = prev.filter((n) => n.id !== noteId);
      reminderNotesCache.set(
        makeReminderCacheKey(calendarId, currentDayAbbr),
        filtered,
      );
      return filtered;
    });
  }, [calendarId, currentDayAbbr]);

  return {
    notes,
    isLoading,
    currentDayAbbr,
    fullDayName,
    reloadNotes: loadReminderNotes,
    updateNote,
    removeNote,
  };
}
