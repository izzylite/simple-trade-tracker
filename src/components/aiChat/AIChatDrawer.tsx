/**
 * AI Chat Bottom Sheet Component
 * Modern bottom sheet interface for AI trading analysis.
 * Manages backdrop, positioning, animation, and close button.
 * Delegates all chat content to AIChatContent.
 */

import React, { useState, useEffect } from 'react';
import OrionIcon from './OrionIcon';
import {
  Box,
  IconButton,
  Typography,
  Tooltip,
  useTheme,
  alpha
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { format } from 'date-fns';
import { v5 as uuidv5 } from 'uuid';
import { Trade } from '../../types/trade';
import { Calendar } from '../../types/calendar';
import { TradeOperationsProps } from '../../types/tradeOperations';
import { Z_INDEX } from '../../styles/zIndex';
import AIChatContent from '../sidePanel/content/AIChatContent';
import { UseAIChatReturn, useAIChat } from '../../hooks/useAIChat';
import { ConversationRepository } from '../../services/repository/repositories/ConversationRepository';
import { logger } from '../../utils/logger';
import RoundedTabs, { TabPanel } from '../common/RoundedTabs';
import OrionTasksContent from '../orionTasks/OrionTasksContent';
import type { AITasksBundle, OrionTaskResult } from '../../types/orionTask';
import { TASK_TYPE_LABELS } from '../../types/orionTask';
import { useAuth } from '../../contexts/SupabaseAuthContext';
import { createNote } from '../../services/notesService';

const ORION_NOTE_NS = 'a7f3d5e2-1b4c-5890-9e12-f3c4d5b6a7e8';

interface AIChatDrawerProps {
  open: boolean;
  onClose: () => void;
  trades?: Trade[];
  calendar?: Calendar;
  isReadOnly?: boolean;
  tradeOperations: TradeOperationsProps;
  /** When provided, shares chat state with the panel version */
  sharedChatState?: UseAIChatReturn;
  /** Calendar picker props (Home page) */
  availableCalendars?: Calendar[];
  selectedCalendarId?: string;
  onCalendarChange?: (calendarId: string) => void;
  /** Orion Tasks state + actions, typically from `useOrionTasks`. When omitted
   *  the Tasks tab renders in empty/disabled form. */
  aiTasks?: AITasksBundle;
  /**
   * One-shot deep-link target. When set, the drawer fetches the conversation,
   * loads it into the chat surface, and queues a scroll-to-message highlight.
   * Caller must clear via `onDeepLinkConsumed` after the effect runs.
   */
  pendingDeepLink?: { conversationId: string; messageId?: string } | null;
  onDeepLinkConsumed?: () => void;
  /**
   * One-shot tab switch request (0 = Chat, 1 = Tasks). Used by callers that
   * need the drawer to land on a specific tab — e.g. a task notification
   * click should drop the user on the Tasks tab regardless of which tab was
   * last active. Caller clears via `onTabRequestConsumed`.
   */
  requestActiveTab?: number | null;
  onTabRequestConsumed?: () => void;
}

// Bottom sheet heights
const BOTTOM_SHEET_HEIGHTS = {
  default: 880
} as const;

const AIChatDrawer: React.FC<AIChatDrawerProps> = ({
  open,
  onClose,
  trades,
  calendar,
  isReadOnly = false,
  tradeOperations,
  sharedChatState,
  availableCalendars,
  selectedCalendarId,
  onCalendarChange,
  aiTasks,
  pendingDeepLink,
  onDeepLinkConsumed,
  requestActiveTab,
  onTabRequestConsumed,
}) => {
  const theme = useTheme();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [chatSeedMessage, setChatSeedMessage] = useState<string>('');

  // Fallback chat state lives at the drawer level so it survives tab switches
  // (AIChatContent unmounts when activeTab changes). Callers that already manage
  // their own shared state (e.g. HomePage) pass it via the prop and this hook's
  // return is unused — the hook itself still runs to satisfy React's rules.
  const internalChatState = useAIChat({
    userId: user?.uid,
    calendar,
    messageLimit: 100,
    autoSaveConversation: true,
  });
  const effectiveChatState = sharedChatState ?? internalChatState;
  const conversationRepoRef = React.useRef(new ConversationRepository());
  const [scrollToMessageId, setScrollToMessageId] = useState<string | null>(null);
  // When a notification deep-link lands, capture where the user was before
  // the swap so the chat header can swap "+" for a back-arrow that restores
  // exactly that state. The capture is a wrapper object (not just a string)
  // so we can distinguish three states:
  //   - undefined  : no deep-link active → render "+"
  //   - { id: X }  : came from conversation X → back swaps to X
  //   - { id: null}: came from a new/empty chat → back returns to new chat
  const [deepLinkOrigin, setDeepLinkOrigin] = useState<
    { conversationId: string | null } | null
  >(null);

  // Deep-link consumption: when the parent passes a pending target (typically
  // from a notification click), load the conversation into the chat surface
  // and queue the scroll. Switch to the Chat tab so the user lands on the
  // message rather than the Tasks tab.
  useEffect(() => {
    if (!open || !pendingDeepLink) return;
    let cancelled = false;
    setActiveTab(0);
    // Capture the active id BEFORE swapping so the back-arrow can restore it.
    // Skip if it's the same conversation (no-op deep-link) or already null
    // (fresh chat — nothing meaningful to return to).
    const priorId = effectiveChatState.currentConversationId;
    conversationRepoRef.current
      .findById(pendingDeepLink.conversationId)
      .then((convo) => {
        if (cancelled) return;
        if (!convo) {
          logger.warn(
            'AIChatDrawer deep-link: conversation not found',
            pendingDeepLink.conversationId
          );
          onDeepLinkConsumed?.();
          return;
        }
        // Capture origin unconditionally — including the empty-chat case
        // (priorId === null). The back-arrow appears in both cases; the
        // handler picks the right restore action based on the captured id.
        setDeepLinkOrigin({ conversationId: priorId ?? null });
        effectiveChatState.selectConversation(convo);
        setScrollToMessageId(pendingDeepLink.messageId ?? null);
        onDeepLinkConsumed?.();
      })
      .catch((err) => {
        logger.error('AIChatDrawer deep-link load failed', err);
        onDeepLinkConsumed?.();
      });
    return () => {
      cancelled = true;
    };
    // selectConversation is stable across messageLimit changes; intentionally
    // listing the primitive identity-driving fields only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pendingDeepLink?.conversationId, pendingDeepLink?.messageId]);

  // Closing the drawer abandons the deep-link trail. Without this, reopening
  // later would still show a back-arrow pointing at a long-stale state.
  useEffect(() => {
    if (!open) setDeepLinkOrigin(null);
  }, [open]);

  // One-shot tab switch consumer. Triggered by external callers that want
  // the drawer to land on a specific tab on open (task notifications → Tasks).
  useEffect(() => {
    if (!open || requestActiveTab == null) return;
    setActiveTab(requestActiveTab);
    onTabRequestConsumed?.();
  }, [open, requestActiveTab, onTabRequestConsumed]);

  const handleReturnToPrevious = React.useCallback(() => {
    const origin = deepLinkOrigin;
    if (!origin) return;
    // Clear state up front — one-way return. If the refetch fails, the user
    // stays on the deep-linked convo (nothing destroyed; History remains).
    setDeepLinkOrigin(null);
    setScrollToMessageId(null);

    // Empty-chat origin: back means "drop me into a new chat".
    if (origin.conversationId === null) {
      void effectiveChatState.startNewChat();
      return;
    }

    conversationRepoRef.current
      .findById(origin.conversationId)
      .then((convo) => {
        if (convo) {
          effectiveChatState.selectConversation(convo);
        } else {
          logger.warn(
            'AIChatDrawer return-to-previous: conversation not found',
            origin.conversationId
          );
        }
      })
      .catch((err) => {
        logger.error('AIChatDrawer return-to-previous failed', err);
      });
    // selectConversation / startNewChat identities are stable per useAIChat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkOrigin]);

  const handleSaveNote = async (result: OrionTaskResult) => {
    if (!user?.uid) return;
    const taskLabel = TASK_TYPE_LABELS[result.task_type];
    const formattedDate = format(new Date(result.created_at), 'MMM d, yyyy');
    await createNote({
      id: uuidv5(result.id, ORION_NOTE_NS),
      user_id: user.uid,
      calendar_id: calendar?.id ?? null,
      title: `Orion Briefing: ${taskLabel} — ${formattedDate}`,
      content: result.content_plain,
      by_assistant: true,
      tags: ['orion', 'briefing'],
    });
  };

  const handleFollowupAboutResult = (result: OrionTaskResult) => {
    const title = (result.metadata as { title?: string } | null)?.title ?? 'this briefing';
    const seed = `I'd like to follow up on "${title}":\n\n${result.content_plain}\n\nMy question: `;
    setChatSeedMessage(seed);
    setActiveTab(0);
  };

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (open) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [open]);

  return (
    <>
      {/* Backdrop - Click to close */}
      <Box
        onClick={onClose}
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: theme.palette.mode === 'dark'
            ? 'rgba(0,0,0,0.6)'
            : 'rgba(0,0,0,0.3)',
          zIndex: Z_INDEX.AI_DRAWER_BACKDROP,
          opacity: open ? 1 : 0,
          visibility: open ? 'visible' : 'hidden',
          transition:
            'opacity 0.3s ease-in-out, visibility 0.3s ease-in-out',
          cursor: 'pointer'
        }}
      />

      {/* Bottom Sheet Drawer */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          right: { xs: 0, sm: 20 },
          left: { xs: 0, sm: 'auto' },
          zIndex: Z_INDEX.AI_DRAWER,
          height: open ? BOTTOM_SHEET_HEIGHTS.default : 0,
          maxHeight: '92vh',
          width: '100%',
          maxWidth: {
            xs: '100%', sm: '480px', md: '540px', lg: '600px'
          },
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          backgroundColor: 'background.paper',
          boxShadow: theme.palette.mode === 'dark'
            ? '0 -8px 24px rgba(0,0,0,0.5)'
            : '0 -8px 24px rgba(0,0,0,0.1)',
          border: `1px solid ${theme.palette.divider}`,
          borderBottom: 'none',
          transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1), '
            + 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          overflow: 'hidden',
          pointerEvents: open ? 'auto' : 'none'
        }}
      >
        <Box sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Header — logo, title, close button */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: `1px solid ${theme.palette.divider}`,
            flexShrink: 0,
          }}>
            {/* Left side - Logo and Title */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <OrionIcon size={36} />
              <Box>
                <Typography variant="h6" sx={{
                  fontWeight: 700,
                  fontSize: '1.1rem',
                  lineHeight: 1.2
                }}>
                  Orion
                </Typography>
                <Typography variant="caption" sx={{
                  color: 'text.secondary',
                  fontSize: '0.75rem'
                }}>
                  {calendar
                    ? (() => {
                        const totalTrades = calendar.year_stats
                          ? Object.values(calendar.year_stats).reduce(
                              (sum, ys) =>
                                sum + (ys.total_trades || 0),
                              0
                            )
                          : 0;
                        return totalTrades > 0
                          ? `${totalTrades} trade${totalTrades !== 1 ? 's' : ''} in ${calendar.name}`
                          : `${calendar.name} - Ready for analysis`;
                      })()
                    : 'Ready for trading analysis across all calendars'
                  }
                </Typography>
              </Box>
            </Box>

            {/* Right side - Close button */}
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Tooltip title="Close">
                <IconButton
                  size="small"
                  onClick={onClose}
                  sx={{
                    color: 'text.secondary',
                    '&:hover': {
                      backgroundColor: alpha(
                        theme.palette.action.hover, 0.5
                      )
                    }
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Tabs */}
          <Box sx={{ px: 2, pt: 1, flexShrink: 0 }}>
            <RoundedTabs
              tabs={[
                { label: 'Chat' },
                { label: 'Tasks', badgeCount: aiTasks?.unreadCount ?? 0 },
              ]}
              activeTab={activeTab}
              onTabChange={(_e, v) => setActiveTab(v)}
              size="small"
              fullWidth
            />
          </Box>

          {/* Tab content */}
          <Box sx={{
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            '& [role="tabpanel"]:not([hidden])': {
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            },
            '& [role="tabpanel"]:not([hidden]) > .MuiBox-root': {
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            },
          }}>
            <TabPanel value={activeTab} index={0}>
              <AIChatContent
                trades={trades}
                calendar={calendar}
                isReadOnly={isReadOnly}
                tradeOperations={tradeOperations}
                isActive={open && activeTab === 0}
                sharedChatState={effectiveChatState}
                availableCalendars={availableCalendars}
                selectedCalendarId={selectedCalendarId}
                onCalendarChange={onCalendarChange}
                seedMessage={chatSeedMessage}
                onSeedMessageConsumed={() => setChatSeedMessage('')}
                scrollToMessageId={scrollToMessageId}
                onScrolledToMessage={() => setScrollToMessageId(null)}
                canReturnToPrevious={!!deepLinkOrigin}
                onReturnToPrevious={handleReturnToPrevious}
              />
            </TabPanel>

            <TabPanel value={activeTab} index={1}>
              <OrionTasksContent
                tasks={aiTasks?.tasks ?? []}
                results={aiTasks?.results ?? []}
                unreadCount={aiTasks?.unreadCount ?? 0}
                loading={aiTasks?.loading ?? false}
                hasMore={aiTasks?.hasMore}
                loadingMore={aiTasks?.loadingMore}
                onLoadMore={aiTasks?.loadMore}
                onCreateTask={aiTasks?.createTask ?? (async () => undefined)}
                onUpdateTask={aiTasks?.updateTask}
                onDeleteTask={aiTasks?.deleteTask ?? (async () => {})}
                onMarkRead={aiTasks?.markRead ?? (async () => {})}
                onMarkAllRead={aiTasks?.markAllRead}
                onHideResult={aiTasks?.hideResult}
                onFollowup={handleFollowupAboutResult}
                onSaveNote={handleSaveNote}
                calendar={calendar}
                trades={trades}
                tradeOperations={tradeOperations}
                isReadOnly={isReadOnly}
              />
            </TabPanel>
          </Box>
        </Box>
      </Box>
    </>
  );
};

export default AIChatDrawer;
