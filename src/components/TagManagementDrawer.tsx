import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Divider,
  TextField,
  InputAdornment,
  Chip,
  useTheme,
  alpha,
  Tooltip,
  Button,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  FormControl
} from '@mui/material';
import { scrollbarStyles } from '../styles/scrollbarStyles';
import {
  Edit as EditIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Info as InfoIcon,
  Tag as TagIcon,
} from '@mui/icons-material';
import UnifiedDrawer from './common/UnifiedDrawer';
import TagEditDialog from './TagEditDialog';
import {
  getTagChipStyles,
  formatTagForDisplay,
  isGroupedTag,
  getTagGroup,
  getUniqueTagGroups
} from '../utils/tagColors';
import { Calendar } from '../types/calendar';
import { logger } from '../utils/logger';

interface TagManagementDrawerProps {
  open: boolean;
  onClose: () => void;
  allTags: string[];
  calendarId: string;
  onTagUpdated?: (oldTag: string, newTag: string) => void;
  requiredTagGroups?: string[];
  onUpdateCalendarProperty?: (calendarId: string, updateCallback: (calendar: Calendar) => Calendar) => Promise<Calendar | undefined>;
  // Read-only mode for shared calendars
  isReadOnly?: boolean;
}

const TagManagementDrawer: React.FC<TagManagementDrawerProps> = ({
  open,
  onClose,
  allTags,
  calendarId,
  onTagUpdated,
  requiredTagGroups = [],
  onUpdateCalendarProperty,
  isReadOnly = false
}) => {
  const theme = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTagGroup, setSelectedTagGroup] = useState<string>('');
  const [tagToEdit, setTagToEdit] = useState<string | null>(null);
  const [localRequiredGroups, setLocalRequiredGroups] = useState<string[]>(requiredTagGroups);

  // Update local state when props change
  useEffect(() => {
    setLocalRequiredGroups(requiredTagGroups);
  }, [requiredTagGroups]);

  // Get all unique tag groups
  const tagGroups = useMemo(() => {
    return getUniqueTagGroups(allTags);
  }, [allTags]);

  // Reset selected tag group if it no longer exists in the available tag groups
  useEffect(() => {
    if (selectedTagGroup && !tagGroups.includes(selectedTagGroup)) {
      setSelectedTagGroup('');
    }
  }, [tagGroups, selectedTagGroup]);

  // Filter tags based on search term and selected group
  const filteredTags = useMemo(() => {
    let filtered = allTags;

    // Filter by group if selected
    if (selectedTagGroup) {
      filtered = filtered.filter(tag =>
        isGroupedTag(tag) && getTagGroup(tag) === selectedTagGroup
      );
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(tag =>
        tag.toLowerCase().includes(term) ||
        formatTagForDisplay(tag).toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [allTags, searchTerm, selectedTagGroup]);

  // Group tags by their group
  const groupedTags = useMemo(() => {
    const groups: Record<string, string[]> = {};

    filteredTags.forEach(tag => {
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
  }, [filteredTags]);

  const handleTagEditSuccess = (oldTag: string, newTag: string, tradesUpdated: number) => {
    logger.log(`Tag update completed: ${oldTag} -> ${newTag}, ${tradesUpdated} trades updated`);

    // Check if this was a tag group name change
    const oldGroup = isGroupedTag(oldTag) ? getTagGroup(oldTag) : null;
    const newGroup = isGroupedTag(newTag) ? getTagGroup(newTag) : null;

    // If the selected tag group was the old group name, update it to the new group name
    if (oldGroup && newGroup && oldGroup !== newGroup && selectedTagGroup === oldGroup) {
      setSelectedTagGroup(newGroup);
    }

    if (onTagUpdated) {
      onTagUpdated(oldTag, newTag);
    }
  };

  const handleTagDelete = (deletedTag: string, tradesUpdated: number) => {
    logger.log(`Tag deletion completed: ${deletedTag}, ${tradesUpdated} trades updated`);

    // Check if the deleted tag was from a group we're currently filtering by
    const deletedGroup = isGroupedTag(deletedTag) ? getTagGroup(deletedTag) : null;

    // If we were filtering by the deleted tag's group, reset the filter to show all groups
    if (deletedGroup && selectedTagGroup === deletedGroup) {
      // Check if there are any other tags in this group
      const otherTagsInGroup = allTags.filter(tag =>
        tag !== deletedTag && isGroupedTag(tag) && getTagGroup(tag) === deletedGroup
      );

      // If no other tags in this group, reset the filter
      if (otherTagsInGroup.length === 0) {
        setSelectedTagGroup('');
      }
    }

    if (onTagUpdated) {
      onTagUpdated(deletedTag, ''); // Pass empty string to indicate deletion
    }
  };

  const handleRequiredTagGroupsChange = (groups: string[]) => {
    setLocalRequiredGroups(groups);

    if (onUpdateCalendarProperty) {
      onUpdateCalendarProperty(calendarId, (calendar) => ({
        ...calendar,
        required_tag_groups: groups
      }));
    }
  };

  return (
    <UnifiedDrawer
      open={open}
      onClose={onClose}
      title="Tag Management"
      icon={<TagIcon />}
      width={{ xs: '100%', sm: 500 }}
      headerVariant="enhanced"
      contentSx={{ p: 2, ...scrollbarStyles(theme) }}
    >
      {/* Content */}
      <Box>
        <Box sx={{ mb: 3 }}>
            <Typography variant="body1" gutterBottom>
              {isReadOnly ? "View your tags" : "Manage your tags and set required tag groups for new trades."}
            </Typography>
            {!isReadOnly && (
              <Typography variant="body2" color="text.secondary">
                When a tag group is set as required, every new trade must include at least one tag from this group.
              </Typography>
            )}
          </Box>

          {!isReadOnly && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Required Tag Groups
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                {localRequiredGroups.length > 0 ? (
                  localRequiredGroups.map(group => (
                    <Chip
                      key={group}
                      label={group}
                      color="primary"
                      variant="outlined"
                      sx={{ fontWeight: 600 }}
                    />
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No required tag groups set. Edit a tag group to make it required.
                  </Typography>
                )}
              </Box>
            </Box>
          )}

          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField
                fullWidth
                placeholder="Search tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  )
                }}
                size="small"
              />
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <Select
                  value={selectedTagGroup}
                  onChange={(e) => setSelectedTagGroup(e.target.value)}
                  displayEmpty
                  startAdornment={
                    <InputAdornment position="start">
                      <FilterListIcon fontSize="small" />
                    </InputAdornment>
                  }
                >
                  <MenuItem value="">All Groups</MenuItem>
                  {tagGroups.map(group => (
                    <MenuItem key={group} value={group}>{group}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box sx={{
              maxHeight: '100%',
              overflow: 'auto',
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 1,
              ...theme.typography.body2,
              ...scrollbarStyles(theme)
            }}>
              {Object.entries(groupedTags).length > 0 ? (
                Object.entries(groupedTags).map(([group, tags]) => (
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
                        {group !== 'Ungrouped' && !isReadOnly && (
                          <Box sx={{ display: 'flex', alignItems: 'center', ml: 1 }}>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={localRequiredGroups.includes(group)}
                                  onChange={(e) => {
                                    const isChecked = e.target.checked;
                                    const updatedGroups = isChecked
                                      ? [...localRequiredGroups, group]
                                      : localRequiredGroups.filter(g => g !== group);
                                    handleRequiredTagGroupsChange(updatedGroups);
                                  }}
                                  color="primary"
                                  size="small"
                                />
                              }
                              label={
                                <Typography variant="caption" sx={{ fontWeight: 500 }}>
                                  Required
                                </Typography>
                              }
                            />
                            <Tooltip title="When a tag group is set as required, every new trade must include at least one tag from this group">
                              <InfoIcon sx={{ ml: 0.5, color: 'text.secondary', fontSize: '0.875rem' }} />
                            </Tooltip>
                          </Box>
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {tags.length} tag{tags.length !== 1 ? 's' : ''}
                      </Typography>
                    </Box>
                    <Divider />
                    <List disablePadding>
                      {tags.map((tag) => (
                        <ListItem
                          key={tag}
                          secondaryAction={
                            !isReadOnly ? (
                              <Button
                                color="primary"
                                sx={{ minWidth: 'auto', p: 0.5 }}
                                onClick={() => setTagToEdit(tag)}
                              >
                                Edit
                              </Button>
                            ) : undefined
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
                ))
              ) : (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography color="text.secondary">
                    No tags found matching your search criteria.
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      

      {tagToEdit && (
        <TagEditDialog
          open={!!tagToEdit}
          onClose={() => setTagToEdit(null)}
          tag={tagToEdit}
          calendarId={calendarId}
          onSuccess={handleTagEditSuccess}
          onDelete={handleTagDelete}
        />
      )}
    </UnifiedDrawer>
  );
};

export default TagManagementDrawer;
