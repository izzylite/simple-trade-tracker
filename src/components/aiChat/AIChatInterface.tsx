/**
 * AIChatInterface Component
 * Reusable AI chat interface that can be embedded in different containers
 * Contains: Messages, Templates, Typing Indicator, Input Area
 */

import React, { useRef, useEffect, useCallback, useMemo, useState, forwardRef, useImperativeHandle } from 'react';
import OrionIcon from './OrionIcon';
import {
  Box,
  IconButton,
  Button,
  Typography,
  useTheme,
  alpha
} from '@mui/material';
import {
  Send as SendIcon,
  AddComment as NewChatIcon,
  Stop as StopIcon,
  Image as ImageIcon,
  Close as CloseIcon,
  KeyboardArrowDown as ScrollDownIcon
} from '@mui/icons-material';
import { useDialogTokens } from '../../styles/dialogTokens';
import ChatMessage from './ChatMessage';
import ReminderSeparator from './ReminderSeparator';
import CrossSessionReminderCard from '../notifications/CrossSessionReminderCard';
import CrossSessionReminderBatchCard from '../notifications/CrossSessionReminderBatchCard';
import { useNotificationsOptional } from '../../contexts/NotificationsContext';
import {
  AppNotification,
  isReminderFiredPayload,
} from '../../types/notification';
import AIChatMentionInput from './AIChatMentionInput';
import type { AIChatMentionInputHandle, SystemCommand } from './AIChatMentionInput';
import { ChatMessage as ChatMessageType, AttachedImage } from '../../types/aiChat';
import { Trade } from '../../types/trade';
import { Calendar } from '../../types/calendar';
import { EconomicEvent } from '../../types/economicCalendar';
import { Note } from '../../types/note';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import { Z_INDEX } from '../../styles/zIndex';
import { logger } from '../../utils/logger';
import { compressImageToDataUrl } from '../../utils/fileValidation';
import * as notesService from '../../services/notesService';
import { expandMentionsForSend, stripReferencedBlocks } from '../../utils/chatMentions';

// Image limit for AI agent requests (must match backend MAX_IMAGES_PER_REQUEST)
const MAX_IMAGES = 4;

// Type for question templates
export interface QuestionTemplate {
  category: string;
  questions: string[];
}

// Default question templates for new users
const defaultQuestionTemplates = [
  {
    category: "Performance Analysis",
    questions: [
      "What's my overall win rate by trading session?",
      "Show me my monthly performance trends",
      "Which tags have the highest win rates?"
    ]
  },
  {
    category: "Pattern Discovery",
    questions: [
      "Find my most profitable trading patterns",
      "Show me trades similar to my best EUR/USD wins",
      "Analyze my performance during high-impact news events"
    ]
  },
  {
    category: "Risk Management",
    questions: [
      "What's my average trade size by day of week?",
      "Show me trades where I violated my risk management rules",
      "Analyze correlation between trade session and profitability"
    ]
  },
  {
    category: "Advanced Analysis",
    questions: [
      "How does my trading performance vary across different sessions during high-impact economic events?",
      "Compare my win rate on Mondays vs Fridays for scalping trades",
      "Show me all my losing breakout trades on Tuesdays in the last 6 months"
    ]
  }
];

export interface AIChatInterfaceProps {
  // Core state from useAIChat hook
  messages: ChatMessageType[];
  isLoading: boolean;
  isTyping: boolean;
  toolExecutionStatus: string;
  isAtMessageLimit: boolean;

  // Actions from useAIChat hook
  sendMessage: (messageText: string, images?: AttachedImage[], segments?: ChatMessageType['segments']) => Promise<void>;
  cancelRequest: () => void;
  setInputForEdit: (messageId: string) => { content: string; images?: AttachedImage[]; segments?: ChatMessageType['segments'] } | null;
  startNewChat: () => Promise<void>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessageType[]>>;
  getWelcomeMessage: () => ChatMessageType;

  // Context
  userId?: string;
  calendar?: Calendar;
  trades?: Trade[];

  // Callbacks for interactions
  onTradeClick?: (tradeId: string, contextTrades: Trade[]) => void;
  onEventClick?: (event: EconomicEvent) => void;
  onNoteClick?: (noteId: string, note?: Note) => void;

  // Configuration
  isReadOnly?: boolean;
  showTemplates?: boolean;
  autoScroll?: boolean;
  messageLimit?: number;
  questionTemplates?: QuestionTemplate[];

  // Locally-handled slash commands shown above note-based slash commands.
  // Selecting one consumes the `/term` (no chip) and fires `onSystemCommand`
  // — these are NOT sent to Orion.
  systemCommands?: SystemCommand[];
  onSystemCommand?: (id: string) => void;

  // Conversation id of the rendered messages. Used to filter cross-session
  // notification cards (only show notifications whose origin conversation
  // is NOT the one currently open).
  currentConversationId?: string | null;

  // One-shot scroll target. When set, the interface scrolls the matching
  // message into view and briefly highlights it. Caller is responsible for
  // clearing the target afterwards via onScrolledToMessage.
  scrollToMessageId?: string | null;
  onScrolledToMessage?: () => void;
}

export interface AIChatInterfaceRef {
  focus: () => void;
  scrollToBottom: () => void;
  setInput: (value: string) => void;
  /** Dismiss the slash/mention popup in the chat input if it's open. */
  closeMention: () => void;
}

const AIChatInterface = forwardRef<AIChatInterfaceRef, AIChatInterfaceProps>(({
  messages,
  isLoading,
  isTyping,
  toolExecutionStatus,
  isAtMessageLimit,
  sendMessage,
  cancelRequest,
  setInputForEdit,
  startNewChat,
  setMessages,
  getWelcomeMessage,
  userId,
  calendar,
  trades,
  onTradeClick,
  onEventClick,
  onNoteClick,
  isReadOnly = false,
  showTemplates: showTemplatesProp,
  autoScroll = true,
  messageLimit = 100,
  questionTemplates = defaultQuestionTemplates,
  systemCommands,
  onSystemCommand,
  currentConversationId,
  scrollToMessageId,
  onScrolledToMessage,
}, ref) => {
  const theme = useTheme();
  const tokens = useDialogTokens();
  const {
    violet,
    violetSoft,
    violetSofter,
    violetBorder,
    surfaceInset,
    hairline,
    footerBg,
    monoLabelSx,
    monoSectionLabelSx,
    chipStyle,
    primaryButtonSx,
    destructiveButtonSx,
    iconAvatarSx,
  } = tokens;
  const notificationsCtx = useNotificationsOptional();
  const crossSessionCards = useMemo(
    () =>
      notificationsCtx
        ? notificationsCtx.crossSessionFor(currentConversationId ?? null)
        : [],
    [notificationsCtx, currentConversationId]
  );

  // Collapse sibling fires (same batchId) into a single grouped card. A batch
  // with only one surviving notification renders as a solo card so the UI is
  // identical to a never-batched reminder. Ordering is preserved by the most
  // recent fire's position in the source list (desc by created_at).
  type CrossSessionEntry =
    | { kind: 'solo'; notification: AppNotification }
    | { kind: 'batch'; batchId: string; notifications: AppNotification[] };
  const groupedCrossSessionCards = useMemo<CrossSessionEntry[]>(() => {
    const byBatch = new Map<string, AppNotification[]>();
    const order: Array<{ key: string; isBatch: boolean }> = [];
    const solos = new Map<string, AppNotification>();

    for (const n of crossSessionCards) {
      const batchId = isReminderFiredPayload(n) ? n.payload.batchId ?? null : null;
      if (batchId) {
        if (!byBatch.has(batchId)) {
          byBatch.set(batchId, []);
          order.push({ key: batchId, isBatch: true });
        }
        byBatch.get(batchId)!.push(n);
      } else {
        solos.set(n.id, n);
        order.push({ key: n.id, isBatch: false });
      }
    }

    const entries: CrossSessionEntry[] = [];
    for (const { key, isBatch } of order) {
      if (isBatch) {
        const arr = byBatch.get(key)!;
        if (arr.length === 1) {
          entries.push({ kind: 'solo', notification: arr[0] });
        } else {
          entries.push({ kind: 'batch', batchId: key, notifications: arr });
        }
      } else {
        const n = solos.get(key);
        if (n) entries.push({ kind: 'solo', notification: n });
      }
    }
    return entries;
  }, [crossSessionCards]);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  // Tracks which scrollToMessageId we already highlighted so a later
  // realtime message arrival doesn't re-fire the scroll/highlight on the
  // same target. The dep array still includes `messages` so the first scroll
  // can wait for the target to render — once we've successfully scrolled,
  // this ref short-circuits subsequent runs.
  const lastScrolledMessageIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<AIChatMentionInputHandle | null>(null);

  // Local UI state
  const [inputMessage, setInputMessage] = useState('');
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [mentionWarning, setMentionWarning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Re-entrancy guard: isLoading is only flipped inside sendMessage(), but
  // we await note fetches before reaching that call. Without this ref a
  // double-click on Send fires two parallel requests.
  const sendingRef = useRef(false);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    },
    scrollToBottom: () => {
      const el = messagesAreaRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    },
    setInput: (value: string) => {
      setInputMessage(value);
      // Focus and move the Draft.js caret to the end of the injected text
      // so the user can type their question immediately.
      requestAnimationFrame(() => {
        inputRef.current?.focus?.();
        inputRef.current?.moveCursorToEnd?.();
      });
    },
    closeMention: () => {
      inputRef.current?.closeMention?.();
    }
  }));

  // Auto-scroll to bottom whenever messages change
  // Uses scrollTo on the messages container instead of scrollIntoView
  // to prevent ancestor containers from being scrolled
  const scrollToBottom = useCallback(() => {
    const el = messagesAreaRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (autoScroll && messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom, autoScroll]);

  // Reset the per-target dedup ref whenever a fresh scroll request comes in.
  useEffect(() => {
    if (scrollToMessageId && lastScrolledMessageIdRef.current !== scrollToMessageId) {
      lastScrolledMessageIdRef.current = null;
    }
  }, [scrollToMessageId]);

  // Deep-link: scroll to a specific message and highlight it briefly.
  // Honours prefers-reduced-motion: jumps instantly without easing or fade.
  useEffect(() => {
    if (!scrollToMessageId) return;
    if (lastScrolledMessageIdRef.current === scrollToMessageId) return;
    const container = messagesAreaRef.current;
    if (!container) return;
    const target = container.querySelector(
      `[data-message-id="${scrollToMessageId}"]`
    ) as HTMLElement | null;
    if (!target) return;

    lastScrolledMessageIdRef.current = scrollToMessageId;
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'center',
    });
    setHighlightedMessageId(scrollToMessageId);
    const timeout = window.setTimeout(() => {
      setHighlightedMessageId(null);
      onScrolledToMessage?.();
    }, 1400);
    return () => window.clearTimeout(timeout);
  }, [scrollToMessageId, messages, onScrolledToMessage]);

  // Track scroll position to show/hide the scroll-to-bottom button
  const handleMessagesScroll = useCallback(() => {
    const el = messagesAreaRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollDown(distanceFromBottom > 120);
  }, []);

  // Event Handlers
  const handleSendMessage = async () => {
    const plainText = inputMessage.trim();
    if ((!plainText && attachedImages.length === 0) || isLoading) return;
    if (sendingRef.current) return;
    sendingRef.current = true;
    try {
      const segments = inputRef.current?.getSegments() ?? [];
      const mentionSegs = segments.filter(
        (s): s is Extract<typeof s, { type: 'note-mention' }> => s.type === 'note-mention'
      );
      const mentionedIds = mentionSegs.map(s => s.noteId);
      const notesMap = new Map<string, { title: string; content: string; tags: string[] }>();
      if (mentionedIds.length > 0) {
        const fetched = await Promise.all(mentionedIds.map(id => notesService.getNote(id)));
        fetched.forEach(note => {
          if (note) notesMap.set(note.id, {
            title: note.title,
            content: note.content ?? '',
            tags: note.tags ?? [],
          });
        });

        // Block the send when any referenced note has been deleted —
        // otherwise expandMentionsForSend silently drops the block and the
        // user gets a stray title in their message with no idea why.
        const missing = mentionSegs.filter(s => !notesMap.has(s.noteId));
        if (missing.length > 0) {
          const titles = missing.map(s => `"${s.noteTitle}"`).join(', ');
          const noun = missing.length === 1 ? 'note' : 'notes';
          setMentionWarning(
            `Referenced ${noun} ${titles} no longer exist. Remove the chip or pick a different ${noun} to send.`
          );
          return;
        }
      }
      setMentionWarning(null);

      const outgoing = segments.length > 0
        ? expandMentionsForSend(segments, notesMap)
        : plainText;

      const imagesToSend = attachedImages.length > 0 ? [...attachedImages] : undefined;
      setInputMessage('');
      setAttachedImages([]);
      // Persist segments alongside the message so Edit can rebuild chips.
      const segmentsToPersist = mentionSegs.length > 0 ? segments : undefined;
      await sendMessage(outgoing, imagesToSend, segmentsToPersist);
    } finally {
      sendingRef.current = false;
    }
  };

  // Image upload handlers
  const handleImageUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newImages: AttachedImage[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file type
      if (!file.type.startsWith('image/')) {
        logger.warn('Skipping non-image file:', file.name);
        continue;
      }

      // Limit file size to 10MB
      if (file.size > 10 * 1024 * 1024) {
        logger.warn('Skipping large file:', file.name, file.size);
        continue;
      }

      try {
        const dataUrl = await compressImageToDataUrl(file);

        newImages.push({
          id: crypto.randomUUID(),
          url: dataUrl,
          mimeType: 'image/jpeg',
          name: file.name,
          size: file.size
        });
      } catch (error) {
        logger.error('Error reading file:', error);
      }
    }

    if (newImages.length > 0) {
      setAttachedImages(prev => [...prev, ...newImages].slice(0, MAX_IMAGES));
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (imageId: string) => {
    setAttachedImages(prev => prev.filter(img => img.id !== imageId));
  };

  // Handle paste event for images (Ctrl+V)
  const handlePaste = useCallback(async (event: React.ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    const newImages: AttachedImage[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Check if it's an image
      if (item.type.startsWith('image/')) {
        event.preventDefault(); // Prevent default paste behavior for images

        const file = item.getAsFile();
        if (!file) continue;

        // Limit file size to 10MB
        if (file.size > 10 * 1024 * 1024) {
          logger.warn('Skipping large pasted image:', file.size);
          continue;
        }

        try {
          // Convert to base64 data URL
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          newImages.push({
            id: crypto.randomUUID(),
            url: dataUrl,
            mimeType: file.type,
            name: `pasted-image-${Date.now()}.${file.type.split('/')[1] || 'png'}`,
            size: file.size
          });
        } catch (error) {
          logger.error('Error reading pasted image:', error);
        }
      }
    }

    if (newImages.length > 0) {
      setAttachedImages(prev => [...prev, ...newImages].slice(0, MAX_IMAGES));
    }
  }, []);

  const handleCancelRequest = () => {
    cancelRequest();
  };

  const handleEditMessage = useCallback((messageId: string) => {
    const editData = setInputForEdit(messageId);
    if (editData) {
      if (editData.segments && editData.segments.length > 0) {
        // Rebuild the editor with chip entities. setSegments calls onChange
        // internally to sync the parent's value, so the value-sync effect
        // sees a matching plain text and bails out instead of rebuilding
        // a plain EditorState that would wipe the chips.
        inputRef.current?.setSegments?.(editData.segments);
      } else {
        // Legacy / no-mention message — strip any leftover Referenced blocks
        // and use plain text. User can re-add a slash command via "/".
        setInputMessage(stripReferencedBlocks(editData.content));
      }
      // Restore images when editing
      if (editData.images && editData.images.length > 0) {
        setAttachedImages(editData.images);
      } else {
        setAttachedImages([]);
      }
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [setInputForEdit]);

  // Stable send handler ref so handleKeyPress can stay referentially stable
  // without being re-created every time inputMessage changes.
  const sendRef = useRef<() => void>(() => {});
  sendRef.current = () => { void handleSendMessage(); };

  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendRef.current();
    }
  }, []);

  const handleTemplateClick = useCallback((question: string) => {
    setInputMessage(question);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleNewChat = async () => {
    await startNewChat();
  };

  // Stable per-message callbacks so memoized ChatMessage components don't
  // re-render on every keystroke.
  const handleTradeClick = useCallback((tradeId: string, contextTrades: Trade[]) => {
    if (onTradeClick) {
      onTradeClick(tradeId, contextTrades);
    } else {
      logger.log('Trade clicked but handler not provided:', tradeId);
    }
  }, [onTradeClick]);

  const handleEventClick = useCallback((event: EconomicEvent) => {
    logger.log('Economic event clicked:', event);
    onEventClick?.(event);
  }, [onEventClick]);

  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const handleNoteClick = useCallback(async (noteId: string) => {
    logger.log('Note clicked:', noteId);
    const note = messagesRef.current
      .flatMap(m => m.embeddedNotes ? Object.values(m.embeddedNotes) : [])
      .find(n => n.id === noteId);
    onNoteClick?.(noteId, note || undefined);
  }, [onNoteClick]);

  // Memoize inputs passed to the mention input so its React.memo can stick.
  // calendar.notes is a JSONB mirror of {id, title, tags} maintained by a DB
  // trigger — we can read it directly without a round-trip to the notes table.
  const allTagsMemo = useMemo(() => calendar?.tags || [], [calendar?.tags]);
  const allNotesMemo = useMemo(
    () => (calendar?.notes ?? []).map(n => ({
      id: n.id,
      title: n.title,
      tags: n.tags ?? [],
    })),
    [calendar?.notes]
  );
  const availableTagsMemo = useMemo(() => calendar?.tags || [], [calendar?.tags]);
  const mentionInputSx = useMemo(
    () => ({ flex: 1, minWidth: 0, fontSize: '0.95rem', lineHeight: 1.4 }),
    []
  );

  // Determine what to display
  const displayMessages = messages.length === 0 ? [getWelcomeMessage()] : messages;
  const shouldShowTemplates = showTemplatesProp !== undefined ? showTemplatesProp : messages.length === 0;

  return (
    <Box sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Messages Area */}
      <Box sx={{ flex: 1, position: 'relative', minHeight: 0 }}>
      <Box
        ref={messagesAreaRef}
        onScroll={handleMessagesScroll}
        sx={{
          position: 'absolute',
          inset: 0,
          overflow: 'auto',
          p: 2,
          pb: 1,
          ...scrollbarStyles(theme)
        }}
      >
        {displayMessages.map((message, index) => {
          const isHighlighted = highlightedMessageId === message.id;
          return (
            <Box
              key={message.id}
              data-message-id={message.id}
              sx={{
                borderRadius: 1.5,
                transition: 'background-color 600ms cubic-bezier(0.22, 1, 0.36, 1)',
                backgroundColor: isHighlighted
                  ? alpha(theme.palette.primary.main, 0.12)
                  : 'transparent',
              }}
            >
              {message.metadata?.triggered_by?.startsWith('reminder:') && (
                <ReminderSeparator description={message.metadata.reminder_description} />
              )}
              <ChatMessage
                message={message}
                showTimestamp={true}
                isLatestMessage={index === displayMessages.length - 1}
                onTradeClick={handleTradeClick}
                onEventClick={handleEventClick}
                onNoteClick={handleNoteClick}
                onEdit={handleEditMessage}
                trades={trades}
                availableTags={availableTagsMemo}
              />
            </Box>
          );
        })}

        {/* Cross-session reminder cards: rendered after the message list at
            the chronologically-most-recent end. Each card represents a
            reminder that fired in a DIFFERENT conversation while the user
            was here. UI-only — Orion never sees these. */}
        {groupedCrossSessionCards.map((entry) =>
          entry.kind === 'solo' ? (
            <CrossSessionReminderCard
              key={entry.notification.id}
              notification={entry.notification}
            />
          ) : (
            <CrossSessionReminderBatchCard
              key={entry.batchId}
              notifications={entry.notifications}
            />
          ),
        )}

        {/* Question Templates - Only show when no conversation started */}
        {shouldShowTemplates && (
          <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Welcome avatar + caption */}
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
              mb: 1,
            }}>
              <Box sx={{ ...iconAvatarSx, width: 44, height: 44, borderRadius: 1.5 }}>
                <OrionIcon size={24} />
              </Box>
              <Typography
                component="span"
                sx={{
                  ...monoLabelSx,
                  fontSize: '0.62rem',
                  color: alpha(theme.palette.text.secondary, 0.85),
                }}
              >
                Try these questions
              </Typography>
            </Box>

            {questionTemplates.map((category: QuestionTemplate, categoryIndex: number) => (
              <Box
                key={categoryIndex}
                sx={{
                  p: 1.5,
                  borderRadius: 1.5,
                  backgroundColor: surfaceInset,
                  border: `1px solid ${hairline}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                }}
              >
                <Typography component="span" sx={monoSectionLabelSx}>
                  {category.category}
                </Typography>

                <Box sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 0.75,
                }}>
                  {category.questions.map((question, questionIndex) => (
                    <Box
                      key={questionIndex}
                      component="span"
                      role="button"
                      tabIndex={0}
                      onClick={() => handleTemplateClick(question)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleTemplateClick(question);
                        }
                      }}
                      sx={{
                        ...chipStyle(false),
                        maxWidth: '100%',
                        whiteSpace: 'normal',
                        textAlign: 'left',
                        lineHeight: 1.35,
                      }}
                    >
                      {question}
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}

            <Box sx={{
              mt: 1,
              mb: 2,
              p: 1.5,
              backgroundColor: surfaceInset,
              borderRadius: 1.5,
              border: `1px solid ${hairline}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 0.75,
            }}>
              <Typography component="span" sx={monoSectionLabelSx}>
                Pro Tip
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontSize: '0.82rem',
                  lineHeight: 1.5,
                  color: theme.palette.text.secondary,
                }}
              >
                You can ask complex questions like "I've been struggling with my breakout strategy on Tuesdays. Can you show me all my losing trades tagged 'breakout' that occurred on a Tuesday in the last 6 months, and analyze if there were any specific economic events or market conditions that contributed to these losses?" — I'll analyze your data and provide detailed insights.
              </Typography>
            </Box>
          </Box>
        )}

        {/* Typing Indicator */}
        {isTyping && (
          <Box sx={{ display: 'flex', px: 1, mb: 2 }}>
            <Box sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              px: 1.25,
              py: 0.6,
              borderRadius: 999,
              backgroundColor: surfaceInset,
              border: `1px solid ${hairline}`,
            }}>
              <Box sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: violet,
                boxShadow: `0 0 0 0 ${alpha(violet, 0.5)}`,
                animation: 'orionDotPulse 1.4s ease-in-out infinite',
                '@keyframes orionDotPulse': {
                  '0%, 100%': { opacity: 0.55, transform: 'scale(0.9)' },
                  '50%': { opacity: 1, transform: 'scale(1.1)' },
                },
              }} />
              <Typography
                component="span"
                sx={{
                  ...monoLabelSx,
                  fontSize: '0.66rem',
                  color: theme.palette.text.secondary,
                }}
              >
                {toolExecutionStatus || 'Orion is thinking'}
              </Typography>
            </Box>
          </Box>
        )}

        <div ref={messagesEndRef} />
      </Box>

        {/* Scroll-to-bottom button */}
        {showScrollDown && (
          <Button
            onClick={scrollToBottom}
            size="small"
            aria-label="Scroll to latest"
            sx={{
              ...primaryButtonSx,
              position: 'absolute',
              bottom: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10,
              minWidth: 0,
              px: 1,
              py: 0.5,
              borderRadius: 999,
              boxShadow: `0 0 0 1px ${alpha(violet, 0.35)}, 0 4px 14px ${alpha(violet, 0.35)}`,
              '&:hover': {
                ...(primaryButtonSx as any)['&:hover'],
                boxShadow: `0 0 0 1px ${alpha(violet, 0.45)}, 0 6px 18px ${alpha(violet, 0.45)}`,
              },
            }}
          >
            <ScrollDownIcon sx={{ fontSize: 18 }} />
          </Button>
        )}
      </Box>

      {/* Message Limit Warning */}
      {isAtMessageLimit && (
        <Box sx={{ p: 2, pb: 0 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.5,
              p: 1.5,
              borderRadius: 1.5,
              backgroundColor: alpha(theme.palette.warning.main, 0.08),
              border: `1px solid ${alpha(theme.palette.warning.main, 0.35)}`,
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography
                component="span"
                sx={{
                  ...monoLabelSx,
                  fontSize: '0.66rem',
                  color: theme.palette.warning.main,
                }}
              >
                Conversation Limit Reached
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontSize: '0.82rem',
                  lineHeight: 1.45,
                  color: theme.palette.text.secondary,
                }}
              >
                This conversation has reached the maximum length of {messageLimit} messages.
                Please start a new conversation to continue.
              </Typography>
            </Box>
            <Button
              size="small"
              onClick={handleNewChat}
              startIcon={<NewChatIcon />}
              sx={{
                ...primaryButtonSx,
                flexShrink: 0,
              }}
            >
              Start New Chat
            </Button>
          </Box>
        </Box>
      )}

      {/* Mention Warning (deleted referenced note) */}
      {mentionWarning && (
        <Box sx={{ p: 2, pb: 0 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.5,
              p: 1.5,
              borderRadius: 1.5,
              backgroundColor: alpha(theme.palette.warning.main, 0.08),
              border: `1px solid ${alpha(theme.palette.warning.main, 0.35)}`,
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography
                component="span"
                sx={{
                  ...monoLabelSx,
                  fontSize: '0.66rem',
                  color: theme.palette.warning.main,
                }}
              >
                Missing Reference
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontSize: '0.82rem',
                  lineHeight: 1.45,
                  color: theme.palette.text.secondary,
                }}
              >
                {mentionWarning}
              </Typography>
            </Box>
            <IconButton
              size="small"
              aria-label="Dismiss"
              onClick={() => setMentionWarning(null)}
              sx={{
                color: theme.palette.text.secondary,
                borderRadius: 1.25,
                flexShrink: 0,
                '&:hover': {
                  color: theme.palette.error.main,
                  backgroundColor: alpha(theme.palette.error.main, 0.08),
                },
              }}
            >
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        </Box>
      )}

      {/* Input Area */}
      <Box sx={{
        p: 2,
        borderTop: `1px solid ${hairline}`,
        backgroundColor: footerBg,
      }}>
        {/* Image Preview Section */}
        {attachedImages.length > 0 && (
          <Box sx={{
            display: 'flex',
            gap: 0.75,
            mb: 1.25,
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <Typography
              component="span"
              sx={{
                ...monoLabelSx,
                fontSize: '0.62rem',
                color: attachedImages.length >= MAX_IMAGES
                  ? theme.palette.warning.main
                  : theme.palette.text.secondary,
                mr: 0.5,
              }}
            >
              {attachedImages.length}/{MAX_IMAGES}
            </Typography>
            {attachedImages.map((image) => (
              <Box
                key={image.id}
                sx={{
                  position: 'relative',
                  width: 64,
                  height: 64,
                  borderRadius: 1.25,
                  overflow: 'hidden',
                  backgroundColor: surfaceInset,
                  border: `1px solid ${hairline}`,
                }}
              >
                <Box
                  component="img"
                  src={image.url}
                  alt={image.name || 'Attached image'}
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
                <IconButton
                  size="small"
                  aria-label="Remove image"
                  onClick={() => handleRemoveImage(image.id)}
                  sx={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    width: 20,
                    height: 20,
                    backgroundColor: alpha(theme.palette.background.paper, 0.85),
                    color: theme.palette.text.secondary,
                    border: `1px solid ${hairline}`,
                    borderRadius: 1,
                    transition: 'all 120ms ease',
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.error.main, 0.12),
                      color: theme.palette.error.main,
                      borderColor: alpha(theme.palette.error.main, 0.4),
                    },
                  }}
                >
                  <CloseIcon sx={{ fontSize: 12 }} />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleImageSelect}
        />

        <Box
          onPaste={handlePaste}
          sx={{
            display: 'flex',
            gap: 0.75,
            alignItems: 'center',
            backgroundColor: surfaceInset,
            borderRadius: 1.5,
            p: 0.75,
            border: `1px solid ${hairline}`,
            transition: 'all 120ms ease',
            '&:hover': { borderColor: alpha(violet, 0.5) },
            '&:focus-within': {
              borderColor: violet,
              boxShadow: `0 0 0 1px ${alpha(violet, 0.25)}`,
            },
          }}
        >
          <AIChatMentionInput
            ref={inputRef}
            value={inputMessage}
            onChange={setInputMessage}
            onKeyDown={handleKeyPress}
            placeholder={calendar ? "Ask Orion… (use @ to mention)" : "Ask Orion about your trading..."}
            disabled={isLoading || isAtMessageLimit}
            allTags={allTagsMemo}
            allNotes={allNotesMemo}
            systemCommands={systemCommands}
            onSystemCommand={onSystemCommand}
            maxRows={4}
            sx={mentionInputSx}
          />
          {/* Image upload button — ghost icon, violet hover */}
          <IconButton
            aria-label="Attach image"
            onClick={handleImageUploadClick}
            disabled={isReadOnly || isLoading || isAtMessageLimit || attachedImages.length >= MAX_IMAGES}
            size="small"
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1.25,
              color: attachedImages.length > 0 ? violet : theme.palette.text.secondary,
              backgroundColor: attachedImages.length > 0 ? violetSoft : 'transparent',
              border: `1px solid ${attachedImages.length > 0 ? violetBorder : 'transparent'}`,
              transition: 'all 120ms ease',
              '&:hover': {
                backgroundColor: violetSofter,
                color: violet,
              },
              '&:disabled': {
                color: theme.palette.action.disabled,
                backgroundColor: 'transparent',
                borderColor: 'transparent',
              },
            }}
          >
            <ImageIcon sx={{ fontSize: 18 }} />
          </IconButton>
          {isLoading ? (
            <Button
              aria-label="Stop generating"
              onClick={handleCancelRequest}
              size="small"
              startIcon={<StopIcon sx={{ fontSize: 14 }} />}
              sx={{
                ...destructiveButtonSx,
                minWidth: 0,
                px: 1.5,
                py: 0.625,
                height: 32,
                gap: 0.25,
                fontSize: '0.82rem',
                '& .MuiButton-startIcon': { mr: 0.625 },
              }}
            >
              Stop
            </Button>
          ) : (
            <Button
              aria-label="Send message"
              onClick={handleSendMessage}
              disabled={(!inputMessage.trim() && attachedImages.length === 0) || isAtMessageLimit}
              size="small"
              endIcon={<SendIcon sx={{ fontSize: 14, transform: 'rotate(-12deg)' }} />}
              sx={{
                ...primaryButtonSx,
                minWidth: 0,
                px: 1.5,
                py: 0.625,
                height: 32,
                gap: 0.25,
                fontSize: '0.82rem',
                '& .MuiButton-endIcon': { ml: 0.625 },
              }}
            >
              Send
            </Button>
          )}
        </Box>

        {/* Helper Text */}
        <Typography
          component="span"
          sx={{
            ...monoSectionLabelSx,
            mt: 1,
            display: 'block',
            textAlign: 'center',
            fontSize: '0.6rem',
            opacity: 0.8,
          }}
        >
          {`Enter to send • Shift+Enter newline • / for commands • @ for notes & tags • Up to ${MAX_IMAGES} images`}
        </Typography>
      </Box>

    </Box>
  );
});

AIChatInterface.displayName = 'AIChatInterface';

export default AIChatInterface;
