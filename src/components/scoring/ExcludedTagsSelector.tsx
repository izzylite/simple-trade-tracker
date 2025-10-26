import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Chip,
  Stack,
  TextField,
  Autocomplete,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Alert,
  List,
  ListItem,
  ListItemText,
  Button,
  Divider,
  InputAdornment
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { HelpOutline, Close, Search as SearchIcon } from '@mui/icons-material';
import { Trade } from '../../types/dualWrite';
import {
  getTagChipStyles,
  formatTagForDisplay,
  isGroupedTag,
  getTagGroup,
  getUniqueTagGroups,
  filterTagsByGroup
} from '../../utils/tagColors';
import { scrollbarStyles } from '../../styles/scrollbarStyles';

interface ExcludedTagsSelectorProps {
  trades: Trade[];
  excludedTags: string[];
  onExcludedTagsChange: (tags: string[]) => void;
  allTags?: string[]; // Add allTags prop to receive calendar.tags
}

const ExcludedTagsSelector: React.FC<ExcludedTagsSelectorProps> = ({
  trades,
  excludedTags,
  onExcludedTagsChange,
  allTags: propAllTags
}) => {
  const theme = useTheme();
  const [searchTerm, setSearchTerm] = useState('');

  // Use calendar.tags from props, fallback to extracting from trades if not available
  const allTags = useMemo(() => {
    if (propAllTags && propAllTags.length > 0) {
      // Filter out system tags like Partials from calendar.tags
      return propAllTags.filter(tag => !tag.startsWith('Partials:')).sort();
    }

    // Fallback: extract from trades (for backwards compatibility)
    const tagSet = new Set<string>();
    trades.forEach(trade => {
      if (trade.tags) {
        trade.tags.forEach(tag => {
          // Filter out system tags like Partials
          if (!tag.startsWith('Partials:')) {
            tagSet.add(tag);
          }
        });
      }
    });
    return Array.from(tagSet).sort();
  }, [propAllTags, trades]);

  // Filter tags based on search term
  const filteredTags = useMemo(() => {
    if (!searchTerm) return allTags;

    const term = searchTerm.toLowerCase();
    return allTags.filter(tag =>
      tag.toLowerCase().includes(term) ||
      formatTagForDisplay(tag).toLowerCase().includes(term)
    );
  }, [allTags, searchTerm]);

  // Available tags (not already excluded) from filtered tags
  const availableTags = useMemo(() => {
    return filteredTags.filter(tag => !excludedTags.includes(tag));
  }, [filteredTags, excludedTags]);

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
    if (tag && !excludedTags.includes(tag)) {
      onExcludedTagsChange([...excludedTags, tag]);
    }
  };

  const handleAddAllInCategory = (category: string) => {
    const categoryTags = groupedAvailableTags[category] || [];
    const newExcludedTags = [...excludedTags, ...categoryTags];
    onExcludedTagsChange(newExcludedTags);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onExcludedTagsChange(excludedTags.filter(tag => tag !== tagToRemove));
  };

  return (
    <Card
      sx={{
        backgroundColor: theme.palette.mode === 'dark'
          ? 'rgba(255, 255, 255, 0.02)'
          : 'rgba(0, 0, 0, 0.02)',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={2}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            🚫 Excluded Tags from Pattern Analysis
          </Typography>
          <Tooltip title="Tags excluded from pattern analysis won't be considered when identifying high-performing or declining tag combinations. This is useful for filtering out temporary or irrelevant tags.">
            <IconButton size="small">
              <HelpOutline fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            Excluded tags will not be included in pattern analysis calculations. This helps focus the analysis on meaningful trading patterns by filtering out temporary, experimental, or irrelevant tags.
          </Typography>
        </Alert>

        {/* Add new excluded tag */}
        <Box mb={3}>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
            Add Tag to Exclude
          </Typography>
          <TextField
            placeholder="Search for tags to exclude..."
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
            maxHeight: '250px',
            overflow: 'auto',
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
            mb: 3,
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
                  {tags.map((tag) => (
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
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
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
            mb: 3
          }}>
            <Typography variant="body2">
              {searchTerm ? 'No matching tags found' : 'No tags available to exclude'}
            </Typography>
          </Box>
        )}

        {/* Currently excluded tags */}
        <Box>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
            Currently Excluded Tags ({excludedTags.length})
          </Typography>
          
          {excludedTags.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              No tags are currently excluded from pattern analysis.
            </Typography>
          ) : (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {excludedTags.map(tag => (
                <Chip
                  key={tag}
                  label={formatTagForDisplay(tag)}
                  onDelete={() => handleRemoveTag(tag)}
                  deleteIcon={
                    <Close 
                      sx={{ 
                        color: theme.palette.mode === 'dark' ? 'white' : 'inherit',
                        '&:hover': {
                          color: theme.palette.error.main
                        }
                      }} 
                    />
                  }
                  sx={{
                    ...getTagChipStyles(tag, theme),
                    '& .MuiChip-deleteIcon': {
                      color: theme.palette.mode === 'dark' ? 'white' : 'inherit',
                      '&:hover': {
                        color: theme.palette.error.main
                      }
                    }
                  }}
                />
              ))}
            </Stack>
          )}
        </Box>

        {/* Summary information */}
        {allTags.length > 0 && (
          <Box mt={3} p={2} sx={{
            backgroundColor: theme.palette.mode === 'dark'
              ? 'rgba(255, 255, 255, 0.02)'
              : 'rgba(0, 0, 0, 0.02)',
            borderRadius: 1,
            border: `1px solid ${theme.palette.divider}`
          }}>
            <Typography variant="caption" color="text.secondary">
              <strong>Pattern Analysis Coverage:</strong> {availableTags.length} of {allTags.length} tags will be included in pattern analysis
              {excludedTags.length > 0 && (
                <span> ({excludedTags.length} excluded)</span>
              )}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default ExcludedTagsSelector;
