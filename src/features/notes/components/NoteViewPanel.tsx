import React, { useCallback, useState } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  IconButton,
  Tooltip,
  alpha,
  useTheme,
  Chip,
} from '@mui/material';
import {
  Edit as EditIcon,
  PushPin as PinIcon,
  PushPinOutlined as PinOutlinedIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
  Notes as NotesIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { formatDistanceToNow, format } from 'date-fns';

import { Note } from 'features/notes/types/note';
import { Trade } from 'features/calendar/types/dualWrite';
import { getTagDisplayLabel } from 'features/notes/components/NoteEditorDialogTags';
import RichTextViewer from 'components/common/RichTextEditor/RichTextViewer';
import { scrollbarStyles } from 'styles/scrollbarStyles';
import { getSharedTrade } from 'features/calendar/services/sharingService';
import { logger } from 'utils/logger';
import { isDarkMode } from 'utils/themeMode';
import { getShadow } from 'styles/designTokens';
import TradeGalleryDialog from 'features/calendar/components/TradeGalleryDialog';
import ImageZoomDialog, { ImageZoomProp } from 'features/calendar/components/ImageZoomDialog';

interface NoteViewPanelProps {
  note: Note | null;
  onEdit: () => void;
  onNewNote: () => void;
  onPin: (note: Note) => void;
  onArchive: (note: Note) => void;
}

const NoteViewPanel: React.FC<NoteViewPanelProps> = ({
  note,
  onEdit,
  onNewNote,
  onPin,
  onArchive,
}) => {
  const theme = useTheme();
  const isDark = isDarkMode(theme);

  // Inline trade preview — replaces the default /shared/{id} navigation
  // when the user clicks a trade embed inside a note's body.
  const [previewTrade, setPreviewTrade] = useState<Trade | null>(null);
  const [tradePreviewOpen, setTradePreviewOpen] = useState(false);
  const [tradePreviewLoading, setTradePreviewLoading] = useState(false);
  const [zoomedImages, setZoomedImages] = useState<ImageZoomProp | null>(null);

  const handleSharedTradeClick = useCallback(async (shareId: string) => {
    setTradePreviewOpen(true);
    setTradePreviewLoading(true);
    try {
      const data = await getSharedTrade(shareId);
      if (data?.trade) setPreviewTrade(data.trade);
    } catch (err) {
      logger.error('Error loading shared trade:', err);
    } finally {
      setTradePreviewLoading(false);
    }
  }, []);

  if (!note) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 2,
          bgcolor: 'background.default',
        }}
      >
        <NotesIcon sx={{ fontSize: 56, color: 'text.disabled', opacity: 0.4 }} />
        <Typography variant="body2" color="text.disabled">
          Select a note or create one
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={onNewNote}
          sx={{
            borderRadius: '999px',
            borderColor: alpha(theme.palette.primary.main, 0.4),
            color: 'primary.main',
            '&:hover': { bgcolor: theme.palette.custom.tintViolet.soft },
          }}
        >
          New note
        </Button>
      </Box>
    );
  }

  const updatedAt = new Date(note.updated_at);
  const dateLabel = format(updatedAt, 'EEE, MMM d · yyyy');
  const relativeLabel = formatDistanceToNow(updatedAt, { addSuffix: true });

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        bgcolor: 'background.default',
      }}
    >
      {/* Sticky sub-header: breadcrumb meta + action buttons */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          borderBottom: `1px solid ${theme.palette.divider}`,
          bgcolor: alpha(
            isDark ? theme.palette.background.default : theme.palette.background.paper,
            0.88,
          ),
          backdropFilter: 'blur(20px) saturate(160%)',
          boxShadow: getShadow(theme, 'sm'),
          px: { xs: 2, sm: 4 },
          py: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        {/* Meta row */}
        <Typography sx={{ fontSize: '0.78rem', color: 'text.disabled', flex: 1 }}>
          {dateLabel}
          <Box component="span" sx={{ mx: 1, opacity: 0.5 }}>·</Box>
          Edited {relativeLabel}
        </Typography>

        {/* Action buttons */}
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Tooltip title={note.is_pinned ? 'Unpin' : 'Pin'} placement="bottom">
            <IconButton
              size="small"
              onClick={() => onPin(note)}
              sx={{
                color: note.is_pinned ? 'primary.main' : 'text.secondary',
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: `${theme.palette.custom.radius.md}px`,
                p: 0.75,
                '&:hover': { bgcolor: theme.palette.custom.tintViolet.soft },
              }}
            >
              {note.is_pinned
                ? <PinIcon sx={{ fontSize: '1rem' }} />
                : <PinOutlinedIcon sx={{ fontSize: '1rem' }} />}
            </IconButton>
          </Tooltip>

          <Tooltip title={note.is_archived ? 'Unarchive' : 'Archive'} placement="bottom">
            <IconButton
              size="small"
              onClick={() => onArchive(note)}
              sx={{
                color: 'text.secondary',
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: `${theme.palette.custom.radius.md}px`,
                p: 0.75,
                '&:hover': { bgcolor: alpha(theme.palette.warning.main, 0.08), color: 'warning.main' },
              }}
            >
              {note.is_archived
                ? <UnarchiveIcon sx={{ fontSize: '1rem' }} />
                : <ArchiveIcon sx={{ fontSize: '1rem' }} />}
            </IconButton>
          </Tooltip>

          <Button
            variant="contained"
            size="small"
            startIcon={<EditIcon sx={{ fontSize: '0.9rem !important' }} />}
            onClick={onEdit}
            sx={{
              borderRadius: `${theme.palette.custom.radius.md}px`,
              fontSize: '0.8rem',
              fontWeight: 600,
              px: 1.5,
              py: 0.75,
              bgcolor: 'primary.main',
              '&:hover': { bgcolor: 'primary.dark' },
              boxShadow: 'none',
              ml: 0.5,
            }}
          >
            Edit
          </Button>
        </Stack>
      </Box>

      {/* Scrollable content */}
      <Box sx={{ flex: 1, overflowY: 'auto', ...scrollbarStyles(theme) }}>
        {/* Cover image */}
        {note.cover_image && (
          <Box
            sx={{
              width: '100%',
              height: 200,
              backgroundImage: `url(${note.cover_image})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        )}

        {/* Content area: max-width centered like Notion */}
        <Box
          sx={{
            maxWidth: 800,
            mx: 'auto',
            px: { xs: 3, md: 7 },
            pt: 3.5,
            pb: 12,
          }}
        >
          {/* Tag chips */}
          {note.tags && note.tags.length > 0 && (
            <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ mb: 2, rowGap: 0.75 }}>
              {note.tags.map(tag => (
                <Chip
                  key={tag}
                  label={getTagDisplayLabel(tag)}
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    borderRadius: '999px',
                    bgcolor: theme.palette.custom.tintViolet.soft,
                    color: 'primary.main',
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
                    '& .MuiChip-label': { px: 1 },
                  }}
                />
              ))}
            </Stack>
          )}

          {/* Title */}
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: { xs: '1.6rem', md: '2.2rem' },
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
              color: 'text.primary',
              mb: 3,
              wordBreak: 'break-word',
            }}
          >
            {note.title || 'Untitled'}
          </Typography>

          {/* Body */}
          {note.content ? (
            <Box
              sx={{
                fontSize: '1rem',
                lineHeight: 1.78,
                color: 'text.secondary',
                '& h2': {
                  color: 'text.primary',
                  fontWeight: 700,
                  fontSize: '1.4rem',
                  letterSpacing: '-0.02em',
                  mt: 4,
                  mb: 1.5,
                },
                '& h3': {
                  color: 'text.primary',
                  fontWeight: 700,
                  fontSize: '1.1rem',
                  letterSpacing: '-0.015em',
                  mt: 3,
                  mb: 1,
                },
                '& p': { mb: 1.75 },
                '& ul, & ol': { pl: 2.75, mb: 1.75 },
                '& li': { mb: 0.75 },
                '& blockquote': {
                  borderLeft: `2px solid ${theme.palette.primary.main}`,
                  ml: 0,
                  pl: 2,
                  color: 'text.tertiary',
                  bgcolor: theme.palette.custom.tintViolet.soft,
                  borderRadius: `0 ${theme.palette.custom.radius.md}px ${theme.palette.custom.radius.md}px 0`,
                  py: 0.5,
                },
              }}
            >
              <RichTextViewer
                content={note.content}
                onSharedTradeClick={handleSharedTradeClick}
              />
            </Box>
          ) : (
            <Typography
              variant="body1"
              sx={{ color: 'text.disabled', fontStyle: 'italic' }}
            >
              No content
            </Typography>
          )}
        </Box>
      </Box>

      {/* Inline trade preview — opens when a trade embed is clicked.
          Replaces the default navigation to /shared/{id}. */}
      {tradePreviewOpen && (
        <TradeGalleryDialog
          open={tradePreviewOpen}
          onClose={() => {
            setTradePreviewOpen(false);
            setPreviewTrade(null);
          }}
          trades={previewTrade ? [previewTrade] : []}
          initialTradeId={previewTrade?.id}
          loading={tradePreviewLoading}
          setZoomedImage={(url, allImages, initialIndex) => {
            setZoomedImages({
              selectetdImageIndex: initialIndex || 0,
              allImages: allImages || [url],
            });
          }}
          title={previewTrade?.name || 'Trade Preview'}
          isReadOnly
          tradeOperations={{
            onZoomImage: (url, allImages, initialIndex) => {
              setZoomedImages({
                selectetdImageIndex: initialIndex || 0,
                allImages: allImages || [url],
              });
            },
            onUpdateTradeProperty: undefined,
            calendarId: undefined,
            onOpenGalleryMode: undefined,
            economicFilter: undefined,
            isTradeUpdating: undefined,
            isReadOnly: true,
          }}
        />
      )}

      {zoomedImages && (
        <ImageZoomDialog
          open={!!zoomedImages}
          onClose={() => setZoomedImages(null)}
          imageProp={zoomedImages}
        />
      )}
    </Box>
  );
};

export default NoteViewPanel;
