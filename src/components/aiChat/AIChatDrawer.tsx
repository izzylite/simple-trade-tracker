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
  alpha,
  Badge,
} from '@mui/material';
import {
  Close as CloseIcon,
  ChatBubbleOutline as ChatIcon,
  AssignmentOutlined as TasksIcon,
  AddComment as NewChatIcon,
  History as HistoryIcon,
  Alarm as AlarmIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import { format } from 'date-fns';
import { v5 as uuidv5 } from 'uuid';
import { Trade } from '../../types/trade';
import { Calendar } from '../../types/calendar';
import { TradeOperationsProps } from '../../types/tradeOperations';
import { Z_INDEX } from '../../styles/zIndex';
import { useDialogTokens } from '../../styles/dialogTokens';
import AIChatContent from '../sidePanel/content/AIChatContent';
import { UseAIChatReturn, useAIChat } from '../../hooks/useAIChat';
import { ConversationRepository } from '../../services/repository/repositories/ConversationRepository';
import { logger } from '../../utils/logger';
import { TabPanel } from '../common/RoundedTabs';
import OrionTasksContent from '../orionTasks/OrionTasksContent';
import type { AITasksBundle, OrionTaskResult } from '../../types/orionTask';
import { TASK_TYPE_LABELS } from '../../types/orionTask';
import { useAuth } from '../../contexts/SupabaseAuthContext';
import { createNote } from 'features/notes/services/notesService';

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
  /** Pre-select a specific trade in the chat surface — used by "AI chat
   *  from this trade" entry points. Forwarded to AIChatContent. */
  initialTradeId?: string;
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
  aiTasks,
  pendingDeepLink,
  onDeepLinkConsumed,
  requestActiveTab,
  onTabRequestConsumed,
  initialTradeId,
}) => {
  const theme = useTheme();
  const { user } = useAuth();
  const {
    isDark,
    violet, violetSoft, violetBorder,
    surfaceInset, hairline,
  } = useDialogTokens();
  const [activeTab, setActiveTab] = useState(0);
  const [chatSeedMessage, setChatSeedMessage] = useState<string>('');
  // Chat-surface view toggles lifted up so the action buttons can live inline
  // with the tab row at the drawer level instead of inside AIChatContent.
  const [showHistoryView, setShowHistoryView] = useState(false);
  const [showRemindersView, setShowRemindersView] = useState(false);
  const [showMemoryLogsView, setShowMemoryLogsView] = useState(false);

  // Fallback chat state lives at the drawer level so it survives tab switches
  // (AIChatContent unmounts when activeTab changes). Callers that already manage
  // their own shared state (e.g. HomePage) pass it via the prop and this hook's
  // return is unused — the hook itself still runs to satisfy React's rules.
  const internalChatState = useAIChat({
    userId: user?.uid,
    calendar,
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
    // selectConversation is stable; intentionally listing the primitive
    // identity-driving fields only.
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
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          backgroundColor: 'background.paper',
          boxShadow: isDark
            ? '0 -12px 32px rgba(0,0,0,0.55)'
            : '0 -12px 32px rgba(0,0,0,0.12)',
          border: `1px solid ${hairline}`,
          borderBottom: 'none',
          backgroundImage: 'none',
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
          {/* Header — Orion avatar, title + subtitle, close icon */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: 2.5,
              py: 1.75,
              borderBottom: `1px solid ${hairline}`,
              flexShrink: 0,
            }}
          >
            {/* Violet icon avatar wrapping OrionIcon */}
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 1.25,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: violetSoft,
                color: violet,
                border: `1px solid ${violetBorder}`,
                flexShrink: 0,
                overflow: 'hidden',
              }}
            >
              <OrionIcon size={26} />
            </Box>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}
              >
                Orion
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.78rem',
                  color: theme.palette.text.secondary,
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {calendar
                  ? (() => {
                      const totalTrades = calendar.year_stats
                        ? Object.values(calendar.year_stats).reduce(
                            (sum, ys) => sum + (ys.total_trades || 0),
                            0,
                          )
                        : 0;
                      return totalTrades > 0
                        ? `${totalTrades} trade${totalTrades !== 1 ? 's' : ''} in ${calendar.name}`
                        : `${calendar.name} · Ready for analysis`;
                    })()
                  : 'Ready for trading analysis across all calendars'}
              </Typography>
            </Box>

            <Tooltip title="Close">
              <IconButton
                size="small"
                onClick={onClose}
                sx={{ color: theme.palette.text.secondary }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Tab row — chip-style segmented tabs on the left, chat-surface
              action buttons on the right (only on Chat tab). */}
          <Box
            sx={{
              px: 2.5,
              pt: 1.5,
              pb: 1,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
            }}
          >
            <Box
              sx={{
                display: 'inline-flex',
                p: 0.375,
                borderRadius: 999,
                backgroundColor: surfaceInset,
                border: `1px solid ${hairline}`,
                gap: 0.25,
              }}
            >
              {([
                { label: 'Chat', icon: <ChatIcon sx={{ fontSize: 14 }} />, badge: 0 },
                { label: 'Tasks', icon: <TasksIcon sx={{ fontSize: 14 }} />, badge: aiTasks?.unreadCount ?? 0 },
              ] as const).map((tab, idx) => {
                const selected = activeTab === idx;
                return (
                  <Box
                    key={tab.label}
                    onClick={() => setActiveTab(idx)}
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.625,
                      px: 1.5,
                      py: 0.625,
                      borderRadius: 999,
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      userSelect: 'none',
                      transition: 'all 140ms ease',
                      backgroundColor: selected ? violet : 'transparent',
                      color: selected ? '#fff' : theme.palette.text.secondary,
                      '&:hover': {
                        backgroundColor: selected
                          ? violet
                          : alpha(theme.palette.text.primary, isDark ? 0.06 : 0.05),
                        color: selected ? '#fff' : theme.palette.text.primary,
                      },
                    }}
                  >
                    {tab.icon}
                    {tab.label}
                    {tab.badge > 0 && (
                      <Badge
                        badgeContent={tab.badge}
                        max={99}
                        sx={{
                          ml: 0.5,
                          '& .MuiBadge-badge': {
                            position: 'static',
                            transform: 'none',
                            backgroundColor: selected
                              ? alpha('#fff', 0.25)
                              : alpha(theme.palette.error.main, isDark ? 0.25 : 0.18),
                            color: selected ? '#fff' : theme.palette.error.main,
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            height: 16,
                            minWidth: 16,
                            px: 0.5,
                            borderRadius: 999,
                          },
                        }}
                      />
                    )}
                  </Box>
                );
              })}
            </Box>

            {/* Chat-surface action buttons: New chat / Back, History, Reminders, Memory Logs.
                Visible only on the Chat tab. */}
            {activeTab === 0 && user && (() => {
              const inOverlay = showHistoryView || showRemindersView || showMemoryLogsView;
              const handleNewChat = async () => {
                setShowHistoryView(false);
                setShowRemindersView(false);
                setShowMemoryLogsView(false);
                await effectiveChatState.startNewChat();
              };
              const handleBackToChat = () => {
                setShowHistoryView(false);
                setShowRemindersView(false);
                setShowMemoryLogsView(false);
              };
              const iconBtnSx = (active: boolean) => ({
                color: active ? violet : theme.palette.text.secondary,
                borderRadius: 1.25,
                backgroundColor: active ? violetSoft : 'transparent',
                border: active ? `1px solid ${violetBorder}` : '1px solid transparent',
                '&:hover': { backgroundColor: alpha(violet, isDark ? 0.12 : 0.1) },
                '&.Mui-disabled': { color: theme.palette.text.disabled },
              });

              return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {/* Slot 1: Back-to-Chat / Back-to-previous / New chat */}
                  {inOverlay ? (
                    <Tooltip title="Back to Chat">
                      <IconButton size="small" onClick={handleBackToChat} sx={iconBtnSx(false)}>
                        <ArrowBackIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  ) : deepLinkOrigin ? (
                    <Tooltip title="Back to previous conversation">
                      <IconButton
                        size="small"
                        onClick={handleReturnToPrevious}
                        sx={iconBtnSx(false)}
                      >
                        <ArrowBackIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <Tooltip title="New Chat">
                      <span>
                        <IconButton
                          size="small"
                          onClick={handleNewChat}
                          disabled={effectiveChatState.messages.length === 0}
                          sx={iconBtnSx(false)}
                        >
                          <NewChatIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}

                  <Tooltip title="Conversation History">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setShowHistoryView((v) => !v);
                        setShowRemindersView(false);
                        setShowMemoryLogsView(false);
                      }}
                      sx={iconBtnSx(showHistoryView)}
                    >
                      <HistoryIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>

                  <Tooltip title="Reminders">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setShowRemindersView((v) => !v);
                        setShowHistoryView(false);
                        setShowMemoryLogsView(false);
                      }}
                      sx={iconBtnSx(showRemindersView)}
                    >
                      <AlarmIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>

                  <Tooltip title="Memory Logs">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setShowMemoryLogsView((v) => !v);
                        setShowHistoryView(false);
                        setShowRemindersView(false);
                      }}
                      sx={iconBtnSx(showMemoryLogsView)}
                    >
                      <ManageSearchIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              );
            })()}
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
                seedMessage={chatSeedMessage}
                onSeedMessageConsumed={() => setChatSeedMessage('')}
                scrollToMessageId={scrollToMessageId}
                onScrolledToMessage={() => setScrollToMessageId(null)}
                canReturnToPrevious={!!deepLinkOrigin}
                onReturnToPrevious={handleReturnToPrevious}
                initialTradeId={initialTradeId}
                showHistoryView={showHistoryView}
                setShowHistoryView={setShowHistoryView}
                showRemindersView={showRemindersView}
                setShowRemindersView={setShowRemindersView}
                showMemoryLogsView={showMemoryLogsView}
                setShowMemoryLogsView={setShowMemoryLogsView}
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
