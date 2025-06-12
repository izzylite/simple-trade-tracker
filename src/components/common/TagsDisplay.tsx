import React, { useMemo } from 'react';
import { Box, Chip, Typography, useTheme } from '@mui/material';
import { Label as TagIcon } from '@mui/icons-material';
import {
  getTagChipStyles,
  formatTagForDisplay,
  isGroupedTag,
  getTagGroup,
  getUniqueTagGroups,
  filterTagsByGroup,
  getTagName
} from '../../utils/tagColors';

interface TagsDisplayProps {
  tags: string[];
  onTagClick?: (tag: string) => void;
  onTagDelete?: (tag: string) => void;
  showGroups?: boolean;
  chipSize?: 'small' | 'medium';
  maxHeight?: string | number;
}

const TagsDisplay: React.FC<TagsDisplayProps> = ({
  tags,
  onTagClick,
  onTagDelete,
  showGroups = true,
  chipSize = 'small',
  maxHeight
}) => {
  // Filter out Partials tags
  const filteredTags = tags.filter(tag => !tag.startsWith('Partials:'));
  const theme = useTheme();

  // Organize tags by category
  const organizedTags = useMemo(() => {
    if (!filteredTags || filteredTags.length === 0) return { groups: {}, ungroupedTags: [] };

    const groups: Record<string, string[]> = {};
    const ungroupedTags: string[] = [];

    // Get all unique groups
    const uniqueGroups = getUniqueTagGroups(filteredTags);

    // Initialize groups
    uniqueGroups.forEach(group => {
      groups[group] = filterTagsByGroup(filteredTags || [], group);
    });

    // Get ungrouped tags
    filteredTags.forEach(tag => {
      if (!isGroupedTag(tag)) {
        ungroupedTags.push(tag);
      }
    });

    return { groups, ungroupedTags };
  }, [filteredTags]);

  if (!filteredTags || filteredTags.length === 0) {
    return null;
  }

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      gap: 1,
      maxHeight: maxHeight,
      overflowY: maxHeight ? 'auto' : 'visible'
    }}>
      {showGroups && Object.keys(organizedTags.groups).length > 0 && (
        <>
          {Object.entries(organizedTags.groups).map(([group, groupTags]) => (
            <Box key={group} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                {group}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {groupTags.map(tag => (
                  <Chip
                    key={tag}
                    label={getTagName(tag)}
                    size={chipSize}
                    onClick={onTagClick ? () => onTagClick(tag) : undefined}
                    onDelete={onTagDelete ? () => onTagDelete(tag) : undefined}
                    sx={getTagChipStyles(tag, theme)}
                  />
                ))}
              </Box>
            </Box>
          ))}
        </>
      )}

      {organizedTags.ungroupedTags.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {showGroups && Object.keys(organizedTags.groups).length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Tags
            </Typography>
          )}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {organizedTags.ungroupedTags.map(tag => (
              <Chip
                key={tag}
                label={formatTagForDisplay(tag)}
                size={chipSize}
                onClick={onTagClick ? () => onTagClick(tag) : undefined}
                onDelete={onTagDelete ? () => onTagDelete(tag) : undefined}
                sx={getTagChipStyles(tag, theme)}
              />
            ))}
          </Box>
        </Box>
      )}

      {!showGroups && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1}}>
          {filteredTags.map(tag => (
            <Chip
              key={tag}
              label={formatTagForDisplay(tag)}
              size={chipSize}
              onClick={onTagClick ? () => onTagClick(tag) : undefined}
              onDelete={onTagDelete ? () => onTagDelete(tag) : undefined}
              sx={getTagChipStyles(tag, theme)}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};

export default TagsDisplay;
