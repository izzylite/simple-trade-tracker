import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Snackbar,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';

import { Note } from 'features/notes/types/note';
import { Calendar } from 'features/calendar/types/calendar';
import { useAuthState } from 'contexts/AuthStateContext';
import { useIsMobile } from 'hooks/useResponsive';
import {
  HEADER_HEIGHT_XS,
  HEADER_HEIGHT_SM,
} from 'styles/layout';
import { getShadow, getControlClusterSx } from 'styles/designTokens';
import { useUserPinnedEvents } from 'features/events/contexts/UserPinnedEventsContext';
import { useSelectedCalendar } from 'features/calendar/contexts/SelectedCalendarContext';
import { useNotes } from 'features/notes/hooks/useNotes';
import { CalendarRepository } from 'services/repositories/CalendarRepository';
import { logger } from 'utils/logger';
import * as notesService from 'features/notes/services/notesService';

import NoteListPanel, {
  NotesTab,
  NotesTagPill,
} from 'features/notes/components/NoteListPanel';
import NoteViewPanel from 'features/notes/components/NoteViewPanel';
import NoteMetaPanel from 'features/notes/components/NoteMetaPanel';
import NoteEditorBody, { NoteEditorBodyHandle } from 'features/notes/components/NoteEditorBody';

/** Full page-column height: viewport minus the responsive app header. */
const PAGE_COLUMN_HEIGHT = {
  xs: `calc(100dvh - ${HEADER_HEIGHT_XS}px)`,
  sm: `calc(100dvh - ${HEADER_HEIGHT_SM}px)`,
} as const;

const NotesPage: React.FC = () => {
  const theme = useTheme();
  const { user } = useAuthState();
  const isMobile = useIsMobile();

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
    notes, loading, loadingMore, hasMore, total, tabCounts, hasLoaded,
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

  // First-load gate. useNotes exposes hasLoaded once the initial fetch
  // settles (success, error, OR silent cache-hit revalidate). Use that
  // directly instead of trying to detect a loading true→false transition
  // — cache hits skip setLoading(true) and would leave the gate stuck.

  // ─── Auto-select most recently updated note on first load ────────────────
  // Notes from useNotes are already sorted by updated_at desc, so notes[0]
  // is the freshest. Skip when user is mid-draft or already viewing a note.
  const didAutoSelectRef = useRef(false);
  useEffect(() => {
    if (didAutoSelectRef.current) return;
    // Phones land on the list (master-detail); auto-selecting would drop the
    // user straight into the detail pane and hide the list on entry. Desktop
    // (multi-column) keeps auto-select so the reading pane is never empty.
    if (isMobile) return;
    if (loading) return;
    if (selectedNote || isNewDraft || isEditing) return;
    if (notes.length === 0) return;
    didAutoSelectRef.current = true;
    setSelectedNote(notes[0]);
  }, [loading, notes, selectedNote, isNewDraft, isEditing, isMobile]);

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
  if (!hasLoaded) {
    return (
      <Box
        sx={{
          height: PAGE_COLUMN_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress size={28} />
      </Box>
    );
  }

  // On phones the master-detail collapses to a single column: show the list
  // when nothing is selected and not editing, otherwise show the center
  // view/editor with a Back affordance that clears selection / exits edit.
  const showListOnMobile = isMobile && !selectedNote && !isEditing && !isNewDraft;
  const showCenterOnMobile = isMobile && !showListOnMobile;

  const handleMobileBack = () => {
    if (isEditing || isNewDraft) {
      handleExitEdit();
    }
    setSelectedNote(null);
  };

  return (
    <Box
      sx={{
        height: PAGE_COLUMN_HEIGHT,
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
        bgcolor: 'background.default',
        overflow: 'hidden',
      }}
    >
      {/* ── Page sub-header: creator toggle only ── */}
      <Box
        sx={{
          px: { xs: 2, sm: 3 },
          py: 1.25,
          borderBottom: `1px solid ${theme.palette.divider}`,
          bgcolor: 'background.paper',
          boxShadow: getShadow(theme, 'sm'),
          display: 'flex',
          alignItems: 'center',
          justifyContent: showCenterOnMobile ? 'space-between' : 'flex-end',
          gap: 2,
        }}
      >
        {/* Mobile back affordance — only when viewing/editing the center pane */}
        {showCenterOnMobile && (
          <IconButton
            onClick={handleMobileBack}
            aria-label="Back to notes list"
            sx={{ height: { xs: 44 }, width: { xs: 44 }, color: 'text.secondary' }}
          >
            <ArrowBackIcon />
          </IconButton>
        )}

        {/* Creator toggle: My Notes / Orion */}
        <Box sx={{ display: 'flex', gap: 0.5, p: 0.5, ...getControlClusterSx(theme), borderRadius: '999px' }}>
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
        {/* Left rail — hidden on phones while the center pane is shown */}
        {!showCenterOnMobile && (
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
            onTogglePin={(note) => updateNote(note.id, { is_pinned: !note.is_pinned })}
            onToggleArchive={(note) => updateNote(note.id, { is_archived: !note.is_archived })}
            tab={tab}
            onTabChange={setTab}
            pill={pillFilter}
            onPillChange={setPillFilter}
            total={total}
            tabCounts={tabCounts}
            disableExpand
          />
        )}

        {/* Center: note viewer or inline editor — hidden on phones while the
            list is shown */}
        {showListOnMobile ? null : isEditing && user?.uid ? (
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
        <Box
          sx={{
            display: { xs: 'none', lg: 'flex' },
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden'
          }}
        >    <NoteMetaPanel
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
