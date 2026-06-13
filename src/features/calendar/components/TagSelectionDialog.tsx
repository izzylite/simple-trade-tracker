import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  Box,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Button,
  useTheme,
  alpha,
  SxProps,
  Theme,
} from '@mui/material';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  LocalOfferOutlined as TagIcon,
} from '@mui/icons-material';
import { scrollbarStyles } from 'styles/scrollbarStyles';
import { Z_INDEX } from 'styles/zIndex';
import { dialogProps } from 'styles/dialogStyles';
import { useDialogTokens, MONO_FONT } from 'styles/dialogTokens';
import {
  useFullScreenDialog,
  SAFE_AREA_TOP,
  SAFE_AREA_BOTTOM,
} from 'components/common/useFullScreenDialog';

export interface SelectableItem {
  /** Stable ID used in `selected`/`onChange`. */
  id: string;
  /** Display label (already formatted for human reading). */
  label: string;
  /** Optional right-aligned meta text — e.g. "11 trades" or "4 tags". */
  meta?: string;
  /** Optional chip style. If omitted, a neutral filled chip is used. */
  chipSx?: SxProps<Theme>;
}

interface TagSelectionDialogProps {
  open: boolean;
  onClose: () => void;

  /** Header bits. */
  title: string;
  description?: string;
  icon?: React.ReactNode;

  /** Color accent for the "selected" section. */
  accent?: 'error' | 'warning' | 'primary' | 'info' | 'success';

  /** Heading shown inside the pinned "selected" card (e.g. "Excluded"). */
  selectedLabel: string;
  /** Verb on the available list rows (e.g. "Exclude", "Require"). */
  actionVerb: string;
  /** Allow the "Clear all" button on the selected section. */
  allowClearAll?: boolean;

  items: SelectableItem[];
  selected: string[];
  onChange: (next: string[]) => void;

  searchPlaceholder?: string;
  /** Empty state shown when `items` is empty. */
  emptyText?: string;
}

/**
 * Generic two-list picker dialog.
 *
 * Top section pins everything currently selected (chips, delete to remove).
 * Bottom section is a searchable scrollable list of everything not yet
 * selected — click a row to add it.
 *
 * Used by:
 *  - Tag-pattern analysis (exclude tags)
 *  - Tag management (require tag groups)
 */
const TagSelectionDialog: React.FC<TagSelectionDialogProps> = ({
  open,
  onClose,
  title,
  description,
  icon,
  accent = 'error',
  selectedLabel,
  actionVerb,
  allowClearAll = true,
  items,
  selected,
  onChange,
  searchPlaceholder = 'Search tags…',
  emptyText = 'Nothing to select yet.',
}) => {
  const theme = useTheme();
  const {
    isDark,
    surfaceInset,
    hairline,
    paperSx,
    headerSx,
    iconAvatarSx,
    footerSx,
    monoLabelSx,
    inputSx,
    primaryButtonSx,
  } = useDialogTokens();
  const { fullScreen, fullScreenPaperSx } = useFullScreenDialog();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const accentColor = theme.palette[accent].main;

  const accentLabelSx = {
    ...monoLabelSx,
    color: accentColor,
  };

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const q = query.trim().toLowerCase();
  const matches = (item: SelectableItem) =>
    !q ||
    item.label.toLowerCase().includes(q) ||
    item.id.toLowerCase().includes(q);

  // Preserve original order so the selected section doesn't jump around as
  // the user toggles items.
  const selectedItems = items.filter((i) => selectedSet.has(i.id));
  const availableItems = items.filter(
    (i) => !selectedSet.has(i.id) && matches(i),
  );

  const setSelected = (id: string, on: boolean) => {
    const next = new Set(selectedSet);
    if (on) next.add(id);
    else next.delete(id);
    onChange(Array.from(next));
  };

  // Chip style mirroring TagFormDialog — selected uses accent fill (since this
  // dialog is action-coloured: exclude=error, require=primary, etc.),
  // unselected uses surfaceInset + hairline.
  const chipSx = (active: boolean) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0.5,
    px: 1.25,
    py: 0.5,
    borderRadius: 999,
    fontSize: '0.8rem',
    fontWeight: 600,
    userSelect: 'none' as const,
    transition: 'all 120ms ease',
    backgroundColor: active ? alpha(accentColor, isDark ? 0.18 : 0.14) : surfaceInset,
    color: active ? accentColor : theme.palette.text.primary,
    border: `1px solid ${active ? alpha(accentColor, isDark ? 0.35 : 0.28) : hairline}`,
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
          sx: {
            ...paperSx,
            ...(fullScreen ? {} : { maxHeight: '82vh' }),
            ...fullScreenPaperSx,
          },
        },
      }}
    >
      {/* Header */}
      <Box sx={{ ...headerSx, pt: fullScreen ? SAFE_AREA_TOP : undefined }}>
        <Box sx={iconAvatarSx}>
          {icon ?? <TagIcon sx={{ fontSize: 18 }} />}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
            {title}
          </Typography>
          {description && (
            <Typography
              sx={{
                fontSize: '0.78rem',
                color: theme.palette.text.secondary,
                lineHeight: 1.3,
              }}
            >
              {description}
            </Typography>
          )}
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
          gap: 2,
          maxHeight: fullScreen ? undefined : '60vh',
          overflowY: 'auto',
          ...scrollbarStyles(theme),
        }}
      >
        {/* Selected — pinned to top */}
        {selectedItems.length > 0 && (
          <Box
            sx={{
              p: 1.5,
              borderRadius: 1.5,
              backgroundColor: alpha(accentColor, isDark ? 0.08 : 0.06),
              border: `1px solid ${alpha(accentColor, isDark ? 0.25 : 0.18)}`,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 1,
              }}
            >
              <Typography sx={accentLabelSx}>
                {selectedLabel} · {selectedItems.length}
              </Typography>
              {allowClearAll && (
                <Button
                  size="small"
                  onClick={() => onChange([])}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    color: accentColor,
                    minWidth: 0,
                    px: 0.75,
                    py: 0.25,
                    '&:hover': {
                      backgroundColor: alpha(accentColor, 0.08),
                    },
                  }}
                >
                  Clear all
                </Button>
              )}
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {selectedItems.map((item) => (
                <Box
                  key={item.id}
                  sx={{
                    ...chipSx(true),
                    gap: 0.75,
                    pl: 1.25,
                    pr: 0.5,
                  }}
                >
                  <Box component="span">{item.label}</Box>
                  <IconButton
                    size="small"
                    onClick={() => setSelected(item.id, false)}
                    sx={{
                      p: 0.25,
                      color: 'inherit',
                      '&:hover': {
                        backgroundColor: alpha(accentColor, 0.18),
                      },
                    }}
                    aria-label={`Remove ${item.label}`}
                  >
                    <CloseIcon sx={{ fontSize: 13 }} />
                  </IconButton>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* Search */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Typography sx={monoLabelSx}>Search</Typography>
          <TextField
            fullWidth
            size="small"
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon
                    sx={{ fontSize: 18, color: theme.palette.text.disabled }}
                  />
                </InputAdornment>
              ),
              endAdornment: query ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setQuery('')}>
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </InputAdornment>
              ) : undefined,
            }}
            sx={inputSx}
          />
        </Box>

        {/* Available list */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Typography sx={monoLabelSx}>
            Available
            <Box
              component="span"
              sx={{
                fontFamily: MONO_FONT,
                fontSize: '0.68rem',
                fontWeight: 500,
                letterSpacing: '0.08em',
                color: alpha(theme.palette.text.secondary, 0.7),
                textTransform: 'none' as const,
                ml: 0.5,
              }}
            >
              · {availableItems.length}
            </Box>
          </Typography>
          {items.length === 0 ? (
            <Box
              sx={{
                px: 1.5,
                py: 2.5,
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
                {emptyText}
              </Typography>
            </Box>
          ) : availableItems.length === 0 ? (
            <Box
              sx={{
                px: 1.5,
                py: 2.5,
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
                {q
                  ? 'No matches for your search'
                  : `All ${items.length === 1 ? 'items' : 'items'} selected`}
              </Typography>
            </Box>
          ) : (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 0.25,
                maxHeight: 320,
                overflowY: 'auto',
                ...scrollbarStyles(theme),
                mx: -0.75,
                px: 0.75,
              }}
            >
              {availableItems.map((item) => (
                <Box
                  key={item.id}
                  onClick={() => setSelected(item.id, true)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1.5,
                    px: 1,
                    py: 0.75,
                    borderRadius: 1.25,
                    cursor: 'pointer',
                    transition: 'background-color 120ms ease',
                    '&:hover': {
                      backgroundColor: alpha(
                        theme.palette.text.primary,
                        isDark ? 0.05 : 0.04,
                      ),
                    },
                  }}
                >
                  <Box
                    sx={{
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      ...(item.chipSx
                        ? {
                            display: 'inline-flex',
                            alignItems: 'center',
                            px: 1.25,
                            py: 0.4,
                            borderRadius: 999,
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            ...item.chipSx,
                          }
                        : chipSx(false)),
                    }}
                  >
                    {item.label}
                  </Box>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    {item.meta && (
                      <Typography
                        sx={{
                          fontFamily: MONO_FONT,
                          fontSize: '0.72rem',
                          fontWeight: 500,
                          color: theme.palette.text.disabled,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.meta}
                      </Typography>
                    )}
                    <Typography
                      sx={{
                        fontFamily: MONO_FONT,
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: alpha(accentColor, 0.75),
                      }}
                    >
                      {actionVerb}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Box>

      {/* Footer */}
      <Box sx={{ ...footerSx, pb: fullScreen ? SAFE_AREA_BOTTOM : undefined }}>
        <Button onClick={onClose} variant="contained" sx={primaryButtonSx}>
          Done
        </Button>
      </Box>
    </Dialog>
  );
};

export default TagSelectionDialog;
