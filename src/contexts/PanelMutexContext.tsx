import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

/**
 * Cross-panel exclusion. The app has three panel surfaces that can't be open
 * at the same time:
 *  - Global SidePanel (App-level, e.g. FAQ).
 *  - CalendarsList panel (App-level, opened from header dropdown).
 *  - Page-local SidePanel (TradeCalendarPage / EconomicEventsPage).
 *
 * Each surface registers (sourceId, close) with the mutex and signals when it
 * opens. The mutex fires every OTHER registered closer.
 *
 * Pages mount and unmount; their slot id `'page-side-panel'` is reused — only
 * one page is mounted at a time, so collisions don't happen.
 */
export type PanelSourceId =
  | 'global-side-panel'
  | 'calendars-list'
  | 'page-side-panel'
  | 'ai-chat';

interface PanelMutexContextValue {
  registerCloser: (id: PanelSourceId, close: () => void) => () => void;
  signalOpened: (id: PanelSourceId) => void;
  setPanelOpen: (id: PanelSourceId, isOpen: boolean) => void;
  openPanels: ReadonlySet<PanelSourceId>;
}

const PanelMutexContext = createContext<PanelMutexContextValue>({
  registerCloser: () => () => {},
  signalOpened: () => {},
  setPanelOpen: () => {},
  openPanels: new Set(),
});

export const PanelMutexProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Use a ref + version counter so registerCloser is stable across renders.
  // Consumers call it inside effects; a churning identity would re-register
  // every render and break the slot lifecycle.
  const closersRef = useRef(new Map<PanelSourceId, () => void>());

  const registerCloser = useCallback(
    (id: PanelSourceId, close: () => void) => {
      closersRef.current.set(id, close);
      return () => {
        // Only unset if the entry is still the one we set — guards against
        // late-unmount cleanups clobbering a fresh registration with the
        // same id (e.g. page navigation re-uses 'page-side-panel').
        if (closersRef.current.get(id) === close) {
          closersRef.current.delete(id);
        }
      };
    },
    []
  );

  const signalOpened = useCallback((id: PanelSourceId) => {
    closersRef.current.forEach((close, otherId) => {
      if (otherId !== id) close();
    });
  }, []);

  const [openPanels, setOpenPanels] = useState<ReadonlySet<PanelSourceId>>(
    () => new Set()
  );

  const setPanelOpen = useCallback((id: PanelSourceId, isOpen: boolean) => {
    setOpenPanels((prev) => {
      const has = prev.has(id);
      if (isOpen === has) return prev;
      const next = new Set(prev);
      if (isOpen) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const value = useMemo<PanelMutexContextValue>(
    () => ({ registerCloser, signalOpened, setPanelOpen, openPanels }),
    [registerCloser, signalOpened, setPanelOpen, openPanels]
  );

  return (
    <PanelMutexContext.Provider value={value}>
      {children}
    </PanelMutexContext.Provider>
  );
};

/**
 * Single-call hook each panel surface uses to participate in the mutex.
 *
 * - Registers `close` while mounted.
 * - Watches `isOpen` and signals on each closed→open transition.
 *
 * `close` must be stable (useCallback'd) so the registration doesn't churn.
 */
export const usePanelMutexSlot = (
  sourceId: PanelSourceId,
  isOpen: boolean,
  close: () => void
): void => {
  const { registerCloser, signalOpened, setPanelOpen } =
    useContext(PanelMutexContext);

  useEffect(() => {
    const unregister = registerCloser(sourceId, close);
    return unregister;
  }, [registerCloser, sourceId, close]);

  const prevOpenRef = useRef(isOpen);
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      signalOpened(sourceId);
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, sourceId, signalOpened]);

  useEffect(() => {
    setPanelOpen(sourceId, isOpen);
  }, [setPanelOpen, sourceId, isOpen]);

  useEffect(() => {
    return () => {
      setPanelOpen(sourceId, false);
    };
  }, [setPanelOpen, sourceId]);
};

/**
 * Subscribe to whether any panel surface is currently open. Pass `exclude`
 * to ignore specific sources (e.g. the ai-chat slot when used from the FAB).
 */
export const useAnyPanelOpen = (
  exclude: ReadonlyArray<PanelSourceId> = []
): boolean => {
  const { openPanels } = useContext(PanelMutexContext);
  const excludeSet = useMemo(() => new Set(exclude), [exclude]);
  let anyOpen = false;
  openPanels.forEach((id) => {
    if (!excludeSet.has(id)) anyOpen = true;
  });
  return anyOpen;
};
