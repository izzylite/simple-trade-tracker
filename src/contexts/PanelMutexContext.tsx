import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSidePanel } from './SidePanelContext';

/**
 * Coordinates mutual exclusion between the App-level SidePanel (FAQ, etc.)
 * and any page-level SidePanelProvider (TradeCalendarPage, EconomicEventsPage).
 *
 * Pattern:
 *  - Pages publish a "close my local panel" callback via usePublishPageSidePanelCloser.
 *  - When the global side panel transitions to open, the mutex fires the
 *    published closer so the page-local panel collapses.
 *  - The reverse direction (close global when local opens) is handled inside
 *    the page itself, which receives a `closeGlobalPanel` callback as a prop
 *    from CalendarRoute (outside the local SidePanelProvider, so it can read
 *    the global one).
 *
 * The mutex provider must live INSIDE the global SidePanelProvider so it can
 * subscribe to its isOpen, and OUTSIDE any page-level SidePanelProvider so it
 * doesn't accidentally read the local one.
 */
interface PanelMutexContextValue {
  setPageCloser: (close: (() => void) | null) => void;
}

const PanelMutexContext = createContext<PanelMutexContextValue>({
  setPageCloser: () => {
    // No-op fallback. Components outside the provider can call the publish
    // hook without throwing; the published callback just never fires.
  },
});

export const PanelMutexProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [pageCloser, setPageCloserState] = useState<(() => void) | null>(null);
  const { isOpen: globalIsOpen, currentView } = useSidePanel();

  const setPageCloser = useCallback((close: (() => void) | null) => {
    setPageCloserState(() => close);
  }, []);

  // Fire the published closer when the global panel transitions from closed
  // to open. We also re-fire when currentView changes while the panel is
  // open, so navigating between global views (e.g. FAQ → some other future
  // global view) still kicks the local panel.
  const prevGlobalOpenRef = useRef(globalIsOpen);
  const prevViewIdRef = useRef(currentView.id);
  useEffect(() => {
    const justOpened = globalIsOpen && !prevGlobalOpenRef.current;
    const viewChangedWhileOpen =
      globalIsOpen && currentView.id !== prevViewIdRef.current;
    if (justOpened || viewChangedWhileOpen) {
      pageCloser?.();
    }
    prevGlobalOpenRef.current = globalIsOpen;
    prevViewIdRef.current = currentView.id;
  }, [globalIsOpen, currentView.id, pageCloser]);

  const value = useMemo<PanelMutexContextValue>(
    () => ({ setPageCloser }),
    [setPageCloser]
  );

  return (
    <PanelMutexContext.Provider value={value}>
      {children}
    </PanelMutexContext.Provider>
  );
};

/**
 * Publish the calling page's local-panel close callback. Re-runs whenever
 * `close` identity changes; the publisher should wrap it in useCallback so
 * registrations don't churn on every render.
 */
export const usePublishPageSidePanelCloser = (
  close: (() => void) | null
): void => {
  const { setPageCloser } = useContext(PanelMutexContext);
  useEffect(() => {
    setPageCloser(close);
    return () => setPageCloser(null);
  }, [setPageCloser, close]);
};
