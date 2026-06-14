import React, { useMemo, useState } from 'react';
import { formatCount } from 'utils/formatters';
import {
  Dialog,
  Box,
  Button,
  Typography,
  IconButton,
  useTheme,
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
} from 'utils/tagColors';
import { scrollbarStyles } from 'styles/scrollbarStyles';
import { Z_INDEX } from 'styles/zIndex';
import { dialogProps } from 'styles/dialogStyles';
import { useDialogTokens, MONO_FONT } from 'styles/dialogTokens';
import {
  useFullScreenDialog,
  SAFE_AREA_TOP,
  SAFE_AREA_BOTTOM,
} from 'components/common/useFullScreenDialog';

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
  showApplyButton = true,
}) => {
  const theme = useTheme();
  const {
    surfaceInset,
    hairline,
    paperSx,
    headerSx,
    iconAvatarSx,
    footerSx,
    monoLabelSx,
    optionalSx,
    primaryButtonSx,
    ghostButtonSx,
    chipStyle: baseChipStyle,
  } = useDialogTokens();
  const { fullScreen, fullScreenPaperSx } = useFullScreenDialog();

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

  // Mirror TagFormDialog.chipStyle — base hook chip plus the color dot indicator.
  const chipStyle = (color: string, selected: boolean) => ({
    ...baseChipStyle(selected),
    gap: 0.75,
    fontSize: '0.8rem',
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
      fullScreen={fullScreen}
      {...dialogProps}
      sx={{ zIndex: Z_INDEX.DIALOG }}
      slotProps={{
        paper: {
          sx: { ...paperSx, ...fullScreenPaperSx },
        },
      }}
    >
      {/* Header */}
      <Box sx={{ ...headerSx, pt: fullScreen ? SAFE_AREA_TOP : undefined }}>
        <Box sx={iconAvatarSx}>
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
          maxHeight: fullScreen ? undefined : '70vh',
          // Under full-screen the body must flex+scroll so the footer
          // (Clear/Apply) stays pinned and reachable on tag-heavy calendars.
          ...(fullScreen ? { flex: 1, minHeight: 0 } : {}),
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
            ...footerSx,
            justifyContent: 'space-between',
            pb: fullScreen ? SAFE_AREA_BOTTOM : undefined,
          }}
        >
          <Box>
            {showClearButton && (
              <Button
                onClick={handleClearTags}
                disabled={selectedTags.length === 0}
                sx={{ ...ghostButtonSx, fontSize: '0.82rem' }}
              >
                Clear all
              </Button>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={onClose} sx={ghostButtonSx}>
              Cancel
            </Button>
            {showApplyButton && (
              <Button onClick={onClose} variant="contained" sx={primaryButtonSx}>
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
