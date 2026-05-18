/**
 * NotesPanelStateContext
 *
 * Owns every piece of user-meaningful state that backs the calendar
 * notes panel so it survives the lg↔︎drawer breakpoint handoff
 * (CalendarNotesPanel unmounts in one slot and remounts in another).
 * The useNotes data hook (which has its own module-level cache) also
 * lives here so swapping the host doesn't trigger a re-fetch flicker
 * or drop tab/search/pill selections.
 *
 * Mounted once inside TradeCalendarPage above both the inline panel and
 * the <lg drawer. Calendar-scope props (calendarId, allTags, pinned
 * events) flow in from the page so the underlying fetch effect always
 * sees the latest scope.
 */

import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { Note } from 'features/notes/types/note';
import type { Currency, ImpactLevel } from 'features/events/types/economicCalendar';
import { useAuthState } from 'contexts/AuthStateContext';
import { useNotes } from 'features/notes/hooks/useNotes';
import * as notesService from 'features/notes/services/notesService';
import { logger } from 'utils/logger';
import type { NotesTab, NotesTagPill } from 'features/notes/components/NoteListPanel';

export interface PinnedEventLite {
  event_id: string;
  event: string;
  currency?: Currency;
  impact?: ImpactLevel;
}

interface NotesPanelStateContextValue {
  // Scope (forwarded from provider props)
  calendarId?: string;
  isReadOnly: boolean;
  availableTradeTags: string[];
  pinnedEvents?: PinnedEventLite[];

  // List-level UI state
  tab: NotesTab;
  setTab: (t: NotesTab) => void;
  pill: NotesTagPill;
  setPill: (p: NotesTagPill) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Row expand state (lives here so the open row persists across the swap)
  expandedId: string | null;
  setExpandedId: React.Dispatch<React.SetStateAction<string | null>>;

  // Selected note (controls NoteEditorDialog open state)
  selectedNote: Note | null;
  openNote: (note: Note) => void;
  closeNote: () => void;

  // Data layer (from useNotes — cached at module level inside the hook)
  notes: Note[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  total: number;
  tabCounts: { all: number; pinned: number; archived: number };
  loadMore: () => void;
  updateNote: (noteId: string, updates: Partial<Note>) => void;
  removeNote: (noteId: string) => void;

  // Pin / archive handlers (optimistic with rollback)
  handleTogglePin: (note: Note) => Promise<void>;
  handleToggleArchive: (note: Note) => Promise<void>;
}

const NotesPanelStateContext =
  createContext<NotesPanelStateContextValue | null>(null);

interface ProviderProps {
  calendarId?: string;
  isReadOnly?: boolean;
  availableTradeTags?: string[];
  pinnedEvents?: PinnedEventLite[];
  /**
   * True when the panel is mounted and visible in at least one slot.
   * Gates the underlying useNotes fetch so the hook only loads when
   * the user actually opens the panel.
   */
  isActive: boolean;
  children: ReactNode;
}

export const NotesPanelStateProvider: React.FC<ProviderProps> = ({
  calendarId,
  isReadOnly = false,
  availableTradeTags = [],
  pinnedEvents,
  isActive,
  children,
}) => {
  const { user } = useAuthState();

  const [tab, setTab] = useState<NotesTab>('all');
  const [pill, setPill] = useState<NotesTagPill>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
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

  const openNote = useCallback((note: Note) => {
    setSelectedNote(note);
  }, []);

  const closeNote = useCallback(() => {
    setSelectedNote(null);
  }, []);

  const handleTogglePin = useCallback(
    async (note: Note) => {
      const next = !note.is_pinned;
      updateNote(note.id, { is_pinned: next });
      try {
        if (next) await notesService.pinNote(note.id);
        else await notesService.unpinNote(note.id);
      } catch (err) {
        logger.error('Error toggling pin:', err);
        updateNote(note.id, { is_pinned: !next });
      }
    },
    [updateNote],
  );

  const handleToggleArchive = useCallback(
    async (note: Note) => {
      const next = !note.is_archived;
      updateNote(note.id, { is_archived: next });
      try {
        if (next) await notesService.archiveNote(note.id);
        else await notesService.unarchiveNote(note.id);
      } catch (err) {
        logger.error('Error toggling archive:', err);
        updateNote(note.id, { is_archived: !next });
      }
    },
    [updateNote],
  );

  const value = useMemo<NotesPanelStateContextValue>(
    () => ({
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
    }),
    [
      calendarId,
      isReadOnly,
      availableTradeTags,
      pinnedEvents,
      tab,
      pill,
      searchQuery,
      expandedId,
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
    ],
  );

  return (
    <NotesPanelStateContext.Provider value={value}>
      {children}
    </NotesPanelStateContext.Provider>
  );
};

export const useNotesPanelState = (): NotesPanelStateContextValue => {
  const ctx = useContext(NotesPanelStateContext);
  if (!ctx) {
    throw new Error(
      'useNotesPanelState must be used within NotesPanelStateProvider',
    );
  }
  return ctx;
};
