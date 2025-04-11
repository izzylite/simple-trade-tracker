import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Typography,
  useTheme,
  IconButton,
  Dialog,
  TextField,
  Autocomplete,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { 
  getTagChipStyles, 
  formatTagForDisplay, 
  isGroupedTag, 
  getTagGroup, 
  getUniqueTagGroups, 
  filterTagsByGroup 
} from '../utils/tagColors';
import { 
  DialogTitleStyled, 
  DialogContentStyled, 
  DialogActionsStyled 
} from './StyledComponents';
import { dialogProps } from '../styles/dialogStyles';
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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      {...dialogProps}
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: 'none',
          border: `1px solid ${theme.palette.divider}`,
          maxHeight: '90vh',
          overflow: 'hidden',
          '& .MuiDialogContent-root': {
            ...scrollbarStyles(theme)
          }
        }
      }}
    >
      <DialogTitleStyled>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <Typography variant="h6">
            {title}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitleStyled>

      <DialogContentStyled>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
          {tagGroups.length > 0 && (
            <FormControl fullWidth size="small">
              <InputLabel id="tag-group-select-label">Filter by Tag Group</InputLabel>
              <Select
                labelId="tag-group-select-label"
                value={selectedTagGroup}
                label="Filter by Tag Group"
                onChange={(e) => setSelectedTagGroup(e.target.value as string)}
              >
                <MenuItem value="">All Tags</MenuItem>
                {tagGroups.map((group) => (
                  <MenuItem key={group} value={group}>{group}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Autocomplete
            multiple
            options={filteredTags}
            value={selectedTags}
            onChange={(_, newValue) => onTagsChange(newValue)}
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
      </DialogContentStyled>

      {(showClearButton || showApplyButton) && (
        <DialogActionsStyled>
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
        </DialogActionsStyled>
      )}
    </Dialog>
  );
};

export default TagFilterDialog;
