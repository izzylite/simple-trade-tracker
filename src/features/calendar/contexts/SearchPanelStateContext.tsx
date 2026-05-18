/**
 * SearchPanelStateContext
 *
 * Owns every piece of state that backs the search panel so it survives
 * the lg↔︎drawer breakpoint handoff (SearchContent unmounts in one slot
 * and remounts in another). The fetch + debounce + reset effects also
 * live here so swapping the host doesn't trigger a re-fetch flicker.
 *
 * Mounted once inside TradeCalendarPage above both the inline panel and
 * the <lg drawer. `selectedTags` is owned by the page (it doubles as a
 * calendar-grid filter) and threaded in as a prop so the fetch effect
 * sees the same value.
 */

import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Trade } from '../types/dualWrite';
import { getTradeRepository } from '../services/calendarService';

export type DateFilterType = 'all' | 'single' | 'range';

export interface DateFilter {
  type: DateFilterType;
  startDate: Date | null;
  endDate: Date | null;
}

interface SearchPanelStateContextValue {
  // Input + derived debounce
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  debouncedSearchQuery: string;

  // Inline expand state
  expandedTradeId: string | null;
  setExpandedTradeId: React.Dispatch<React.SetStateAction<string | null>>;

  // Pagination
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;

  // Server results
  searchResults: Trade[];
  isSearching: boolean;
  totalCount: number;
  totalPages: number;

  // Filter dialog + filter inputs
  isFilterDialogOpen: boolean;
  setIsFilterDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedTagGroup: string;
  setSelectedTagGroup: React.Dispatch<React.SetStateAction<string>>;
  dateFilter: DateFilter;
  setDateFilter: React.Dispatch<React.SetStateAction<DateFilter>>;
  pinnedOnly: boolean;
  setPinnedOnly: React.Dispatch<React.SetStateAction<boolean>>;

  // Convenience helpers
  handleDateFilterChange: (type: DateFilterType) => void;
  handleStartDateChange: (date: Date | null) => void;
  handleEndDateChange: (date: Date | null) => void;
  handleClearDateFilter: () => void;
  handleClearAllFilters: () => void;

  // Constants
  itemsPerPage: number;
}

const SearchPanelStateContext =
  createContext<SearchPanelStateContextValue | null>(null);

interface ProviderProps {
  calendarId: string | undefined;
  selectedTags: string[];
  onTagsChange?: (tags: string[]) => void;
  itemsPerPage?: number;
  children: ReactNode;
}

const DEBOUNCE_MS = 300;

export const SearchPanelStateProvider: React.FC<ProviderProps> = ({
  calendarId,
  selectedTags,
  onTagsChange,
  itemsPerPage = 20,
  children,
}) => {
  // ── Input + filter state ────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [selectedTagGroup, setSelectedTagGroup] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<DateFilter>({
    type: 'all',
    startDate: null,
    endDate: null,
  });
  const [pinnedOnly, setPinnedOnly] = useState(false);

  // ── Server results ──────────────────────────────────────────────────────
  const [searchResults, setSearchResults] = useState<Trade[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // ── Debounce search input ───────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ── Reset pagination when filter inputs change ──────────────────────────
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, selectedTags, dateFilter, pinnedOnly]);

  // ── Server-side search effect ───────────────────────────────────────────
  useEffect(() => {
    if (!calendarId) return;

    const performSearch = async () => {
      if (
        !debouncedSearchQuery.trim() &&
        selectedTags.length === 0 &&
        dateFilter.type === 'all' &&
        !pinnedOnly
      ) {
        setSearchResults([]);
        setTotalCount(0);
        setTotalPages(0);
        return;
      }

      setIsSearching(true);
      try {
        const result = await getTradeRepository().searchTrades(calendarId, {
          searchQuery: debouncedSearchQuery.trim() || undefined,
          selectedTags: selectedTags.length > 0 ? selectedTags : undefined,
          dateFilter:
            dateFilter.type !== 'all'
              ? {
                  type: dateFilter.type,
                  startDate: dateFilter.startDate || undefined,
                  endDate: dateFilter.endDate || undefined,
                }
              : undefined,
          pinnedOnly: pinnedOnly || undefined,
          page: currentPage,
          pageSize: itemsPerPage,
        });
        setSearchResults(result.trades);
        setTotalCount(result.totalCount);
        setTotalPages(result.totalPages);
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
        setTotalCount(0);
        setTotalPages(0);
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
  }, [
    calendarId,
    debouncedSearchQuery,
    selectedTags,
    dateFilter,
    pinnedOnly,
    currentPage,
    itemsPerPage,
  ]);

  // ── Convenience handlers ────────────────────────────────────────────────
  const handleDateFilterChange = useCallback((type: DateFilterType) => {
    setDateFilter((prev) => ({
      ...prev,
      type,
      startDate: type === 'all' ? null : prev.startDate,
      endDate: type === 'all' ? null : prev.endDate,
    }));
  }, []);

  const handleStartDateChange = useCallback((date: Date | null) => {
    setDateFilter((prev) => ({ ...prev, startDate: date }));
  }, []);

  const handleEndDateChange = useCallback((date: Date | null) => {
    setDateFilter((prev) => ({ ...prev, endDate: date }));
  }, []);

  const handleClearDateFilter = useCallback(() => {
    setDateFilter({ type: 'all', startDate: null, endDate: null });
  }, []);

  const handleClearAllFilters = useCallback(() => {
    onTagsChange?.([]);
    setDateFilter({ type: 'all', startDate: null, endDate: null });
    setSelectedTagGroup('');
    setPinnedOnly(false);
  }, [onTagsChange]);

  const value = useMemo<SearchPanelStateContextValue>(
    () => ({
      searchQuery,
      setSearchQuery,
      debouncedSearchQuery,
      expandedTradeId,
      setExpandedTradeId,
      currentPage,
      setCurrentPage,
      searchResults,
      isSearching,
      totalCount,
      totalPages,
      isFilterDialogOpen,
      setIsFilterDialogOpen,
      selectedTagGroup,
      setSelectedTagGroup,
      dateFilter,
      setDateFilter,
      pinnedOnly,
      setPinnedOnly,
      handleDateFilterChange,
      handleStartDateChange,
      handleEndDateChange,
      handleClearDateFilter,
      handleClearAllFilters,
      itemsPerPage,
    }),
    [
      searchQuery,
      debouncedSearchQuery,
      expandedTradeId,
      currentPage,
      searchResults,
      isSearching,
      totalCount,
      totalPages,
      isFilterDialogOpen,
      selectedTagGroup,
      dateFilter,
      pinnedOnly,
      handleDateFilterChange,
      handleStartDateChange,
      handleEndDateChange,
      handleClearDateFilter,
      handleClearAllFilters,
      itemsPerPage,
    ],
  );

  return (
    <SearchPanelStateContext.Provider value={value}>
      {children}
    </SearchPanelStateContext.Provider>
  );
};

export const useSearchPanelState = (): SearchPanelStateContextValue => {
  const ctx = useContext(SearchPanelStateContext);
  if (!ctx) {
    throw new Error(
      'useSearchPanelState must be used within SearchPanelStateProvider',
    );
  }
  return ctx;
};
