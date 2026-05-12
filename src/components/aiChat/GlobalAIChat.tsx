import React, { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import AIChatDrawer from './AIChatDrawer';
import { useAIChat } from '../../contexts/AIChatContext';
import { useTradesContext } from '../../contexts/TradesContext';
import { useNotifications } from '../../contexts/NotificationsContext';
import { usePanelMutexSlot } from '../../contexts/PanelMutexContext';
import {
  isOrionTaskResultPayload,
  isReminderFiredPayload,
} from '../../types/notification';
import { TradeOperationsProps } from '../../types/tradeOperations';

/**
 * App-level renderer for the AI chat drawer. Mounted once inside the global
 * provider stack so every route (calendar, performance, notes, events, …)
 * shares a single chat session.
 *
 * Lifts the per-page state that previously lived in TradeCalendarPage and
 * EconomicEventsPage:
 *   - open/close + deep-link + requested-tab state (via AIChatContext)
 *   - notification route handler (reminder_fired → Chat tab; orion_task_result
 *     → Tasks tab)
 *   - `?openTasks=1` URL fallback used by notifications fired from non-
 *     calendar routes
 *   - useOrionTasks subscription (single instance, user+calendar scoped)
 *
 * The drawer's "edit / zoom / gallery" buttons inside trade detail bubbles
 * degrade to inert when reached from this global surface — callers that
 * need those (the calendar page) wire their own page-side dialogs. Lifting
 * the full TradeUI dialog stack to App level is a separate refactor.
 */
const GlobalAIChat: React.FC = () => {
  const { calendar, trades } = useTradesContext();
  const aiChat = useAIChat();
  const { registerRouteHandler } = useNotifications();
  const aiTasks = aiChat.aiTasks;

  // Mutex slot — opening the chat closes other panels, and vice versa.
  usePanelMutexSlot('ai-chat', aiChat.isOpen, aiChat.close);

  // Notification route handler — used to live on TradeCalendarPage. Now
  // mounted once globally so notifications work from any route.
  //
  // Deps are the stable open-callbacks (not the whole aiChat object) so
  // this effect only re-runs when calendar identity or the notifications
  // hook changes. Re-registering on every state transition would create a
  // brief unregister/register gap where notifications could be missed.
  const { openWithDeepLink, openOnTab } = aiChat;
  useEffect(() => {
    return registerRouteHandler((n) => {
      if (isReminderFiredPayload(n)) {
        // Only the calendar this reminder belongs to should host the deep
        // link. If the user is on a different calendar (or none at all),
        // fall through to the URL navigation fallback.
        if (!calendar?.id || n.payload.calendarId !== calendar.id) return false;
        openWithDeepLink(
          {
            conversationId: n.payload.conversationId,
            messageId: n.payload.messageId,
          },
          0
        );
        return true;
      }
      if (isOrionTaskResultPayload(n)) {
        openOnTab(1);
        return true;
      }
      return false;
    });
  }, [calendar?.id, registerRouteHandler, openWithDeepLink, openOnTab]);

  // ?openTasks=1 fallback — bell notifications fired on a non-calendar
  // route navigate here. Open Tasks tab then strip the param so refresh
  // doesn't re-trigger.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('openTasks') !== '1') return;
    openOnTab(1);
    const next = new URLSearchParams(searchParams);
    next.delete('openTasks');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, openOnTab]);

  // Minimal tradeOperations stub — pages with their own dialog stack
  // (TradeCalendarPage) pass through richer ops. The global mount has no
  // access to page-side dialogs, so edit/zoom/gallery handlers stay
  // undefined and the corresponding bubble buttons render disabled.
  const tradeOperations = useMemo<TradeOperationsProps>(
    () => ({
      onUpdateTradeProperty: undefined,
      onEditTrade: undefined,
      onDeleteTrade: undefined,
      onDeleteMultipleTrades: undefined,
      onZoomImage: undefined,
      onOpenGalleryMode: undefined,
      onOpenAIChat: undefined,
      onUpdateCalendarProperty: undefined,
      isTradeUpdating: () => false,
      deletingTradeIds: [] as string[],
      calendarId: calendar?.id,
      calendar: calendar || undefined,
      isReadOnly: !calendar,
    }),
    [calendar]
  );

  // Consume initialTrade once the drawer mounts the prop — AIChatContent
  // reads `initialTradeId` on its own mount and resolves the trade from
  // the `trades` array. After one open we clear the context state so the
  // next open without an explicit trade doesn't re-seed.
  useEffect(() => {
    if (!aiChat.isOpen || !aiChat.initialTrade) return;
    // Defer one tick so the drawer's mount effect picks up initialTradeId
    // before we clear it.
    const t = setTimeout(() => aiChat.consumeInitialTrade(), 0);
    return () => clearTimeout(t);
  }, [aiChat.isOpen, aiChat.initialTrade, aiChat.consumeInitialTrade]);

  return (
    <AIChatDrawer
      open={aiChat.isOpen}
      onClose={aiChat.close}
      trades={trades}
      calendar={calendar || undefined}
      isReadOnly={!calendar}
      tradeOperations={tradeOperations}
      aiTasks={aiTasks}
      pendingDeepLink={aiChat.pendingDeepLink}
      onDeepLinkConsumed={aiChat.consumeDeepLink}
      requestActiveTab={aiChat.requestedTab}
      onTabRequestConsumed={aiChat.consumeTabRequest}
      initialTradeId={aiChat.initialTrade?.id}
    />
  );
};

export default GlobalAIChat;
