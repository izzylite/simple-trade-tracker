/**
 * useReminderNotes Hook
 * Manages reminder notes data fetching and real-time updates
 * Extracted from CalendarDayReminder component
 */

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Note, DayAbbreviation } from '../../types/note';
import { getReminderNotesForDay } from '../../services/notesService';
import { logger } from '../../utils/logger';
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription';

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

  // Get current day abbreviation
  const currentDayAbbr = format(new Date(), 'EEE') as DayAbbreviation;
  const fullDayName = format(new Date(), 'EEEE');

  // Load reminder notes for current day
  const loadReminderNotes = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedNotes = await getReminderNotesForDay(calendarId, currentDayAbbr);
      setNotes(fetchedNotes);
    } catch (error) {
      logger.error('Error loading reminder notes:', error);
      setNotes([]);
    } finally {
      setIsLoading(false);
    }
  }, [calendarId, currentDayAbbr]);

  // Initial load
  useEffect(() => {
    loadReminderNotes();
  }, [loadReminderNotes]);

  // Helper to check if a note is a reminder for the current day
  const isReminderForToday = useCallback((note: Note | null): boolean => {
    if (!note || !note.is_reminder_active || note.is_archived) return false;
    if (note.reminder_type === 'weekly' && note.reminder_days?.includes(currentDayAbbr)) {
      return true;
    }
    return false;
  }, [currentDayAbbr]);

  // Set up real-time subscription for reminder notes changes
  useRealtimeSubscription({
    channelName: `calendar-reminders-${calendarId}`,
    enabled: true,
    onChannelCreated: (channel) => {
      logger.log(`🔧 Setting up reminder notes broadcast subscription for calendar-${calendarId}`);

      // Listen for INSERT events
      channel.on(
        'broadcast',
        { event: 'INSERT' },
        (payload: any) => {
          if (payload.payload?.record) {
            const newNote = payload.payload.record as Note;
            logger.log(`➕ Note added via broadcast: ${newNote.id}`);

            if (isReminderForToday(newNote)) {
              setNotes((prev) => {
                const exists = prev.some((n) => n.id === newNote.id);
                if (exists) return prev;
                return [newNote, ...prev];
              });
            }
          }
        },
      );

      // Listen for UPDATE events
      channel.on(
        'broadcast',
        { event: 'UPDATE' },
        (payload: any) => {
          if (payload.payload?.record) {
            const newNote = payload.payload.record as Note;
            const oldNote = payload.payload.old_record as Note | null;
            logger.log(`✏️ Note updated via broadcast: ${newNote.id}`);

            const isCurrentlyRelevant = isReminderForToday(newNote);
            const wasRelevant = oldNote ? isReminderForToday(oldNote) : false;

            if (isCurrentlyRelevant) {
              setNotes((prev) => {
                const index = prev.findIndex((n) => n.id === newNote.id);
                if (index >= 0) {
                  const updated = [...prev];
                  updated[index] = newNote;
                  return updated;
                } else {
                  return [newNote, ...prev];
                }
              });
            } else if (wasRelevant && !isCurrentlyRelevant) {
              setNotes((prev) => prev.filter((n) => n.id !== newNote.id));
            }
          }
        },
      );

      // Listen for DELETE events
      channel.on(
        'broadcast',
        { event: 'DELETE' },
        (payload: any) => {
          if (payload.payload?.old_record) {
            const oldNote = payload.payload.old_record as Note;
            logger.log(`🗑️ Note deleted via broadcast: ${oldNote.id}`);
            setNotes((prev) => prev.filter((n) => n.id !== oldNote.id));
          }
        },
      );
    },
    onSubscribed: () => {
      logger.log(`✅ Reminder notes broadcast subscription ACTIVE for calendar-${calendarId}`);
    },
    onError: (error) => {
      logger.error(`❌ Reminder notes broadcast subscription ERROR for calendar-${calendarId}:`, error);
    },
  });

  // Update a note in the local state (optimistic update)
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

  // Remove a note from the local state (optimistic update)
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
