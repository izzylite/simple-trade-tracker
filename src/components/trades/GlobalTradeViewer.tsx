import React, { useMemo } from 'react';
import TradeGalleryDialog from '../TradeGalleryDialog';
import ImageZoomDialog from '../ImageZoomDialog';
import { useTradeViewer } from '../../contexts/TradeViewerContext';
import { useTradesContext } from '../../contexts/TradesContext';
import { useTradeOperations } from '../../contexts/TradeOperationsContext';
import { TradeOperationsProps } from '../../types/tradeOperations';

/**
 * App-level mount for the read-only trade viewer dialogs. Reads gallery +
 * image-zoom state from TradeViewerContext and renders the corresponding
 * MUI dialogs.
 *
 * `tradeOperations` here is a minimal stub — edit / delete / open-AI-chat
 * actions wire to undefined so the gallery's mutating buttons render
 * disabled when launched from the global path. Page-local consumers
 * (TradeCalendarPage) continue to render their own gallery/zoom with
 * full ops; the global pair coexists harmlessly.
 */
const GlobalTradeViewer: React.FC = () => {
  const { gallery, closeGallery, zoomedImages, closeImageZoom, openImageZoom } =
    useTradeViewer();
  const { calendar, isReadOnly } = useTradesContext();
  const tradeOps = useTradeOperations();

  const tradeOperations = useMemo<TradeOperationsProps>(
    () => ({
      onUpdateTradeProperty: isReadOnly
        ? undefined
        : tradeOps.onUpdateTradeProperty,
      onEditTrade: isReadOnly ? undefined : tradeOps.onEditTrade,
      onDeleteTrade: isReadOnly ? undefined : tradeOps.onDeleteTrade,
      onDeleteMultipleTrades: isReadOnly
        ? undefined
        : tradeOps.onDeleteMultipleTrades,
      onZoomImage: openImageZoom,
      onOpenGalleryMode: undefined,
      onOpenAIChat: undefined,
      onUpdateCalendarProperty: isReadOnly
        ? undefined
        : tradeOps.onUpdateCalendarProperty,
      isTradeUpdating: tradeOps.isTradeUpdating ?? (() => false),
      deletingTradeIds: tradeOps.deletingTradeIds ?? [],
      economicFilter: tradeOps.economicFilter,
      calendarId: calendar?.id,
      calendar: calendar || undefined,
      isReadOnly,
    }),
    [calendar, isReadOnly, openImageZoom, tradeOps]
  );

  return (
    <>
      <TradeGalleryDialog
        open={gallery.open}
        onClose={closeGallery}
        trades={gallery.trades}
        initialTradeId={gallery.initialTradeId}
        setZoomedImage={openImageZoom}
        title={gallery.title}
        calendarId={calendar?.id}
        calendar={calendar || undefined}
        aiOnlyMode={gallery.aiOnlyMode}
        isReadOnly={isReadOnly}
        fetchYear={gallery.fetchYear}
        tradeOperations={tradeOperations}
      />
      {zoomedImages && (
        <ImageZoomDialog
          open={!!zoomedImages}
          onClose={closeImageZoom}
          imageProp={zoomedImages}
        />
      )}
    </>
  );
};

export default GlobalTradeViewer;
