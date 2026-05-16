/**
 * CalendarNotesPanel
 *
 * View/edit-only notes panel for a single calendar. Reuses the same
 * NoteListPanel that NotesPage uses so the UX stays in lockstep.
 *
 * Differences vs the standalone /notes page:
 *   - Scoped to one calendarId (no calendar picker)
 *   - No create-note affordance (read + edit existing only)
 *   - No "Notes" header / entries count (drawer/panel chrome already labels it)
 *   - No My Notes / Orion toggle — that filter lives on /notes only
 *   - Click a note → NoteEditorDialog opens for view/edit
 */

import React, { useState } from 'react';
import { Box } from '@mui/material';

import { Note } from '../../types/note';
import type { Currency, ImpactLevel } from '../../types/economicCalendar';
import { useAuthState } from '../../contexts/AuthStateContext';
import { useNotes } from '../../hooks/useNotes';
import * as notesService from '../../services/notesService';
import { logger } from '../../utils/logger';

import NoteListPanel, { NotesTab, NotesTagPill } from './NoteListPanel';
import NoteEditorDialog from './NoteEditorDialog';

export interface CalendarNotesPanelProps {
  calendarId?: string;
  isActive?: boolean;
  isReadOnly?: boolean;
  availableTradeTags?: string[];
  pinnedEvents?: Array<{
    event_id: string;
    event: string;
    currency?: Currency;
    impact?: ImpactLevel;
  }>;
}

const CalendarNotesPanel: React.FC<CalendarNotesPanelProps> = ({
  calendarId,
  isActive = true,
  isReadOnly = false,
  availableTradeTags = [],
  pinnedEvents,
}) => {
  const { user } = useAuthState();

  const [tab, setTab] = useState<NotesTab>('all');
  const [pill, setPill] = useState<NotesTagPill>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  const {
    notes,
    loading,
    loadingMore,
    hasMore,
    total,
    tabCounts,
    loadMore,
    updateNote,
    removeNote,
  } = useNotes({
    userId: user?.uid,
    calendarId,
    isOpen: isActive,
    activeTab: tab,
    searchQuery,
    selectedCalendarFilter: calendarId || 'all',
    creatorFilter: 'me',
  });

  const handleNoteClick = (note: Note) => {
    setSelectedNote(note);
  };

  const handleEditorClose = () => {
    setSelectedNote(null);
  };

  const handleTogglePin = async (note: Note) => {
    const next = !note.is_pinned;
    updateNote(note.id, { is_pinned: next });
    try {
      if (next) await notesService.pinNote(note.id);
      else await notesService.unpinNote(note.id);
    } catch (err) {
      logger.error('Error toggling pin:', err);
      updateNote(note.id, { is_pinned: !next });
    }
  };

  const handleToggleArchive = async (note: Note) => {
    const next = !note.is_archived;
    updateNote(note.id, { is_archived: next });
    try {
      if (next) await notesService.archiveNote(note.id);
      else await notesService.unarchiveNote(note.id);
    } catch (err) {
      logger.error('Error toggling archive:', err);
      updateNote(note.id, { is_archived: !next });
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <NoteListPanel
        notes={notes}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        onLoadMore={loadMore}
        selectedNoteId={selectedNote?.id}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onNoteClick={handleNoteClick}
        onTogglePin={isReadOnly ? undefined : handleTogglePin}
        onToggleArchive={isReadOnly ? undefined : handleToggleArchive}
        tab={tab}
        onTabChange={setTab}
        pill={pill}
        onPillChange={setPill}
        total={total}
        tabCounts={tabCounts}
        showHeader={false}
      />

      {selectedNote && !isReadOnly && (
        <NoteEditorDialog
          open={!!selectedNote}
          onClose={handleEditorClose}
          note={selectedNote}
          calendarId={selectedNote.calendar_id || calendarId || ''}
          onSave={(note) => {
            updateNote(note.id, note);
          }}
          onDelete={(noteId) => {
            removeNote(noteId);
            setSelectedNote(null);
          }}
          availableTradeTags={availableTradeTags}
          calendarNotes={notes.map((n) => ({ id: n.id, title: n.title }))}
          pinnedEvents={pinnedEvents}
        />
      )}
    </Box>
  );
};

export default CalendarNotesPanel;
