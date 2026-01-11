import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
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
  FormControl,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { scrollbarStyles } from '../styles/scrollbarStyles';
import {
  Edit as EditIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Info as InfoIcon,
  Tag as TagIcon,
  Close as CloseIcon,
  Add as AddIcon
} from '@mui/icons-material';
import UnifiedDrawer from './common/UnifiedDrawer';
import TagEditDialog from './TagEditDialog';
import TagCreateDialog from './TagCreateDialog';
import {
  getTagChipStyles,
  formatTagForDisplay,
  isGroupedTag,
  getTagGroup,
  getUniqueTagGroups
} from '../utils/tagColors';
import { Calendar } from '../types/calendar';
import { logger } from '../utils/logger';
import { tagService } from '../services/tagService';
import { useAuthState } from '../contexts/AuthStateContext';

interface TagManagementDrawerProps {
  open: boolean;
  onClose: () => void;
  allTags: string[];
  calendarId: string;
  onTagUpdated?: (oldTag: string, newTag: string) => Promise<{ success: boolean; tradesUpdated: number }>;
  requiredTagGroups?: string[];
  onUpdateCalendarProperty?: (calendarId: string, updateCallback: (calendar: Calendar) => Calendar) => Promise<Calendar | undefined>;
  // Read-only mode for shared calendars
  isReadOnly?: boolean;
  // Calendar owner's user ID (for fetching tag definitions in read-only mode)
  calendarOwnerId?: string;
}

const TagManagementDrawer: React.FC<TagManagementDrawerProps> = ({
  open,
  onClose,
  allTags,
  calendarId,
  onTagUpdated,
  requiredTagGroups = [],
  onUpdateCalendarProperty,
  isReadOnly = false,
  calendarOwnerId
}) => {
  const theme = useTheme();
  const { user } = useAuthState();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTagGroup, setSelectedTagGroup] = useState<string>('');
  const [tagToEdit, setTagToEdit] = useState<string | null>(null);
  const [tagToView, setTagToView] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [localRequiredGroups, setLocalRequiredGroups] = useState<string[]>(requiredTagGroups);
  const [tagDefinitions, setTagDefinitions] = useState<Record<string, string>>({});

  // Update local state when props change
  useEffect(() => {
    setLocalRequiredGroups(requiredTagGroups);
  }, [requiredTagGroups]);

  // Fetch tag definitions
  // In read-only mode, fetch from the calendar owner's definitions
  const fetchTagDefinitions = useCallback(async () => {
    // Use calendarOwnerId for shared calendars, otherwise use current user
    const userId = isReadOnly ? calendarOwnerId : user?.id;
    if (!userId) return;

    try {
      const definitions = await tagService.fetchTagDefinitions(userId);
      setTagDefinitions(definitions);
    } catch (err) {
      logger.error('Error fetching tag definitions:', err);
    }
  }, [user?.id, isReadOnly, calendarOwnerId]);

  // Fetch tag definitions when drawer opens
  useEffect(() => {
    if (open) {
      fetchTagDefinitions();
    }
  }, [open, fetchTagDefinitions]);

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

  const handleTagCreated = async (newTag: string) => {
    if (onUpdateCalendarProperty) {
      await onUpdateCalendarProperty(calendarId, (calendar) => {
        const currentTags = calendar.tags || [];
        if (currentTags.includes(newTag)) return calendar;
        return {
          ...calendar,
          tags: [...currentTags, newTag]
        };
      });
      // Refresh definitions to include the new one
      fetchTagDefinitions();
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
      headerActions={
        !isReadOnly && (
          <Tooltip title="Create new tag" arrow>
            <IconButton
              color="primary"
              onClick={() => setIsCreateDialogOpen(true)}
              sx={{
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.2)
                }
              }}
            >
              <AddIcon />
            </IconButton>
          </Tooltip>
        )
      }
      contentSx={{ p: 2, ...scrollbarStyles(theme) }}
    >
      {/* Content */}
      <Box>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body1" gutterBottom>
            {isReadOnly ? "View tags and their definitions to better understand this trader's terminology." : "Manage your tags and set required tag groups for new trades."}
          </Typography>
          {!isReadOnly && (
            <>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                When a tag group is set as required, every new trade must include at least one tag from this group.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 4 }}>
                Adding definitions to your tags helps the AI assistant and traders understand your trading terminology and provide more accurate analysis.
              </Typography>
            </>
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
                        disablePadding
                        secondaryAction={
                          !isReadOnly ? (
                            <Button
                              color="primary"
                              sx={{ minWidth: 'auto', p: 0.5 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setTagToEdit(tag);
                              }}
                            >
                              Edit
                            </Button>
                          ) : undefined
                        }
                      >
                        <ListItemButton
                          onClick={() => setTagToView(tag)}
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
                            secondary={
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                  display: '-webkit-box',
                                  WebkitLineClamp: 4,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  mt: 0.5,
                                  ml: 0.5,
                                  opacity: tagDefinitions[tag] ? 1 : 0.6
                                }}
                              >
                                {tagDefinitions[tag] || (isReadOnly ? 'No definition' : 'No definition — click Edit to add one')}
                              </Typography>
                            }
                          />
                        </ListItemButton>
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
          onClose={(definitionUpdated) => {
            setTagToEdit(null);
            if (definitionUpdated) {
              fetchTagDefinitions();
            }
          }}
          tag={tagToEdit}
          calendarId={calendarId}
          onSuccess={handleTagEditSuccess}
          onDelete={handleTagDelete}
          onTagUpdated={onTagUpdated}
          initialDefinition={tagDefinitions[tagToEdit] || ''}
        />
      )}

      <TagCreateDialog
        open={isCreateDialogOpen}
        onClose={(created) => {
          setIsCreateDialogOpen(false);
          if (created) fetchTagDefinitions();
        }}
        calendarId={calendarId}
        allTags={allTags}
        onTagCreated={handleTagCreated}
      />

      {/* Tag View Dialog */}
      <Dialog
        open={!!tagToView}
        onClose={() => setTagToView(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <TagIcon sx={{ color: 'primary.main' }} />
            <Typography variant="h6" component="span">
              Tag Details
            </Typography>
          </Box>
          <IconButton
            onClick={() => setTagToView(null)}
            size="small"
            sx={{ color: 'text.secondary' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ ...scrollbarStyles(theme) }}>
          {tagToView && (
            <Box>
              <Box sx={{ mb: 3 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                  Tag
                </Typography>
                <Chip
                  label={formatTagForDisplay(tagToView, true)}
                  sx={{
                    ...getTagChipStyles(tagToView, theme),
                    fontSize: '1rem',
                    height: 36,
                    '& .MuiChip-label': {
                      px: 2
                    }
                  }}
                />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  Definition
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    color: tagDefinitions[tagToView] ? 'text.primary' : 'text.secondary',
                    fontStyle: tagDefinitions[tagToView] ? 'normal' : 'italic'
                  }}
                >
                  {tagDefinitions[tagToView] || 'No definition available for this tag.'}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTagToView(null)}>
            Close
          </Button>
          {!isReadOnly && tagToView && (
            <Button
              variant="contained"
              onClick={() => {
                setTagToEdit(tagToView);
                setTagToView(null);
              }}
            >
              Edit Tag
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </UnifiedDrawer>
  );
};

export default TagManagementDrawer;
