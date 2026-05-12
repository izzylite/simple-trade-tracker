import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Snackbar,
  alpha,
  useTheme,
} from '@mui/material';
import { Visibility as VisibilityIcon } from '@mui/icons-material';

import { Note } from '../types/note';
import { Calendar } from '../types/calendar';
import { useAuthState } from '../contexts/AuthStateContext';
import { useUserPinnedEvents } from '../contexts/UserPinnedEventsContext';
import { useSelectedCalendar } from '../contexts/SelectedCalendarContext';
import { useNotes } from '../hooks/useNotes';
import { CalendarRepository } from '../services/repository/repositories/CalendarRepository';
import { logger } from '../utils/logger';
import * as notesService from '../services/notesService';

import NoteListPanel, {
  NotesTab,
  NotesTagPill,
} from '../components/notes/NoteListPanel';
import NoteViewPanel from '../components/notes/NoteViewPanel';
import NoteMetaPanel from '../components/notes/NoteMetaPanel';
import NoteEditorBody, { NoteEditorBodyHandle } from '../components/notes/NoteEditorBody';

const APP_HEADER_HEIGHT = 64;

const NotesPage: React.FC = () => {
  const theme = useTheme();
  const { user } = useAuthState();

  // ─── UI state ────────────────────────────────────────────────────────────
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tab, setTab] = useState<NotesTab>('all');
  const [pillFilter, setPillFilter] = useState<NotesTagPill>('all');
  const [creator, setCreator] = useState<'me' | 'assistant'>('me');
  const [isEditing, setIsEditing] = useState(false);
  const [isNewDraft, setIsNewDraft] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState<string | null>(null);

  // Pinned economic events (global)
  const { pins: pinnedEvents } = useUserPinnedEvents();

  // Imperative handle on the inline editor — used by Done to flush save
  const editorBodyRef = useRef<NoteEditorBodyHandle>(null);

  // ─── Calendar picker (now driven by global selection) ────────────────────
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const { calendarId: selectedCalendar, setCalendarId } = useSelectedCalendar();

  useEffect(() => {
    if (!user?.uid) return;
    const repo = new CalendarRepository();
    repo.findByUserId(user.uid)
      .then(setCalendars)
      .catch(err => logger.error('Failed to load calendars', err));
  }, [user?.uid]);

  // Fall back to the most recently updated calendar when the global context
  // is empty. Keeps useNotes scoped to a real calendar so /notes never
  // silently shows cross-calendar notes on cold load.
  useEffect(() => {
    if (selectedCalendar) return;
    if (calendars.length === 0) return;
    const fallback = [...calendars]
      .filter((c) => !c.deleted_at)
      .sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )[0];
    if (fallback) setCalendarId(fallback.id);
  }, [selectedCalendar, calendars, setCalendarId]);

  // ─── Notes data ───────────────────────────────────────────────────────────
  const {
    notes, loading, loadingMore, hasMore, total,
    updateNote, removeNote, addNote, loadMore,
  } = useNotes({
    userId: user?.uid,
    isOpen: true,
    activeTab: tab,
    searchQuery,
    selectedCalendarFilter: selectedCalendar,
    creatorFilter: creator,
  });

  // Tag tags for slash-command embedding — derived from selected note's calendar
  // (or the calendar picker) so /tag suggestions match the note's calendar.
  const noteCalendarId = selectedNote?.calendar_id ?? selectedCalendar ?? (calendars[0]?.id ?? '');
  const noteCalendar = calendars.find(c => c.id === noteCalendarId);
  const availableTradeTags = noteCalendar?.tags ?? [];

  // ─── Keep selected note in sync after updates ─────────────────────────────
  useEffect(() => {
    if (!selectedNote) return;
    const fresh = notes.find(n => n.id === selectedNote.id);
    if (fresh) setSelectedNote(fresh);
  }, [notes]); // eslint-disable-line react-hooks/exhaustive-deps

  // First-load gate. useNotes starts with loading=false (it doesn't fetch
  // until the effect kicks in), so we can't treat "loading went false" as
  // "data arrived". Instead watch for the true→false transition: a real
  // fetch cycle has completed. After that, subsequent loading flips
  // (search/tab/calendar) keep the page rendered and the list panel
  // shows its own inline loader.
  const hasFetchedNotesRef = useRef(false);
  const prevLoadingRef = useRef(loading);
  useEffect(() => {
    if (prevLoadingRef.current && !loading) {
      hasFetchedNotesRef.current = true;
    }
    prevLoadingRef.current = loading;
  }, [loading]);

  // ─── Auto-select most recently updated note on first load ────────────────
  // Notes from useNotes are already sorted by updated_at desc, so notes[0]
  // is the freshest. Skip when user is mid-draft or already viewing a note.
  const didAutoSelectRef = useRef(false);
  useEffect(() => {
    if (didAutoSelectRef.current) return;
    if (loading) return;
    if (selectedNote || isNewDraft || isEditing) return;
    if (notes.length === 0) return;
    didAutoSelectRef.current = true;
    setSelectedNote(notes[0]);
  }, [loading, notes, selectedNote, isNewDraft, isEditing]);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleNoteClick = useCallback((note: Note) => {
    setSelectedNote(note);
    setIsNewDraft(false);
    setIsEditing(false);
  }, []);

  // New notes always belong to the currently selected calendar.
  const calendarIdForNew = selectedCalendar || '';
  const canCreateNote = calendarIdForNew !== '';

  const handleNewNote = useCallback(() => {
    if (!canCreateNote) {
      setSnackbarMsg('Pick a calendar from the header to add a note');
      return;
    }
    setSelectedNote(null);
    setIsNewDraft(true);
    setIsEditing(true);
  }, [canCreateNote]);

  const handleEditNote = useCallback(() => {
    if (selectedNote) setIsEditing(true);
  }, [selectedNote]);

  const handleExitEdit = useCallback(() => {
    setIsEditing(false);
    setIsNewDraft(false);
  }, []);

  const handleDone = useCallback(async () => {
    try {
      await editorBodyRef.current?.saveIfDirty();
    } catch (err) {
      logger.error('Failed to save before exit', err);
    }
    handleExitEdit();
  }, [handleExitEdit]);

  const handleInlineSaved = useCallback((note: Note, isCreated?: boolean) => {
    if (isCreated) {
      addNote(note);
      // If the user has navigated to a different note while the background
      // save was in flight, don't yank them back. Only auto-select when
      // there's nothing currently selected (i.e. this was the active draft).
      setSelectedNote(prev => prev ?? note);
      setIsNewDraft(false);
    } else {
      updateNote(note.id, note);
      // Refresh selection only if the user is still viewing this note.
      setSelectedNote(prev => (prev?.id === note.id ? note : prev));
    }
  }, [addNote, updateNote]);

  const handleInlineDelete = useCallback((noteId: string) => {
    removeNote(noteId);
    if (selectedNote?.id === noteId) setSelectedNote(null);
    setIsEditing(false);
    setIsNewDraft(false);
  }, [removeNote, selectedNote]);

  const handlePin = useCallback(async (note: Note) => {
    updateNote(note.id, { is_pinned: !note.is_pinned });
    try {
      if (note.is_pinned) await notesService.unpinNote(note.id);
      else await notesService.pinNote(note.id);
    } catch (err) {
      logger.error('Error toggling pin', err);
      updateNote(note.id, { is_pinned: note.is_pinned });
    }
  }, [updateNote]);

  const handleArchive = useCallback(async (note: Note) => {
    removeNote(note.id);
    if (selectedNote?.id === note.id) setSelectedNote(null);
    try {
      if (note.is_archived) await notesService.unarchiveNote(note.id);
      else await notesService.archiveNote(note.id);
    } catch (err) {
      logger.error('Error archiving note', err);
    }
  }, [removeNote, selectedNote]);

  // Initial cold-load loader. While the first fetch hasn't yet completed
  // we'd otherwise render the empty NoteViewPanel — which is the "create
  // note" CTA — and that flashes before real notes arrive. Covers both
  // the loading=true window and the pre-fetch initial render where
  // useNotes hasn't yet kicked off its first request.
  if (!hasFetchedNotesRef.current) {
    return (
      <Box
        sx={{
          height: `calc(100vh - ${APP_HEADER_HEIGHT}px)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: `calc(100vh - ${APP_HEADER_HEIGHT}px)`,
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
        bgcolor: 'background.default',
        overflow: 'hidden',
      }}
    >
      {/* ── Page sub-header: creator toggle only ── */}
      <Box
        sx={{
          px: 3,
          py: 1.25,
          borderBottom: `1px solid ${theme.palette.divider}`,
          bgcolor: 'background.paper',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 2,
        }}
      >
        {/* Creator toggle: My Notes / Orion */}
        <Box sx={{ display: 'flex', gap: 0.5, p: 0.5, bgcolor: alpha(theme.palette.common.white, theme.palette.mode === 'dark' ? 0.03 : 0.6), borderRadius: '999px', border: `1px solid ${theme.palette.divider}` }}>
          {(['me', 'assistant'] as const).map(c => {
            const active = creator === c;
            return (
              <Box
                key={c}
                component="button"
                onClick={() => setCreator(c)}
                sx={{
                  background: active ? alpha(theme.palette.primary.main, 0.16) : 'transparent',
                  color: active ? theme.palette.primary.light : 'text.secondary',
                  border: 'none',
                  borderRadius: '999px',
                  px: 1.5,
                  py: 0.5,
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 150ms',
                }}
              >
                {c === 'me' ? 'My Notes' : 'Orion'}
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* ── 3-column body ── */}
      <Box
        sx={{
          display: 'grid',
          // minmax(0, 1fr) lets the center cell shrink below the editor's
          // intrinsic content width — without it, the /tag mention picker
          // bar pushes the page wider than the viewport.
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            sm: '260px minmax(0, 1fr)',
            lg: '280px minmax(0, 1fr) 300px',
          },
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* Left rail */}
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
          onNewNote={handleNewNote}
          canCreateNote={canCreateNote}
          tab={tab}
          onTabChange={setTab}
          pill={pillFilter}
          onPillChange={setPillFilter}
          total={total}
        />

        {/* Center: note viewer or inline editor */}
        {isEditing && user?.uid ? (
          <NoteEditorBody
            ref={editorBodyRef}
            key={isNewDraft ? 'new' : selectedNote?.id ?? 'fallback'}
            isActive
            note={isNewDraft ? undefined : (selectedNote ?? undefined)}
            calendarId={selectedNote?.calendar_id ?? calendarIdForNew}
            calendarNotes={notes.map(n => ({ id: n.id, title: n.title }))}
            availableTradeTags={availableTradeTags}
            pinnedEvents={pinnedEvents}
            onSave={handleInlineSaved}
            onDelete={handleInlineDelete}
            onCloseRequest={handleExitEdit}
            trailingAction={
              <Button
                variant="contained"
                size="small"
                startIcon={<VisibilityIcon sx={{ fontSize: '0.9rem !important' }} />}
                onClick={() => { void handleDone(); }}
                sx={{
                  borderRadius: 1,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  px: 1.5,
                  py: 0.5,
                  bgcolor: 'primary.main',
                  '&:hover': { bgcolor: '#6d28d9' },
                  boxShadow: 'none',
                }}
              >
                Done
              </Button>
            }
          />
        ) : (
          <NoteViewPanel
            note={selectedNote}
            onEdit={handleEditNote}
            onNewNote={handleNewNote}
            onPin={handlePin}
            onArchive={handleArchive}
          />
        )}

        {/* Right rail: outline + stats (hidden below lg) */}
        <Box sx={{ display: { xs: 'none', lg: 'block' }, minHeight: 0, overflow: 'hidden' }}>
          <NoteMetaPanel
            note={selectedNote}
            notes={notes}
            onSelectNote={handleNoteClick}
          />
        </Box>
      </Box>

      <Snackbar
        open={!!snackbarMsg}
        autoHideDuration={3000}
        onClose={() => setSnackbarMsg(null)}
        message={snackbarMsg}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
};

export default NotesPage;
