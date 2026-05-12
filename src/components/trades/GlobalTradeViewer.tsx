import React, { useMemo } from 'react';
import TradeGalleryDialog from '../TradeGalleryDialog';
import ImageZoomDialog from '../ImageZoomDialog';
import { useTradeViewer } from '../../contexts/TradeViewerContext';
import { useTradesContext } from '../../contexts/TradesContext';
import { useAuthState } from '../../contexts/AuthStateContext';
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
  const { calendar } = useTradesContext();
  const { user } = useAuthState();

  // Read-only when the active calendar isn't owned by the current user
  // (e.g. shared calendar) — also when there's no calendar at all.
  const isReadOnly = !calendar || (user?.uid && calendar.user_id !== user.uid)
    ? true
    : false;

  const tradeOperations = useMemo<TradeOperationsProps>(
    () => ({
      onUpdateTradeProperty: undefined,
      onEditTrade: undefined,
      onDeleteTrade: undefined,
      onDeleteMultipleTrades: undefined,
      onZoomImage: openImageZoom,
      onOpenGalleryMode: undefined,
      onOpenAIChat: undefined,
      onUpdateCalendarProperty: undefined,
      isTradeUpdating: () => false,
      deletingTradeIds: [] as string[],
      calendarId: calendar?.id,
      calendar: calendar || undefined,
      isReadOnly,
    }),
    [calendar, isReadOnly, openImageZoom]
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
