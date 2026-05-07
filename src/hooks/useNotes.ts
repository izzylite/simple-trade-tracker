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
import { supabase } from '../config/supabase';

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
 * Module-level cache for notes lists, keyed by the same filter combination
 * that triggers a refetch. Survives unmount so re-opening the notes panel
 * (or remounting via route nav) hydrates instantly.
 */
type NotesCacheEntry = {
  notes: Note[];
  hasMore: boolean;
  total: number;
  offset: number;
};
const notesCache = new Map<string, NotesCacheEntry>();
function makeNotesKey(
  userId: string | undefined,
  calendarId: string | undefined,
  activeTab: 'all' | 'pinned' | 'archived',
  selectedCalendarFilter: string,
  creatorFilter: 'assistant' | 'me',
  searchQuery: string | null | undefined,
): string {
  return [
    userId ?? '',
    calendarId ?? '',
    activeTab,
    selectedCalendarFilter,
    creatorFilter,
    (searchQuery ?? '').trim(),
  ].join('|');
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
    searchQuery = null,
    selectedCalendarFilter = 'all',
    creatorFilter,
    notesPerPage = 20,
  } = options;

  // Hydrate from module cache on first render — re-opening the panel or
  // remounting via route nav reuses the previously-loaded list instantly.
  const initialKey = makeNotesKey(
    userId,
    calendarId,
    activeTab,
    selectedCalendarFilter,
    creatorFilter,
    searchQuery,
  );
  const initialCache = notesCache.get(initialKey);

  const [notes, setNotes] = useState<Note[]>(initialCache?.notes ?? []);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialCache?.hasMore ?? false);
  const [total, setTotal] = useState(initialCache?.total ?? 0);

  // Use ref for offset to avoid it being in dependency array
  const offsetRef = useRef(initialCache?.offset ?? 0);
  // Mirror of `notes` so loadMore (which has wide deps) can read the current
  // list without forcing loadNotes to depend on every notes mutation.
  const notesRef = useRef<Note[]>(notes);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  // Track if we've loaded notes for the current open session
  const hasLoadedRef = useRef(false);
  // Track previous filter values to detect actual changes
  const prevFiltersRef = useRef({
    activeTab,
    selectedCalendarFilter,
    creatorFilter,
    calendarId,
    searchQuery,
  });

  const loadNotes = useCallback(
    async (reset: boolean = false) => {
      if (!userId) return;
      try {
        if (reset) {
          // Silent revalidate when cache already populated for this combo.
          const revalidateKey = makeNotesKey(
            userId,
            calendarId,
            activeTab,
            selectedCalendarFilter,
            creatorFilter,
            searchQuery,
          );
          if (!notesCache.has(revalidateKey)) {
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

        // Update state + module cache
        let nextNotes: Note[];
        if (reset) {
          nextNotes = result.notes;
          offsetRef.current = result.notes.length;
          setNotes(nextNotes);
        } else {
          nextNotes = [...notesRef.current, ...result.notes];
          offsetRef.current += result.notes.length;
          setNotes(nextNotes);
        }
        setHasMore(result.hasMore);
        setTotal(result.total);

        const writeKey = makeNotesKey(
          userId,
          calendarId,
          activeTab,
          selectedCalendarFilter,
          creatorFilter,
          searchQuery,
        );
        notesCache.set(writeKey, {
          notes: nextNotes,
          hasMore: result.hasMore,
          total: result.total,
          offset: offsetRef.current,
        });
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
        ...prevFiltersRef.current,
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

  // Debounced search effect - only runs when searchQuery actually changes
  useEffect(() => {
    if (!isOpen || !hasLoadedRef.current) return;

    // Only trigger if searchQuery actually changed from previous value
    if (prevFiltersRef.current.searchQuery === searchQuery) return;

    const timeout = setTimeout(() => {
      prevFiltersRef.current.searchQuery = searchQuery;
      loadNotes(true);
    }, 500); // 500ms debounce

    return () => clearTimeout(timeout);
  }, [searchQuery, isOpen, loadNotes]);

  const loadMore = useCallback(() => {
    loadNotes(false);
  }, [loadNotes]);

  const writeListToCache = useCallback(
    (list: Note[]) => {
      const key = makeNotesKey(
        userId,
        calendarId,
        activeTab,
        selectedCalendarFilter,
        creatorFilter,
        searchQuery,
      );
      const existing = notesCache.get(key);
      notesCache.set(key, {
        notes: list,
        hasMore: existing?.hasMore ?? hasMore,
        total: existing?.total ?? total,
        offset: existing?.offset ?? offsetRef.current,
      });
    },
    [userId, calendarId, activeTab, selectedCalendarFilter, creatorFilter, searchQuery, hasMore, total],
  );

  const updateNote = useCallback((noteId: string, updates: Partial<Note>) => {
    setNotes((prev) => {
      const next = prev.map((n) => (n.id === noteId ? { ...n, ...updates } : n));
      writeListToCache(next);
      return next;
    });
  }, [writeListToCache]);

  const removeNote = useCallback((noteId: string) => {
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== noteId);
      writeListToCache(next);
      return next;
    });
  }, [writeListToCache]);

  const addNote = useCallback((note: Note) => {
    setNotes((prev) => {
      const next = [note, ...prev];
      writeListToCache(next);
      return next;
    });
  }, [writeListToCache]);

  // Real-time updates via postgres_changes
  const channelIdRef = useRef(
    `notes-drawer-pg-${Math.random().toString(36).slice(2, 8)}`
  );

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(channelIdRef.current)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes' },
        (payload: any) => {
          const { eventType } = payload;
          const newNote = payload.new as Note | undefined;
          const oldNote = payload.old as Note | undefined;

          if (eventType === 'UPDATE' && newNote) {
            // Update in-place if the note is already in the list
            setNotes((prev) => {
              const idx = prev.findIndex((n) => n.id === newNote.id);
              if (idx === -1) return prev;
              const updated = [...prev];
              updated[idx] = { ...updated[idx], ...newNote };
              return updated;
            });
          } else if (eventType === 'DELETE' && oldNote?.id) {
            setNotes((prev) => prev.filter((n) => n.id !== oldNote.id));
          }
          // INSERT: skip — complex filters make it hard to know
          // if the new note belongs in the current view.
          // The user will see it on next open/filter change.
        }
      )
      .subscribe((status: string) => {
        logger.log(`Notes drawer channel (${channelIdRef.current}): ${status}`);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

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
