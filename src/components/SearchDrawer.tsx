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
  Collapse,
  FormControl,
  RadioGroup,
  FormControlLabel,
  Radio,
  IconButton,
  Pagination
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterAlt as FilterIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  DateRange as DateRangeIcon
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
import { startOfDay, endOfDay, isWithinInterval } from 'date-fns';

interface SearchDrawerProps {
  open: boolean;
  onClose: () => void;
  trades: Trade[]; // Changed from calendarId to trades array
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
  trades,
  allTags,
  onTradeClick,
  selectedTags = [],
  onTagsChange
}) => {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Tag filtering state
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [selectedTagGroup, setSelectedTagGroup] = useState<string>('');

  // Date filtering state
  const [isDateFilterExpanded, setIsDateFilterExpanded] = useState(false);
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

  // Client-side filtering of trades
  const filteredTrades = useMemo(() => {
    let filtered = [...trades];

    // Filter by search query (id, name, notes, tags, or economic events)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(trade => {
        // Search by trade ID
        if (trade.id?.toLowerCase().includes(query)) return true;

        // Search in trade name
        if (trade.name?.toLowerCase().includes(query)) return true;

        // Search in trade notes
        if (trade.notes?.toLowerCase().includes(query)) return true;

        // Search in tags (both full tag and tag name after colon)
        if (trade.tags?.some(tag => {
          const lowerTag = tag.toLowerCase();
          // Match full tag (e.g., "strategy:scalp")
          if (lowerTag.includes(query)) return true;
          // Match tag name only (e.g., "scalp" from "Strategy:Scalp")
          if (tag.includes(':')) {
            const tagName = tag.split(':')[1]?.toLowerCase();
            if (tagName?.includes(query)) return true;
          }
          return false;
        })) return true;

        // Search in economic events
        if (trade.economic_events?.some(event => event.name.toLowerCase().includes(query))) return true;

        return false;
      });
    }

    // Filter by selected tags
    if (selectedTags.length > 0) {
      filtered = filtered.filter(trade =>
        selectedTags.every(tag => trade.tags?.includes(tag))
      );
    }

    // Filter by date
    if (dateFilter.type === 'single' && dateFilter.startDate) {
      const targetDate = startOfDay(dateFilter.startDate);
      const targetDateEnd = endOfDay(dateFilter.startDate);
      filtered = filtered.filter(trade => {
        const tradeDate = trade.trade_date instanceof Date ? trade.trade_date : new Date(trade.trade_date);
        return isWithinInterval(tradeDate, { start: targetDate, end: targetDateEnd });
      });
    } else if (dateFilter.type === 'range' && dateFilter.startDate && dateFilter.endDate) {
      const start = startOfDay(dateFilter.startDate);
      const end = endOfDay(dateFilter.endDate);
      filtered = filtered.filter(trade => {
        const tradeDate = trade.trade_date instanceof Date ? trade.trade_date : new Date(trade.trade_date);
        return isWithinInterval(tradeDate, { start, end });
      });
    }

    return filtered;
  }, [trades, searchQuery, selectedTags, dateFilter]);

  // Calculate pagination
  const paginationData = useMemo(() => {
    const totalItems = filteredTrades.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedTrades = filteredTrades.slice(startIndex, endIndex);

    return {
      totalItems,
      totalPages,
      paginatedTrades,
      hasResults: totalItems > 0,
      showPagination: totalPages > 1
    };
  }, [filteredTrades, currentPage]);

  // Reset pagination to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedTags, dateFilter]);

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



  const handleTagClick = useCallback((tag: string) => {
    const currentTerms = searchQuery
      .split(/[,;\s]+/)
      .map(term => term.trim())
      .filter(term => term.length > 0);

    if (currentTerms.length === 0) {
      setSearchQuery(tag);
    } else {
      const newTerms = [...currentTerms.slice(0, -1), tag];
      setSearchQuery(newTerms.join(', ') + ', ');
    }
  }, [searchQuery]);

  const handleTradeClick = useCallback((trade: Trade) => {
    onTradeClick?.(trade);
    onClose();
  }, [onTradeClick, onClose]);

  return (
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

        {/* Search Input */}
        <Box sx={{
          p: 3,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          background: alpha(theme.palette.background.default, 0.3)
        }}>
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
          <Typography variant="caption" color="text.secondary" sx={{
            mt: 1.5,
            display: 'block',
            fontSize: '0.75rem', 
          }}>
            💡 Use multiple tags separated by spaces, commas, or semicolons to find trades with ALL specified tags
          </Typography>
        </Box>

        {/* Filters Section - Side by Side */}
        <Box sx={{ borderBottom: `1px solid ${theme.palette.divider}`, p: 2 }}>
          <Box sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2
          }}>
            {/* Tag Filter */}
            {onTagsChange && (
              <Box sx={{ flex: 1 }}>
                <Box>
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    color: selectedTags.length > 0 ? 'primary.main' : 'text.secondary',
                    fontWeight: selectedTags.length > 0 ? 600 : 400,
                    mb: 1
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                      <FilterIcon sx={{ fontSize: 20 }} />
                      <Typography variant="body2">
                        Filter by Tags
                      </Typography>
                      {selectedTags.length > 0 && (
                        <Chip
                          label={`${selectedTags.length}`}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      )}
                    </Box>
                    <IconButton
                      onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                      size="small"
                      sx={{
                        color: 'inherit',
                        '&:hover': {
                          backgroundColor: alpha(theme.palette.primary.main, 0.1)
                        }
                      }}
                    >
                      {isFilterExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>

                  <Collapse in={isFilterExpanded}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                        />
                      )}

                      <Autocomplete
                        multiple
                        options={filteredTagOptions}
                        value={selectedTags}
                        onChange={(_, newValue) => onTagsChange?.(newValue)}
                        slotProps={{
                          listbox: {
                            sx: {
                              ...scrollbarStyles(theme)
                            }
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

                      {selectedTags.length > 0 && (
                        <Button onClick={() => onTagsChange?.([])} size="small" color="inherit" fullWidth>
                          Clear Tags
                        </Button>
                      )}
                    </Box>
                  </Collapse>
                </Box>
              </Box>
            )}

            {/* Date Filter */}
            <Box sx={{ flex: 1 }}>
              <Box>
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  color: dateFilter.type !== 'all' ? 'primary.main' : 'text.secondary',
                  fontWeight: dateFilter.type !== 'all' ? 600 : 400,
                  mb: 1
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                    <DateRangeIcon sx={{ fontSize: 20 }} />
                    <Typography variant="body2">
                      Filter by Date
                    </Typography>
                    {dateFilter.type !== 'all' && (
                      <Chip
                        label={dateFilter.type === 'single' ? 'Single' : 'Range'}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                    )}
                  </Box>
                  <IconButton
                    onClick={() => setIsDateFilterExpanded(!isDateFilterExpanded)}
                    size="small"
                    sx={{
                      color: 'inherit',
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.primary.main, 0.1)
                      }
                    }}
                  >
                    {isDateFilterExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Box>

                <Collapse in={isDateFilterExpanded}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <FormControl component="fieldset" sx={{ width: '100%' }}>
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

                    {dateFilter.type !== 'all' && (
                      <Button onClick={handleClearDateFilter} size="small" color="inherit" fullWidth>
                        Clear Date
                      </Button>
                    )}
                  </Box>
                </Collapse>
              </Box>
            </Box>
          </Box>
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
                  {searchQuery.trim() ? 'Search Results' : 'Filtered Results'} ({paginationData.totalItems})
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

              {!paginationData.hasResults ? (
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
                  {paginationData.paginatedTrades.map((trade) => (
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
              {paginationData.showPagination && paginationData.hasResults && (
                <Box sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  py: 3,
                  borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  gap: 2
                }}>
                  <Typography variant="body2" color="text.secondary">
                    Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, paginationData.totalItems)} of {paginationData.totalItems} trades
                  </Typography>
                  <Pagination
                    count={paginationData.totalPages}
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
                Search by trade name, tags, notes, or session. Use tag and date filters to narrow down results.
              </Typography>
             
            </Box>
          )}
        </Box>
    </UnifiedDrawer>
  );
};

export default SearchDrawer;
