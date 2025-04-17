import React, { useState } from 'react';
import {
  Autocomplete,
  TextField,
  Chip,
  Box,
  IconButton,
  Tooltip,
  Button
} from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import {
  getTagChipStyles,
  formatTagForDisplay,
  isGroupedTag,
  getTagGroup
} from '../../utils/tagColors';
import TagEditDialog from '../TagEditDialog';

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

  const handleTagEditSuccess = (oldTag: string, newTag: string, tradesUpdated: number) => {
    if (onTagUpdated) {
      onTagUpdated(oldTag, newTag);
    }
  };

  return (
    <>
      <Autocomplete
        multiple
        freeSolo
        options={allTags}
        value={tags}
        onChange={onTagsChange}
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
    </>
  );
};

export default TagsInput;
