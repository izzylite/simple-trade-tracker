import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Container,
  Toolbar,
  Alert,
  Typography,
  Chip,
  Stack,
  Skeleton,
  ThemeProvider,
  CssBaseline,
} from '@mui/material';
import { createTheme } from '@mui/material/styles';
import { createAppTheme } from 'theme';
import { format } from 'date-fns';
import AppHeader from 'components/common/AppHeader';
import RichTextViewer from
  'components/common/RichTextEditor/RichTextViewer';
import {
  getSharedNote,
  getSharedTrade,
  SharedNoteData,
} from 'features/calendar/services/sharingService';
import { Trade } from 'features/calendar/types/dualWrite';
import TradeGalleryDialog from 'features/calendar/components/TradeGalleryDialog';
import ImageZoomDialog, { ImageZoomProp } from 'features/calendar/components/ImageZoomDialog';
import { logger } from 'utils/logger';

const SharedNotePage: React.FC = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const [note, setNote] = useState<SharedNoteData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('themeMode');
    return (saved as 'light' | 'dark') || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('themeMode', mode);
  }, [mode]);

  const theme = useMemo(
    () => createTheme(createAppTheme(mode)),
    [mode]
  );

  // Embedded TRADE_LINK chip → fetch the trade via the public share-link
  // edge function and surface it in a read-only TradeGalleryDialog. This
  // is a PUBLIC page, so all access must go through getSharedTrade.
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
      logger.error('Error loading shared trade on shared-note page:', err);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!shareId) return;

    const fetchNote = async () => {
      try {
        setLoading(true);
        const data = await getSharedNote(shareId);
        if (data) {
          setNote(data);
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchNote();
  }, [shareId]);

  const formattedDate = note?.shared_at
    ? format(new Date(note.shared_at), 'MMM d, yyyy')
    : '';

  if (!shareId) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            minHeight: '100vh',
            backgroundColor: 'custom.pageBackground',
          }}
        >
          <AppHeader
            onToggleTheme={() =>
              setMode((p) =>
                p === 'light' ? 'dark' : 'light'
              )
            }
            mode={mode}
          />
          <Toolbar />
          <Container maxWidth="md" sx={{ pt: 4 }}>
            <Alert severity="error">
              Invalid share link
            </Alert>
          </Container>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          backgroundColor: 'custom.pageBackground',
        }}
      >
        <AppHeader
          onToggleTheme={() =>
            setMode((p) =>
              p === 'light' ? 'dark' : 'light'
            )
          }
          mode={mode}
        />
        <Toolbar sx={{ pl: 0, pr: 0 }} />

        <Container
          maxWidth="md"
          sx={{
            pt: { xs: 2, sm: 4 },
            pb: { xs: 2, sm: 4 },
            px: { xs: 1, sm: 3 },
          }}
        >
          {loading && (
            <Box>
              <Skeleton
                variant="rectangular"
                height={200}
                sx={{ borderRadius: 2, mb: 3 }}
              />
              <Skeleton width="60%" height={40} />
              <Skeleton width="30%" height={20} />
              <Skeleton height={200} sx={{ mt: 3 }} />
            </Box>
          )}

          {error && (
            <Alert severity="error">
              Note not found or sharing has been disabled
            </Alert>
          )}

          {!loading && !error && note && (
            <Box>
              {/* Cover Image */}
              {note.cover_image && (
                <Box
                  sx={{
                    width: '100%',
                    height: 220,
                    backgroundImage:
                      `url(${note.cover_image})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    borderRadius: 2,
                    mb: 3,
                  }}
                />
              )}

              {/* Tags */}
              {note.tags.length > 0 && (
                <Stack
                  direction="row"
                  spacing={0.5}
                  flexWrap="wrap"
                  sx={{ mb: 2 }}
                >
                  {note.tags.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      sx={{
                        bgcolor: 'secondary.main',
                        color: 'secondary.contrastText',
                        fontWeight: 500,
                        fontSize: '0.75rem',
                        height: 24,
                      }}
                    />
                  ))}
                </Stack>
              )}

              {/* Title */}
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

              {/* Date */}
              {formattedDate && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mb: 3, display: 'block' }}
                >
                  Shared {formattedDate}
                </Typography>
              )}

              {/* Content */}
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
          )}
        </Container>

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
      </Box>
    </ThemeProvider>
  );
};

export default SharedNotePage;
