import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Typography,
  useTheme,
  TextField,
  Autocomplete,
  Chip,
  Drawer,
  IconButton,
  alpha
} from '@mui/material';
import {
  Close as CloseIcon,
  FilterAlt as FilterIcon
} from '@mui/icons-material';
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

interface TagFilterDrawerProps {
  open: boolean;
  onClose: () => void;
  allTags: string[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
}

const TagFilterDrawer: React.FC<TagFilterDrawerProps> = ({
  open,
  onClose,
  allTags,
  selectedTags,
  onTagsChange
}) => {
  const theme = useTheme();
  const [selectedTagGroup, setSelectedTagGroup] = useState<string>('');

  // Get all unique tag groups
  const tagGroups = useMemo(() => {
    return getUniqueTagGroups(allTags);
  }, [allTags]);

  // Filter tags by selected group
  const filteredTags = useMemo(() => {
    if (!selectedTagGroup) return allTags;
    return filterTagsByGroup(allTags, selectedTagGroup);
  }, [allTags, selectedTagGroup]);

  const handleClearTags = () => {
    onTagsChange([]);
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        zIndex: 1300, // Higher than AppBar (1100) and other components
        '& .MuiDrawer-paper': {
          width: { xs: '100%', sm: 400 },
          maxWidth: '100vw',
          zIndex: 1300 // Ensure the paper also has high z-index
        }
      }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{
          p: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
          display: 'flex',
          alignItems: 'center',
          gap: 2
        }}>
          <Box sx={{
            p: 1,
            borderRadius: 1,
            backgroundColor: alpha(theme.palette.primary.main, 0.1),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FilterIcon sx={{ color: 'primary.main', fontSize: 20 }} />
          </Box>
          <Typography variant="h6" sx={{ flex: 1, fontWeight: 600 }}>
            Filter Trades by Tags
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, p: 2, overflow: 'auto' }}>
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
              options={filteredTags}
              value={selectedTags}
              onChange={(_, newValue) => onTagsChange(newValue)}
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

            <Typography variant="body2" color="text.secondary">
              {selectedTags.length > 0
                ? `Selected ${selectedTags.length} tag${selectedTags.length > 1 ? 's' : ''}`
                : 'Select tags to filter. When no tags are selected, all items will be shown.'}
            </Typography>
          </Box>
        </Box>

        {/* Footer */}
        <Box sx={{
          p: 2,
          borderTop: `1px solid ${theme.palette.divider}`,
          display: 'flex',
          gap: 1,
          justifyContent: 'flex-end'
        }}>
          <Button onClick={handleClearTags} color="inherit">
            Clear All
          </Button>
          <Button onClick={onClose} variant="contained">
            Apply
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
};

export default TagFilterDrawer;
