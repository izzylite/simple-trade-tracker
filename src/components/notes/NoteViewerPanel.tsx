/**
 * NoteViewerPanel Component
 * Read-only note viewer rendered inline as a flex-sibling slide-in
 * panel. Designed to live alongside another dialog's main content
 * (e.g. TradeGalleryDialog) so that the surrounding content shrinks
 * to make room — no z-index stacking against the parent dialog.
 *
 * Loading model:
 *   - Pass `note` directly when the caller already has it.
 *   - Pass `noteId` and the panel will fetch via notesService and show
 *     a shimmer while loading. Useful for chat references whose embedded
 *     note payload is missing (e.g. conversations loaded from history).
 *   - Pass `loading` to force the shimmer state when the caller is
 *     fetching with a non-id source (e.g. game plan day-based query).
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
  alpha,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  PushPin as PinIcon,
  SmartToy as AIIcon,
} from '@mui/icons-material';

import { Note } from '../../types/note';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import Shimmer from '../Shimmer';
import { getNote } from '../../services/notesService';
import { logger } from '../../utils/logger';
import NoteViewerContent from './NoteViewerContent';

interface NoteViewerPanelProps {
  open: boolean;
  onClose: () => void;
  note?: Note | null;
  /** Note id to fetch internally when no `note` is provided. */
  noteId?: string | null;
  /** Force the shimmer state — useful when caller is fetching from a
   *  non-id source (e.g. day-based game-plan query). */
  loading?: boolean;
  /** Message rendered when the panel is open but has no content
   *  (e.g. "No game plan available for this day"). */
  emptyMessage?: string;
}

// Width of the panel when open. Sized smaller than the main content
// so the trade details remain the primary surface. Inner wrapper holds
// this width while the outer collapses to 0 — gives a smooth slide
// without content reflowing during the transition.
const PANEL_WIDTH = { xs: '100%', sm: 'min(45%, 380px)' } as const;
const INNER_WIDTH = { xs: '100%', sm: 'min(45vw, 380px)' } as const;

const NoteViewerPanelShimmer: React.FC = () => (
  <Box>
    {/* Cover image */}
    <Shimmer height={220} width="100%" borderRadius={0} variant="wave" intensity="low" />

    <Box sx={{ px: { xs: 2, md: 5 }, py: 4, maxWidth: 800, mx: 'auto' }}>
      {/* Tags row */}
      <Stack direction="row" spacing={0.5} sx={{ mb: 2 }}>
        <Shimmer height={24} width={60} borderRadius={12} variant="wave" intensity="low" />
        <Shimmer height={24} width={80} borderRadius={12} variant="wave" intensity="low" />
      </Stack>

      {/* Title */}
      <Shimmer height={48} width="80%" borderRadius={4} variant="wave" intensity="medium" sx={{ mb: 2 }} />

      {/* Date */}
      <Shimmer height={14} width={140} borderRadius={4} variant="wave" intensity="low" sx={{ mb: 3 }} />

      {/* Body lines */}
      <Stack spacing={1.2}>
        <Shimmer height={16} width="95%" borderRadius={4} variant="wave" intensity="low" />
        <Shimmer height={16} width="92%" borderRadius={4} variant="wave" intensity="low" />
        <Shimmer height={16} width="88%" borderRadius={4} variant="wave" intensity="low" />
        <Shimmer height={16} width="60%" borderRadius={4} variant="wave" intensity="low" />
      </Stack>
    </Box>
  </Box>
);

const NoteViewerPanel: React.FC<NoteViewerPanelProps> = ({
  open,
  onClose,
  note,
  noteId,
  loading = false,
  emptyMessage = 'No content available.',
}) => {
  const theme = useTheme();

  // Last rendered note — kept around so the close animation can play
  // out after the parent clears its `note` state.
  const [renderedNote, setRenderedNote] = useState<Note | null>(note ?? null);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Mirror the prop note into local state when caller provides it.
  useEffect(() => {
    if (note) {
      setRenderedNote(note);
      setNotFound(false);
    }
  }, [note]);

  // When caller signals a fresh load (noteId or loading) and hasn't
  // supplied a note, clear the previously-rendered note so the shimmer
  // can show instead of stale content.
  useEffect(() => {
    if (open && !note && (noteId || loading)) {
      setRenderedNote(null);
      setNotFound(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, loading, open]);

  // Fetch by id when no note is provided.
  useEffect(() => {
    if (!open || note || !noteId) return;

    let cancelled = false;
    setFetchLoading(true);
    setNotFound(false);

    getNote(noteId)
      .then((fetched) => {
        if (cancelled) return;
        if (fetched) {
          setRenderedNote(fetched);
        } else {
          setNotFound(true);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        logger.error('NoteViewerPanel: failed to fetch note', noteId, err);
        setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setFetchLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, note, noteId]);

  const showShimmer =
    open && !renderedNote && !notFound && (loading || fetchLoading || !!noteId);

  const headerNote = renderedNote;

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
      <Box
        sx={{
          width: INNER_WIDTH,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
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
            {headerNote?.is_pinned && (
              <PinIcon sx={{ fontSize: '1rem', color: 'primary.main' }} />
            )}
            {headerNote?.by_assistant && (
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
          {showShimmer ? (
            <NoteViewerPanelShimmer />
          ) : notFound ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                This note is unavailable. It may have been deleted.
              </Typography>
            </Box>
          ) : renderedNote ? (
            <NoteViewerContent note={renderedNote} />
          ) : (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {emptyMessage}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default NoteViewerPanel;
