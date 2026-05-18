import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { Trade } from '../types/dualWrite';
import { ImageZoomProp } from '../components/ImageZoomDialog';

/**
 * App-level controller for the read-only trade viewer surfaces:
 *   - TradeGalleryDialog (paged trade detail with images, AI assist, etc.)
 *   - ImageZoomDialog (full-screen image viewer)
 *
 * Lifted out of TradeCalendarPage so the global AI chat (and any future
 * cross-route surface) can open the gallery / zoom an image without
 * navigating away from the user's current page.
 *
 * Edit-trade and similar mutating actions stay page-coupled — buttons
 * inside the gallery that wire to those gracefully degrade when launched
 * from the global surface (read-only path).
 */
export interface OpenGalleryArgs {
  trades: Trade[];
  initialTradeId?: string;
  title?: string;
  /** Hide the Trade tab inside the gallery, showing only the Assistant tab. */
  aiOnlyMode?: boolean;
  /** When trades is empty, lazy-fetch the entire year on open. */
  fetchYear?: number;
}

interface GalleryState extends OpenGalleryArgs {
  open: boolean;
}

const EMPTY_GALLERY: GalleryState = {
  open: false,
  trades: [],
  initialTradeId: undefined,
  title: undefined,
  aiOnlyMode: false,
  fetchYear: undefined,
};

interface TradeViewerContextValue {
  gallery: GalleryState;
  openGallery: (args: OpenGalleryArgs) => void;
  closeGallery: () => void;
  zoomedImages: ImageZoomProp | null;
  openImageZoom: (url: string, allImages?: string[], initialIndex?: number) => void;
  closeImageZoom: () => void;
}

const TradeViewerContext = createContext<TradeViewerContextValue | null>(null);

export const TradeViewerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [gallery, setGallery] = useState<GalleryState>(EMPTY_GALLERY);
  const [zoomedImages, setZoomedImages] = useState<ImageZoomProp | null>(null);

  const openGallery = useCallback((args: OpenGalleryArgs) => {
    setGallery({
      open: true,
      trades: args.trades,
      initialTradeId: args.initialTradeId,
      title: args.title,
      aiOnlyMode: args.aiOnlyMode ?? false,
      fetchYear: args.fetchYear,
    });
  }, []);

  const closeGallery = useCallback(() => {
    setGallery((prev) => ({ ...prev, open: false }));
  }, []);

  const openImageZoom = useCallback(
    (url: string, allImages?: string[], initialIndex?: number) => {
      setZoomedImages({
        selectetdImageIndex: initialIndex || 0,
        allImages: allImages || [url],
      });
    },
    []
  );

  const closeImageZoom = useCallback(() => setZoomedImages(null), []);

  const value = useMemo<TradeViewerContextValue>(
    () => ({
      gallery,
      openGallery,
      closeGallery,
      zoomedImages,
      openImageZoom,
      closeImageZoom,
    }),
    [gallery, openGallery, closeGallery, zoomedImages, openImageZoom, closeImageZoom]
  );

  return (
    <TradeViewerContext.Provider value={value}>
      {children}
    </TradeViewerContext.Provider>
  );
};

export const useTradeViewer = (): TradeViewerContextValue => {
  const ctx = useContext(TradeViewerContext);
  if (!ctx) throw new Error('useTradeViewer must be used within TradeViewerProvider');
  return ctx;
};

export const useTradeViewerOptional = (): TradeViewerContextValue | null =>
  useContext(TradeViewerContext);
