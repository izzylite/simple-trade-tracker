/**
 * useNotes Hook
 *
 * Custom hook for loading and managing notes with proper memoization
 * to prevent unnecessary reloads when drawer opens/closes.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Note } from '../types/note';
import * as notesService from '../services/notesService';
import { logger } from '../utils/logger';

export interface UseNotesOptions {
  /**
   * User ID to fetch notes for
   */
  userId?: string;

  /**
   * Calendar ID to filter notes by (optional)
   */
  calendarId?: string;

  /**
   * Whether the drawer is open
   */
  isOpen: boolean;

  /**
   * Active tab filter
   */
  activeTab: 'all' | 'pinned' | 'archived';

  /**
   * Search query
   */
  searchQuery?: string;

  /**
   * Calendar filter (for multi-calendar view)
   */
  selectedCalendarFilter?: string;

  /**
   * Creator filter
   */
  creatorFilter: 'assistant' | 'me';

  /**
   * Number of notes per page
   * @default 20
   */
  notesPerPage?: number;
}

export interface UseNotesResult {
  notes: Note[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  total: number;
  loadNotes: (reset?: boolean) => Promise<void>;
  loadMore: () => void;
  updateNote: (noteId: string, updates: Partial<Note>) => void;
  removeNote: (noteId: string) => void;
  addNote: (note: Note) => void;
}

/**
 * Custom hook for loading and managing notes with optimized loading behavior
 */
export function useNotes(options: UseNotesOptions): UseNotesResult {
  const {
    userId,
    calendarId,
    isOpen,
    activeTab,
    searchQuery = '',
    selectedCalendarFilter = 'all',
    creatorFilter,
    notesPerPage = 20,
  } = options;

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  // Use ref for offset to avoid it being in dependency array
  const offsetRef = useRef(0);

  // Track if we've loaded notes for the current open session
  const hasLoadedRef = useRef(false);
  // Track previous filter values to detect actual changes
  const prevFiltersRef = useRef({
    activeTab,
    selectedCalendarFilter,
    creatorFilter,
    calendarId,
  });

  const loadNotes = useCallback(
    async (reset: boolean = false) => {
      if (!userId) return;

      try {
        if (reset) {
          if(notes.length == 0) {
          setLoading(true);
          }
          offsetRef.current = 0;
        } else {
          setLoadingMore(true);
        }

        // Determine filter options based on active tab
        const queryOptions: notesService.NoteQueryOptions = {
          limit: notesPerPage,
          offset: offsetRef.current,
          searchQuery: (searchQuery || '').trim() || undefined,
        };

        // Apply tab-specific filters
        if (activeTab === 'pinned') {
          queryOptions.isPinned = true;
          queryOptions.isArchived = false;
        } else if (activeTab === 'archived') {
          queryOptions.isArchived = true;
        } else {
          // 'all' tab - exclude archived notes
          queryOptions.isArchived = false;
        }

        // Apply creator filter
        if (creatorFilter === 'assistant') {
          queryOptions.byAssistant = true;
        } else if (creatorFilter === 'me') {
          queryOptions.byAssistant = false;
        }

        // Query notes
        let result: notesService.NoteQueryResult;
        // Use calendarId prop if provided (calendar-specific view)
        // Otherwise use selectedCalendarFilter from dropdown (multi-calendar view)
        const effectiveCalendarId =
          calendarId ||
          (selectedCalendarFilter !== 'all' ? selectedCalendarFilter : undefined);

        if (effectiveCalendarId) {
          result = await notesService.queryCalendarNotes(
            effectiveCalendarId,
            queryOptions
          );
        } else {
          result = await notesService.queryUserNotes(userId, queryOptions);
        }

        // Update state
        if (reset) {
          setNotes(result.notes);
          offsetRef.current = result.notes.length;
        } else {
          setNotes((prev) => [...prev, ...result.notes]);
          offsetRef.current += result.notes.length;
        }
        setHasMore(result.hasMore);
        setTotal(result.total);
      } catch (error) {
        logger.error('Error loading notes:', error);
        setNotes([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [
      userId,
      calendarId,
      activeTab,
      searchQuery,
      selectedCalendarFilter,
      creatorFilter,
      notesPerPage,
    ]
  );

  // Load notes when drawer opens (only once per session)
  useEffect(() => {
    if (isOpen && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadNotes(true);
    }
    // Don't reset hasLoadedRef when drawer closes if using keepMounted
    // The drawer component will handle unmounting if needed
  }, [isOpen, loadNotes]);

  // Reload when filters change (only if drawer is open and already loaded)
  useEffect(() => {
    if (!isOpen || !hasLoadedRef.current) return;

    const prev = prevFiltersRef.current;
    const filtersChanged =
      prev.activeTab !== activeTab ||
      prev.selectedCalendarFilter !== selectedCalendarFilter ||
      prev.creatorFilter !== creatorFilter ||
      prev.calendarId !== calendarId;

    if (filtersChanged) {
      prevFiltersRef.current = {
        activeTab,
        selectedCalendarFilter,
        creatorFilter,
        calendarId,
      };
      loadNotes(true);
    }
  }, [
    isOpen,
    activeTab,
    selectedCalendarFilter,
    creatorFilter,
    calendarId,
    loadNotes,
  ]);

  // Debounced search effect
  useEffect(() => {
    if (!isOpen || !hasLoadedRef.current) return;

    const timeout = setTimeout(() => {
      loadNotes(true);
    }, 500); // 500ms debounce

    return () => clearTimeout(timeout);
  }, [searchQuery, isOpen, loadNotes]);

  const loadMore = useCallback(() => {
    loadNotes(false);
  }, [loadNotes]);

  const updateNote = useCallback((noteId: string, updates: Partial<Note>) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, ...updates } : n))
    );
  }, []);

  const removeNote = useCallback((noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }, []);

  const addNote = useCallback((note: Note) => {
    setNotes((prev) => [note, ...prev]);
  }, []);

  return {
    notes,
    loading,
    loadingMore,
    hasMore,
    total,
    loadNotes,
    loadMore,
    updateNote,
    removeNote,
    addNote,
  };
}
