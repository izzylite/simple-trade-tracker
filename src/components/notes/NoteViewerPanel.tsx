/**
 * NoteViewerPanel Component
 * Read-only note viewer rendered inline as a flex-sibling slide-in
 * panel. Designed to live alongside another dialog's main content
 * (e.g. TradeGalleryDialog) so that the surrounding content shrinks
 * to make room — no z-index stacking against the parent dialog.
 *
 * Parent must render this as a child of a `display: flex; flex-direction: row`
 * container. The panel collapses to width: 0 when closed.
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  IconButton,
  Toolbar,
  Typography,
  Chip,
  Stack,
  Tooltip,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  ArrowBack as BackIcon,
  PushPin as PinIcon,
  SmartToy as AIIcon,
} from '@mui/icons-material';

import { Note } from '../../types/note';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import { Z_INDEX } from '../../styles/zIndex';
import NoteViewerContent from './NoteViewerContent';

interface NoteViewerPanelProps {
  open: boolean;
  onClose: () => void;
  note: Note | null;
}

// Width of the panel when open. Sized smaller than the main content
// so the trade details remain the primary surface. Inner wrapper holds
// this width while the outer collapses to 0 — gives a smooth slide
// without content reflowing during the transition.
const PANEL_WIDTH = { xs: '100%', sm: 'min(45%, 380px)' } as const;
const INNER_WIDTH = { xs: '100%', sm: 'min(45vw, 380px)' } as const;

const NoteViewerPanel: React.FC<NoteViewerPanelProps> = ({
  open,
  onClose,
  note,
}) => {
  const theme = useTheme();

  // Keep last-rendered note around so close animation can play out
  // after the parent clears its `note` state.
  const [renderedNote, setRenderedNote] = useState<Note | null>(note);

  useEffect(() => {
    if (note) setRenderedNote(note);
  }, [note]);

  return (
    <Box
      sx={{
        width: open ? PANEL_WIDTH : 0,
        flexShrink: 0,
        overflow: 'hidden',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        borderLeft: open
          ? `1px solid ${alpha(theme.palette.divider, 0.12)}`
          : 'none',
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Inner wrapper holds the content at its natural width
          while the outer collapses — prevents reflow during animation. */}
      <Box
        sx={{
          width: INNER_WIDTH,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        {renderedNote && (
          <>
            <Toolbar
              sx={{
                borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                gap: 1,
                minHeight: 56,
              }}
            >
              

              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ flex: 1, minWidth: 0 }}
              >
                <Typography variant="h6" noWrap>
                  View Note
                </Typography>
                {renderedNote.is_pinned && (
                  <PinIcon sx={{ fontSize: '1rem', color: 'primary.main' }} />
                )}
                {renderedNote.by_assistant && (
                  <Chip
                    icon={<AIIcon sx={{ fontSize: '0.9rem !important' }} />}
                    label="AI"
                    size="small"
                    sx={{
                      height: 20,
                      '& .MuiChip-label': { px: 0.75, fontSize: '0.7rem' },
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: 'primary.main',
                    }}
                  />
                )}
              </Stack>

              <IconButton size="small" onClick={onClose}>
                <CloseIcon />
              </IconButton>
            </Toolbar>

            <Box
              sx={{
                flex: 1,
                overflowY: 'auto',
                ...(scrollbarStyles(theme) as any),
              }}
            >
              <NoteViewerContent note={renderedNote} />
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
};

export default NoteViewerPanel;
