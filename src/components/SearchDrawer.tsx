import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  useTheme,
  TextField,
  alpha,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Chip,
  Divider,
  InputAdornment,
  CircularProgress,
  Autocomplete,
  Button,
  Collapse,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  IconButton
} from '@mui/material';
import {
  Search as SearchIcon,
  TrendingUp as WinIcon,
  TrendingDown as LossIcon,
  Remove as BreakevenIcon,
  CalendarToday as DateIcon,
  FilterAlt as FilterIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  DateRange as DateRangeIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers';
import { Trade } from '../types/trade';
import { format, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
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
import { logger } from '../utils/logger';
interface SearchDrawerProps {
  open: boolean;
  onClose: () => void;
  trades: Trade[];
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

// Debounce hook for search optimization
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Background search worker function
const performSearch = (trades: Trade[], query: string, selectedTags: string[] = [], dateFilter: DateFilter): Trade[] => {
  // First apply tag filtering if any tags are selected
  let filteredTrades = trades;
  if (selectedTags.length > 0) {
    filteredTrades = trades.filter(trade =>
      trade.tags?.some(tag => selectedTags.includes(tag))
    );
  }

  // Apply date filtering
  if (dateFilter.type !== 'all') {
    filteredTrades = filteredTrades.filter(trade => {
      const tradeDate = new Date(trade.date);

      if (dateFilter.type === 'single' && dateFilter.startDate) {
        const filterDate = startOfDay(dateFilter.startDate);
        const endOfFilterDate = endOfDay(dateFilter.startDate);
        return !isBefore(tradeDate, filterDate) && !isAfter(tradeDate, endOfFilterDate);
      }

      if (dateFilter.type === 'range' && dateFilter.startDate && dateFilter.endDate) {
        const startFilterDate = startOfDay(dateFilter.startDate);
        const endFilterDate = endOfDay(dateFilter.endDate);
        return !isBefore(tradeDate, startFilterDate) && !isAfter(tradeDate, endFilterDate);
      }

      return true;
    });
  }

  // If no search query, return filtered results
  if (!query.trim()) {
    return filteredTrades.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  const lowerQuery = query.toLowerCase();

  // Check if query contains multiple tags (separated by spaces, commas, or semicolons)
  const searchTerms = lowerQuery
    .split(/[,;\s]+/) // Split by comma, semicolon, or whitespace
    .map(term => term.trim())
    .filter(term => term.length > 0);

  return filteredTrades.filter(trade => {
    // For multiple search terms, check if ALL terms match (AND logic)
    // For single term, use the original OR logic across different fields

    if (searchTerms.length > 1) {
      // Multiple terms - check if ALL terms are found in the trade's tags
      return searchTerms.every(term => {
        if (!trade.tags || trade.tags.length === 0) return false;

        return trade.tags.some(tag =>
          tag.toLowerCase().includes(term) ||
          formatTagForDisplay(tag).toLowerCase().includes(term)
        );
      });
    } else {
      // Single term - search across all fields (original behavior)
      const term = searchTerms[0];

      // Search by trade name
      if (trade.name && trade.name.toLowerCase().includes(term)) {
        return true;
      }

      // Search by tags
      if (trade.tags && trade.tags.some(tag =>
        tag.toLowerCase().includes(term) ||
        formatTagForDisplay(tag).toLowerCase().includes(term)
      )) {
        return true;
      }

      // Search by notes
      if (trade.notes && trade.notes.toLowerCase().includes(term)) {
        return true;
      }

      // Search by session
      if (trade.session && trade.session.toLowerCase().includes(term)) {
        return true;
      }

      return false;
    }
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Sort by date, newest first
};

// Background tag suggestion function
const getSuggestedTags = (allTags: string[], query: string): string[] => {
  if (!query.trim()) return [];

  // Get the last term being typed (for multi-tag support)
  const terms = query.split(/[,;\s]+/).map(term => term.trim()).filter(term => term.length > 0);
  const lastTerm = terms[terms.length - 1]?.toLowerCase() || '';

  if (!lastTerm) return [];

  // Filter out tags that are already in the search query
  const existingTags = terms.slice(0, -1).map(term => term.toLowerCase());

  return allTags
    .filter(tag => {
      const lowerTag = tag.toLowerCase();
      const displayTag = formatTagForDisplay(tag).toLowerCase();

      // Don't suggest tags that are already included
      if (existingTags.some(existing =>
        lowerTag.includes(existing) || displayTag.includes(existing)
      )) {
        return false;
      }

      // Match the current term being typed
      return lowerTag.includes(lastTerm) || displayTag.includes(lastTerm);
    })
    .slice(0, 5); // Limit to 5 suggestions
};

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
  const [isSearching, setIsSearching] = useState(false);
  const [filteredTrades, setFilteredTrades] = useState<Trade[]>([]);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);

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

  // Debounce search query to avoid excessive calculations
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Perform search in background when debounced query or selected tags change
  useEffect(() => {
    if (!open) return; // Don't search if drawer is closed

    const performBackgroundSearch = async () => {
      setIsSearching(true);

      // Use setTimeout to move computation to next tick (background)
      setTimeout(() => {
        try {
          const results = performSearch(trades, debouncedSearchQuery, selectedTags, dateFilter);
          const suggestions = getSuggestedTags(allTags, debouncedSearchQuery);

          setFilteredTrades(results);
          setSuggestedTags(suggestions);
        } catch (error) {
          logger.error('Search error:', error);
          setFilteredTrades([]);
          setSuggestedTags([]);
        } finally {
          setIsSearching(false);
        }
      }, 0);
    };

    performBackgroundSearch();
  }, [debouncedSearchQuery, selectedTags, dateFilter, trades, allTags, open]);

  // Reset search when drawer closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setFilteredTrades([]);
      setSuggestedTags([]);
      setIsSearching(false);
      setSelectedTagGroup('');
      setIsDateFilterExpanded(false);
      setDateFilter({
        type: 'all',
        startDate: null,
        endDate: null
      });
    }
  }, [open]);

  // Tag filtering handlers
  const handleTagsChange = useCallback((tags: string[]) => {
    onTagsChange?.(tags);
  }, [onTagsChange]);

  const handleClearTags = useCallback(() => {
    onTagsChange?.([]);
  }, [onTagsChange]);

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

  const getTradeTypeIcon = (type: Trade['type']) => {
    switch (type) {
      case 'win':
        return <WinIcon sx={{ fontSize: 20, color: 'success.main' }} />;
      case 'loss':
        return <LossIcon sx={{ fontSize: 20, color: 'error.main' }} />;
      case 'breakeven':
        return <BreakevenIcon sx={{ fontSize: 20, color: 'text.secondary' }} />;
    }
  };

  const getTradeTypeColor = (type: Trade['type']) => {
    switch (type) {
      case 'win':
        return theme.palette.success.main;
      case 'loss':
        return theme.palette.error.main;
      case 'breakeven':
        return theme.palette.text.secondary;
    }
  };

  const handleTagClick = useCallback((tag: string) => {
    // Smart tag appending for multi-tag search
    const currentTerms = searchQuery.split(/[,;\s]+/).map(term => term.trim()).filter(term => term.length > 0);

    if (currentTerms.length === 0) {
      // No existing terms, just set the tag
      setSearchQuery(tag);
    } else {
      // Replace the last term (which is being typed) with the selected tag
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
            placeholder="Search by name, tags, notes, or session..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    {isSearching ? (
                      <CircularProgress size={20} sx={{ color: 'text.secondary' }} />
                    ) : (
                      <SearchIcon sx={{ color: 'text.secondary' }} />
                    )}
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

        {/* Tag Filter Section */}
        {onTagsChange && (
          <Box sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
            <Box sx={{ p: 2, pb: 1 }}>
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: selectedTags.length > 0 ? 'primary.main' : 'text.secondary',
                fontWeight: selectedTags.length > 0 ? 600 : 400
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                  <FilterIcon sx={{ fontSize: 20 }} />
                  <Typography variant="body2">
                    Filter by Tags
                  </Typography>
                  {selectedTags.length > 0 && (
                    <Chip
                      label={`${selectedTags.length} selected`}
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
            </Box>

            <Collapse in={isFilterExpanded}>
              <Box sx={{ px: 2, pb: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {tagGroups.length > 0 && (
                    <SelectInput
                      label="Filter by Tag Group"
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
                    onChange={(_, newValue) => handleTagsChange(newValue)}
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
                        placeholder="Choose tags to filter"
                        fullWidth
                        size="small"
                      />
                    )}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          label={formatTagForDisplay(option, true)}
                          {...getTagProps({ index })}
                          sx={getTagChipStyles(option, theme)}
                          title={isGroupedTag(option) ? `Group: ${getTagGroup(option)}` : undefined}
                        />
                      ))
                    }
                    renderOption={(props, option) => (
                      <li {...props}>
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
                    )}
                  />

                  {selectedTags.length > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        {selectedTags.length} tag{selectedTags.length > 1 ? 's' : ''} selected
                      </Typography>
                      <Button onClick={handleClearTags} size="small" color="inherit">
                        Clear All
                      </Button>
                    </Box>
                  )}
                </Box>
              </Box>
            </Collapse>
          </Box>
        )}

        {/* Date Filter Section */}
        <Box sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Box sx={{ p: 2, pb: 1 }}>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: dateFilter.type !== 'all' ? 'primary.main' : 'text.secondary',
              fontWeight: dateFilter.type !== 'all' ? 600 : 400
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                <DateRangeIcon sx={{ fontSize: 20 }} />
                <Typography variant="body2">
                  Filter by Date
                </Typography>
                {dateFilter.type !== 'all' && (
                  <Chip
                    label={
                      dateFilter.type === 'single'
                        ? 'Single Date'
                        : dateFilter.type === 'range'
                        ? 'Date Range'
                        : ''
                    }
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
          </Box>

          <Collapse in={isDateFilterExpanded}>
            <Box sx={{ px: 2, pb: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControl component="fieldset" sx={{ width: '100%' }}>
                  <RadioGroup
                    value={dateFilter.type}
                    onChange={(e) => handleDateFilterChange(e.target.value as DateFilterType)}
                    sx={{ gap: 1 }}
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

                {/* Date Pickers */}
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

                {/* Date Filter Summary and Clear Button */}
                {dateFilter.type !== 'all' && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {/* Summary */}
                    <Box sx={{ p: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        {dateFilter.type === 'single' && dateFilter.startDate && (
                          <>Showing trades from: <strong>{format(dateFilter.startDate, 'MMM dd, yyyy')}</strong></>
                        )}
                        {dateFilter.type === 'range' && dateFilter.startDate && dateFilter.endDate && (
                          <>
                            Showing trades from: <strong>{format(dateFilter.startDate, 'MMM dd, yyyy')}</strong> to <strong>{format(dateFilter.endDate, 'MMM dd, yyyy')}</strong>
                          </>
                        )}
                        {dateFilter.type === 'range' && dateFilter.startDate && !dateFilter.endDate && (
                          <>Showing trades from: <strong>{format(dateFilter.startDate, 'MMM dd, yyyy')}</strong> onwards</>
                        )}
                      </Typography>
                    </Box>

                    {/* Clear Button */}
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Button onClick={handleClearDateFilter} size="small" color="inherit">
                        Clear Date Filter
                      </Button>
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>
          </Collapse>
        </Box>

        {/* Content */}
        <Box sx={{
          flex: 1,
          overflow: 'auto',
          ...scrollbarStyles(theme)
        }}>
          {/* Tag Suggestions */}
          {suggestedTags.length > 0 && (
            <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Tag Suggestions
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {suggestedTags.map((tag) => (
                  <Chip
                    key={tag}
                    label={formatTagForDisplay(tag, true)}
                    size="small"
                    clickable
                    onClick={() => handleTagClick(tag)}
                    sx={{
                      ...getTagChipStyles(tag, theme),
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.primary.main, 0.1)
                      }
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}

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
                  {searchQuery.trim() ? 'Search Results' : 'Filtered Results'} {!isSearching && `(${filteredTrades.length})`}
                </Typography>
                {(() => {
                  const terms = searchQuery.split(/[,;\s]+/).map(term => term.trim()).filter(term => term.length > 0);
                  if (terms.length > 1) {
                    return (
                      <Chip
                        label={`${terms.length} search terms (AND)`}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem', height: 20 }}
                      />
                    );
                  }
                  return null;
                })()}
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

              {isSearching ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <CircularProgress size={40} sx={{ mb: 2 }} />
                  <Typography variant="body1" color="text.secondary">
                    Searching trades...
                  </Typography>
                </Box>
              ) : filteredTrades.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <SearchIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                  <Typography variant="body1" color="text.secondary">
                    No trades found
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Try searching with different keywords
                  </Typography>
                </Box>
              ) : (
                <List sx={{
                  p: 0,
                  ...scrollbarStyles(theme)
                }}>
                  {filteredTrades.map((trade, index) => (
                    <React.Fragment key={trade.id}>
                      <ListItem disablePadding>
                        <ListItemButton
                          onClick={() => handleTradeClick(trade)}
                          sx={{
                            p: 2,
                            '&:hover': {
                              backgroundColor: alpha(theme.palette.primary.main, 0.05)
                            }
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, width: '100%' }}>
                            {/* Trade Type Icon */}
                            <Box sx={{ mt: 0.5 }}>
                              {getTradeTypeIcon(trade.type)}
                            </Box>

                            {/* Trade Content */}
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <ListItemText
                                primary={
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                                    <Typography
                                      variant="subtitle1"
                                      sx={{
                                        fontWeight: 600,
                                        color: 'text.primary',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        flex: 1,
                                        mr: 1
                                      }}
                                    >
                                      {trade.name || `Trade ${trade.id.slice(-6)}`}
                                    </Typography>
                                    <Typography
                                      variant="subtitle1"
                                      sx={{
                                        fontWeight: 700,
                                        color: getTradeTypeColor(trade.type),
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      {trade.amount > 0 ? '+' : ''}${Math.abs(trade.amount).toFixed(2)}
                                    </Typography>
                                  </Box>
                                }
                                secondary={
                                  <Box>
                                    {/* Date and Session */}
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                      <DateIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                      <Typography variant="body2" color="text.secondary">
                                        {format(new Date(trade.date), 'MMM dd, yyyy')}
                                      </Typography>
                                      {trade.session && (
                                        <Chip
                                          label={trade.session}
                                          size="small"
                                          variant="outlined"
                                          sx={{
                                            height: 20,
                                            fontSize: '0.7rem',
                                            borderColor: alpha(theme.palette.text.secondary, 0.3),
                                            color: 'text.secondary'
                                          }}
                                        />
                                      )}
                                    </Box>

                                    {/* Tags */}
                                    {trade.tags && trade.tags.length > 0 && (
                                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                        {trade.tags.slice(0, 3).map((tag) => (
                                          <Chip
                                            key={tag}
                                            label={formatTagForDisplay(tag, true)}
                                            size="small"
                                            variant="outlined"
                                            sx={{
                                              height: 20,
                                              fontSize: '0.7rem',
                                              ...getTagChipStyles(tag, theme)
                                            }}
                                          />
                                        ))}
                                        {trade.tags.length > 3 && (
                                          <Chip
                                            label={`+${trade.tags.length - 3}`}
                                            size="small"
                                            variant="outlined"
                                            sx={{
                                              height: 20,
                                              fontSize: '0.7rem',
                                              borderColor: alpha(theme.palette.text.secondary, 0.3),
                                              color: 'text.secondary'
                                            }}
                                          />
                                        )}
                                      </Box>
                                    )}
                                  </Box>
                                }
                              />
                            </Box>
                          </Box>
                        </ListItemButton>
                      </ListItem>
                      {index < filteredTrades.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
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
              <Box sx={{ textAlign: 'left', maxWidth: 400, mx: 'auto' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
                  Examples:
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  • <code>scalping</code> - Find trades with "scalping" tag
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  • <code>scalping, morning</code> - Find trades with BOTH tags
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  • <code>EURUSD breakout</code> - Find trades with both terms
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  • Use tag filters to show trades with specific tags
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • Use date filters to show trades from specific dates or ranges
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
    </UnifiedDrawer>
  );
};

export default SearchDrawer;
