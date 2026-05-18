/**
 * useTradeLinkInsertion
 *
 * Bundles the "insert trade link" toolbar flow and the shared-trade preview
 * that fires when a user clicks an embedded TRADE_LINK chip. Both flows
 * appear in every editor surface that allows trade-share embedding
 * (NoteEditorBody, TradeForm), so the state, dialogs and image-zoom
 * plumbing live here instead of being duplicated per caller.
 *
 * Returns:
 *   - onInsertTradeLink:   wire to <RichTextEditor onInsertTradeLink>
 *   - onSharedTradeClick:  wire to <RichTextEditor onSharedTradeClick>
 *   - elements:            render once next to the editor; contains the
 *                          insert-link dialog, the read-only preview
 *                          gallery, and the image-zoom dialog.
 *
 * Dialogs are pinned to Z_INDEX.RICH_TEXT_DIALOG so they stack above any
 * parent dialog (e.g. TradeFormDialog at DIALOG_POPUP = 1600).
 */

import React, { ReactNode, RefObject, useCallback, useState } from 'react';
import {
  Dialog,
  TextField,
  Button,
  Typography,
  CircularProgress,
  IconButton,
  Box,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  CallMadeOutlined as TradeLinkIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';

import { Trade } from 'features/calendar/types/dualWrite';
import { getSharedTrade } from 'features/calendar/services/sharingService';
import { logger } from 'utils/logger';
import { Z_INDEX } from 'styles/zIndex';
import { useDialogTokens, MONO_FONT } from 'styles/dialogTokens';
import { dialogProps } from 'styles/dialogStyles';
import { isInternalTradeLink } from 'components/common/RichTextEditor/utils/linkUtils';
import type { TradeChipData } from 'components/common/RichTextEditor/utils/tradeEntityUtils';
import type { RichTextEditorHandle } from 'components/common/RichTextEditor';
import TradeGalleryDialog from 'features/calendar/components/TradeGalleryDialog';
import ImageZoomDialog, { ImageZoomProp } from 'features/calendar/components/ImageZoomDialog';

export interface UseTradeLinkInsertionResult {
  /** Pass to <RichTextEditor onInsertTradeLink>. */
  onInsertTradeLink: () => void;
  /** Pass to <RichTextEditor onSharedTradeClick>. */
  onSharedTradeClick: (shareId: string, tradeId: string) => void;
  /** Dialog JSX — render once near the editor. */
  elements: ReactNode;
}

export function useTradeLinkInsertion(
  editorRef: RefObject<RichTextEditorHandle | null>,
): UseTradeLinkInsertionResult {
  const theme = useTheme();
  const tokens = useDialogTokens();
  const {
    violet, surfaceInset, hairline,
    monoLabelSx,
    paperSx, headerSx, iconAvatarSx, footerSx,
    primaryButtonSx, ghostButtonSx,
  } = tokens;

  // Insert dialog
  const [insertOpen, setInsertOpen] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Preview gallery
  const [previewTrade, setPreviewTrade] = useState<Trade | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Image zoom (opened by the preview gallery)
  const [zoomedImages, setZoomedImages] = useState<ImageZoomProp | null>(null);

  const openInsert = useCallback(() => {
    setInputUrl('');
    setError(null);
    setLoading(false);
    setInsertOpen(true);
  }, []);

  const closeInsert = useCallback(() => {
    if (!loading) setInsertOpen(false);
  }, [loading]);

  const submitInsert = useCallback(async () => {
    const url = inputUrl.trim();
    if (!url) {
      setError('Paste a trade share link to continue.');
      return;
    }
    const parsed = isInternalTradeLink(url);
    if (parsed.type !== 'shared' || !parsed.id) {
      setError("That doesn't look like a trade share link (expected /shared/<id>).");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await getSharedTrade(parsed.id);
      const trade = result?.trade;
      if (!trade) {
        setError('Share link not found or is no longer accessible.');
        return;
      }
      const data: TradeChipData = {
        shareId: parsed.id,
        tradeId: trade.id,
        date: new Date(trade.trade_date).toISOString(),
        // trade.amount is signed P&L; preserve sign for win/loss styling.
        pnl: trade.amount ?? 0,
      };
      editorRef.current?.insertTradeLink(data);
      setInsertOpen(false);
    } catch (err) {
      logger.error('Failed to resolve trade share link', err);
      setError('Failed to load the trade. Check the link and try again.');
    } finally {
      setLoading(false);
    }
  }, [inputUrl, editorRef]);

  const onSharedTradeClick = useCallback(
    async (shareId: string, _tradeId: string) => {
      setPreviewOpen(true);
      setPreviewLoading(true);
      try {
        const data = await getSharedTrade(shareId);
        if (data?.trade) setPreviewTrade(data.trade);
      } catch (err) {
        logger.error('Error loading shared trade:', err);
      } finally {
        setPreviewLoading(false);
      }
    },
    [],
  );

  const handleZoom = useCallback(
    (url: string, allImages?: string[], initialIndex?: number) => {
      setZoomedImages({
        selectetdImageIndex: initialIndex || 0,
        allImages: allImages || [url],
      });
    },
    [],
  );

  // Mono URL field — switches its border to error tones during validation.
  const urlInputSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: 1.5,
      backgroundColor: surfaceInset,
      '& fieldset': {
        borderColor: error ? alpha(theme.palette.error.main, 0.6) : hairline,
      },
      '&:hover fieldset': {
        borderColor: error ? theme.palette.error.main : alpha(violet, 0.5),
      },
      '&.Mui-focused fieldset': {
        borderColor: error ? theme.palette.error.main : violet,
        borderWidth: 1,
      },
    },
    '& .MuiOutlinedInput-input': {
      py: 1.1,
      fontSize: '0.88rem',
      fontWeight: 500,
      fontFamily: MONO_FONT,
    },
  };

  const elements: ReactNode = (
    <>
      <Dialog
        open={insertOpen}
        onClose={closeInsert}
        maxWidth="sm"
        fullWidth
        {...dialogProps}
        sx={{ zIndex: Z_INDEX.RICH_TEXT_DIALOG }}
        slotProps={{ paper: { sx: paperSx } }}
      >
        {/* Header */}
        <Box sx={headerSx}>
          <Box sx={iconAvatarSx}>
            <TradeLinkIcon sx={{ fontSize: 18 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
              Insert trade share link
            </Typography>
            <Typography
              sx={{
                fontSize: '0.78rem',
                color: theme.palette.text.secondary,
                lineHeight: 1.3,
              }}
            >
              Embed a live trade chip from any shared trade URL
            </Typography>
          </Box>
          <IconButton
            onClick={closeInsert}
            disabled={loading}
            size="small"
            sx={{ color: theme.palette.text.secondary }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Body */}
        <Box sx={{ px: 2.5, py: 2, display: 'flex', flexDirection: 'column', gap: 1.75 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1,
              px: 1.25,
              py: 1,
              borderRadius: 1.25,
              border: `1px solid ${hairline}`,
              backgroundColor: surfaceInset,
            }}
          >
            <TradeLinkIcon sx={{ fontSize: 14, color: violet, mt: 0.25, flexShrink: 0 }} />
            <Typography
              sx={{
                fontSize: '0.78rem',
                color: theme.palette.text.secondary,
                lineHeight: 1.5,
              }}
            >
              Paste a trade share link. This will resolve to a clickable trade chip.
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Typography sx={monoLabelSx}>
              Share URL
              <Box
                component="span"
                sx={{ color: theme.palette.error.main, fontFamily: 'inherit' }}
              >
                *
              </Box>
            </Typography>
            <TextField
              autoFocus
              fullWidth
              size="small"
              value={inputUrl}
              onChange={(e) => {
                setInputUrl(e.target.value);
                if (error) setError(null);
              }}
              placeholder="https://app/shared/share_…"
              error={!!error}
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !loading) {
                  e.preventDefault();
                  void submitInsert();
                }
              }}
              sx={urlInputSx}
            />
            {error && (
              <Typography
                sx={{
                  fontSize: '0.75rem',
                  color: theme.palette.error.main,
                  mt: 0.25,
                }}
              >
                {error}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Footer */}
        <Box sx={footerSx}>
          <Button onClick={closeInsert} disabled={loading} sx={ghostButtonSx}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              void submitInsert();
            }}
            disabled={loading || !inputUrl.trim()}
            variant="contained"
            endIcon={
              loading ? (
                <CircularProgress size={14} thickness={5} sx={{ color: 'inherit' }} />
              ) : (
                <ArrowIcon sx={{ fontSize: 14 }} />
              )
            }
            sx={primaryButtonSx}
          >
            {loading ? 'Resolving…' : 'Insert trade'}
          </Button>
        </Box>
      </Dialog>

      {previewOpen && (
        <TradeGalleryDialog
          open={previewOpen}
          onClose={() => {
            setPreviewOpen(false);
            setPreviewTrade(null);
          }}
          trades={previewTrade ? [previewTrade] : []}
          initialTradeId={previewTrade?.id}
          loading={previewLoading}
          title={previewTrade?.name || 'Trade Preview'}
          isReadOnly
          setZoomedImage={handleZoom}
          tradeOperations={{
            onZoomImage: handleZoom,
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

  return {
    onInsertTradeLink: openInsert,
    onSharedTradeClick,
    elements,
  };
}
