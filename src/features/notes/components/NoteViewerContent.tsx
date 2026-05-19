/**
 * NoteViewerContent Component
 * Shared inner content for the note viewer — used by both
 * NoteViewerDialog (modal) and NoteViewerPanel (inline slide-in).
 */

import React, { useCallback, useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  Stack,
  useTheme,
  alpha,
} from '@mui/material';
import { format } from 'date-fns';
import { Note } from 'features/notes/types/note';
import { Trade } from 'features/calendar/types/dualWrite';
import { getTagDisplayLabel } from 'features/notes/components/NoteEditorDialogTags';
import RichTextViewer from 'components/common/RichTextEditor/RichTextViewer';
import { getSharedTrade } from 'features/calendar/services/sharingService';
import { logger } from 'utils/logger';
import TradeGalleryDialog from 'features/calendar/components/TradeGalleryDialog';
import ImageZoomDialog, { ImageZoomProp } from 'features/calendar/components/ImageZoomDialog';
import { EYEBROW_SX } from 'styles/designTokens';

interface NoteViewerContentProps {
  note: Note;
}

const NoteViewerContent: React.FC<NoteViewerContentProps> = ({ note }) => {
  const theme = useTheme();

  // Shared-trade preview triggered by clicking a TRADE_LINK chip in the
  // body. Same pattern as NoteEditorBody / NoteViewPanel / NoteMetaPanel —
  // worth extracting to a useSharedTradePreview hook once 5+ call sites
  // exist; left inline here to keep this commit a pure bug fix.
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTrade, setPreviewTrade] = useState<Trade | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [zoomedImages, setZoomedImages] = useState<ImageZoomProp | null>(null);

  const handleSharedTradeClick = useCallback(async (shareId: string) => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewTrade(null);
    try {
      const data = await getSharedTrade(shareId);
      if (data?.trade) setPreviewTrade(data.trade);
    } catch (err) {
      logger.error('Error loading shared trade in note viewer:', err);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const formattedDate = note.updated_at
    ? format(new Date(note.updated_at), 'MMM d, yyyy')
    : note.created_at
      ? format(new Date(note.created_at), 'MMM d, yyyy')
      : '';

  return (
    <>
      {note.cover_image && (
        <Box
          sx={{
            width: '100%',
            height: 220,
            backgroundImage: `url(${note.cover_image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}

      <Box
        sx={{
          maxWidth: 800,
          margin: '0 auto',
          px: { xs: 2, md: 5 },
          py: 4,
        }}
      >
        {note.tags && note.tags.length > 0 && (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mb: 2, rowGap: 0.5 }}>
            {note.tags.map((tag) => (
              <Chip
                key={tag}
                label={getTagDisplayLabel(tag)}
                size="small"
                sx={{
                  height: 24,
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  borderRadius: `${theme.palette.custom.radius.md}px`,
                  bgcolor: theme.palette.custom.tintViolet.soft,
                  color: 'primary.main',
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
                  '& .MuiChip-label': { px: 1 },
                }}
              />
            ))}
          </Stack>
        )}

        <Typography
          variant="h3"
          sx={{
            fontWeight: 700,
            lineHeight: 1.2,
            mb: 2,
            wordBreak: 'break-word',
          }}
        >
          {note.title || 'Untitled'}
        </Typography>

        {formattedDate && (
          <Typography
            sx={{
              ...EYEBROW_SX,
              color: 'text.tertiary',
              mb: 3,
              display: 'block',
            }}
          >
            {note.updated_at ? 'Updated' : 'Created'} · {formattedDate}
          </Typography>
        )}

        <Box sx={{ mt: 3 }}>
          {note.content ? (
            <RichTextViewer
              content={note.content}
              onSharedTradeClick={handleSharedTradeClick}
            />
          ) : (
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ fontStyle: 'italic' }}
            >
              No content
            </Typography>
          )}
        </Box>
      </Box>

      {previewOpen && (
        <TradeGalleryDialog
          open={previewOpen}
          onClose={() => { setPreviewOpen(false); setPreviewTrade(null); }}
          trades={previewTrade ? [previewTrade] : []}
          initialTradeId={previewTrade?.id}
          loading={previewLoading}
          setZoomedImage={(url, allImages, initialIndex) => {
            setZoomedImages({ selectetdImageIndex: initialIndex || 0, allImages: allImages || [url] });
          }}
          title={previewTrade?.name || 'Trade Preview'}
          isReadOnly
          tradeOperations={{
            onZoomImage: (url, allImages, initialIndex) => {
              setZoomedImages({ selectetdImageIndex: initialIndex || 0, allImages: allImages || [url] });
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
    </>
  );
};

export default NoteViewerContent;
