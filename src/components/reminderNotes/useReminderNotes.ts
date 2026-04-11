/**
 * useReminderNotes Hook
 * Manages reminder notes data fetching and real-time updates
 * Uses postgres_changes for reliable subscriptions
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { Note, DayAbbreviation } from '../../types/note';
import { getReminderNotesForDay } from '../../services/notesService';
import { logger } from '../../utils/logger';
import { supabase } from '../../config/supabase';

interface UseReminderNotesResult {
  notes: Note[];
  isLoading: boolean;
  currentDayAbbr: DayAbbreviation;
  fullDayName: string;
  reloadNotes: () => Promise<void>;
  updateNote: (updatedNote: Note) => void;
  removeNote: (noteId: string) => void;
}

export function useReminderNotes(calendarId: string): UseReminderNotesResult {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const currentDayAbbr = format(new Date(), 'EEE') as DayAbbreviation;
  const fullDayName = format(new Date(), 'EEEE');

  const loadReminderNotes = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedNotes = await getReminderNotesForDay(
        calendarId, currentDayAbbr
      );
      setNotes(fetchedNotes);
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

          if (eventType === 'INSERT' && newNote) {
            if (isReminderForTodayRef.current(newNote)) {
              setNotes((prev) => {
                if (prev.some((n) => n.id === newNote.id)) return prev;
                return [newNote, ...prev];
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
                if (idx >= 0) {
                  const updated = [...prev];
                  updated[idx] = newNote;
                  return updated;
                }
                return [newNote, ...prev];
              });
            } else if (wasRelevant && !isRelevant) {
              setNotes((prev) =>
                prev.filter((n) => n.id !== newNote.id)
              );
            }
          } else if (eventType === 'DELETE' && oldNote) {
            setNotes((prev) =>
              prev.filter((n) => n.id !== oldNote.id)
            );
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
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = updatedNote;
        return updated;
      }
      return prev;
    });
  }, []);

  const removeNote = useCallback((noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }, []);

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
