// src/contexts/SidePanelContext.tsx
import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

// -- Types --

export interface EconomicCalendarView {
  id: 'economic-calendar';
}

export interface NotesView {
  id: 'notes';
}

export interface SearchView {
  id: 'search';
}

export interface PinnedView {
  id: 'pinned';
}

export interface TagsView {
  id: 'tags';
}

export interface DayTradesView {
  id: 'day-trades';
  date: Date;
}

/** Deferred — will be wired when trade AI analysis is integrated into the panel */
export interface AIAnalysisView {
  id: 'ai-analysis';
  tradeId: string;
  tradeIds: string[];
}

export interface AIChatView {
  id: 'ai-chat';
}

export type SidePanelView =
  | EconomicCalendarView
  | NotesView
  | SearchView
  | PinnedView
  | TagsView
  | DayTradesView
  | AIAnalysisView
  | AIChatView;

const MAX_STACK_DEPTH = 3;

export interface SidePanelContextValue {
  stack: SidePanelView[];
  currentView: SidePanelView;
  isOpen: boolean;
  canGoBack: boolean;

  pushPanel: (view: SidePanelView) => void;
  popPanel: () => void;
  replacePanel: (view: SidePanelView) => void;
  resetPanel: () => void;
  setOpen: (open: boolean) => void;
}

// -- Context --

const SidePanelContext = createContext<SidePanelContextValue | null>(null);

// -- Provider --

interface SidePanelProviderProps {
  defaultView: SidePanelView;
  children: ReactNode;
}

export const SidePanelProvider: React.FC<SidePanelProviderProps> = ({
  defaultView,
  children,
}) => {
  const [stack, setStack] = useState<SidePanelView[]>([defaultView]);
  const [isOpen, setIsOpen] = useState(true);

  const pushPanel = useCallback((view: SidePanelView) => {
    setStack(prev => {
      // Dedup: if top of stack has same id, update in-place
      const top = prev[prev.length - 1];
      if (top && top.id === view.id) {
        return [...prev.slice(0, -1), view];
      }
      // Cap at max depth
      if (prev.length >= MAX_STACK_DEPTH) return prev;
      return [...prev, view];
    });
  }, []);

  const popPanel = useCallback(() => {
    setStack(prev => {
      if (prev.length <= 1) return [defaultView];
      return prev.slice(0, -1);
    });
  }, [defaultView]);

  const replacePanel = useCallback((view: SidePanelView) => {
    setStack(prev => {
      if (prev.length === 1 && prev[0].id === view.id) return prev;
      return [view];
    });
  }, []);

  const resetPanel = useCallback(() => {
    setStack([defaultView]);
  }, [defaultView]);

  const setOpenHandler = useCallback((open: boolean) => {
    setIsOpen(open);
  }, []);

  const value = useMemo<SidePanelContextValue>(() => ({
    stack,
    currentView: stack[stack.length - 1],
    isOpen,
    canGoBack: stack.length > 1,
    pushPanel,
    popPanel,
    replacePanel,
    resetPanel,
    setOpen: setOpenHandler,
  }), [stack, isOpen, pushPanel, popPanel, replacePanel, resetPanel, setOpenHandler]);

  return (
    <SidePanelContext.Provider value={value}>
      {children}
    </SidePanelContext.Provider>
  );
};

// -- Hook --

export const useSidePanel = (): SidePanelContextValue => {
  const context = useContext(SidePanelContext);
  if (!context) {
    throw new Error('useSidePanel must be used within a SidePanelProvider');
  }
  return context;
};

/**
 * Optional hook that returns null when outside a provider.
 * Useful for components that render in both panel and non-panel contexts.
 */
export const useSidePanelOptional = (): SidePanelContextValue | null => {
  return useContext(SidePanelContext);
};
