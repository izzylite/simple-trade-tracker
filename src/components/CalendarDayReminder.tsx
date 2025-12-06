/**
 * CalendarDayReminder Component
 * Displays reminder notes for the current day
 * Supports multiple reminders with navigation
 */

import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import {
  Box,
  Paper,
  Typography,
  Divider,
  IconButton,
  alpha,
  useTheme,
} from '@mui/material';
import {
  EventNote as EventNoteIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Edit as EditIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';

import NoteEditorDialog from './notes/NoteEditorDialog';
import { Note, DayAbbreviation } from '../types/note';
import { getReminderNotesForDay } from '../services/notesService';
import { logger } from '../utils/logger';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import RichTextEditor from './common/RichTextEditor';

interface CalendarDayReminderProps {
  calendarId: string;
  // Callback when reminder note's cover image changes (for hero image override)
  onReminderImageChange?: (imageUrl: string | null) => void;
}

const CalendarDayReminder: React.FC<CalendarDayReminderProps> = ({
  calendarId,
  onReminderImageChange,
}) => {
  const theme = useTheme();
  const [reminderNotes, setReminderNotes] = useState<Note[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHidden, setIsHidden] = useState(() => {
    const saved = localStorage.getItem(`dayReminder-hidden-${calendarId}`) || 'false';
    return saved === 'true';
  });
  const [editorOpen, setEditorOpen] = useState(false);

  // Get current day abbreviation
  const currentDayAbbr = format(new Date(), 'EEE') as DayAbbreviation;
  const fullDayName = format(new Date(), 'EEEE');

  // Load reminder notes for current day
  const loadReminderNotes = useCallback(async () => {
    try {
      const notes = await getReminderNotesForDay(calendarId, currentDayAbbr);
      setReminderNotes(notes);
      // Reset to first note when notes change
      setCurrentIndex(0);
    } catch (error) {
      logger.error('Error loading reminder notes:', error);
      setReminderNotes([]);
    }
  }, [calendarId, currentDayAbbr]);

  // Initial load
  useEffect(() => {
    loadReminderNotes();
  }, [loadReminderNotes]);

  // Store callback in ref to avoid triggering effect on callback changes
  const onReminderImageChangeRef = React.useRef(onReminderImageChange);
  onReminderImageChangeRef.current = onReminderImageChange;

  // Notify parent of current note's cover image for hero image override
  useEffect(() => {
    const currentNote = reminderNotes[currentIndex];
    const coverImage = currentNote?.cover_image || null;
    onReminderImageChangeRef.current?.(coverImage);
  }, [reminderNotes, currentIndex]);

  // Separate cleanup effect that only runs on unmount
  useEffect(() => {
    return () => {
      onReminderImageChangeRef.current?.(null);
    };
  }, []);

  // Set up real-time subscription for reminder notes changes
  // Uses Supabase broadcast feature
  useRealtimeSubscription({
    channelName: `calendar-reminders-${calendarId}`,
    enabled: true,
    onChannelCreated: (channel) => {
      logger.log(`🔧 Setting up reminder notes broadcast subscription for calendar-${calendarId}`);

      // Helper to check if a note is a reminder for the current day
      const isReminderForToday = (note: Note | null): boolean => {
        if (!note || !note.is_reminder_active || note.is_archived) return false;
        if (note.reminder_type === 'weekly' && note.reminder_days?.includes(currentDayAbbr)) {
          return true;
        }
        return false;
      };

      // Listen for INSERT events
      channel.on(
        'broadcast',
        {
          event: 'INSERT',
        },
        (payload: any) => {
          if (payload.payload?.record) {
            const newNote = payload.payload.record as Note;
            logger.log(`➕ Note added via broadcast: ${newNote.id}`);

            // Add new note if it's a reminder for today
            if (isReminderForToday(newNote)) {
              setReminderNotes((prev) => {
                const exists = prev.some((n) => n.id === newNote.id);
                if (exists) return prev;
                return [newNote, ...prev]; // Add to beginning (most recent first)
              });
            }
          }
        },
      );

      // Listen for UPDATE events
      channel.on(
        'broadcast',
        {
          event: 'UPDATE',
        },
        (payload: any) => {
          if (payload.payload?.record) {
            const newNote = payload.payload.record as Note;
            const oldNote = payload.payload.old_record as Note | null;
            logger.log(`✏️ Note updated via broadcast: ${newNote.id}`);

            const isCurrentlyRelevant = isReminderForToday(newNote);
            const wasRelevant = oldNote ? isReminderForToday(oldNote) : false;

            if (isCurrentlyRelevant) {
              // Update existing note or add if it became relevant
              setReminderNotes((prev) => {
                const index = prev.findIndex((n) => n.id === newNote.id);
                if (index >= 0) {
                  // Update existing note
                  const updated = [...prev];
                  updated[index] = newNote;
                  return updated;
                } else {
                  // Note became a reminder for today
                  return [newNote, ...prev];
                }
              });
            } else if (wasRelevant && !isCurrentlyRelevant) {
              // Remove note if it's no longer relevant for today
              setReminderNotes((prev) => {
                const filtered = prev.filter((n) => n.id !== newNote.id);
                // Adjust current index if needed
                setCurrentIndex((currentIdx) => {
                  if (currentIdx >= filtered.length && filtered.length > 0) {
                    return filtered.length - 1;
                  }
                  return currentIdx;
                });
                return filtered;
              });
            }
          }
        },
      );

      // Listen for DELETE events
      channel.on(
        'broadcast',
        {
          event: 'DELETE',
        },
        (payload: any) => {
          if (payload.payload?.old_record) {
            const oldNote = payload.payload.old_record as Note;
            logger.log(`🗑️ Note deleted via broadcast: ${oldNote.id}`);

            // Remove deleted note
            setReminderNotes((prev) => {
              const filtered = prev.filter((n) => n.id !== oldNote.id);
              // Adjust current index if needed
              setCurrentIndex((currentIdx) => {
                if (currentIdx >= filtered.length && filtered.length > 0) {
                  return filtered.length - 1;
                }
                return currentIdx;
              });
              return filtered;
            });
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

  const handleToggleHidden = () => {
    const newHiddenState = !isHidden;
    setIsHidden(newHiddenState);
    localStorage.setItem(`dayReminder-hidden-${calendarId}`, newHiddenState.toString());
  };

  const handleEditNote = () => {
    setEditorOpen(true);
  };

  const handleCloseEditor = () => {
    setEditorOpen(false);
  };

  const handleNoteSaved = async (savedNote: Note, isCreated?: boolean) => {
    // Reload reminder notes after save
    try {
      const notes = await getReminderNotesForDay(calendarId, currentDayAbbr);
      setReminderNotes(notes);

      // If a note was created, navigate to it
      if (isCreated) {
        const newIndex = notes.findIndex(n => n.id === savedNote.id);
        if (newIndex >= 0) {
          setCurrentIndex(newIndex);
        }
      }
    } catch (error) {
      logger.error('Error reloading reminder notes:', error);
    }
  };

  const handleNoteDeleted = async () => {
    // Reload reminder notes after delete
    try {
      const notes = await getReminderNotesForDay(calendarId, currentDayAbbr);
      setReminderNotes(notes);
      // Adjust current index if needed
      if (currentIndex >= notes.length && notes.length > 0) {
        setCurrentIndex(notes.length - 1);
      }
    } catch (error) {
      logger.error('Error reloading reminder notes:', error);
    }
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : reminderNotes.length - 1));
  };

  const handleNext = () => {
   setCurrentIndex((prev) => (prev < reminderNotes.length - 1 ? prev + 1 : 0));
  };

  // Don't render if no reminders for today
  if (reminderNotes.length === 0) {
    return null;
  }

  const currentNote = reminderNotes[currentIndex];
  const hasMultipleNotes = reminderNotes.length > 1;

  return (
    <>
      <Paper
        elevation={3}
        sx={{
          overflow: 'hidden',
          borderRadius: 0,
          backgroundColor: alpha(theme.palette.background.paper, 0.5),
          transition: 'all 0.3s ease',
          boxShadow: `0 2px 8px ${alpha(theme.palette.grey[500], 0.1)}`,
           
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1,
            
            borderBottom: `1px solid ${theme.palette.divider}`,
            backgroundColor: alpha(theme.palette.info.main, 0.05),
            borderLeft: `4px solid ${theme.palette.info.main}`,
          }}
        >
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <EventNoteIcon sx={{ fontSize: '1rem', color: 'info.main' }} />
              <Typography
                variant="subtitle2"
                sx={{
                  fontSize: '0.875rem',
                  color: 'info.main',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {fullDayName} Reminder
              </Typography>
              {hasMultipleNotes && (
                <Typography
                  variant="caption"
                  sx={{
                    ml: 1,
                    px: 1,
                    py: 0.25,
                    borderRadius: 1,
                    backgroundColor: alpha(theme.palette.info.main, 0.15),
                    color: 'info.main',
                    fontWeight: 600,
                    fontSize: '0.7rem',
                  }}
                >
                  {currentIndex + 1} of {reminderNotes.length}
                </Typography>
              )}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {/* Navigation buttons for multiple notes */}
              {hasMultipleNotes && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <IconButton
                    size="small"
                    onClick={handlePrevious}
                    sx={{ color: 'info.main' }}
                    title="Previous reminder"
                  >
                    <ChevronLeftIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={handleNext}
                    sx={{ color: 'info.main' }}
                    title="Next reminder"
                  >
                    <ChevronRightIcon fontSize="small" />
                  </IconButton>
                </Box>
              )}

              {/* Edit Note button */}
              <Box
                onClick={handleEditNote}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  cursor: 'pointer',
                  color: 'info.main',
                }}
              >
                <EditIcon fontSize="small" />
                <Typography
                  variant="body1"
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: 'text.main',
                    textTransform: 'none',
                  }}
                >
                  Edit Note
                </Typography>
              </Box>

              {/* Show/Hide toggle */}
              <Box
                onClick={handleToggleHidden}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  cursor: 'pointer',
                  color: 'info.main',
                }}
              >
                {isHidden ? (
                  <VisibilityIcon fontSize="small" />
                ) : (
                  <VisibilityOffIcon fontSize="small" />
                )}
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    textTransform: 'none',
                  }}
                >
                  {isHidden ? 'Show Note' : 'Hide Note'}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Note Content */}
          {!isHidden && (
            <>
              <Divider sx={{ my: 1, borderColor: theme.palette.divider, borderRadius: 1 }} />
              <Box
                onClick={handleEditNote}
                sx={{
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.info.main, 0.03),
                  },
                  transition: 'background-color 0.2s ease',
                  borderRadius: 1,
                  py: 0.5,
                }}
              >
                {/* Note Title */}
                {currentNote.title && currentNote.title.trim() !== '' && (
                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: 600,
                      color: 'text.primary',
                      mb: 0.5,
                    }}
                  >
                    {currentNote.title}
                  </Typography>
                )}

                {/* Note Content Preview - Styled with RichTextEditor */}
                <Box
                  sx={{
                    height: 65,
                    width: '100%',
                    overflow: 'hidden',
                    position: 'relative',
                    pointerEvents: 'none',
                    boxSizing: 'border-box',
                    // Multi-line truncation with line-clamp
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    // Disable all scrolling
                    '& *': {
                      overflow: 'hidden !important',
                      maxWidth: '100% !important',
                    },
                    '& .DraftEditor-root': {
                      fontSize: '0.875rem',
                      overflow: 'hidden',
                      lineHeight: 1.4,
                      width: '100%',
                    },
                    '& .DraftEditor-editorContainer, & .public-DraftEditor-content': {
                      overflow: 'hidden',
                      width: '100%',
                    },
                    '& .public-DraftStyleDefault-block': {
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      width: '100%',
                    },
                  }}
                >
                  <RichTextEditor
                    value={currentNote.content}
                    disabled
                    hideCharacterCount
                    minHeight={60}
                    maxHeight={65}
                  />
                </Box>

                {/* View more link */}
                <Typography
                  variant="caption"
                  sx={{
                    color: 'info.main',
                    fontWeight: 500,
                    mt: 0.5,
                    display: 'inline-block',
                    '&:hover': {
                      textDecoration: 'underline',
                    },
                  }}
                >
                  View full note →
                </Typography>
              </Box>
            </>
          )}
        </Box>
      </Paper>

      {/* Note Editor Dialog */}
      <NoteEditorDialog
        open={editorOpen}
        onClose={handleCloseEditor}
        note={currentNote}
        calendarId={calendarId}
        onSave={handleNoteSaved}
        onDelete={handleNoteDeleted}
      />
    </>
  );
};

export default CalendarDayReminder;
