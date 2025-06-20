import React, { useState } from 'react';
import {
  Box,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  Stack,
  Button,
  IconButton,
  Popover,
  Divider,
  Typography
} from '@mui/material';
import {
  FilterList,
  Clear,
  Search,
  KeyboardArrowDown,
  Close
} from '@mui/icons-material';

import { BlogFilters as BlogFiltersType, BlogCategory, NewsSource } from '../../types/blog';
import { getDateRange } from '../../utils/blog';
import NewsSourceSelector from './NewsSourceSelector';
import { scrollbarStyles } from '../../styles/scrollbarStyles';

interface BlogFiltersProps {
  filters: BlogFiltersType;
  sources: NewsSource[];
  availableTags: string[];
  onFiltersChange: (filters: BlogFiltersType) => void;
  onClearFilters: () => void;
  isLoading?: boolean;
}

const BlogFilters: React.FC<BlogFiltersProps> = ({
  filters,
  sources,
  availableTags,
  onFiltersChange,
  onClearFilters,
  isLoading = false
}) => {
  const [searchInput, setSearchInput] = useState(filters.searchQuery || '');
  const [filterAnchorEl, setFilterAnchorEl] = useState<HTMLElement | null>(null);

  const handleFilterChange = (key: keyof BlogFiltersType, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleFilterChange('searchQuery', searchInput.trim() || undefined);
  };

  const handleDateRangePreset = (preset: 'today' | 'week' | 'month' | 'year') => {
    const range = getDateRange(preset);
    handleFilterChange('dateRange', range);
  };

  const handleTagToggle = (tag: string) => {
    const currentTags = filters.tags || [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];

    handleFilterChange('tags', newTags.length > 0 ? newTags : undefined);
  };

  const getCategoryDisplayName = (category: BlogCategory): string => {
    return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const hasActiveFilters = !!(
    filters.category ||
    filters.source ||
    (filters.sources && filters.sources.length > 0) ||
    filters.dateRange ||
    filters.tags?.length ||
    filters.searchQuery
  );

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.category) count++;
    if (filters.source) count++;
    if (filters.sources && filters.sources.length > 0) count++;
    if (filters.dateRange) count++;
    if (filters.tags?.length) count++;
    if (filters.searchQuery) count++;
    return count;
  };

  return (
    <Paper
      sx={{
        p: 2,
        mb: 3,
        borderRadius: 2,
        background: (theme) => theme.palette.mode === 'dark'
          ? 'rgba(30, 30, 30, 0.8)'
          : 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(8px)',
        border: (theme) => `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
        boxShadow: (theme) => theme.palette.mode === 'dark'
          ? '0 4px 20px rgba(0, 0, 0, 0.2)'
          : '0 4px 20px rgba(0, 0, 0, 0.06)'
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', md: 'center' }}
        sx={{ flexWrap: 'wrap', gap: 1.5 }}
      >
        {/* Search Bar */}
        <Box
          component="form"
          onSubmit={handleSearchSubmit}
          sx={{ flex: { xs: '1 1 100%', md: '1 1 300px' }, minWidth: 250 }}
        >
          <TextField
            size="small"
            fullWidth
            placeholder="Search articles..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            slotProps={{
              input: {
                startAdornment: <Search sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />,
                endAdornment: searchInput && (
                  <IconButton
                    size="small"
                    onClick={() => {
                      setSearchInput('');
                      handleFilterChange('searchQuery', undefined);
                    }}
                  >
                    <Clear fontSize="small" />
                  </IconButton>
                )
              }
            }}
            disabled={isLoading}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 1.5,
                backgroundColor: (theme) => theme.palette.mode === 'dark'
                  ? 'rgba(255, 255, 255, 0.05)'
                  : 'rgba(0, 0, 0, 0.02)',
                '&:hover': {
                  backgroundColor: (theme) => theme.palette.mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(0, 0, 0, 0.04)',
                }
              }
            }}
          />
        </Box>

        {/* Quick Date Filters */}
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button
            size="small"
            variant={!filters.dateRange ? "contained" : "outlined"}
            onClick={() => handleFilterChange('dateRange', undefined)}
            sx={{
              borderRadius: 1.5,
              px: 2,
              py: 0.5,
              fontWeight: 500,
              textTransform: 'none',
              minWidth: 'auto',
              fontSize: '0.875rem'
            }}
          >
            All Time
          </Button>
          <Button
            size="small"
            variant={filters.dateRange &&
              filters.dateRange.start.toDateString() === getDateRange('today').start.toDateString()
              ? "contained" : "outlined"}
            onClick={() => handleDateRangePreset('today')}
            sx={{
              borderRadius: 1.5,
              px: 2,
              py: 0.5,
              fontWeight: 500,
              textTransform: 'none',
              minWidth: 'auto',
              fontSize: '0.875rem'
            }}
          >
            Today
          </Button>
          <Button
            size="small"
            variant={filters.dateRange &&
              filters.dateRange.start.toDateString() === getDateRange('week').start.toDateString()
              ? "contained" : "outlined"}
            onClick={() => handleDateRangePreset('week')}
            sx={{
              borderRadius: 1.5,
              px: 2,
              py: 0.5,
              fontWeight: 500,
              textTransform: 'none',
              minWidth: 'auto',
              fontSize: '0.875rem'
            }}
          >
            This Week
          </Button>
          <Button
            size="small"
            variant={filters.dateRange &&
              filters.dateRange.start.toDateString() === getDateRange('month').start.toDateString()
              ? "contained" : "outlined"}
            onClick={() => handleDateRangePreset('month')}
            sx={{
              borderRadius: 1.5,
              px: 2,
              py: 0.5,
              fontWeight: 500,
              textTransform: 'none',
              minWidth: 'auto',
              fontSize: '0.875rem'
            }}
          >
            This Month
          </Button>
        </Stack>

        {/* Category Filter */}
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Category</InputLabel>
          <Select
            value={filters.category || ''}
            label="Category"
            onChange={(e) => handleFilterChange('category', e.target.value || undefined)}
            disabled={isLoading}
            sx={{
              borderRadius: 1.5,
              '& .MuiSelect-select': {
                fontSize: '0.875rem'
              }
            }}
          >
            <MenuItem value="">All Categories</MenuItem>
            {Object.values(BlogCategory).map((category) => (
              <MenuItem key={category} value={category}>
                {getCategoryDisplayName(category)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Source Filter */}
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Source</InputLabel>
          <Select
            value={filters.source || ''}
            label="Source"
            onChange={(e) => handleFilterChange('source', e.target.value || undefined)}
            disabled={isLoading}
            sx={{
              borderRadius: 1.5,
              '& .MuiSelect-select': {
                fontSize: '0.875rem'
              }
            }}
          >
            <MenuItem value="">All Sources</MenuItem>
            {sources.map((source) => (
              <MenuItem key={source.id} value={source.id}>
                {source.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Selected Sources Indicator */}
        {filters.sources && filters.sources.length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Sources:
            </Typography>
            <Chip
              label={`${filters.sources.length} selected`}
              size="small"
              color="primary"
              variant="outlined"
              onDelete={() => handleFilterChange('sources', undefined)}
              deleteIcon={<Clear fontSize="small" />}
              sx={{
                height: 24,
                fontSize: '0.75rem',
                '& .MuiChip-deleteIcon': {
                  fontSize: '16px'
                }
              }}
            />
          </Box>
        )}

        {/* Advanced Filters Button */}
        <Button
          size="small"
          variant="outlined"
          startIcon={<FilterList />}
          endIcon={<KeyboardArrowDown />}
          onClick={(e) => setFilterAnchorEl(e.currentTarget)}
          disabled={isLoading}
          sx={{
            borderRadius: 1.5,
            px: 2,
            py: 0.5,
            fontWeight: 500,
            textTransform: 'none',
            fontSize: '0.875rem',
            minWidth: 'auto',
            ...(hasActiveFilters && {
              borderColor: 'primary.main',
              color: 'primary.main'
            })
          }}
        >
          More
          {hasActiveFilters && (
            <Chip
              label={getActiveFilterCount()}
              size="small"
              color="primary"
              sx={{ ml: 1, height: 18, fontSize: '0.75rem' }}
            />
          )}
        </Button>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <IconButton
            size="small"
            onClick={onClearFilters}
            disabled={isLoading}
            sx={{
              color: 'text.secondary',
              '&:hover': {
                color: 'error.main',
                backgroundColor: 'error.main',
                '& .MuiSvgIcon-root': {
                  color: 'white'
                }
              }
            }}
          >
            <Clear fontSize="small" />
          </IconButton>
        )}
      </Stack>

      {/* Advanced Filters Popover */}
      <Popover
        open={Boolean(filterAnchorEl)}
        anchorEl={filterAnchorEl}
        onClose={() => setFilterAnchorEl(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        slotProps={{
          paper: {
            sx: (theme) => ({
              p: 3,
              minWidth: 400,
              maxWidth: 500,
              maxHeight: 600,
              borderRadius: 2,
              boxShadow: theme.palette.mode === 'dark'
                ? '0 8px 32px rgba(0, 0, 0, 0.4)'
                : '0 8px 32px rgba(0, 0, 0, 0.12)',
              ...scrollbarStyles(theme)
            })
          }
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Advanced Filters
          </Typography>
          <IconButton
            size="small"
            onClick={() => setFilterAnchorEl(null)}
          >
            <Close />
          </IconButton>
        </Box>

        <Stack spacing={3}>
          {/* NewsAPI Sources */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                NewsAPI Sources
              </Typography>
              {filters.sources && filters.sources.length > 0 && (
                <Button
                  size="small"
                  variant="text"
                  color="error"
                  onClick={() => handleFilterChange('sources', undefined)}
                  sx={{
                    minWidth: 'auto',
                    px: 1,
                    fontSize: '0.75rem',
                    textTransform: 'none'
                  }}
                >
                  Clear All
                </Button>
              )}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Select specific news sources for enhanced search results
            </Typography>
            <NewsSourceSelector
              selectedSources={filters.sources || []}
              onSourcesChange={(sources) => handleFilterChange('sources', sources.length > 0 ? sources : undefined)}
              multiple={true}
              size="small"
              fullWidth={true}
            />
          </Box>

          <Divider />

          {/* Tags */}
          {availableTags.length > 0 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Tags
                </Typography>
                {filters.tags && filters.tags.length > 0 && (
                  <Button
                    size="small"
                    variant="text"
                    color="error"
                    onClick={() => handleFilterChange('tags', undefined)}
                    sx={{
                      minWidth: 'auto',
                      px: 1,
                      fontSize: '0.75rem',
                      textTransform: 'none'
                    }}
                  >
                    Clear All
                  </Button>
                )}
              </Box>
              <Box sx={(theme) => ({ display: 'flex', flexWrap: 'wrap', gap: 1, ...scrollbarStyles(theme) })}>
                {availableTags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    clickable
                    size="small"
                    variant={filters.tags?.includes(tag) ? "filled" : "outlined"}
                    color={filters.tags?.includes(tag) ? "primary" : "default"}
                    onClick={() => handleTagToggle(tag)}
                    disabled={isLoading}
                  />
                ))}
              </Box>
            </Box>
          )}

          <Divider />

          {/* Sorting */}
          <Box>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
              Sort Options
            </Typography>
            <Stack direction="row" spacing={2}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={filters.sortBy || 'publishedAt'}
                  label="Sort By"
                  onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                  disabled={isLoading}
                >
                  <MenuItem value="publishedAt">Date</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Order</InputLabel>
                <Select
                  value={filters.sortOrder || 'desc'}
                  label="Order"
                  onChange={(e) => handleFilterChange('sortOrder', e.target.value as 'asc' | 'desc')}
                  disabled={isLoading}
                >
                  <MenuItem value="desc">Newest First</MenuItem>
                  <MenuItem value="asc">Oldest First</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </Box>
        </Stack>
      </Popover>
    </Paper>
  );
};

export default BlogFilters;
