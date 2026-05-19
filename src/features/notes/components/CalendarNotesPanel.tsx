/**
 * CalendarNotesPanel
 *
 * View/edit-only notes panel for a single calendar. Reuses the same
 * NoteListPanel that NotesPage uses so the UX stays in lockstep.
 *
 * All user-meaningful panel state (tab, pill, search, expanded row,
 * selected note) lives in NotesPanelStateContext so it survives the
 * lg↔︎drawer breakpoint swap. This component is now a thin renderer
 * that wires the context into the shared list + editor surfaces.
 *
 * Differences vs the standalone /notes page:
 *   - Scoped to one calendarId (no calendar picker)
 *   - No create-note affordance (read + edit existing only)
 *   - No "Notes" header / entries count (drawer/panel chrome already labels it)
 *   - No My Notes / Orion toggle — that filter lives on /notes only
 *   - Click a note → NoteEditorDialog opens for view/edit
 */

import React from 'react';
import { Box } from '@mui/material';

import { useNotesPanelState } from 'features/notes/contexts/NotesPanelStateContext';

import NoteListPanel from 'features/notes/components/NoteListPanel';
import NoteEditorDialog from 'features/notes/components/NoteEditorDialog';
import * as notesService from 'features/notes/services/notesService';
import { logger } from 'utils/logger';

const CalendarNotesPanel: React.FC = () => {
  const {
    calendarId,
    isReadOnly,
    availableTradeTags,
    pinnedEvents,
    tab,
    setTab,
    pill,
    setPill,
    searchQuery,
    setSearchQuery,
    expandedId,
    setExpandedId,
    selectedNote,
    openNote,
    closeNote,
    notes,
    loading,
    loadingMore,
    hasMore,
    total,
    tabCounts,
    loadMore,
    updateNote,
    removeNote,
    handleTogglePin,
    handleToggleArchive,
  } = useNotesPanelState();

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
        onNoteClick={openNote}
        onTogglePin={isReadOnly ? undefined : handleTogglePin}
        onToggleArchive={isReadOnly ? undefined : handleToggleArchive}
        onDelete={
          isReadOnly
            ? undefined
            : async (note) => {
                try {
                  await notesService.deleteNote(note.id);
                  removeNote(note.id);
                } catch (err) {
                  logger.error('Error deleting note from list panel:', err);
                }
              }
        }
        tab={tab}
        onTabChange={setTab}
        pill={pill}
        onPillChange={setPill}
        total={total}
        tabCounts={tabCounts}
        showHeader={false}
        expandedId={expandedId}
        onExpandedIdChange={setExpandedId}
      />

      {selectedNote && !isReadOnly && (
        <NoteEditorDialog
          open={!!selectedNote}
          onClose={closeNote}
          note={selectedNote}
          calendarId={selectedNote.calendar_id || calendarId || ''}
          onSave={(note) => {
            updateNote(note.id, note);
          }}
          onDelete={(noteId) => {
            removeNote(noteId);
            closeNote();
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
