/**
 * SearchContent Component
 * Inner content for trade search — usable inside a drawer (mobile) or side panel (desktop)
 */

import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  useTheme,
  TextField,
  alpha,
  Chip,
  InputAdornment,
  Autocomplete,
  Button,
  IconButton,
  Dialog,
  Switch,
  Tooltip
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  DateRange as DateRangeIcon,
  Close as CloseIcon,
  Clear as ClearIcon,
  PushPin as PushPinIcon,
  KeyboardArrowDown as ArrowDownIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers';
import { Trade } from '../../types/dualWrite';
import {
  getTagChipStyles,
  formatTagForDisplay,
  isGroupedTag,
  getTagGroup,
  getUniqueTagGroups,
  filterTagsByGroup
} from 'utils/tagColors';
import { SelectInput } from 'components/common';
import { getInsetSurface } from 'styles/designTokens';
import { scrollbarStyles } from 'styles/scrollbarStyles';
import { dialogProps } from 'styles/dialogStyles';
import { Z_INDEX } from 'styles/zIndex';
import { useDialogTokens, MONO_FONT } from 'styles/dialogTokens';
import { useIsMobile } from 'hooks/useResponsive';
import {
  useFullScreenDialog,
  SAFE_AREA_TOP,
  SAFE_AREA_BOTTOM,
} from 'components/common/useFullScreenDialog';
import TradeList from '../trades/TradeList';
import TradeCardShimmer from '../TradeCardShimmer';
import { useTradeOperations } from '../../contexts/TradeOperationsContext';
import { useTradeViewer } from '../../contexts/TradeViewerContext';
import {
  useSearchPanelState,
  DateFilter,
  DateFilterType,
} from '../../contexts/SearchPanelStateContext';

export interface SearchContentProps {
  /** Kept for backward compatibility with parent call sites; the search
   *  effect itself reads calendarId from SearchPanelStateContext. */
  calendarId?: string;
  allTags: string[];
  // Tag filtering props
  selectedTags?: string[];
  onTagsChange?: (tags: string[]) => void;
  /** Reserved for future use (e.g. focusing the input on activation). */
  isActive?: boolean;
}

const SearchContent: React.FC<SearchContentProps> = ({
  allTags,
  selectedTags = [],
  onTagsChange,
}) => {
  const theme = useTheme();
  const subtleBg = getInsetSurface(theme);
  const baseTradeOperations = useTradeOperations();
  const tradeViewer = useTradeViewer();

  // ── Persistent state lives in SearchPanelStateContext (mounted in
  //    TradeCalendarPage) so it survives the lg↔︎drawer breakpoint swap.
  const {
    searchQuery,
    setSearchQuery,
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
    pinnedOnly,
    setPinnedOnly,
    handleDateFilterChange,
    handleStartDateChange,
    handleEndDateChange,
    handleClearDateFilter,
    handleClearAllFilters,
    itemsPerPage,
  } = useSearchPanelState();

  // Merge the app-level ops with viewer-driven handlers so per-row actions
  // inside the expanded TradeDetailExpanded (gallery, image zoom) work
  // without the search panel having to thread props from above.
  const tradeOperations = useMemo(
    () => ({
      ...baseTradeOperations,
      onOpenGalleryMode: (
        trades: Trade[],
        initialTradeId?: string,
        title?: string,
      ) =>
        tradeViewer.openGallery({
          trades,
          initialTradeId,
          title: title ?? 'Search Results',
        }),
      onZoomImage: tradeViewer.openImageZoom,
    }),
    [baseTradeOperations, tradeViewer],
  );

  // Tag-group dropdown options + filtered autocomplete (purely derived from
  // props — kept local since they don't need to survive breakpoint swaps).
  const tagGroups = useMemo(() => getUniqueTagGroups(allTags), [allTags]);
  const filteredTagOptions = useMemo(() => {
    if (!selectedTagGroup) return allTags;
    return filterTagsByGroup(allTags, selectedTagGroup);
  }, [allTags, selectedTagGroup]);

  // Active filter count (drives the badge on the Filters button).
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedTags.length > 0) count++;
    if (dateFilter.type !== 'all') count++;
    if (pinnedOnly) count++;
    return count;
  }, [selectedTags, dateFilter, pinnedOnly]);

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      bgcolor: 'background.paper',
    }}>
      {/* Search + filter row */}
      <Box sx={{ px: 1.75, pt: 1.5, pb: 1, display: 'flex', gap: 0.75 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search trades…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: '0.95rem', color: 'text.disabled' }} />
              </InputAdornment>
            ),
            endAdornment: searchQuery ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchQuery('')} edge="end">
                  <ClearIcon sx={{ fontSize: '0.85rem' }} />
                </IconButton>
              </InputAdornment>
            ) : undefined,
            sx: {
              borderRadius: '8px',
              fontSize: '0.82rem',
              bgcolor: subtleBg,
              '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.divider },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: alpha(theme.palette.primary.main, 0.4),
              },
            },
          }}
        />
        <Tooltip title="Filters" placement="bottom">
          <Box
            component="button"
            onClick={() => setIsFilterDialogOpen(true)}
            sx={{
              height: { xs: 44, sm: 34 },
              px: 1.25,
              display: 'flex',
              alignItems: 'center',
              gap: 0.625,
              bgcolor: activeFilterCount > 0
                ? alpha(theme.palette.primary.main, 0.1)
                : subtleBg,
              border: `1px solid ${
                activeFilterCount > 0
                  ? alpha(theme.palette.primary.main, 0.35)
                  : theme.palette.divider
              }`,
              borderRadius: '8px',
              color: activeFilterCount > 0 ? 'primary.main' : 'text.secondary',
              font: 'inherit',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 120ms',
              flexShrink: 0,
              '&:hover': {
                borderColor: alpha(theme.palette.primary.main, 0.4),
              },
            }}
          >
            <FilterIcon sx={{ fontSize: '0.95rem' }} />
            Filters
            {activeFilterCount > 0 && (
              <Box
                component="span"
                sx={{
                  fontSize: '0.66rem',
                  px: 0.625,
                  borderRadius: '999px',
                  bgcolor: alpha(theme.palette.primary.main, 0.18),
                  color: 'primary.main',
                  fontWeight: 700,
                  fontFeatureSettings: "'tnum' on",
                  lineHeight: 1.4,
                }}
              >
                {activeFilterCount}
              </Box>
            )}
            <ArrowDownIcon sx={{ fontSize: '0.85rem' }} />
          </Box>
        </Tooltip>
      </Box>

      {/* Hint copy — shown only when nothing is active yet */}
      {activeFilterCount === 0 && !searchQuery.trim() && (
        <Box sx={{ px: 1.75, pb: 1 }}>
          <Typography
            sx={{
              fontSize: '0.7rem',
              color: 'text.disabled',
              lineHeight: 1.5,
            }}
          >
            Search by name, tags, notes, events or session. Separate tags with spaces or commas
            to match trades that have all of them.
          </Typography>
        </Box>
      )}

      {/* Active filter pills */}
      {activeFilterCount > 0 && (
        <Box
          sx={{
            px: 1.75,
            pb: 1.25,
            display: 'flex',
            gap: 0.5,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          {selectedTags.length > 0 && (
            <Chip
              label={`${selectedTags.length} tag${selectedTags.length > 1 ? 's' : ''}`}
              size="small"
              variant="outlined"
              onDelete={() => onTagsChange?.([])}
              sx={{
                height: 22,
                fontSize: '0.7rem',
                borderRadius: '999px',
                borderColor: alpha(theme.palette.primary.main, 0.35),
                color: 'primary.main',
                bgcolor: alpha(theme.palette.primary.main, 0.06),
                '& .MuiChip-deleteIcon': { fontSize: '0.85rem', color: 'primary.main' },
              }}
            />
          )}
          {dateFilter.type !== 'all' && (
            <Chip
              icon={<DateRangeIcon sx={{ fontSize: 12 }} />}
              label={dateFilter.type === 'single' ? 'Single date' : 'Date range'}
              size="small"
              variant="outlined"
              onDelete={handleClearDateFilter}
              sx={{
                height: 22,
                fontSize: '0.7rem',
                borderRadius: '999px',
                borderColor: theme.palette.divider,
                color: 'text.secondary',
                bgcolor: subtleBg,
                '& .MuiChip-icon': { color: 'text.disabled', ml: 0.5 },
                '& .MuiChip-deleteIcon': { fontSize: '0.85rem' },
              }}
            />
          )}
          {pinnedOnly && (
            <Chip
              icon={<PushPinIcon sx={{ fontSize: 12 }} />}
              label="Pinned only"
              size="small"
              variant="outlined"
              onDelete={() => setPinnedOnly(false)}
              sx={{
                height: 22,
                fontSize: '0.7rem',
                borderRadius: '999px',
                borderColor: theme.palette.divider,
                color: 'text.secondary',
                bgcolor: subtleBg,
                '& .MuiChip-icon': { color: 'text.disabled', ml: 0.5 },
                '& .MuiChip-deleteIcon': { fontSize: '0.85rem' },
              }}
            />
          )}
          <Box
            component="button"
            onClick={handleClearAllFilters}
            sx={{
              ml: 'auto',
              border: 0,
              bgcolor: 'transparent',
              color: 'text.disabled',
              font: 'inherit',
              fontSize: '0.7rem',
              fontWeight: 600,
              cursor: 'pointer',
              px: 0.5,
              py: 0.25,
              borderRadius: '6px',
              transition: 'color 120ms',
              '&:hover': { color: 'text.primary' },
            }}
          >
            Clear all
          </Box>
        </Box>
      )}

      {/* Content */}
      <Box sx={{
        flex: 1,
        overflow: 'auto',
        ...scrollbarStyles(theme),
      }}>
        {/* Search Results */}
        {(searchQuery.trim() || selectedTags.length > 0 || dateFilter.type !== 'all' || pinnedOnly) && (
          <Box sx={{ px: 1.75, pt: 0.5, pb: 1.25 }}>
            {/* Result heading */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 0.75,
                mb: 1,
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'text.secondary',
                }}
              >
                {searchQuery.trim() ? 'Results' : 'Filtered'}
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.7rem',
                  color: 'text.disabled',
                  fontFeatureSettings: "'tnum' on, 'lnum' on",
                }}
              >
                {totalCount} {totalCount === 1 ? 'trade' : 'trades'}
              </Typography>
            </Box>

            {/* Loading / Empty / List */}
            {isSearching ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <TradeCardShimmer count={6} />
              </Box>
            ) : searchResults.length === 0 ? (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  py: 5,
                  px: 2,
                  border: `1px dashed ${theme.palette.divider}`,
                  borderRadius: '10px',
                  bgcolor: subtleBg,
                }}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '10px',
                    bgcolor: alpha(theme.palette.text.primary, 0.06),
                    display: 'grid',
                    placeItems: 'center',
                    mb: 1.25,
                  }}
                >
                  <SearchIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                </Box>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
                  No trades found
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled', maxWidth: 240 }}>
                  Try different keywords or loosen your filters.
                </Typography>
              </Box>
            ) : (
              <TradeList
                trades={searchResults}
                expandedTradeId={expandedTradeId}
                onTradeClick={(tradeId) =>
                  setExpandedTradeId((prev) => (prev === tradeId ? null : tradeId))
                }
                hideHeader
                tradeOperations={tradeOperations}
                sx={{ mt: 0 }}
              />
            )}

            {/* Pagination — prev/next with range + position */}
            {totalPages > 1 && searchResults.length > 0 && (
              <Box
                sx={{
                  mt: 1.5,
                  pt: 1.25,
                  borderTop: `1px solid ${theme.palette.divider}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.7rem',
                    color: 'text.disabled',
                    fontFeatureSettings: "'tnum' on, 'lnum' on",
                    flexShrink: 0,
                  }}
                >
                  {((currentPage - 1) * itemsPerPage) + 1}
                  –{Math.min(currentPage * itemsPerPage, totalCount)}
                  <Box component="span" sx={{ color: 'text.disabled', mx: 0.5 }}>of</Box>
                  {totalCount}
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <IconButton
                    size="small"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    aria-label="Previous page"
                    sx={{
                      width: { xs: 40, sm: 28 },
                      height: { xs: 40, sm: 28 },
                      borderRadius: '8px',
                      border: `1px solid ${theme.palette.divider}`,
                      bgcolor: subtleBg,
                      color: 'text.secondary',
                      '&:hover': {
                        borderColor: alpha(theme.palette.primary.main, 0.4),
                        color: 'text.primary',
                      },
                      '&.Mui-disabled': {
                        opacity: 0.4,
                        bgcolor: subtleBg,
                      },
                    }}
                  >
                    <ChevronLeftIcon sx={{ fontSize: '1rem' }} />
                  </IconButton>

                  <Box
                    sx={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: 'text.secondary',
                      fontFeatureSettings: "'tnum' on, 'lnum' on",
                      minWidth: 56,
                      textAlign: 'center',
                      px: 0.5,
                    }}
                  >
                    <Box component="span" sx={{ color: 'text.primary' }}>
                      {currentPage}
                    </Box>
                    <Box component="span" sx={{ color: 'text.disabled', mx: 0.5 }}>
                      /
                    </Box>
                    {totalPages}
                  </Box>

                  <IconButton
                    size="small"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    aria-label="Next page"
                    sx={{
                      width: { xs: 40, sm: 28 },
                      height: { xs: 40, sm: 28 },
                      borderRadius: '8px',
                      border: `1px solid ${theme.palette.divider}`,
                      bgcolor: subtleBg,
                      color: 'text.secondary',
                      '&:hover': {
                        borderColor: alpha(theme.palette.primary.main, 0.4),
                        color: 'text.primary',
                      },
                      '&.Mui-disabled': {
                        opacity: 0.4,
                        bgcolor: subtleBg,
                      },
                    }}
                  >
                    <ChevronRightIcon sx={{ fontSize: '1rem' }} />
                  </IconButton>
                </Box>
              </Box>
            )}
          </Box>
        )}

        {/* Empty State — no query, no filters */}
        {!searchQuery.trim() && selectedTags.length === 0 && dateFilter.type === 'all' && !pinnedOnly && (
          <Box
            sx={{
              minHeight: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              px: 3,
              py: 6,
            }}
          >
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '12px',
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.22)}`,
                display: 'grid',
                placeItems: 'center',
                color: 'primary.main',
                mb: 1.5,
              }}
            >
              <SearchIcon sx={{ fontSize: 22 }} />
            </Box>
            <Typography
              sx={{ fontSize: '0.95rem', fontWeight: 700, letterSpacing: '-0.01em', mb: 0.5 }}
            >
              Search your trades
            </Typography>
            <Typography
              sx={{
                fontSize: '0.75rem',
                color: 'text.disabled',
                maxWidth: 280,
                lineHeight: 1.55,
              }}
            >
              Find trades by name, tags, notes, events or session — or narrow by date and pinned
              status from the Filters menu.
            </Typography>
          </Box>
        )}
      </Box>

      {/* Filter Dialog — follows the canonical TagFormDialog pattern */}
      <FilterDialog
        open={isFilterDialogOpen}
        onClose={() => setIsFilterDialogOpen(false)}
        activeFilterCount={activeFilterCount}
        pinnedOnly={pinnedOnly}
        onPinnedOnlyChange={setPinnedOnly}
        onTagsChange={onTagsChange}
        selectedTags={selectedTags}
        tagGroups={tagGroups}
        selectedTagGroup={selectedTagGroup}
        onSelectedTagGroupChange={setSelectedTagGroup}
        filteredTagOptions={filteredTagOptions}
        dateFilter={dateFilter}
        onDateFilterTypeChange={handleDateFilterChange}
        onStartDateChange={handleStartDateChange}
        onEndDateChange={handleEndDateChange}
        onClearAll={handleClearAllFilters}
      />
    </Box>
  );
};

// ─── Filter dialog ──────────────────────────────────────────────────────────
// Matches the canonical TagFormDialog look: hairline border, violet icon tile,
// mono uppercase eyebrows, surface-inset inputs, footer with Cancel + primary.

interface FilterDialogProps {
  open: boolean;
  onClose: () => void;
  activeFilterCount: number;
  pinnedOnly: boolean;
  onPinnedOnlyChange: (value: boolean) => void;
  onTagsChange?: (tags: string[]) => void;
  selectedTags: string[];
  tagGroups: string[];
  selectedTagGroup: string;
  onSelectedTagGroupChange: (value: string) => void;
  filteredTagOptions: string[];
  dateFilter: DateFilter;
  onDateFilterTypeChange: (type: DateFilterType) => void;
  onStartDateChange: (date: Date | null) => void;
  onEndDateChange: (date: Date | null) => void;
  onClearAll: () => void;
}

const FilterDialog: React.FC<FilterDialogProps> = ({
  open,
  onClose,
  activeFilterCount,
  pinnedOnly,
  onPinnedOnlyChange,
  onTagsChange,
  selectedTags,
  tagGroups,
  selectedTagGroup,
  onSelectedTagGroupChange,
  filteredTagOptions,
  dateFilter,
  onDateFilterTypeChange,
  onStartDateChange,
  onEndDateChange,
  onClearAll,
}) => {
  const theme = useTheme();
  const isMobile = useIsMobile();
  const { fullScreen, fullScreenPaperSx } = useFullScreenDialog();
  const {
    violet, violetSoft, violetBorder,
    surfaceInset, hairline,
    paperSx, headerSx, iconAvatarSx, footerSx,
    monoLabelSx, inputSx,
    primaryButtonSx, ghostButtonSx,
  } = useDialogTokens();

  // On phones the X DatePickers force their desktop variant (desktopPaper),
  // whose popper overflows the viewport. Dropping the forced desktop slot lets
  // MUI X pick the responsive/mobile picker (full-screen modal) instead.
  const datePickerSlotProps = {
    textField: { fullWidth: true, size: 'small' as const, sx: inputSx },
    popper: { sx: { zIndex: Z_INDEX.DIALOG_POPUP } },
    ...(isMobile ? {} : { desktopPaper: { sx: { zIndex: Z_INDEX.DIALOG_POPUP } } }),
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={fullScreen}
      {...dialogProps}
      sx={{ zIndex: Z_INDEX.DIALOG }}
      slotProps={{
        paper: {
          sx: {
            ...paperSx,
            // Full-screen: stack header/body/footer in a flex column so the
            // body can flex to fill and the footer pins to the bottom.
            ...(fullScreen ? { display: 'flex', flexDirection: 'column' } : {}),
            ...fullScreenPaperSx,
          },
        },
      }}
    >
      {/* Header */}
      <Box sx={{ ...headerSx, pt: fullScreen ? SAFE_AREA_TOP : undefined }}>
        <Box sx={iconAvatarSx}>
          <FilterIcon sx={{ fontSize: 18 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
            Filters
          </Typography>
          <Typography
            sx={{ fontSize: '0.78rem', color: theme.palette.text.secondary, lineHeight: 1.3 }}
          >
            {activeFilterCount === 0
              ? 'Narrow your search by tags, date, or pinned trades'
              : `${activeFilterCount} active ${activeFilterCount === 1 ? 'filter' : 'filters'}`}
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ color: theme.palette.text.secondary }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Body */}
      <Box
        sx={{
          px: 2.5,
          py: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2.25,
          ...scrollbarStyles(theme),
          overflowY: 'auto',
          // Drop the fixed cap when full-screen so the body flexes to fill
          // the dialog; otherwise keep the bounded scroll region.
          ...(fullScreen ? { flex: 1, minHeight: 0 } : { maxHeight: '70vh' }),
        }}
      >
        {/* Pinned-only row */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Typography sx={monoLabelSx}>Pinned</Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1.5,
              px: 1.5,
              py: 1.1,
              borderRadius: 1.5,
              border: `1px solid ${hairline}`,
              backgroundColor: surfaceInset,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: 1.25,
                  display: 'grid',
                  placeItems: 'center',
                  backgroundColor: pinnedOnly ? violetSoft : alpha(theme.palette.text.primary, 0.06),
                  color: pinnedOnly ? violet : theme.palette.text.secondary,
                  border: `1px solid ${pinnedOnly ? violetBorder : hairline}`,
                  flexShrink: 0,
                  transition: 'all 120ms',
                }}
              >
                <PushPinIcon sx={{ fontSize: 14 }} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.88rem', fontWeight: 600, lineHeight: 1.25 }}>
                  Pinned only
                </Typography>
                <Typography
                  sx={{ fontSize: '0.75rem', color: theme.palette.text.secondary, lineHeight: 1.4 }}
                >
                  Show only trades you've pinned.
                </Typography>
              </Box>
            </Box>
            <Switch
              checked={pinnedOnly}
              onChange={(e) => onPinnedOnlyChange(e.target.checked)}
              color="primary"
              size="small"
            />
          </Box>
        </Box>

        {/* Tag Filter Section */}
        {onTagsChange && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Typography sx={monoLabelSx}>Tags</Typography>
              {selectedTags.length > 0 && (
                <Typography
                  sx={{
                    fontFamily: MONO_FONT,
                    fontSize: '0.66rem',
                    fontWeight: 600,
                    color: violet,
                    letterSpacing: '0.08em',
                    fontFeatureSettings: "'tnum' on",
                  }}
                >
                  {selectedTags.length} SELECTED
                </Typography>
              )}
            </Box>

            {tagGroups.length > 0 && (
              <SelectInput
                label="Tag group"
                value={selectedTagGroup}
                onChange={(e) => onSelectedTagGroupChange(e.target.value as string)}
                options={[
                  { value: '', label: 'All tags' },
                  ...tagGroups.map((group) => ({ value: group, label: group })),
                ]}
                size="small"
              />
            )}

            <Autocomplete
              multiple
              options={filteredTagOptions}
              value={selectedTags}
              onChange={(_, newValue) => onTagsChange?.(newValue)}
              slotProps={{
                popper: { sx: { zIndex: Z_INDEX.DIALOG_POPUP } },
                listbox: { sx: { ...scrollbarStyles(theme), fontSize: '0.85rem' } },
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  variant="outlined"
                  placeholder={selectedTags.length === 0 ? 'Pick one or more tags' : ''}
                  fullWidth
                  size="small"
                  sx={inputSx}
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => {
                  const { key, ...chipProps } = getTagProps({ index });
                  return (
                    <Chip
                      key={key}
                      label={formatTagForDisplay(option, true)}
                      size="small"
                      {...chipProps}
                      sx={{
                        ...getTagChipStyles(option, theme),
                        height: 22,
                        fontSize: '0.72rem',
                      }}
                      title={isGroupedTag(option) ? `Group: ${getTagGroup(option)}` : undefined}
                    />
                  );
                })
              }
              renderOption={(props, option) => {
                const { key, ...restProps } = props;
                return (
                  <li key={key} {...restProps}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {isGroupedTag(option) && (
                        <Chip
                          label={getTagGroup(option)}
                          size="small"
                          sx={{
                            ...getTagChipStyles(option, theme),
                            height: 18,
                            fontSize: '0.65rem',
                          }}
                        />
                      )}
                      <Typography sx={{ fontSize: '0.85rem' }}>
                        {formatTagForDisplay(option, true)}
                      </Typography>
                    </Box>
                  </li>
                );
              }}
            />
          </Box>
        )}

        {/* Date Filter Section */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Typography sx={monoLabelSx}>
              <DateRangeIcon sx={{ fontSize: 14 }} />
              Date
            </Typography>
            {dateFilter.type !== 'all' && (
              <Typography
                sx={{
                  fontFamily: MONO_FONT,
                  fontSize: '0.66rem',
                  fontWeight: 600,
                  color: violet,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {dateFilter.type === 'single' ? 'Single date' : 'Range'}
              </Typography>
            )}
          </Box>

          {/* Segmented control */}
          <Box
            sx={{
              display: 'flex',
              backgroundColor: surfaceInset,
              border: `1px solid ${hairline}`,
              borderRadius: 1.5,
              padding: '3px',
              gap: '3px',
            }}
          >
            {(
              [
                { value: 'all', label: 'All dates' },
                { value: 'single', label: 'Specific' },
                { value: 'range', label: 'Range' },
              ] as const
            ).map((opt) => {
              const selected = dateFilter.type === opt.value;
              return (
                <Box
                  key={opt.value}
                  component="button"
                  onClick={() => onDateFilterTypeChange(opt.value)}
                  sx={{
                    flex: 1,
                    px: 1,
                    py: 0.75,
                    backgroundColor: selected ? violetSoft : 'transparent',
                    border: `1px solid ${selected ? violetBorder : 'transparent'}`,
                    borderRadius: 1.25,
                    color: selected ? violet : theme.palette.text.secondary,
                    font: 'inherit',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 120ms ease',
                    '&:hover': {
                      color: selected ? violet : theme.palette.text.primary,
                    },
                  }}
                >
                  {opt.label}
                </Box>
              );
            })}
          </Box>

          {dateFilter.type === 'single' && (
            <DatePicker
              label="Select date"
              value={dateFilter.startDate}
              onChange={onStartDateChange}
              slotProps={datePickerSlotProps}
            />
          )}

          {dateFilter.type === 'range' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              <DatePicker
                label="Start date"
                value={dateFilter.startDate}
                onChange={onStartDateChange}
                slotProps={datePickerSlotProps}
              />
              <DatePicker
                label="End date"
                value={dateFilter.endDate}
                onChange={onEndDateChange}
                minDate={dateFilter.startDate || undefined}
                slotProps={datePickerSlotProps}
              />
            </Box>
          )}
        </Box>
      </Box>

      {/* Footer */}
      <Box
        sx={{
          ...footerSx,
          justifyContent: 'space-between',
          pb: fullScreen ? SAFE_AREA_BOTTOM : undefined,
        }}
      >
        <Button
          onClick={onClearAll}
          disabled={activeFilterCount === 0}
          sx={{ ...ghostButtonSx, fontSize: '0.82rem' }}
        >
          Clear all
        </Button>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            onClick={onClose}
            sx={ghostButtonSx}
          >
            Cancel
          </Button>
          <Button
            onClick={onClose}
            variant="contained"
            sx={primaryButtonSx}
          >
            Done
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
};

export default SearchContent;
