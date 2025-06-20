import React, { useState } from 'react';
import {
  Autocomplete,
  TextField,
  Chip,
  Box,
  Tooltip,
  Button,
  Snackbar,
  Alert
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  getTagChipStyles,
  formatTagForDisplay,
  isGroupedTag,
  getTagGroup
} from '../../utils/tagColors';
import TagEditDialog from '../TagEditDialog';
import { scrollbarStyles } from '../../styles/scrollbarStyles';

interface TagsInputProps {
  tags: string[];
  allTags: string[];
  onTagsChange: (event: React.SyntheticEvent, value: string[]) => void;
  calendarId: string;
  onTagUpdated?: (oldTag: string, newTag: string) => void;
}

const TagsInput: React.FC<TagsInputProps> = ({
  tags,
  allTags,
  onTagsChange,
  calendarId,
  onTagUpdated
}) => {
  const theme = useTheme();
  const [tagToEdit, setTagToEdit] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState(false);

  const handleTagEditSuccess = (oldTag: string, newTag: string, tradesUpdated: number) => {
    if (onTagUpdated) {
      onTagUpdated(oldTag, newTag);
    }
  };

  // Validate and filter tags to prevent multiple colons
  const handleTagsChangeWithValidation = (event: React.SyntheticEvent, value: string[]) => {
    const validTags: string[] = [];
    let hasInvalidTags = false;

    value.forEach(tag => {
      // Count colons in the tag
      const colonCount = (tag.match(/:/g) || []).length;

      if (colonCount <= 1) {
        validTags.push(tag);
      } else {
        hasInvalidTags = true;
      }
    });

    // Show warning if invalid tags were filtered out
    if (hasInvalidTags) {
      setShowWarning(true);
    }

    // Call the original handler with filtered tags
    onTagsChange(event, validTags);
  };

  return (
    <>
      <Autocomplete
        multiple
        freeSolo
        options={allTags}
        value={tags}
        onChange={handleTagsChangeWithValidation}
        slotProps={{
          listbox: {
            sx: {
              ...scrollbarStyles(theme)
            }
          }
        }}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip
              label={formatTagForDisplay(option, false)}
              {...getTagProps({ index })}
              sx={getTagChipStyles(option, theme)}
              title={isGroupedTag(option) ? `Group: ${getTagGroup(option)}` : undefined}
            />
          ))
        }
        renderOption={(props, option) => (
          <li {...props}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
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
              <Tooltip title="Edit this tag across all trades">
                <Button
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTagToEdit(option);
                  }}
                  sx={{ 
                    color: theme.palette.text.secondary,
                    '&:hover': {
                      color: theme.palette.primary.main
                    }
                  }}
                >
                  Edit
                </Button>
              </Tooltip>
            </Box>
          </li>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Tags"
            placeholder="Add tags"
            slotProps={{
              htmlInput: {
                ...params.inputProps,
                id: 'trade-tags-input'
              }
            }}
          />
        )}
      />

      {tagToEdit && (
        <TagEditDialog
          open={!!tagToEdit}
          onClose={() => setTagToEdit(null)}
          tag={tagToEdit}
          calendarId={calendarId}
          onSuccess={handleTagEditSuccess}
        />
      )}

      <Snackbar
        open={showWarning}
        autoHideDuration={4000}
        onClose={() => setShowWarning(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setShowWarning(false)}
          severity="warning"
          sx={{ width: '100%' }}
        >
          Tags can only contain one colon (:) for category formatting. Invalid tags were removed.
        </Alert>
      </Snackbar>
    </>
  );
};

export default TagsInput;
