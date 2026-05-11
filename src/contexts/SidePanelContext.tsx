// src/contexts/SidePanelContext.tsx
import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { Trade } from '../types/dualWrite';
import { EconomicEvent } from '../types/economicCalendar';

// -- Types --

export interface EconomicCalendarView {
  id: 'economic-calendar';
  initialDate?: Date;
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

export interface AIAnalysisView {
  id: 'ai-analysis';
  tradeId: string;
  trades: Trade[];
  title?: string;
}

export interface AIChatView {
  id: 'ai-chat';
}

export interface CalendarsListView {
  id: 'calendars-list';
  isTrash?: boolean;
}

export interface FAQView {
  id: 'faq';
}

export interface StatsView {
  id: 'stats';
}

/**
 * Cross-calendar event detail panel — used by the user-level Events page
 * (`/events`). Holds the EconomicEvent so the panel re-renders with the
 * correct context when the user clicks a different row.
 */
export interface EventDetailView {
  id: 'event-detail';
  event: EconomicEvent;
}

/**
 * Cross-calendar all-pinned-events list — used by the user-level Events
 * page when the user clicks "View all" on the pinned events card.
 */
export interface AllPinnedEventsView {
  id: 'all-pinned-events';
}

/**
 * Default empty view for the Events page when nothing is selected. Renders
 * an empty placeholder so the panel slot still exists in the layout but no
 * panel content is shown.
 */
export interface EventsHomeView {
  id: 'events-home';
}

export type SidePanelView =
  | EconomicCalendarView
  | NotesView
  | SearchView
  | PinnedView
  | TagsView
  | DayTradesView
  | AIAnalysisView
  | AIChatView
  | CalendarsListView
  | FAQView
  | StatsView
  | EventDetailView
  | AllPinnedEventsView
  | EventsHomeView;

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
  defaultOpen?: boolean;
  children: ReactNode;
}

export const SidePanelProvider: React.FC<SidePanelProviderProps> = ({
  defaultView,
  defaultOpen = true,
  children,
}) => {
  const [stack, setStack] = useState<SidePanelView[]>([defaultView]);
  const [isOpen, setIsOpen] = useState(defaultOpen);

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
