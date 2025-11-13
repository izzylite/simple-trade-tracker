/**
 * Utility functions for generating consistent colors for tags
 * Supports grouped tags in format "Group:Tag" (e.g., "Strategy:Volume")
 */

import { alpha } from '@mui/material/styles';
import { Theme } from '@mui/material';

// Predefined color palette for better visual consistency
const TAG_COLORS = [
  '#1565C0', // Dark Blue
  '#2E7D32', // Dark Green
  '#EF6C00', // Dark Orange
  '#6A1B9A', // Dark Purple
  '#AD1457', // Dark Pink
  '#00838F', // Dark Cyan
  '#FFA000', // Dark Amber
  '#4E342E', // Dark Brown
  '#455A64', // Dark Blue Grey
  '#558B2F', // Dark Light Green
  '#D84315', // Dark Deep Orange
  '#4527A0', // Dark Deep Purple
  '#283593', // Dark Indigo
  '#00695C', // Dark Teal
  '#9E9D24', // Dark Lime
  '#F9A825', // Dark Yellow
];

/**
 * Generates a consistent color hash from a string
 * @param str The string to generate a color for
 * @returns A number between 0 and TAG_COLORS.length
 */
const hashString = (str: string): number => {
  // Simple but effective string hash function
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // Make sure we get a positive number and map it directly to our color array length
  return Math.abs(hash) % TAG_COLORS.length;
};

/**
 * Checks if a tag is a grouped tag (contains a colon)
 * @param tag The tag to check
 * @returns True if the tag is grouped
 */
export const isGroupedTag = (tag: string): boolean => {
  return tag.includes(':');
};

/**
 * Gets the group name from a grouped tag
 * @param tag The grouped tag (e.g., "Strategy:Volume")
 * @returns The group name (e.g., "Strategy")
 */
export const getTagGroup = (tag: string): string => {
  if (!isGroupedTag(tag)) return '';
  return tag.split(':')[0];
};

/**
 * Gets the tag name without the group prefix
 * @param tag The grouped tag (e.g., "Strategy:Volume")
 * @returns The tag name without group (e.g., "Volume")
 */
export const getTagName = (tag: string): string => {
  if (!isGroupedTag(tag)) return tag;
  const parts = tag.split(':');
  return parts.length > 1 ? parts[1] : parts[0];
};

/**
 * Capitalizes the first letter of a string
 * @param str The string to capitalize
 * @returns The capitalized string
 */
const capitalizeFirstLetter = (str: string): string => {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Formats a tag by capitalizing the group name (if it's a grouped tag)
 * @param tag The tag to format (e.g., "strategy:Volume" or "breakout")
 * @returns The formatted tag with capitalized group (e.g., "Strategy:Volume" or "breakout")
 */
export const formatTagWithCapitalizedGroup = (tag: string): string => {
  if (!tag) return tag;

  if (isGroupedTag(tag)) {
    const parts = tag.split(':');
    const group = capitalizeFirstLetter(parts[0].trim());
    const tagName = parts[1]?.trim() || '';
    return `${group}:${tagName}`;
  }

  return tag;
};

/**
 * Formats an array of tags by capitalizing all group names
 * @param tags Array of tags to format
 * @returns Array of formatted tags with capitalized groups
 */
export const formatTagsWithCapitalizedGroups = (tags: string[]): string[] => {
  return tags.map(formatTagWithCapitalizedGroup);
};

/**
 * Gets a consistent color for a tag
 * For grouped tags, the color is based on the group name
 * @param tag The tag name
 * @returns A hex color code
 */
export const getTagColor = (tag: string): string => {
  // For grouped tags, use the group name for color consistency within groups
  const colorKey = isGroupedTag(tag) ? getTagGroup(tag) : tag;
  // Get the index directly from the hash function
  const index = hashString(colorKey);
  return TAG_COLORS[index];
};

/**
 * Gets tag chip styles for consistent appearance across the app
 * @param tag The tag name
 * @param theme The current theme
 * @returns Style object for the tag chip
 */
export const getTagChipStyles = (tag: string, theme: Theme) => {
  const color = getTagColor(tag);
  return {
    backgroundColor: alpha(color, 0.8),
    color: alpha("#ffffff", 0.8),
    fontWeight: 500,
    '& .MuiChip-deleteIcon': {
      color: '#ffffff',
      '&:hover': {
        color: alpha('#ffffff', 0.8)
      }
    }
  };
};

/**
 * Filters tags by group name
 * @param tags Array of tags to filter
 * @param group Group name to filter by
 * @returns Array of tags that belong to the specified group
 */
export const filterTagsByGroup = (tags: string[], group: string): string[] => {
  return tags.filter(tag => isGroupedTag(tag) && getTagGroup(tag) === group);
};

/**
 * Gets all unique group names from an array of tags
 * @param tags Array of tags to extract groups from
 * @returns Array of unique group names
 */
export const getUniqueTagGroups = (tags: string[]): string[] => {
  const groups = new Set<string>();

  tags.forEach(tag => {
    if (isGroupedTag(tag)) {
      groups.add(getTagGroup(tag));
    }
  });

  return Array.from(groups).sort();
};

/**
 * Formats a tag for display, optionally hiding the group prefix
 * @param tag The tag to format
 * @param hideGroup Whether to hide the group prefix
 * @returns Formatted tag for display
 */
export const formatTagForDisplay = (tag: string, hideGroup: boolean = false): string => {
  if (!isGroupedTag(tag) || !hideGroup) return tag;
  return getTagName(tag);
};
