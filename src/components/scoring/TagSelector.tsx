import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  FormControlLabel,
  Checkbox,
  Chip,
  useTheme,
  Autocomplete,
  Stack
} from '@mui/material';

import { alpha } from '@mui/material/styles';
import { Trade } from '../../types/trade';
import { getTagChipStyles, formatTagForDisplay } from '../../utils/tagColors';

interface TagSelectorProps {
  trades: Trade[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  allTags?: string[]; // Add allTags prop to receive calendar.tags
}

const TagSelector: React.FC<TagSelectorProps> = ({
  trades,
  selectedTags,
  onTagsChange,
  allTags: propAllTags
}) => {
  const theme = useTheme();
  const [inputValue, setInputValue] = useState('');

  // Use calendar.tags from props, fallback to extracting from trades if not available
  const allTags = useMemo(() => {
    if (propAllTags && propAllTags.length > 0) {
      // Filter out Partials tags from calendar.tags
      return propAllTags.filter(tag => !tag.startsWith('Partials:')).sort();
    }

    // Fallback: extract from trades (for backwards compatibility)
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
  }, [propAllTags, trades]);

  // Available tags (not already selected)
  const availableTags = useMemo(() => {
    return allTags.filter(tag => !selectedTags.includes(tag));
  }, [allTags, selectedTags]);

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

  const handleAddTag = (tag: string) => {
    if (tag && !selectedTags.includes(tag)) {
      onTagsChange([...selectedTags, tag]);
      setInputValue('');
    }
  };

  const handleAutocompleteChange = (_: any, value: string | null) => {
    if (value) {
      handleAddTag(value);
    }
  };

  const handleClearAll = () => {
    onTagsChange([]);
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Select specific tags to track their usage frequency across your trades. This will show how often you use each selected strategy in the Analysis tab.
      </Typography>

      {/* Add Tag Dropdown */}
      <Box mb={2}>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
          Add Tags to Track
        </Typography>
        <Autocomplete
          value={null}
          inputValue={inputValue}
          onInputChange={(_, newInputValue) => setInputValue(newInputValue)}
          onChange={handleAutocompleteChange}
          options={availableTags}
          getOptionLabel={(option) => formatTagForDisplay(option)}
          renderOption={(props, option) => {
            const stats = tagStats[option];
            return (
              <Box component="li" {...props}>
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <Chip
                    label={formatTagForDisplay(option)}
                    size="small"
                    sx={getTagChipStyles(option, theme)}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    {stats.count} trades ({stats.percentage}%)
                  </Typography>
                </Box>
              </Box>
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Search for tags to track..."
              variant="outlined"
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: theme.palette.mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.05)'
                    : 'rgba(0, 0, 0, 0.02)',
                }
              }}
            />
          )}
          noOptionsText={
            availableTags.length === 0
              ? "All tags are already selected"
              : "No matching tags found"
          }
          disabled={availableTags.length === 0}
        />
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
                  sx={{
                    ...getTagChipStyles(tag, theme),
                    '& .MuiChip-deleteIcon': {
                      color: 'inherit',
                      '&:hover': {
                        color: 'inherit',
                        opacity: 0.7
                      }
                    }
                  }}
                  onDelete={() => handleTagToggle(tag)}
                />
              );
            })}
          </Box>
        </Box>
      )}

    </Box>
  );
};

export default TagSelector;
