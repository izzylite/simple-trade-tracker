import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  FormControlLabel,
  Checkbox,
  Chip,
  useTheme,
  InputAdornment,
  Paper,
  Stack
} from '@mui/material';
import { Search, Clear } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { Trade } from '../../types/trade';

interface TagSelectorProps {
  trades: Trade[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
}

const TagSelector: React.FC<TagSelectorProps> = ({
  trades,
  selectedTags,
  onTagsChange
}) => {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');

  // Get all unique tags from trades
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    trades.forEach(trade => {
      if (trade.tags) {
        trade.tags.forEach(tag => {
          // Filter out Partials tags
          if (!tag.startsWith('Partials:')) {
            tagSet.add(tag);
          }
        });
      }
    });
    return Array.from(tagSet).sort();
  }, [trades]);

  // Filter tags based on search query
  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return allTags;
    return allTags.filter(tag =>
      tag.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allTags, searchQuery]);

  // Calculate tag usage statistics
  const tagStats = useMemo(() => {
    const stats: Record<string, { count: number; percentage: number }> = {};
    allTags.forEach(tag => {
      const count = trades.filter(trade => 
        trade.tags && trade.tags.includes(tag)
      ).length;
      const percentage = trades.length > 0 ? Math.round((count / trades.length) * 100) : 0;
      stats[tag] = { count, percentage };
    });
    return stats;
  }, [allTags, trades]);

  const handleTagToggle = (tag: string) => {
    const newSelectedTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag];
    onTagsChange(newSelectedTags);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const handleClearAll = () => {
    onTagsChange([]);
  };

  return (
    <Paper
      sx={{
        p: 3,
        backgroundColor: theme.palette.mode === 'dark'
          ? alpha(theme.palette.background.paper, 0.6)
          : alpha(theme.palette.background.paper, 0.8),
        borderRadius: 2,
        border: `1px solid ${theme.palette.mode === 'dark'
          ? alpha(theme.palette.common.white, 0.1)
          : alpha(theme.palette.common.black, 0.1)}`
      }}
    >
      <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
        🏷️ Common Strategies Tracking
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Select specific tags to track their usage frequency across your trades. This will show how often you use each selected strategy in the Analysis tab.
      </Typography>

      {/* Search Field */}
      <TextField
        fullWidth
        size="small"
        placeholder="Search tags..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        sx={{ mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search sx={{ color: 'text.secondary' }} />
            </InputAdornment>
          ),
          endAdornment: searchQuery && (
            <InputAdornment position="end">
              <Clear
                sx={{ 
                  color: 'text.secondary', 
                  cursor: 'pointer',
                  '&:hover': { color: 'primary.main' }
                }}
                onClick={handleClearSearch}
              />
            </InputAdornment>
          )
        }}
      />

      {/* Tag List with Custom Scrollbar */}
      <Box
        sx={{
          maxHeight: 300,
          overflowY: 'auto',
          mb: 2,
          pr: 1,
          // Custom scrollbar styling
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: theme.palette.mode === 'dark'
              ? alpha(theme.palette.common.white, 0.1)
              : alpha(theme.palette.common.black, 0.1),
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: theme.palette.mode === 'dark'
              ? alpha(theme.palette.common.white, 0.3)
              : alpha(theme.palette.common.black, 0.3),
            borderRadius: '4px',
            '&:hover': {
              background: theme.palette.mode === 'dark'
                ? alpha(theme.palette.common.white, 0.4)
                : alpha(theme.palette.common.black, 0.4),
            }
          },
          // Firefox scrollbar styling
          scrollbarWidth: 'thin',
          scrollbarColor: theme.palette.mode === 'dark'
            ? `${alpha(theme.palette.common.white, 0.3)} ${alpha(theme.palette.common.white, 0.1)}`
            : `${alpha(theme.palette.common.black, 0.3)} ${alpha(theme.palette.common.black, 0.1)}`,
        }}
      >
        {filteredTags.length > 0 ? (
          filteredTags.map(tag => {
            const stats = tagStats[tag];
            return (
              <FormControlLabel
                key={tag}
                control={
                  <Checkbox
                    checked={selectedTags.includes(tag)}
                    onChange={() => handleTagToggle(tag)}
                    size="small"
                  />
                }
                label={
                  <Box sx={{ ml: 1 }}>
                    <Typography variant="body2">{tag}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Used in {stats.count} trades ({stats.percentage}%)
                    </Typography>
                  </Box>
                }
                sx={{ 
                  display: 'block', 
                  mb: 1,
                  '& .MuiFormControlLabel-label': {
                    width: '100%'
                  }
                }}
              />
            );
          })
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
            {searchQuery ? 'No tags found matching your search.' : 'No tags available.'}
          </Typography>
        )}
      </Box>

      {/* Selected Tags Summary */}
      {selectedTags.length > 0 && (
        <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="subtitle2">
              Selected Tags ({selectedTags.length}):
            </Typography>
            <Chip
              label="Clear All"
              size="small"
              onClick={handleClearAll}
              sx={{ cursor: 'pointer' }}
            />
          </Stack>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {selectedTags.map(tag => {
              const stats = tagStats[tag];
              return (
                <Chip
                  key={tag}
                  label={`${tag} (${stats.percentage}%)`}
                  size="small"
                  color={stats.percentage >= 50 ? 'success' : stats.percentage >= 25 ? 'warning' : 'default'}
                  onDelete={() => handleTagToggle(tag)}
                />
              );
            })}
          </Box>
        </Box>
      )}

      {searchQuery && filteredTags.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
          No tags found for "{searchQuery}". Try a different search term.
        </Typography>
      )}
    </Paper>
  );
};

export default TagSelector;
