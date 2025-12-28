/**
 * StackedNotesWidget Component
 * Displays reminder notes as stacked cards in the bottom-left corner
 * Hover to fan out cards, click to open bottom sheet
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Box } from '@mui/material';
import { useReminderNotes } from './useReminderNotes';
import NoteCard from './NoteCard';
import PlaceholderNoteCard from './PlaceholderNoteCard';
import NotesBottomSheet from './NotesBottomSheet';
import { Z_INDEX } from '../../styles/zIndex';
import { Note } from '../../types/note';

interface StackedNotesWidgetProps {
  calendarId: string;
}

const MAX_VISIBLE_CARDS = 3;

const StackedNotesWidget: React.FC<StackedNotesWidgetProps> = ({ calendarId }) => {
  const { notes, isLoading, fullDayName, updateNote, removeNote } = useReminderNotes(calendarId);
  const [isHovered, setIsHovered] = useState(false);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const [initialNoteIndex, setInitialNoteIndex] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  // Trigger animation on first appearance
  useEffect(() => {
    if (!isLoading && notes.length > 0 && !hasAnimated) {
      setHasAnimated(true);
    }
  }, [isLoading, notes.length, hasAnimated]);

  // Get visible cards (max 3)
  const visibleNotes = notes.slice(0, MAX_VISIBLE_CARDS);

  const handleWidgetClick = useCallback(() => {
    setInitialNoteIndex(0);
    setBottomSheetOpen(true);
  }, []);

  const handleBottomSheetClose = useCallback(() => {
    setBottomSheetOpen(false);
  }, []);

  // Optimistically update the note in local state
  const handleNoteSaved = useCallback((savedNote: Note) => {
    updateNote(savedNote);
  }, [updateNote]);

  // Optimistically remove the note from local state
  const handleNoteDeleted = useCallback((noteId: string) => {
    removeNote(noteId);
  }, [removeNote]);

  // Don't render if loading or no notes
  if (isLoading || notes.length === 0) {
    return null;
  }

  return (
    <>
      {/* Stacked Cards Widget */}
      <Box
        onClick={handleWidgetClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        sx={{
          position: 'fixed',
          bottom: { xs: 16, sm: 24 },
          left: { xs: 16, sm: 24 },
          zIndex: Z_INDEX.FLOAT_NAVIGATION,
          cursor: 'pointer',
          // Container size to accommodate fanned cards
          width: isHovered ? 180 : 90,
          height: 110,
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Render placeholder cards when there's only 1 note for animation effect */}
        {visibleNotes.length === 1 && (
          <>
            
            <PlaceholderNoteCard
              index={1}
              totalCards={2}
              isHovered={isHovered}
              hasAnimated={hasAnimated}
            />
          </>
        )}

        {/* Render cards in reverse order so first card is on top */}
        {[...visibleNotes].reverse().map((note, reversedIndex) => {
          const originalIndex = visibleNotes.length - 1 - reversedIndex;
          // When we have only 1 note, render it at index 0 with totalCards=3 for proper stacking
          const displayIndex = visibleNotes.length === 1 ? 0 : originalIndex;
          const displayTotal = visibleNotes.length === 1 ? 3 : visibleNotes.length;
          return (
            <NoteCard
              key={note.id}
              note={note}
              index={displayIndex}
              totalCards={displayTotal}
              isHovered={isHovered}
              hasAnimated={hasAnimated}
            />
          );
        })}
      </Box>

      {/* Bottom Sheet */}
      <NotesBottomSheet
        open={bottomSheetOpen}
        onClose={handleBottomSheetClose}
        notes={notes}
        initialIndex={initialNoteIndex}
        calendarId={calendarId}
        fullDayName={fullDayName}
        onNoteSaved={handleNoteSaved}
        onNoteDeleted={handleNoteDeleted}
      />
    </>
  );
};

export default StackedNotesWidget;
