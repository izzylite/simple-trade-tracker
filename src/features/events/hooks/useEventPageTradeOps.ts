import { useCallback, useState } from 'react';
import { Trade } from 'features/calendar/types/dualWrite';
import { TradeOperationsProps } from 'features/calendar/types/tradeOperations';
import { getTradeById, updateTrade } from 'features/calendar/services/calendarService';
import { ImageZoomProp } from 'features/calendar/components/ImageZoomDialog';
import { logger } from 'utils/logger';

interface UseEventPageTradeOpsReturn {
  tradeOps: Pick<TradeOperationsProps, 'onUpdateTradeProperty' | 'onZoomImage' | 'onOpenGalleryMode'>;
  isTradeUpdating: (tradeId: string) => boolean;
  zoomedImages: ImageZoomProp | null;
  setZoomedImage: (url: string, allImages?: string[], initialIndex?: number) => void;
  closeZoom: () => void;
  galleryMode: {
    open: boolean;
    trades: Trade[];
    initialTradeId?: string;
    title?: string;
    aiOnlyMode?: boolean;
  };
  openGalleryMode: (trades: Trade[], initialTradeId?: string, title?: string) => void;
  closeGalleryMode: () => void;
}

export function useEventPageTradeOps(): UseEventPageTradeOpsReturn {
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [zoomedImages, setZoomedImagesState] = useState<ImageZoomProp | null>(null);
  const [galleryMode, setGalleryMode] = useState<{
    open: boolean;
    trades: Trade[];
    initialTradeId?: string;
    title?: string;
    aiOnlyMode?: boolean;
  }>({ open: false, trades: [] });

  const isTradeUpdating = useCallback(
    (tradeId: string) => updatingIds.has(tradeId),
    [updatingIds]
  );

  const onUpdateTradeProperty = useCallback(
    async (
      tradeId: string,
      updateCallback: (trade: Trade) => Trade
    ): Promise<Trade | undefined> => {
      setUpdatingIds((prev) => new Set(prev).add(tradeId));
      try {
        const trade = await getTradeById(tradeId);
        if (!trade) throw new Error(`Trade ${tradeId} not found`);
        const updated = await updateTrade(trade, updateCallback);
        return updated ?? undefined;
      } catch (err) {
        logger.error('useEventPageTradeOps: update failed', err);
        return undefined;
      } finally {
        setUpdatingIds((prev) => {
          const next = new Set(prev);
          next.delete(tradeId);
          return next;
        });
      }
    },
    []
  );

  const setZoomedImage = useCallback(
    (url: string, allImages?: string[], initialIndex?: number) => {
      setZoomedImagesState({
        selectetdImageIndex: initialIndex ?? 0,
        allImages: allImages ?? [url],
      });
    },
    []
  );

  const closeZoom = useCallback(() => setZoomedImagesState(null), []);

  const openGalleryMode = useCallback(
    (trades: Trade[], initialTradeId?: string, title?: string) => {
      setGalleryMode({ open: true, trades, initialTradeId, title, aiOnlyMode: false });
    },
    []
  );

  const closeGalleryMode = useCallback(() => {
    setGalleryMode((prev) => ({ ...prev, open: false }));
  }, []);

  return {
    tradeOps: {
      onUpdateTradeProperty,
      onZoomImage: setZoomedImage,
      onOpenGalleryMode: openGalleryMode,
    },
    isTradeUpdating,
    zoomedImages,
    setZoomedImage,
    closeZoom,
    galleryMode,
    openGalleryMode,
    closeGalleryMode,
  };
}
