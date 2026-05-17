/**
 * AIChatContent Component
 * Inner content for AI chat — usable inside AIChatDrawer (mobile bottom sheet)
 * or side panel (desktop). Contains all chat logic, history, and sub-dialogs.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  IconButton,
  Button,
  Typography,
  Alert,
  Tooltip,
  useTheme,
  alpha,
  List,
  ListItem,
  ListItemButton,
  TextField,
  InputAdornment,
  CircularProgress,
  Select,
  MenuItem,
  FormControl
} from '@mui/material';
import {
  AddComment as NewChatIcon,
  History as HistoryIcon,
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
  Search as SearchIcon,
  PushPin as PushPinIcon,
  PushPinOutlined as PushPinOutlinedIcon,
  Alarm as AlarmIcon
} from '@mui/icons-material';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import { format } from 'date-fns';
import EconomicEventShimmer from '../../economicCalendar/EconomicEventShimmer';
import AIChatInterface, { AIChatInterfaceRef, QuestionTemplate } from '../../aiChat/AIChatInterface';
import { AIConversation } from '../../../types/aiChat';
import { Trade } from '../../../types/trade';
import { Calendar } from '../../../types/calendar';
import { EconomicEvent } from '../../../types/economicCalendar';
import { scrollbarStyles } from '../../../styles/scrollbarStyles';
import { useDialogTokens, MONO_FONT } from '../../../styles/dialogTokens';
import { logger } from '../../../utils/logger';
import { stripReferencedBlocks } from '../../../utils/chatMentions';
import { useAuthState } from '../../../contexts/AuthStateContext';
import { useAIChat, UseAIChatReturn } from '../../../hooks/useAIChat';
import { useReminderScheduler } from '../../../hooks/useReminderScheduler';
import EconomicEventDetailDialog
  from '../../economicCalendar/EconomicEventDetailDialog';
import NoteEditorDialog from '../../notes/NoteEditorDialog';
import ConfirmationDialog from '../../common/ConfirmationDialog';
import RemindersPanel from '../../aiChat/RemindersPanel';
import MemoryLogsPanel from '../../aiChat/MemoryLogsPanel';
import { Note, SLASH_COMMAND_TAG, GUIDELINE_TAG } from '../../../types/note';
import * as notesService from '../../../services/notesService';
import { ConversationRepository }
  from '../../../services/repository/repositories/ConversationRepository';
import type { SystemCommand } from '../../aiChat/AIChatMentionInput';
import { TradeOperationsProps } from '../../../types/tradeOperations';
import { Z_INDEX } from '../../../styles/zIndex';

export interface AIChatContentProps {
  trades?: Trade[];
  calendar?: Calendar;
  isReadOnly?: boolean;
  tradeOperations: TradeOperationsProps;
  isActive?: boolean;
  /** When provided, starts a focused AI analysis for this trade */
  initialTradeId?: string;
  /** When provided, uses this shared chat state instead of creating its own useAIChat instance */
  sharedChatState?: UseAIChatReturn;
  /** Available calendars for the context picker dropdown */
  availableCalendars?: Calendar[];
  /** Currently selected calendar ID for AI context */
  selectedCalendarId?: string;
  /** Callback when user changes the calendar context */
  onCalendarChange?: (calendarId: string) => void;
  /** When set (non-empty), populates the chat input with this text. Used by the
   *  "Follow up with Orion" button on Orion Task briefings. */
  seedMessage?: string;
  /** Called after seedMessage has been injected into the input so the parent
   *  can clear it (otherwise it would re-inject on every re-render). */
  onSeedMessageConsumed?: () => void;
  /** One-shot deep-link target. Scrolls the matching message into view and
   *  briefly highlights it. */
  scrollToMessageId?: string | null;
  /** Cleared by the chat surface after the scroll completes. */
  onScrolledToMessage?: () => void;
  /** When true, the "New chat" button morphs into a back-arrow that returns
   *  the surface to the conversation that was active before a notification
   *  deep-link swapped it out. */
  canReturnToPrevious?: boolean;
  onReturnToPrevious?: () => void;
}

const AIChatContent: React.FC<AIChatContentProps> = ({
  trades,
  calendar,
  isReadOnly = false,
  tradeOperations,
  isActive = false,
  initialTradeId,
  sharedChatState,
  availableCalendars,
  selectedCalendarId = '',
  onCalendarChange,
  seedMessage = '',
  onSeedMessageConsumed,
  scrollToMessageId,
  onScrolledToMessage,
  canReturnToPrevious = false,
  onReturnToPrevious,
}) => {
  const { onOpenGalleryMode } = tradeOperations;
  const theme = useTheme();
  const tokens = useDialogTokens();
  const {
    violet,
    violetSoft,
    violetSofter,
    violetBorder,
    surfaceInset,
    hairline,
    inputSx,
    chipStyle,
    monoSectionLabelSx,
  } = tokens;
  const { user } = useAuthState();
  const chatInterfaceRef = useRef<AIChatInterfaceRef>(null);

  // Find the focused trade for AI analysis
  const focusedTrade = useMemo(() => {
    if (!initialTradeId || !trades) return undefined;
    return trades.find(t => t.id === initialTradeId);
  }, [initialTradeId, trades]);

  // Trade-specific question templates (when focused on a trade)
  const tradeQuestionTemplates: QuestionTemplate[] | undefined =
    useMemo(() => {
      if (!focusedTrade) return undefined;
      const name = focusedTrade.name || 'this trade';
      const isWin = focusedTrade.trade_type === 'win';
      const isLoss = focusedTrade.trade_type === 'loss';
      return [
        {
          category: 'Trade Analysis',
          questions: [
            `Why did ${name} ${isWin ? 'succeed' : isLoss ? 'fail' : 'break even'}?`,
            "What patterns do you see in this trade's setup?",
            'Analyze the entry and exit timing for this trade',
          ],
        },
        {
          category: 'Compare & Learn',
          questions: [
            'Show me similar trades from my history',
            'How does this trade compare to my winning trades?',
            'What could I have done differently in this trade?',
          ],
        },
        {
          category: 'Risk & Management',
          questions: [
            'Was my position size appropriate for this trade?',
            'Analyze the risk-reward ratio of this trade',
            'Did I follow my trading rules on this trade?',
          ],
        },
      ];
    }, [focusedTrade]);

  // Schedule browser-local timers for chat-driven reminders. Mounted here so
  // it runs only when the chat panel is alive — cron handles users who never
  // open chat, and longer-than-24-day reminders.
  useReminderScheduler();

  // Use shared chat state if provided, otherwise create own instance
  const ownChatState = useAIChat({
    userId: user?.uid,
    calendar,
    trade: focusedTrade,
    messageLimit: 100,
    autoSaveConversation: true
  });

  const {
    messages,
    isLoading,
    isTyping,
    toolExecutionStatus,
    conversations,
    loadingConversations,
    loadingMoreConversations,
    hasMoreConversations,
    totalConversationsCount,
    isAtMessageLimit,
    sendMessage,
    cancelRequest,
    setInputForEdit,
    loadConversations,
    loadMoreConversations,
    selectConversation,
    currentConversationId,
    deleteConversation,
    togglePinConversation,
    startNewChat,
    setMessages,
    getWelcomeMessage
  } = sharedChatState || ownChatState;

  // Local UI state
  const [showHistoryView, setShowHistoryView] = useState(false);
  const [showRemindersView, setShowRemindersView] = useState(false);
  const [showMemoryLogsView, setShowMemoryLogsView] = useState(false);

  // Dismiss any open slash/mention popup in the chat input when sliding to the
  // history view, opening the reminders overlay, or when the chat panel itself
  // is dismissed (isActive=false, e.g. user opens the Notes panel). The Popper
  // renders into a portal, so it outlives any visibility change to the chat
  // content unless we close it explicitly.
  useEffect(() => {
    if (showHistoryView || showRemindersView || showMemoryLogsView || !isActive) {
      chatInterfaceRef.current?.closeMention?.();
    }
  }, [showHistoryView, showRemindersView, showMemoryLogsView, isActive]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] =
    useState<string | null>(null);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyFilter, setHistoryFilter] =
    useState<'all' | 'pinned'>('all');

  // Economic event detail dialog state
  const [selectedEvent, setSelectedEvent] =
    useState<EconomicEvent | null>(null);
  const [eventDetailDialogOpen, setEventDetailDialogOpen] =
    useState(false);

  // Note editor dialog state
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  // When set, NoteEditorDialog opens in "create new note" mode with these
  // tags pre-selected. Used by the "New Slash Command" system command.
  const [newNoteInitialTags, setNewNoteInitialTags] = useState<string[] | null>(null);

  // Filter conversations based on search query + pinned filter
  const filteredConversations = useMemo(() => {
    const scoped = historyFilter === 'pinned'
      ? conversations.filter(c => c.pinned)
      : conversations;

    if (!historySearchQuery.trim()) {
      return scoped;
    }
    const query = historySearchQuery.toLowerCase();
    return scoped.filter(conversation => {
      if (conversation.title?.toLowerCase().includes(query)) {
        return true;
      }
      if (
        (conversation as any).preview?.toLowerCase().includes(query)
      ) {
        return true;
      }
      if (conversation.messages && Array.isArray(conversation.messages)) {
        return conversation.messages.some(message =>
          message.content?.toLowerCase().includes(query)
        );
      }
      return false;
    });
  }, [conversations, historySearchQuery, historyFilter]);

  // Focus input when content becomes active
  useEffect(() => {
    if (isActive && !isLoading) {
      setTimeout(() => chatInterfaceRef.current?.focus(), 100);
    }
  }, [isActive, isLoading]);

  // Inject seed message (from "Follow up with Orion" on a task briefing).
  // Defer slightly so the AIChatInterface has mounted its ref.
  useEffect(() => {
    if (!seedMessage) return;
    const timer = setTimeout(() => {
      chatInterfaceRef.current?.setInput(seedMessage);
      onSeedMessageConsumed?.();
    }, 150);
    return () => clearTimeout(timer);
  }, [seedMessage, onSeedMessageConsumed]);

  // Load conversations when content becomes active or calendar context changes.
  // Calendar is intentionally optional — when undefined (e.g. AssistantPage's
  // "All Calendars" mode), useAIChat falls back to user-level conversations.
  useEffect(() => {
    if (isActive && user) {
      loadConversations();
    }
  }, [isActive, calendar?.id, user, loadConversations]);

  // =====================================================
  // UI EVENT HANDLERS
  // =====================================================

  // System slash commands. Locally handled — never sent to Orion. The
  // "Orion Guidelines" command is gated on the calendar actually having a
  // GUIDELINE-tagged note (calendar.notes is a JSONB mirror with tags).
  const hasGuidelineNote = useMemo(
    () => (calendar?.notes ?? []).some(
      n => (n.tags ?? []).includes(GUIDELINE_TAG)
    ),
    [calendar?.notes]
  );

  const systemCommands = useMemo<SystemCommand[]>(() => {
    const commands: SystemCommand[] = [];
    if (hasGuidelineNote) {
      commands.push({
        id: 'open-guidelines',
        title: 'Orion Guidelines',
        subtitle: 'Open the GUIDELINE note for this calendar',
      });
    }
    if (messages.length > 0) {
      commands.push({
        id: 'clear-chat',
        title: 'Clear Chat',
        subtitle: 'Start a fresh conversation',
      });
    }
    commands.push({
      id: 'new-slash-command',
      title: 'New Slash Command',
      subtitle: 'Create a reusable Orion prompt',
    });
    return commands;
  }, [hasGuidelineNote, messages.length]);

  const handleSystemCommand = async (id: string) => {
    if (id === 'clear-chat') {
      setShowHistoryView(false);
      // Abort any in-flight ai-trading-agent fetch BEFORE deleting — otherwise
      // the backend's turn-end UPDATE would race with our DELETE. UPDATE no-ops
      // on a deleted row, so this is belt-and-braces.
      cancelRequest();
      if (currentConversationId) {
        // deleteConversation already calls startNewChat() when the deleted id
        // matches currentConversationId (see useAIChat.ts), so we don't need
        // to call it twice.
        await deleteConversation(currentConversationId);
      } else {
        // No persisted conversation yet (first turn never landed) — just reset.
        await startNewChat();
      }
      return;
    }
    if (id === 'open-guidelines') {
      const stub = (calendar?.notes ?? []).find(
        n => (n.tags ?? []).includes(GUIDELINE_TAG)
      );
      if (!stub) return;
      // calendar.notes only has {id, title, tags} — fetch the full note before
      // opening the editor.
      try {
        const full = await notesService.getNote(stub.id);
        if (full) {
          setSelectedNote(full);
          setNoteEditorOpen(true);
        } else {
          logger.warn('Guideline note not found:', stub.id);
        }
      } catch (err) {
        logger.error('Failed to load guideline note:', err);
      }
      return;
    }
    if (id === 'new-slash-command') {
      setSelectedNote(null);
      setNewNoteInitialTags([SLASH_COMMAND_TAG]);
      setNoteEditorOpen(true);
      return;
    }
  };

  const handleNewChat = async () => {
    setShowHistoryView(false);
    await startNewChat();
  };

  const handleSelectConversation = (conversation: AIConversation) => {
    selectConversation(conversation);
    setShowHistoryView(false);
  };

  // Repository ref for the reminder-driven nav fallback (when the target
  // conversation isn't in the local cache yet).
  const conversationRepoRef = useRef(new ConversationRepository());

  // Sentinel for the infinite-scroll loader at the bottom of the history
  // list. The IntersectionObserver fires `loadMoreConversations()` when the
  // sentinel scrolls into view, replacing the old "Load More" button.
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!showHistoryView) return;
    const node = loadMoreSentinelRef.current;
    if (!node) return;
    if (!hasMoreConversations) return;
    if (loadingMoreConversations) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void loadMoreConversations();
        }
      },
      { rootMargin: '120px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [
    showHistoryView,
    hasMoreConversations,
    loadingMoreConversations,
    loadMoreConversations,
    conversations.length,
  ]);

  const handleNavigateFromReminder = async (conversationId: string) => {
    const cached = conversations.find(c => c.id === conversationId);
    if (cached) {
      selectConversation(cached);
    } else {
      const fetched = await conversationRepoRef.current.findById(conversationId);
      if (fetched) {
        selectConversation(fetched);
      } else {
        logger.warn(
          'Reminder target conversation not found:', conversationId
        );
        return;
      }
    }
    setShowRemindersView(false);
  };

  const handleDeleteClick = (
    conversationId: string,
    event: React.MouseEvent
  ) => {
    event.stopPropagation();
    setConversationToDelete(conversationId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!conversationToDelete) return;
    const success = await deleteConversation(conversationToDelete);
    if (success) {
      logger.log('Conversation deleted:', conversationToDelete);
    }
    setDeleteDialogOpen(false);
    setConversationToDelete(null);
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setConversationToDelete(null);
  };

  const handlePinToggle = (
    conversationId: string,
    event: React.MouseEvent
  ) => {
    event.stopPropagation();
    togglePinConversation(conversationId);
  };

  const getPreviewText = (conversation: AIConversation): string => {
    const firstUserMessage =
      conversation.messages.find(msg => msg.role === 'user');
    if (!firstUserMessage || !firstUserMessage.content) return 'No messages';

    const raw = firstUserMessage.content;
    // Strip [Referenced …:] block syntax so the preview reads naturally
    // instead of leaking "[Referenced command: …]" into the sidebar.
    let preview = stripReferencedBlocks(raw).trim();
    // Bare invocation (no typed text): fall back to the body of the first
    // block so the user sees what the command/note actually says.
    // Handles both old format `[Referenced command:\n` and new format
    // `[Referenced command "Title":\n`.
    if (!preview) {
      const firstBlockBody = raw.match(
        /\[Referenced (?:command|note)(?:\s+"[^"]*")?:\n([\s\S]*?)\n\]/
      )?.[1]?.trim();
      preview = firstBlockBody || raw;
    }
    return preview.length > 80 ? `${preview.substring(0, 80)}...` : preview;
  };

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
    }}>
      {/* Header Action Bar */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.25,
        py: 0.75,
        flexShrink: 0,
        borderBottom: `1px solid ${hairline}`,
      }}>
        {/* Calendar context picker — chip-style trigger that opens a themed
            paper menu. Mirrors the dialog-token chipStyle() language. */}
        {availableCalendars && availableCalendars.length > 0 && onCalendarChange ? (
          <FormControl size="small" sx={{ flex: 1, minWidth: 0 }}>
            <Select
              value={selectedCalendarId}
              onChange={(e) => onCalendarChange(e.target.value)}
              displayEmpty
              variant="standard"
              disableUnderline
              MenuProps={{
                sx: { zIndex: Z_INDEX.DIALOG_POPUP },
                PaperProps: {
                  sx: {
                    mt: 0.75,
                    borderRadius: 1.5,
                    border: `1px solid ${hairline}`,
                    boxShadow: theme.shadows[10],
                    backgroundImage: 'none',
                    overflow: 'hidden',
                    '& .MuiMenuItem-root': {
                      fontSize: '0.82rem',
                      fontWeight: 500,
                      py: 0.85,
                      px: 1.5,
                      '&:hover': { backgroundColor: violetSofter },
                      '&.Mui-selected': {
                        backgroundColor: violetSoft,
                        color: violet,
                        '&:hover': { backgroundColor: violetSoft },
                      },
                    },
                  },
                },
              }}
              renderValue={(val) => {
                const selected = availableCalendars.find((c) => c.id === val);
                return (
                  <Typography
                    variant="body2"
                    sx={{
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: selected ? violet : theme.palette.text.primary,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {selected ? selected.name : 'All Calendars'}
                  </Typography>
                );
              }}
              sx={{
                borderRadius: 999,
                px: 1.25,
                py: 0.25,
                backgroundColor: surfaceInset,
                border: `1px solid ${hairline}`,
                transition: 'all 120ms ease',
                '&:hover': {
                  backgroundColor: violetSofter,
                  borderColor: violetBorder,
                },
                '& .MuiSelect-select': {
                  py: 0.4,
                  pl: 0.5,
                  pr: '24px !important',
                  backgroundColor: 'transparent !important',
                  display: 'flex',
                  alignItems: 'center',
                  minHeight: '0 !important',
                },
                '& .MuiSvgIcon-root': {
                  color: theme.palette.text.secondary,
                  right: 4,
                },
              }}
            >
              <MenuItem value="">All Calendars</MenuItem>
              {availableCalendars.map((cal) => (
                <MenuItem key={cal.id} value={cal.id}>{cal.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : calendar ? (
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              display: 'inline-flex',
              alignItems: 'center',
              px: 1.25,
              py: 0.55,
              borderRadius: 999,
              backgroundColor: surfaceInset,
              border: `1px solid ${hairline}`,
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontSize: '0.82rem',
                fontWeight: 600,
                color: theme.palette.text.primary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {calendar.name}
            </Typography>
          </Box>
        ) : null}

        {user && (
          <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto' }}>
            {/* First slot morphs in priority order:
                1. inside history / reminders / memory  → back-to-Chat
                2. notification deep-link is active     → back-to-previous-conversation
                3. default                              → "+" new chat */}
            {showHistoryView || showRemindersView || showMemoryLogsView ? (
              <Tooltip title="Back to Chat">
                <IconButton
                  size="small"
                  onClick={() => {
                    setShowHistoryView(false);
                    setShowRemindersView(false);
                    setShowMemoryLogsView(false);
                  }}
                  aria-label="Back to Chat"
                  sx={{
                    color: violet,
                    borderRadius: 1.25,
                    '&:hover': { backgroundColor: violetSofter },
                  }}
                >
                  <ArrowBackIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : canReturnToPrevious ? (
              <Tooltip title="Back to previous conversation">
                <IconButton
                  size="small"
                  onClick={() => onReturnToPrevious?.()}
                  aria-label="Back to previous conversation"
                  sx={{
                    color: violet,
                    borderRadius: 1.25,
                    '&:hover': { backgroundColor: violetSofter },
                  }}
                >
                  <ArrowBackIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : (
              <Tooltip title="New Chat">
                <IconButton
                  size="small"
                  onClick={handleNewChat}
                  disabled={messages.length === 0}
                  sx={{
                    color: violet,
                    borderRadius: 1.25,
                    '&:hover': { backgroundColor: violetSofter },
                    '&:disabled': { color: 'text.disabled' },
                  }}
                >
                  <NewChatIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}

            <Tooltip title="Conversation History">
              <IconButton
                size="small"
                onClick={() => {
                  setShowHistoryView(prev => !prev);
                  setShowRemindersView(false);
                  setShowMemoryLogsView(false);
                }}
                aria-label="Conversation History"
                sx={{
                  color: showHistoryView ? violet : 'text.secondary',
                  borderRadius: 1.25,
                  backgroundColor: showHistoryView ? violetSoft : 'transparent',
                  border: showHistoryView
                    ? `1px solid ${violetBorder}`
                    : '1px solid transparent',
                  '&:hover': { backgroundColor: violetSofter },
                }}
              >
                <HistoryIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Tooltip title="Reminders">
              <IconButton
                size="small"
                onClick={() => {
                  setShowRemindersView(prev => !prev);
                  setShowHistoryView(false);
                  setShowMemoryLogsView(false);
                }}
                aria-label="Reminders"
                sx={{
                  color: showRemindersView ? violet : 'text.secondary',
                  borderRadius: 1.25,
                  backgroundColor: showRemindersView ? violetSoft : 'transparent',
                  border: showRemindersView
                    ? `1px solid ${violetBorder}`
                    : '1px solid transparent',
                  '&:hover': { backgroundColor: violetSofter },
                }}
              >
                <AlarmIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Tooltip title="Memory Logs">
              <IconButton
                size="small"
                onClick={() => {
                  setShowMemoryLogsView(prev => !prev);
                  setShowHistoryView(false);
                  setShowRemindersView(false);
                }}
                aria-label="Memory Logs"
                sx={{
                  color: showMemoryLogsView ? violet : 'text.secondary',
                  borderRadius: 1.25,
                  backgroundColor: showMemoryLogsView ? violetSoft : 'transparent',
                  border: showMemoryLogsView
                    ? `1px solid ${violetBorder}`
                    : '1px solid transparent',
                  '&:hover': { backgroundColor: violetSofter },
                }}
              >
                <ManageSearchIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )}

      </Box>

      {/* Content area. Chat is always rendered; history and reminders
          render as absolute overlays when active (no slide animation —
          consistent across both side panels, and avoids the 200%-width
          translateX trick). */}
      <Box sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* Chat View */}
        <Box sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
            <AIChatInterface
              ref={chatInterfaceRef}
              messages={messages}
              isLoading={isLoading}
              isTyping={isTyping}
              toolExecutionStatus={toolExecutionStatus}
              isAtMessageLimit={isAtMessageLimit}
              sendMessage={sendMessage}
              cancelRequest={cancelRequest}
              setInputForEdit={setInputForEdit}
              startNewChat={startNewChat}
              setMessages={setMessages}
              getWelcomeMessage={getWelcomeMessage}
              userId={user?.uid}
              calendar={calendar}
              trades={trades}
              currentConversationId={currentConversationId}
              scrollToMessageId={scrollToMessageId}
              onScrolledToMessage={onScrolledToMessage}
              {...(tradeQuestionTemplates && {
                questionTemplates: tradeQuestionTemplates,
              })}
              onTradeClick={(tradeId, contextTrades) => {
                if (onOpenGalleryMode) {
                  const clickedTrade =
                    contextTrades.find(t => t.id === tradeId);
                  if (clickedTrade) {
                    onOpenGalleryMode(
                      contextTrades,
                      tradeId,
                      'AI Chat - Trade Gallery'
                    );
                  }
                } else {
                  logger.log(
                    'Trade clicked but gallery mode not available:',
                    tradeId
                  );
                }
              }}
              onEventClick={(event) => {
                logger.log('Economic event clicked:', event);
                setSelectedEvent(event);
                setEventDetailDialogOpen(true);
              }}
              onNoteClick={(noteId, note) => {
                logger.log('Note clicked:', noteId);
                if (note) {
                  setSelectedNote(note);
                  setNoteEditorOpen(true);
                } else {
                  logger.warn(
                    'Note not found in embedded notes:', noteId
                  );
                }
              }}
              isReadOnly={isReadOnly}
              messageLimit={100}
              systemCommands={systemCommands}
              onSystemCommand={handleSystemCommand}
            />
          </Box>

        {/* History View — overlay (mirrors the Reminders pattern below).
            Mutually exclusive with reminders; the active toggle button or
            the back-arrow in the header closes it. */}
        {showHistoryView && (
          <Box sx={{
            position: 'absolute',
            inset: 0,
            backgroundColor: theme.palette.background.default,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            // Above the in-chat scroll-to-bottom button (zIndex 10) so it
            // doesn't leak through this overlay.
            zIndex: 20
          }}>
            {/* Search Bar with inline filter chips */}
            <Box sx={{ px: 2, pt: 2, pb: 1.25, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search conversations..."
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon
                        fontSize="small"
                        sx={{ color: 'text.secondary' }}
                      />
                    </InputAdornment>
                  ),
                }}
                sx={inputSx}
              />
              {/* Filter pills — mirror chipStyle() language */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box
                  component="span"
                  role="button"
                  tabIndex={0}
                  onClick={() => setHistoryFilter('all')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setHistoryFilter('all');
                    }
                  }}
                  sx={chipStyle(historyFilter === 'all')}
                >
                  All
                </Box>
                <Box
                  component="span"
                  role="button"
                  tabIndex={0}
                  onClick={() => setHistoryFilter('pinned')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setHistoryFilter('pinned');
                    }
                  }}
                  sx={chipStyle(historyFilter === 'pinned')}
                >
                  <PushPinIcon sx={{ fontSize: 13 }} />
                  Pinned
                </Box>
              </Box>
            </Box>

            {/* History Content */}
            <Box sx={{
              flex: 1,
              overflow: 'auto',
              ...scrollbarStyles(theme)
            }}>
              {loadingConversations ? (
                <EconomicEventShimmer count={10} />
              ) : filteredConversations.length === 0 ? (
                <Box sx={{ p: 3 }}>
                  <Alert severity="info">
                    {historySearchQuery.trim()
                      ? `No conversations found matching "${historySearchQuery}"`
                      : historyFilter === 'pinned'
                        ? 'No pinned conversations yet. Pin a conversation from the list to keep it handy.'
                        : 'No conversation history yet. Start chatting with the AI to create your first conversation!'}
                  </Alert>
                </Box>
              ) : (
                <List sx={{ p: 0, px: 1.5, pt: 0.5 }}>
                  {filteredConversations.map((conversation) => {
                    const isActive = conversation.id === currentConversationId;
                    return (
                      <ListItem
                        key={conversation.id}
                        disablePadding
                        sx={{ mb: 0.75 }}
                      >
                        <ListItemButton
                          onClick={() => handleSelectConversation(conversation)}
                          sx={{
                            py: 1.5,
                            px: 1.5,
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 1,
                            borderRadius: 1.5,
                            border: `1px solid ${isActive ? violetBorder : hairline}`,
                            backgroundColor: isActive ? violetSoft : surfaceInset,
                            transition: 'all 120ms ease',
                            '&:hover': {
                              backgroundColor: isActive ? violetSoft : violetSofter,
                              borderColor: violetBorder,
                            },
                          }}
                        >
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              mb: 0.5
                            }}>
                              <Typography
                                variant="subtitle1"
                                sx={{
                                  fontWeight: 600,
                                  fontSize: '0.9rem',
                                  flex: 1,
                                  color: isActive ? violet : theme.palette.text.primary,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {conversation.title}
                              </Typography>
                              <Box
                                sx={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  height: 20,
                                  px: 0.85,
                                  borderRadius: 999,
                                  fontFamily: MONO_FONT,
                                  fontSize: '0.66rem',
                                  fontWeight: 600,
                                  letterSpacing: '0.04em',
                                  backgroundColor: isActive ? alpha(violet, 0.18) : violetSofter,
                                  color: violet,
                                  border: `1px solid ${violetBorder}`,
                                }}
                              >
                                {conversation.message_count}
                              </Box>
                            </Box>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                fontSize: '0.82rem',
                                lineHeight: 1.45,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                mb: 0.65
                              }}
                            >
                              {getPreviewText(conversation)}
                            </Typography>
                            <Box sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5
                            }}>
                              <ScheduleIcon
                                sx={{
                                  fontSize: 12,
                                  color: 'text.disabled'
                                }}
                              />
                              <Typography
                                variant="caption"
                                color="text.disabled"
                                sx={{
                                  fontFamily: MONO_FONT,
                                  fontSize: '0.68rem',
                                  letterSpacing: '0.02em',
                                }}
                              >
                                {format(
                                  conversation.updated_at,
                                  'MMM d, yyyy \u2022 h:mm a'
                                )}
                              </Typography>
                            </Box>
                          </Box>
                          <Box sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 0.25,
                            flexShrink: 0,
                            mt: 0.25
                          }}>
                            <Tooltip
                              title={
                                conversation.pinned
                                  ? 'Unpin conversation'
                                  : 'Pin conversation'
                              }
                            >
                              <IconButton
                                onClick={(e) => handlePinToggle(conversation.id, e)}
                                size="small"
                                sx={{
                                  color: conversation.pinned ? violet : 'text.secondary',
                                  borderRadius: 1,
                                  '&:hover': { backgroundColor: violetSofter },
                                }}
                              >
                                {conversation.pinned
                                  ? <PushPinIcon fontSize="small" />
                                  : <PushPinOutlinedIcon fontSize="small" />
                                }
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete conversation">
                              <IconButton
                                onClick={(e) => handleDeleteClick(conversation.id, e)}
                                size="small"
                                sx={{
                                  color: 'text.secondary',
                                  borderRadius: 1,
                                  transition: 'all 120ms ease',
                                  '&:hover': {
                                    color: theme.palette.error.main,
                                    backgroundColor: alpha(theme.palette.error.main, 0.1),
                                  },
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </ListItemButton>
                      </ListItem>
                    );
                  })}
                </List>
              )}

              {/* Infinite-scroll sentinel — when this enters the viewport
                  the IntersectionObserver above triggers loadMoreConversations.
                  The inline spinner shows during the fetch. */}
              {!loadingConversations && hasMoreConversations && (
                <Box
                  ref={loadMoreSentinelRef}
                  sx={{
                    py: 2,
                    display: 'flex',
                    justifyContent: 'center',
                    minHeight: 48,
                  }}
                >
                  {loadingMoreConversations && (
                    <CircularProgress size={20} color="inherit" />
                  )}
                </Box>
              )}
            </Box>

            {/* Footer Info */}
            {!loadingConversations && conversations.length > 0 && (
              <Box sx={{
                px: 2,
                py: 1.25,
                borderTop: `1px solid ${hairline}`,
                backgroundColor: tokens.footerBg,
              }}>
                <Typography component="span" sx={monoSectionLabelSx}>
                  {conversations.length} / {totalConversationsCount}
                  {' '}conversation{totalConversationsCount !== 1 ? 's' : ''}
                </Typography>
              </Box>
            )}
          </Box>
        )}
        {/* End History overlay */}

        {/* Reminders View — overlay. Mutually exclusive with the history
            view (the alarm-clock toggle closes history, and vice versa). */}
        {showRemindersView && (
          <Box sx={{
            position: 'absolute',
            inset: 0,
            backgroundColor: theme.palette.background.default,
            overflow: 'auto',
            ...scrollbarStyles(theme),
            // Above the in-chat scroll-to-bottom button (zIndex 10) so it
            // doesn't leak through this overlay.
            zIndex: 20
          }}>
            <RemindersPanel
              onNavigateToConversation={(conversationId) => {
                void handleNavigateFromReminder(conversationId);
              }}
            />
          </Box>
        )}

        {/* Memory Logs View — overlay. Mutually exclusive with history and reminders. */}
        {showMemoryLogsView && (
          <Box sx={{
            position: 'absolute',
            inset: 0,
            backgroundColor: theme.palette.background.default,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            // Above the in-chat scroll-to-bottom button (zIndex 10) so it
            // doesn't leak through this overlay.
            zIndex: 20
          }}>
            <MemoryLogsPanel calendarId={calendar?.id} />
          </Box>
        )}
      </Box>

      {/* Economic Event Detail Dialog */}
      {selectedEvent && calendar && (
        <EconomicEventDetailDialog
          open={eventDetailDialogOpen}
          onClose={() => {
            setEventDetailDialogOpen(false);
            setSelectedEvent(null);
          }}
          event={selectedEvent}
          calendarId={calendar.id}
          tradeOperations={tradeOperations}
          isReadOnly={isReadOnly}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        title="Delete conversation?"
        message="This permanently removes the conversation and its messages. This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmColor="error"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />

      {/* Note Editor Dialog */}
      {noteEditorOpen && calendar && (selectedNote || newNoteInitialTags) && (
        <NoteEditorDialog
          open={noteEditorOpen}
          onClose={() => {
            setNoteEditorOpen(false);
            setSelectedNote(null);
            setNewNoteInitialTags(null);
          }}
          note={selectedNote || undefined}
          initialTags={newNoteInitialTags || undefined}
          calendarId={calendar.id}
          availableTradeTags={calendar.tags || []}
          calendarNotes={calendar.notes}
          onSave={(updatedNote) => {
            setMessages(prevMessages =>
              prevMessages.map(msg => {
                if (
                  msg.embeddedNotes &&
                  msg.embeddedNotes[updatedNote.id]
                ) {
                  return {
                    ...msg,
                    embeddedNotes: {
                      ...msg.embeddedNotes,
                      [updatedNote.id]: updatedNote
                    }
                  };
                }
                return msg;
              })
            );
          }}
          onDelete={(noteId) => {
            setMessages(prevMessages =>
              prevMessages.map(msg => {
                if (msg.embeddedNotes && msg.embeddedNotes[noteId]) {
                  const {
                    [noteId]: _,
                    ...remainingNotes
                  } = msg.embeddedNotes;
                  return {
                    ...msg,
                    embeddedNotes: remainingNotes
                  };
                }
                return msg;
              })
            );
            setNoteEditorOpen(false);
            setSelectedNote(null);
            setNewNoteInitialTags(null);
          }}
        />
      )}
    </Box>
  );
};

export default AIChatContent;
