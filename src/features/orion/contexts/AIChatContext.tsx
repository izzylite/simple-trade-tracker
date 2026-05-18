import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { Trade } from 'types/dualWrite';
import { AITasksBundle } from '../types/orionTask';
import { useOrionTasks } from '../hooks/useOrionTasks';
import { useAuthState } from 'contexts/AuthStateContext';
import { useTradesContextOptional } from 'contexts/TradesContext';

/**
 * App-level controller for the single AI chat drawer instance.
 *
 * Pages dispatch through `useAIChat()`:
 *   - open / close — plain toggle
 *   - openWithTrade(trade) — focus chat on a specific trade
 *   - openOnTab(tab) — land on a specific tab (0 = Chat, 1 = Tasks)
 *   - openWithDeepLink(payload, tab?) — load a conversation from a notification
 *
 * The drawer (`GlobalAIChat`) reads `initialTrade`, `pendingDeepLink`, and
 * `requestedTab` from context and calls the matching `consumeX()` once each
 * one-shot has been honored.
 */
interface DeepLinkPayload {
  conversationId: string;
  messageId?: string;
}

interface AIChatContextValue {
  isOpen: boolean;
  open: () => void;
  /** Open the drawer focused on a specific trade — Orion Chat will read the
   *  initial trade context from caller-side state (see GlobalAIChat). */
  openWithTrade: (trade: Trade) => void;
  openOnTab: (tab: number) => void;
  openWithDeepLink: (payload: DeepLinkPayload, tab?: number) => void;
  close: () => void;

  /** Internal state consumed by GlobalAIChat — exposed so the renderer
   *  can read + clear via the consume callbacks. */
  initialTrade: Trade | null;
  consumeInitialTrade: () => void;
  pendingDeepLink: DeepLinkPayload | null;
  consumeDeepLink: () => void;
  requestedTab: number | null;
  consumeTabRequest: () => void;

  /** Single Orion tasks bundle — shared by the drawer (chat tab + Tasks tab)
   *  and the floating FAB (unread badge). Sourced from useOrionTasks here so
   *  the app keeps exactly one subscription regardless of how many consumers
   *  read unreadCount / tasks / results. */
  aiTasks: AITasksBundle;
}

const AIChatContext = createContext<AIChatContextValue | null>(null);

export const AIChatProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [initialTrade, setInitialTrade] = useState<Trade | null>(null);
  const [pendingDeepLink, setPendingDeepLink] = useState<DeepLinkPayload | null>(
    null
  );
  const [requestedTab, setRequestedTab] = useState<number | null>(null);

  // Single Orion tasks subscription for the entire app. useTradesContext is
  // optional here because AIChatProvider mounts inside TradesProvider in the
  // app stack, but the file structure tolerates being rendered outside (e.g.
  // tests) without throwing.
  const { user } = useAuthState();
  const trades = useTradesContextOptional();
  const aiTasks = useOrionTasks(user?.uid, trades?.calendar?.id);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const openWithTrade = useCallback((trade: Trade) => {
    setInitialTrade(trade);
    setRequestedTab(0);
    setIsOpen(true);
  }, []);
  const openOnTab = useCallback((tab: number) => {
    setRequestedTab(tab);
    setIsOpen(true);
  }, []);
  const openWithDeepLink = useCallback(
    (payload: DeepLinkPayload, tab: number = 0) => {
      setPendingDeepLink(payload);
      setRequestedTab(tab);
      setIsOpen(true);
    },
    []
  );
  const consumeInitialTrade = useCallback(() => setInitialTrade(null), []);
  const consumeDeepLink = useCallback(() => setPendingDeepLink(null), []);
  const consumeTabRequest = useCallback(() => setRequestedTab(null), []);

  const value = useMemo<AIChatContextValue>(
    () => ({
      isOpen,
      open,
      openWithTrade,
      openOnTab,
      openWithDeepLink,
      close,
      initialTrade,
      consumeInitialTrade,
      pendingDeepLink,
      consumeDeepLink,
      requestedTab,
      consumeTabRequest,
      aiTasks,
    }),
    [
      isOpen,
      open,
      openWithTrade,
      openOnTab,
      openWithDeepLink,
      close,
      initialTrade,
      consumeInitialTrade,
      pendingDeepLink,
      consumeDeepLink,
      requestedTab,
      consumeTabRequest,
      aiTasks,
    ]
  );

  return (
    <AIChatContext.Provider value={value}>{children}</AIChatContext.Provider>
  );
};

export const useAIChat = (): AIChatContextValue => {
  const ctx = useContext(AIChatContext);
  if (!ctx) throw new Error('useAIChat must be used within AIChatProvider');
  return ctx;
};

export const useAIChatOptional = (): AIChatContextValue | null =>
  useContext(AIChatContext);
