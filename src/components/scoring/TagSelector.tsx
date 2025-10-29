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
  Stack,
  List,
  ListItem,
  ListItemText,
  Button,
  Divider,
  InputAdornment
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';

import { alpha } from '@mui/material/styles';
import { Trade, Calendar } from '../../types/dualWrite'; 
import {
  getTagChipStyles,
  formatTagForDisplay,
  isGroupedTag,
  getTagGroup,
  getUniqueTagGroups,
  filterTagsByGroup
} from '../../utils/tagColors';
import { scrollbarStyles } from '../../styles/scrollbarStyles';

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
  const [searchTerm, setSearchTerm] = useState('');

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

  // Filter tags based on search term
  const filteredTags = useMemo(() => {
    if (!searchTerm) return allTags;

    const term = searchTerm.toLowerCase();
    return allTags.filter(tag =>
      tag.toLowerCase().includes(term) ||
      formatTagForDisplay(tag).toLowerCase().includes(term)
    );
  }, [allTags, searchTerm]);

  // Available tags (not already selected) from filtered tags
  const availableTags = useMemo(() => {
    return filteredTags.filter(tag => !selectedTags.includes(tag));
  }, [filteredTags, selectedTags]);

  // Group available tags by their group
  const groupedAvailableTags = useMemo(() => {
    const groups: Record<string, string[]> = {};

    availableTags.forEach(tag => {
      if (isGroupedTag(tag)) {
        const group = getTagGroup(tag);
        if (!groups[group]) {
          groups[group] = [];
        }
        groups[group].push(tag);
      } else {
        if (!groups['Ungrouped']) {
          groups['Ungrouped'] = [];
        }
        groups['Ungrouped'].push(tag);
      }
    });

    return groups;
  }, [availableTags]);

  const handleAddTag = (tag: string) => {
    if (tag && !selectedTags.includes(tag)) {
      onTagsChange([...selectedTags, tag]);
    }
  };

  const handleRemoveTag = (tag: string) => {
    onTagsChange(selectedTags.filter(t => t !== tag));
  };

  const handleAddAllInCategory = (category: string) => {
    const categoryTags = groupedAvailableTags[category] || [];
    const newSelectedTags = [...selectedTags, ...categoryTags];
    onTagsChange(newSelectedTags);
  };

  const handleClearAll = () => {
    onTagsChange([]);
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Select specific tags to track their usage frequency across your trades. This will show how often you use each selected strategy in the Analysis tab.
      </Typography>

      {/* Search Field */}
      <Box mb={2}>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
          Add Tags to Track
        </Typography>
        <TextField
          placeholder="Search for tags to track..."
          variant="outlined"
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }
          }}
          sx={{
            width: '100%',
            '& .MuiOutlinedInput-root': {
              backgroundColor: theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.05)'
                : 'rgba(0, 0, 0, 0.02)',
            }
          }}
        />
      </Box>

      {/* Available Tags by Category */}
      {Object.keys(groupedAvailableTags).length > 0 && (
        <Box sx={{
          maxHeight: '300px',
          overflow: 'auto',
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 1,
          mb: 2,
          ...scrollbarStyles(theme)
        }}>
          {Object.entries(groupedAvailableTags).map(([group, tags]) => (
            <Box key={group}>
              <Box sx={{
                p: 1.5,
                bgcolor: alpha(theme.palette.primary.main, 0.05),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle2" fontWeight={600}>
                    {group}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {tags.length} tag{tags.length !== 1 ? 's' : ''}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleAddAllInCategory(group)}
                  sx={{ minWidth: 'auto', px: 1 }}
                >
                  Add All
                </Button>
              </Box>
              <Divider />
              <List disablePadding>
                {tags.map((tag) => {
                  const stats = tagStats[tag] || { count: 0, percentage: 0 };
                  return (
                    <ListItem
                      key={tag}
                      secondaryAction={
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => handleAddTag(tag)}
                          sx={{ minWidth: 'auto', p: 0.5 }}
                        >
                          Add
                        </Button>
                      }
                      sx={{
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.05)
                        }
                      }}
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                              label={formatTagForDisplay(tag, true)}
                              size="small"
                              sx={getTagChipStyles(tag, theme)}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {stats.count} trades ({stats.percentage}%)
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  );
                })}
              </List>
            </Box>
          ))}
        </Box>
      )}

      {Object.keys(groupedAvailableTags).length === 0 && (
        <Box sx={{
          p: 2,
          textAlign: 'center',
          color: 'text.secondary',
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 1,
          mb: 2
        }}>
          <Typography variant="body2">
            {searchTerm ? 'No matching tags found' : 'All tags are already selected'}
          </Typography>
        </Box>
      )}

     

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
              const stats = tagStats[tag] || { count: 0, percentage: 0 };
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
                  onDelete={() => handleRemoveTag(tag)}
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
