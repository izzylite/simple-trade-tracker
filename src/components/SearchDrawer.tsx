import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
  FormControl,
  RadioGroup,
  FormControlLabel,
  Radio,
  IconButton,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Badge,
  Divider
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterAlt as FilterIcon,
  DateRange as DateRangeIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers';
import { Trade } from '../types/dualWrite';
import {
  getTagChipStyles,
  formatTagForDisplay,
  isGroupedTag,
  getTagGroup,
  getUniqueTagGroups,
  filterTagsByGroup
} from '../utils/tagColors';
import { SelectInput } from './common';
import { scrollbarStyles } from '../styles/scrollbarStyles';
import UnifiedDrawer from './common/UnifiedDrawer';
import TradeCard from './aiChat/TradeCard';
import TradeCardShimmer from './TradeCardShimmer';
import { getTradeRepository } from '../services/calendarService';

interface SearchDrawerProps {
  open: boolean;
  onClose: () => void;
  calendarId: string;
  allTags: string[];
  onTradeClick?: (trade: Trade) => void;
  // Tag filtering props
  selectedTags?: string[];
  onTagsChange?: (tags: string[]) => void;
}

// Date filter types
type DateFilterType = 'all' | 'single' | 'range';

interface DateFilter {
  type: DateFilterType;
  startDate: Date | null;
  endDate: Date | null;
}

// Pagination configuration
const ITEMS_PER_PAGE = 20;

const SearchDrawer: React.FC<SearchDrawerProps> = ({
  open,
  onClose,
  calendarId,
  allTags,
  onTradeClick,
  selectedTags = [],
  onTagsChange
}) => {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Server search state
  const [searchResults, setSearchResults] = useState<Trade[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  // Filter dialog state
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [selectedTagGroup, setSelectedTagGroup] = useState<string>('');

  // Date filtering state
  const [dateFilter, setDateFilter] = useState<DateFilter>({
    type: 'all',
    startDate: null,
    endDate: null
  });

  // Get all unique tag groups
  const tagGroups = useMemo(() => {
    return getUniqueTagGroups(allTags);
  }, [allTags]);

  // Filter tags by selected group
  const filteredTagOptions = useMemo(() => {
    if (!selectedTagGroup) return allTags;
    return filterTagsByGroup(allTags, selectedTagGroup);
  }, [allTags, selectedTagGroup]);

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedTags.length > 0) count++;
    if (dateFilter.type !== 'all') count++;
    return count;
  }, [selectedTags, dateFilter]);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, selectedTags, dateFilter]);

  // Server-side search effect
  useEffect(() => {
    const performSearch = async () => {
      // Only search if we have active filters
      if (!debouncedSearchQuery.trim() && selectedTags.length === 0 && dateFilter.type === 'all') {
        setSearchResults([]);
        setTotalCount(0);
        setTotalPages(0);
        return;
      }

      setIsSearching(true);
      try {
        const result = await getTradeRepository().searchTrades(
          calendarId,
          {
            searchQuery: debouncedSearchQuery.trim() || undefined,
            selectedTags: selectedTags.length > 0 ? selectedTags : undefined,
            dateFilter: dateFilter.type !== 'all' ? {
              type: dateFilter.type,
              startDate: dateFilter.startDate || undefined,
              endDate: dateFilter.endDate || undefined
            } : undefined,
            page: currentPage,
            pageSize: ITEMS_PER_PAGE
          }
        );

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
  }, [calendarId, debouncedSearchQuery, selectedTags, dateFilter, currentPage]);

  // Tag filtering handlers (removed - using new handlers with pagination reset)

  // Date filtering handlers
  const handleDateFilterChange = useCallback((type: DateFilterType) => {
    setDateFilter(prev => ({
      ...prev,
      type,
      // Clear dates when switching to 'all'
      startDate: type === 'all' ? null : prev.startDate,
      endDate: type === 'all' ? null : prev.endDate
    }));
  }, []);

  const handleStartDateChange = useCallback((date: Date | null) => {
    setDateFilter(prev => ({
      ...prev,
      startDate: date
    }));
  }, []);

  const handleEndDateChange = useCallback((date: Date | null) => {
    setDateFilter(prev => ({
      ...prev,
      endDate: date
    }));
  }, []);

  const handleClearDateFilter = useCallback(() => {
    setDateFilter({
      type: 'all',
      startDate: null,
      endDate: null
    });
  }, []);

  const handleClearAllFilters = useCallback(() => {
    onTagsChange?.([]);
    setDateFilter({
      type: 'all',
      startDate: null,
      endDate: null
    });
    setSelectedTagGroup('');
  }, [onTagsChange]);

  const handleTradeClick = useCallback((trade: Trade) => {
    onTradeClick?.(trade);
    onClose();
  }, [onTradeClick, onClose]);

  return (
    <>
    <UnifiedDrawer
      open={open}
      onClose={onClose}
      title="Search & Filter Trades"
      subtitle="Find trades by tags, notes, or date ranges"
      icon={<SearchIcon />}
      width={{ xs: '100%', sm: 450 }}
      contentSx={{...scrollbarStyles(theme) }}
      headerVariant="enhanced"
    >

        {/* Search Input with Filter Button */}
        <Box sx={{
          p: 3,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          background: alpha(theme.palette.background.default, 0.3)
        }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <TextField
              fullWidth
              placeholder="Search by ID, name, tags, events, or session..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  )
                }
              }}
              variant="outlined"
              size="medium"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  backgroundColor: alpha(theme.palette.background.paper, 0.8),
                  backdropFilter: 'blur(8px)',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.background.paper, 0.9)
                  },
                  '&.Mui-focused': {
                    backgroundColor: alpha(theme.palette.background.paper, 1)
                  }
                }
              }}
            />
            <Badge
              badgeContent={activeFilterCount}
              color="primary"
              sx={{
                '& .MuiBadge-badge': {
                  fontSize: '0.65rem',
                  height: 18,
                  minWidth: 18
                }
              }}
            >
              <IconButton
                onClick={() => setIsFilterDialogOpen(true)}
                size="large"
                sx={{
                  bgcolor: activeFilterCount > 0
                    ? alpha(theme.palette.primary.main, 0.15)
                    : alpha(theme.palette.text.secondary, 0.15),
                  borderRadius: 2,
                  border: activeFilterCount > 0
                    ? `1px solid ${alpha(theme.palette.primary.main, 0.3)}`
                    : `1px solid ${alpha(theme.palette.divider, 0.3)}`,
                  '&:hover': {
                    bgcolor: activeFilterCount > 0
                      ? alpha(theme.palette.primary.main, 0.25)
                      : alpha(theme.palette.text.secondary, 0.25)
                  }
                }}
              >
                <FilterIcon sx={{
                  color: activeFilterCount > 0 ? 'primary.main' : 'text.secondary'
                }} />
              </IconButton>
            </Badge>
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{
            mt: 1.5,
            display: 'block',
            fontSize: '0.75rem',
          }}>
            💡 Use multiple tags separated by spaces, commas, or semicolons to find trades with ALL specified tags
          </Typography>

          {/* Active Filters Display */}
          {activeFilterCount > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, mt: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
              {selectedTags.length > 0 && (
                <Chip
                  label={`${selectedTags.length} tag${selectedTags.length > 1 ? 's' : ''}`}
                  size="small"
                  color="primary"
                  variant="outlined"
                  onDelete={() => onTagsChange?.([])}
                  sx={{ height: 24, fontSize: '0.75rem' }}
                />
              )}
              {dateFilter.type !== 'all' && (
                <Chip
                  label={dateFilter.type === 'single' ? 'Date filter' : 'Date range'}
                  size="small"
                  color="secondary"
                  variant="outlined"
                  onDelete={handleClearDateFilter}
                  sx={{ height: 24, fontSize: '0.75rem' }}
                />
              )}
              <Button
                size="small"
                onClick={handleClearAllFilters}
                sx={{
                  fontSize: '0.7rem',
                  py: 0,
                  minHeight: 24,
                  color: 'text.secondary'
                }}
              >
                Clear all
              </Button>
            </Box>
          )}
        </Box>

        {/* Content */}
        <Box sx={{
          flex: 1,
          overflow: 'auto',
          ...scrollbarStyles(theme)
        }}>
          {/* Search Results */}
          {(searchQuery.trim() || selectedTags.length > 0 || dateFilter.type !== 'all') && (
            <Box sx={{
              flex: 1,
              overflow: 'auto',
              background: alpha(theme.palette.background.default, 0.2),
              ...scrollbarStyles(theme)
            }}>
              <Box sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {searchQuery.trim() ? 'Search Results' : 'Filtered Results'} ({totalCount})
                </Typography>

                {selectedTags.length > 0 && (
                  <Chip
                    label={`${selectedTags.length} tag filter${selectedTags.length > 1 ? 's' : ''}`}
                    size="small"
                    color="secondary"
                    variant="outlined"
                    sx={{ fontSize: '0.7rem', height: 20 }}
                  />
                )}
                {dateFilter.type !== 'all' && (
                  <Chip
                    label={`${dateFilter.type === 'single' ? 'Single date' : 'Date range'} filter`}
                    size="small"
                    color="info"
                    variant="outlined"
                    sx={{ fontSize: '0.7rem', height: 20 }}
                  />
                )}
              </Box>

              {/* Loading State */}
              {isSearching ? (
                <TradeCardShimmer count={6} />
              ) : searchResults.length === 0 ? (
                <Box sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 'calc(100vh - 400px)',
                  textAlign: 'center'
                }}>
                  <SearchIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                  <Typography variant="body1" color="text.secondary">
                    No trades found
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Try searching with different keywords
                  </Typography>
                </Box>
              ) : (
                <Box sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  ...scrollbarStyles(theme)
                }}>
                  {searchResults.map((trade) => (
                    <TradeCard
                      key={trade.id}
                      trade={trade}
                      onClick={() => handleTradeClick(trade)}
                      showTags={true}
                      showImages={false}
                    />
                  ))}
                </Box>
              )}

              {/* Pagination */}
              {totalPages > 1 && searchResults.length > 0 && (
                <Box sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  py: 3,
                  borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  gap: 2
                }}>
                  <Typography variant="body2" color="text.secondary">
                    Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of {totalCount} trades
                  </Typography>
                  <Pagination
                    count={totalPages}
                    page={currentPage}
                    onChange={(_, page) => setCurrentPage(page)}
                    color="primary"
                    size="small"
                    showFirstButton
                    showLastButton
                    sx={{
                      '& .MuiPaginationItem-root': {
                        borderRadius: 2
                      }
                    }}
                  />
                </Box>
              )}
              </Box>
            </Box>
          )}

          {/* Empty State */}
          {!searchQuery.trim() && selectedTags.length === 0 && dateFilter.type === 'all' && (
            <Box sx={{ textAlign: 'center', py: 6, px: 3 }}>
              <SearchIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600, color: 'text.secondary' }}>
                Search Your Trades
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 400, mx: 'auto', mb: 2 }}>
                Search by trade name, tags, notes, events or session. Use the filter button to narrow down results.
              </Typography>

            </Box>
          )}
        </Box>
    </UnifiedDrawer>

    {/* Filter Dialog */}
    <Dialog
      open={isFilterDialogOpen}
      onClose={() => setIsFilterDialogOpen(false)}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          maxHeight: '80vh'
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FilterIcon color="primary" />
            <Typography variant="h6">Filters</Typography>
          </Box>
          <IconButton onClick={() => setIsFilterDialogOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {/* Tag Filter Section */}
        {onTagsChange && (
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <FilterIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
              <Typography variant="subtitle2" fontWeight={600}>
                Filter by Tags
              </Typography>
              {selectedTags.length > 0 && (
                <Chip
                  label={selectedTags.length}
                  size="small"
                  color="primary"
                  sx={{ height: 20, fontSize: '0.7rem' }}
                />
              )}
            </Box>

            {tagGroups.length > 0 && (
              <SelectInput
                label="Tag Group"
                value={selectedTagGroup}
                onChange={(e) => setSelectedTagGroup(e.target.value as string)}
                options={[
                  { value: "", label: "All Tags" },
                  ...tagGroups.map(group => ({ value: group, label: group }))
                ]}
                size="small"
                sx={{ mb: 2 }}
              />
            )}

            <Autocomplete
              multiple
              options={filteredTagOptions}
              value={selectedTags}
              onChange={(_, newValue) => onTagsChange?.(newValue)}
              slotProps={{
                listbox: {
                  sx: { ...scrollbarStyles(theme) }
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  variant="outlined"
                  label="Select Tags"
                  placeholder="Choose tags"
                  fullWidth
                  size="small"
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => {
                  const { key, ...chipProps } = getTagProps({ index });
                  return (
                    <Chip
                      key={key}
                      label={formatTagForDisplay(option, true)}
                      {...chipProps}
                      sx={getTagChipStyles(option, theme)}
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
                            height: '18px',
                            fontSize: '0.7rem'
                          }}
                        />
                      )}
                      {formatTagForDisplay(option, true)}
                    </Box>
                  </li>
                );
              }}
            />
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Date Filter Section */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <DateRangeIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
            <Typography variant="subtitle2" fontWeight={600}>
              Filter by Date
            </Typography>
            {dateFilter.type !== 'all' && (
              <Chip
                label={dateFilter.type === 'single' ? 'Single' : 'Range'}
                size="small"
                color="secondary"
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            )}
          </Box>

          <FormControl component="fieldset" sx={{ width: '100%', mb: 2 }}>
            <RadioGroup
              value={dateFilter.type}
              onChange={(e) => handleDateFilterChange(e.target.value as DateFilterType)}
              sx={{ gap: 0.5 }}
            >
              <FormControlLabel
                value="all"
                control={<Radio size="small" />}
                label="All dates"
                sx={{ margin: 0 }}
              />
              <FormControlLabel
                value="single"
                control={<Radio size="small" />}
                label="Specific date"
                sx={{ margin: 0 }}
              />
              <FormControlLabel
                value="range"
                control={<Radio size="small" />}
                label="Date range"
                sx={{ margin: 0 }}
              />
            </RadioGroup>
          </FormControl>

          {dateFilter.type === 'single' && (
            <DatePicker
              label="Select Date"
              value={dateFilter.startDate}
              onChange={handleStartDateChange}
              slotProps={{
                textField: {
                  fullWidth: true,
                  size: 'small'
                }
              }}
            />
          )}

          {dateFilter.type === 'range' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <DatePicker
                label="Start Date"
                value={dateFilter.startDate}
                onChange={handleStartDateChange}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    size: 'small'
                  }
                }}
              />
              <DatePicker
                label="End Date"
                value={dateFilter.endDate}
                onChange={handleEndDateChange}
                minDate={dateFilter.startDate || undefined}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    size: 'small'
                  }
                }}
              />
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={handleClearAllFilters}
          color="inherit"
          disabled={activeFilterCount === 0}
        >
          Clear All
        </Button>
        <Button
          onClick={() => setIsFilterDialogOpen(false)}
          variant="contained"
          color="primary"
        >
          Apply
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
};

export default SearchDrawer;
