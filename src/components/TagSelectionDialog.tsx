import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Stack,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Button,
  Divider,
  useTheme,
  alpha,
  SxProps,
  Theme,
} from '@mui/material';
import { Close, Search as SearchIcon } from '@mui/icons-material';
import { scrollbarStyles } from '../styles/scrollbarStyles';

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
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const accentColor = theme.palette[accent].main;

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const q = query.trim().toLowerCase();
  const matches = (item: SelectableItem) =>
    !q || item.label.toLowerCase().includes(q) || item.id.toLowerCase().includes(q);

  // Preserve original order so the selected section doesn't jump around as
  // the user toggles items.
  const selectedItems = items.filter((i) => selectedSet.has(i.id));
  const availableItems = items.filter((i) => !selectedSet.has(i.id) && matches(i));

  const setSelected = (id: string, on: boolean) => {
    const next = new Set(selectedSet);
    if (on) next.add(id);
    else next.delete(id);
    onChange(Array.from(next));
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          bgcolor: theme.palette.background.paper,
          backgroundImage: 'none',
          boxShadow: 'none',
          border: `1px solid ${theme.palette.divider}`,
          maxHeight: '82vh',
          overflow: 'hidden',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          {icon}
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
        </Stack>
        <IconButton onClick={onClose} size="small">
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ ...scrollbarStyles(theme), pt: '4px !important' }}>
        {description && (
          <Typography
            variant="caption"
            sx={{ color: theme.palette.text.secondary, display: 'block', mb: 1.5 }}
          >
            {description}
          </Typography>
        )}

        {/* Selected — pinned to top */}
        {selectedItems.length > 0 && (
          <Box
            sx={{
              mb: 2,
              p: 1.5,
              borderRadius: 2,
              bgcolor: alpha(accentColor, 0.06),
              border: `1px solid ${alpha(accentColor, 0.18)}`,
            }}
          >
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              mb={1}
            >
              <Typography
                variant="overline"
                sx={{ color: accentColor, letterSpacing: 1, opacity: 0.9 }}
              >
                {selectedLabel} · {selectedItems.length}
              </Typography>
              {allowClearAll && (
                <Button
                  size="small"
                  onClick={() => onChange([])}
                  sx={{ textTransform: 'none', minWidth: 0, p: 0.25 }}
                >
                  Clear all
                </Button>
              )}
            </Stack>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {selectedItems.map((item) => (
                <Chip
                  key={item.id}
                  label={item.label}
                  size="small"
                  onDelete={() => setSelected(item.id, false)}
                  deleteIcon={<Close sx={{ fontSize: 14 }} />}
                  sx={{
                    height: 26,
                    bgcolor: alpha(theme.palette.text.primary, 0.06),
                    color: theme.palette.text.secondary,
                    border: `1px dashed ${alpha(theme.palette.text.primary, 0.25)}`,
                  }}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* Search */}
        <TextField
          fullWidth
          size="small"
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: theme.palette.text.disabled }} />
              </InputAdornment>
            ),
            endAdornment: query ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setQuery('')}>
                  <Close sx={{ fontSize: 16 }} />
                </IconButton>
              </InputAdornment>
            ) : undefined,
            sx: { borderRadius: 2, bgcolor: alpha(theme.palette.text.primary, 0.04) },
          }}
          sx={{ mb: 1.5 }}
        />

        <Divider sx={{ mb: 1, opacity: 0.5 }} />

        {/* Available list */}
        {items.length === 0 ? (
          <Typography
            variant="body2"
            sx={{ color: theme.palette.text.disabled, py: 3, textAlign: 'center' }}
          >
            {emptyText}
          </Typography>
        ) : availableItems.length === 0 ? (
          <Typography
            variant="body2"
            sx={{ color: theme.palette.text.disabled, py: 3, textAlign: 'center' }}
          >
            {q ? 'No matches for your search.' : `All ${items.length === 1 ? 'item is' : 'items are'} selected.`}
          </Typography>
        ) : (
          <Stack
            spacing={0.25}
            sx={{
              maxHeight: 320,
              overflowY: 'auto',
              ...scrollbarStyles(theme),
              mx: -1,
              px: 1,
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
                  borderRadius: 1.5,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.05) },
                }}
              >
                <Chip
                  label={item.label}
                  size="small"
                  sx={
                    item.chipSx
                      ? { ...item.chipSx, height: 24 }
                      : {
                          height: 24,
                          bgcolor: alpha(theme.palette.text.primary, 0.08),
                          color: theme.palette.text.primary,
                        }
                  }
                />
                <Stack direction="row" alignItems="center" spacing={1}>
                  {item.meta && (
                    <Typography
                      variant="caption"
                      sx={{ color: theme.palette.text.disabled, whiteSpace: 'nowrap' }}
                    >
                      {item.meta}
                    </Typography>
                  )}
                  <Typography
                    variant="caption"
                    sx={{ color: theme.palette.text.disabled }}
                  >
                    {actionVerb}
                  </Typography>
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TagSelectionDialog;
