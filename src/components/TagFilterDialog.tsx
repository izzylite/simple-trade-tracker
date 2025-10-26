import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Typography,
  useTheme,
  TextField,
  Autocomplete,
  Chip
} from '@mui/material';
import {
  getTagChipStyles,
  formatTagForDisplay,
  isGroupedTag,
  getTagGroup,
  getUniqueTagGroups,
  filterTagsByGroup
} from '../utils/tagColors';
import { BaseDialog, SelectInput } from './common';
import { scrollbarStyles } from '../styles/scrollbarStyles';

interface TagFilterDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  allTags: string[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  showClearButton?: boolean;
  showApplyButton?: boolean;
}

const TagFilterDialog: React.FC<TagFilterDialogProps> = ({
  open,
  onClose,
  title = 'Filter by Tags',
  allTags,
  selectedTags,
  onTagsChange,
  showClearButton = true,
  showApplyButton = true
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

  const dialogTitle = (
    <Typography variant="h6">{title}</Typography>
  );

  const dialogActions = (showClearButton || showApplyButton) ? (
    <Box>
      {showClearButton && (
        <Button onClick={handleClearTags} color="inherit">
          Clear All
        </Button>
      )}
      {showApplyButton && (
        <Button onClick={onClose} color="primary">
          Apply
        </Button>
      )}
    </Box>
  ) : undefined;

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      title={dialogTitle}
      actions={dialogActions}
      maxWidth="sm"
      fullWidth
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
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
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        {selectedTags.length > 0
          ? `Selected ${selectedTags.length} tag${selectedTags.length > 1 ? 's' : ''}`
          : 'Select tags to filter. When no tags are selected, all items will be shown.'}
      </Typography>
    </BaseDialog>
  );
};

export default TagFilterDialog;
