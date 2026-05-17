import React, { useMemo, useState } from 'react';
import { formatCount } from '../utils/formatters';
import {
  Dialog,
  Box,
  Button,
  Typography,
  IconButton,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Close as CloseIcon,
  FilterAltOutlined as FilterIcon,
} from '@mui/icons-material';
import {
  formatTagForDisplay,
  isGroupedTag,
  getTagColor,
  getUniqueTagGroups,
  filterTagsByGroup,
} from '../utils/tagColors';
import { scrollbarStyles } from '../styles/scrollbarStyles';
import { Z_INDEX } from '../styles/zIndex';
import { dialogProps } from '../styles/dialogStyles';

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

const MONO_FONT = "'JetBrains Mono', ui-monospace, monospace";

const TagFilterDialog: React.FC<TagFilterDialogProps> = ({
  open,
  onClose,
  title = 'Filter by Tags',
  allTags,
  selectedTags,
  onTagsChange,
  showClearButton = true,
  showApplyButton = true,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const violet = theme.palette.primary.main;
  const violetSoft = alpha(violet, isDark ? 0.18 : 0.14);
  const violetBorder = alpha(violet, isDark ? 0.35 : 0.28);
  const surfaceInset = isDark
    ? 'rgba(255,255,255,0.03)'
    : alpha(theme.palette.text.primary, 0.03);
  const hairline = isDark ? 'rgba(255,255,255,0.08)' : theme.palette.divider;

  const [selectedTagGroup, setSelectedTagGroup] = useState<string>('');

  // All unique tag groups for the group filter chip row.
  const tagGroups = useMemo(() => getUniqueTagGroups(allTags), [allTags]);

  // Tags filtered by selected group.
  const filteredTags = useMemo(() => {
    if (!selectedTagGroup) return allTags;
    return filterTagsByGroup(allTags, selectedTagGroup);
  }, [allTags, selectedTagGroup]);

  const selectedSet = useMemo(() => new Set(selectedTags), [selectedTags]);

  const toggleTag = (tag: string) => {
    if (selectedSet.has(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  const handleClearTags = () => {
    onTagsChange([]);
  };

  const monoLabelSx = {
    fontFamily: MONO_FONT,
    fontSize: '0.68rem',
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: theme.palette.text.secondary,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0.75,
  };

  const optionalSx = {
    fontFamily: MONO_FONT,
    fontSize: '0.68rem',
    fontWeight: 500,
    letterSpacing: '0.08em',
    color: alpha(theme.palette.text.secondary, 0.7),
    textTransform: 'none' as const,
  };

  // Mirror TagFormDialog.chipStyle — violet selected fill, surfaceInset
  // unselected with hairline border, color dot inside.
  const chipStyle = (color: string, selected: boolean) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0.75,
    px: 1.25,
    py: 0.5,
    borderRadius: 999,
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
    userSelect: 'none' as const,
    transition: 'all 120ms ease',
    backgroundColor: selected ? violetSoft : surfaceInset,
    color: selected ? violet : theme.palette.text.primary,
    border: `1px solid ${selected ? violetBorder : hairline}`,
    '&:hover': {
      backgroundColor: selected
        ? violetSoft
        : alpha(theme.palette.text.primary, isDark ? 0.06 : 0.05),
    },
    '& .dot': {
      width: 6,
      height: 6,
      borderRadius: '50%',
      backgroundColor: color,
      flexShrink: 0,
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      {...dialogProps}
      sx={{ zIndex: Z_INDEX.DIALOG }}
      slotProps={{
        paper: {
          sx: {
            borderRadius: 2,
            border: `1px solid ${hairline}`,
            boxShadow: theme.shadows[10],
            backgroundImage: 'none',
            overflow: 'hidden',
          },
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2.5,
          py: 1.75,
          borderBottom: `1px solid ${hairline}`,
        }}
      >
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1.25,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: violetSoft,
            color: violet,
            border: `1px solid ${violetBorder}`,
            flexShrink: 0,
          }}
        >
          <FilterIcon sx={{ fontSize: 18 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
            {title}
          </Typography>
          <Typography
            sx={{
              fontSize: '0.78rem',
              color: theme.palette.text.secondary,
              lineHeight: 1.3,
            }}
          >
            {selectedTags.length > 0
              ? `${formatCount(selectedTags.length)} tag${selectedTags.length > 1 ? 's' : ''} selected`
              : 'No filter applied — showing everything'}
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ color: theme.palette.text.secondary }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Body */}
      <Box
        sx={{
          px: 2.5,
          py: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2.25,
          maxHeight: '70vh',
          overflowY: 'auto',
          ...scrollbarStyles(theme),
        }}
      >
        {/* Group filter chips */}
        {tagGroups.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography sx={monoLabelSx}>
              Group
              <Box component="span" sx={{ ...optionalSx, ml: 0.5 }}>
                · Optional
              </Box>
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              <Box
                sx={chipStyle(theme.palette.text.secondary, selectedTagGroup === '')}
                onClick={() => setSelectedTagGroup('')}
              >
                <Box component="span" className="dot" />
                All
              </Box>
              {tagGroups.map((g) => {
                const selected = selectedTagGroup === g;
                return (
                  <Box
                    key={g}
                    sx={chipStyle(getTagColor(`${g}:_`), selected)}
                    onClick={() => setSelectedTagGroup(selected ? '' : g)}
                  >
                    <Box component="span" className="dot" />
                    {g}
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

        {/* Tag chip grid */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography sx={monoLabelSx}>
            Tags
            <Box
              component="span"
              sx={{
                ...optionalSx,
                ml: 0.5,
              }}
            >
              · {filteredTags.length}
            </Box>
          </Typography>
          {filteredTags.length === 0 ? (
            <Box
              sx={{
                px: 1.5,
                py: 2,
                borderRadius: 1.5,
                border: `1px dashed ${hairline}`,
                backgroundColor: surfaceInset,
                textAlign: 'center',
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.82rem',
                  color: theme.palette.text.disabled,
                  fontFamily: MONO_FONT,
                }}
              >
                No tags in this group
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {filteredTags.map((tag) => {
                const selected = selectedSet.has(tag);
                const color = getTagColor(tag);
                return (
                  <Box
                    key={tag}
                    sx={chipStyle(color, selected)}
                    onClick={() => toggleTag(tag)}
                    title={isGroupedTag(tag) ? `Group: ${tag.split(':')[0]}` : undefined}
                  >
                    <Box component="span" className="dot" />
                    {formatTagForDisplay(tag, true)}
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      </Box>

      {/* Footer */}
      {(showClearButton || showApplyButton) && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            px: 2.5,
            py: 1.5,
            borderTop: `1px solid ${hairline}`,
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.02)'
              : alpha(theme.palette.text.primary, 0.02),
          }}
        >
          <Box>
            {showClearButton && (
              <Button
                onClick={handleClearTags}
                disabled={selectedTags.length === 0}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  color: theme.palette.text.secondary,
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.text.primary, 0.04),
                  },
                }}
              >
                Clear all
              </Button>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              onClick={onClose}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.85rem',
                color: theme.palette.text.secondary,
                '&:hover': {
                  backgroundColor: alpha(theme.palette.text.primary, 0.04),
                },
              }}
            >
              Cancel
            </Button>
            {showApplyButton && (
              <Button
                onClick={onClose}
                variant="contained"
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  backgroundColor: violet,
                  color: '#fff',
                  borderRadius: 1.25,
                  px: 1.75,
                  py: 0.75,
                  boxShadow: 'none',
                  '&:hover': {
                    backgroundColor: theme.palette.primary.dark,
                    boxShadow: 'none',
                  },
                  '&.Mui-disabled': {
                    backgroundColor: alpha(violet, 0.35),
                    color: alpha('#fff', 0.7),
                  },
                }}
              >
                Apply
              </Button>
            )}
          </Box>
        </Box>
      )}
    </Dialog>
  );
};

export default TagFilterDialog;
