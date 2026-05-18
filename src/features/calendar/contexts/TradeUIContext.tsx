import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Trade } from '../types/dualWrite';

/**
 * UI-orchestration callbacks for trade-related actions. Triggered from
 * within panel content components but executed by whichever page currently
 * owns the dialog/drawer state (e.g. TradeCalendarPage).
 *
 * All fields optional — if a callback is missing, the panel should hide or
 * disable the button that would trigger it.
 */
export interface TradeUIOps {
  onEditTrade?: (trade: Trade) => void;
  onZoomImage?: (
    imageUrl: string,
    allImages?: string[],
    initialIndex?: number
  ) => void;
  onOpenGalleryMode?: (
    trades: Trade[],
    initialTradeId?: string,
    title?: string,
    fetchYear?: number
  ) => void;
}

interface TradeUIContextValue {
  ops: TradeUIOps;
  /** Page-level helper — registers a set of UI ops while the page is mounted.
   *  Returning a cleanup is the publisher's responsibility (see usePublishTradeUI). */
  setOps: (ops: TradeUIOps) => void;
}

const TradeUIContext = createContext<TradeUIContextValue>({
  ops: {},
  setOps: () => {
    // No-op fallback. Allows panel content to call hooks unconditionally
    // even when rendered outside the provider (e.g. in unit tests).
  },
});

export const TradeUIProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [ops, setOpsState] = useState<TradeUIOps>({});

  const setOps = useCallback((next: TradeUIOps) => {
    setOpsState(next);
  }, []);

  const value = useMemo<TradeUIContextValue>(
    () => ({ ops, setOps }),
    [ops, setOps]
  );

  return <TradeUIContext.Provider value={value}>{children}</TradeUIContext.Provider>;
};

/**
 * Read the currently-published UI ops. Always safe to call — falls back to an
 * empty object outside the provider, so panel content guards each callback
 * with optional-chaining (`ops.onEditTrade?.(...)`).
 */
export const useTradeUI = (): TradeUIOps => {
  return useContext(TradeUIContext).ops;
};

/**
 * Publish UI ops for the lifetime of the calling component. Pages should call
 * this once near the top of their component body with their dialog handlers;
 * the registry is cleared on unmount so panels stop firing actions into a
 * gone-away page.
 */
export const usePublishTradeUI = (ops: TradeUIOps): void => {
  const { setOps } = useContext(TradeUIContext);
  // Memoize the ops object so changes only fire when individual callbacks
  // change identity. Pages should pass stable (useCallback'd) handlers.
  const stableOps = useMemo<TradeUIOps>(
    () => ({
      onEditTrade: ops.onEditTrade,
      onZoomImage: ops.onZoomImage,
      onOpenGalleryMode: ops.onOpenGalleryMode,
    }),
    [
      ops.onEditTrade,
      ops.onZoomImage,
      ops.onOpenGalleryMode,
    ]
  );

  useEffect(() => {
    setOps(stableOps);
    return () => setOps({});
  }, [setOps, stableOps]);
};
