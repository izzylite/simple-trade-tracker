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
  Alert
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { HelpOutline, Close } from '@mui/icons-material';
import { Trade } from '../../types/trade';
import { getTagChipStyles, formatTagForDisplay } from '../../utils/tagColors';

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
  const [inputValue, setInputValue] = useState('');

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

  // Available tags (not already excluded)
  const availableTags = useMemo(() => {
    return allTags.filter(tag => !excludedTags.includes(tag));
  }, [allTags, excludedTags]);

  const handleAddTag = (tag: string) => {
    if (tag && !excludedTags.includes(tag)) {
      onExcludedTagsChange([...excludedTags, tag]);
      setInputValue('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onExcludedTagsChange(excludedTags.filter(tag => tag !== tagToRemove));
  };

  const handleAutocompleteChange = (_: any, value: string | null) => {
    if (value) {
      handleAddTag(value);
    }
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
          <Autocomplete
            value={null}
            inputValue={inputValue}
            onInputChange={(_, newInputValue) => setInputValue(newInputValue)}
            onChange={handleAutocompleteChange}
            options={availableTags}
            getOptionLabel={(option) => formatTagForDisplay(option)}
            renderOption={(props, option) => (
              <Box component="li" {...props}>
                <Chip
                  label={formatTagForDisplay(option)}
                  size="small"
                  sx={getTagChipStyles(option, theme)}
                />
              </Box>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Search for tags to exclude..."
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
                ? "No tags available to exclude"
                : "No matching tags found"
            }
            disabled={availableTags.length === 0}
          />
        </Box>

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
