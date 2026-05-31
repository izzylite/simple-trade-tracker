/**
 * AIChatInterface Component
 * Reusable AI chat interface that can be embedded in different containers
 * Contains: Messages, Templates, Typing Indicator, Input Area
 */

import React, { useRef, useEffect, useCallback, useMemo, useState, forwardRef, useImperativeHandle } from 'react';
import OrionMark from 'features/orion/components/aiChat/OrionMark';
import { useOrionExpression } from 'features/orion/hooks/useOrionExpression';
import {
  Box,
  IconButton,
  Button,
  Tooltip,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  alpha
} from '@mui/material';
import {
  Send as SendIcon,
  AddComment as NewChatIcon,
  Stop as StopIcon,
  Image as ImageIcon,
  Close as CloseIcon,
  KeyboardArrowDown as ScrollDownIcon,
  InfoOutlined as InfoIcon,
} from '@mui/icons-material';
import { useDialogTokens } from 'styles/dialogTokens';
import ChatMessage from 'features/orion/components/aiChat/ChatMessage';
import ReminderSeparator from 'features/orion/components/aiChat/ReminderSeparator';
import CrossSessionReminderCard from 'components/notifications/CrossSessionReminderCard';
import CrossSessionReminderBatchCard from 'components/notifications/CrossSessionReminderBatchCard';
import { useNotificationsOptional } from 'contexts/NotificationsContext';
import {
  AppNotification,
  isReminderFiredPayload,
} from 'types/notification';
import AIChatMentionInput from 'features/orion/components/aiChat/AIChatMentionInput';
import type { AIChatMentionInputHandle, SystemCommand } from 'features/orion/components/aiChat/AIChatMentionInput';
import {
  ChatMessage as ChatMessageType,
  AttachedImage,
  ThinkingLevel,
  THINKING_LEVEL_OPTIONS,
  DEFAULT_THINKING_LEVEL,
  THINKING_LEVEL_STORAGE_KEY,
} from 'features/orion/types/aiChat';
import { Trade } from 'features/calendar/types/trade';
import { Calendar } from 'features/calendar/types/calendar';
import { EconomicEvent } from 'features/events/types/economicCalendar';
import { Note } from 'features/notes/types/note';
import { scrollbarStyles } from 'styles/scrollbarStyles';
import { Z_INDEX } from 'styles/zIndex';
import { logger } from 'utils/logger';
import { compressImageToDataUrl } from 'utils/fileValidation';
import * as notesService from 'features/notes/services/notesService';
import { expandMentionsForSend, stripReferencedBlocks, tokenizeSegmentsWithTags } from 'features/orion/utils/chatMentions';
import { OrionUpgradeCard } from 'features/billing/components/OrionUpgradeCard';
import type { OrionBlockedState } from 'features/orion/hooks/useAIChat';

// Image limit for AI agent requests (must match backend MAX_IMAGES_PER_REQUEST)
const MAX_IMAGES = 4;

// Per-message character cap. ~12.5K English tokens — catches an
// accidental long paste (log, CSV, article body) before any network
// round-trip. Backend has a tighter byte cap (200KB ≈ same order of
// magnitude after UTF-8 + mention expansion) as defense in depth.
const MAX_USER_MESSAGE_CHARS = 50_000;
// Start surfacing a character counter when within this many chars of the cap.
const CHAR_COUNTER_WARN_AT = MAX_USER_MESSAGE_CHARS - 5_000;

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
  /** True when the conversation has reached its estimated token budget. */
  isAtContextLimit: boolean;
  /** Estimated tokens consumed by the current conversation. */
  tokenUsage: number;
  /** Effective token budget for the current conversation. */
  tokenBudget: number;
  /**
   * Non-null when the most recent send was rejected by the ai-trading-agent
   * edge function because the user is on a non-paid tier or has exhausted
   * their Orion token budget. Renders <OrionUpgradeCard /> in place of the
   * empty assistant reply.
   */
  blockedState: OrionBlockedState | null;

  // Actions from useAIChat hook
  sendMessage: (messageText: string, images?: AttachedImage[], segments?: ChatMessageType['segments'], thinkingLevel?: string) => Promise<void>;
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
  isAtContextLimit,
  tokenUsage,
  tokenBudget,
  blockedState,
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
  const orionExpression = useOrionExpression(isLoading, messages.length, {
    toolStatus: toolExecutionStatus,
  });
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

  // Reasoning depth (Fast / Balanced / Deep). Seeded from localStorage so the
  // user's last choice sticks across sends and sessions; sent per-request to
  // ai-trading-agent, which maps it to Gemini's thinkingLevel. Market research
  // is unaffected — it runs on a separate batch path.
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>(() => {
    try {
      const stored = localStorage.getItem(THINKING_LEVEL_STORAGE_KEY);
      if (stored && THINKING_LEVEL_OPTIONS.some(o => o.value === stored)) {
        return stored as ThinkingLevel;
      }
    } catch {
      /* localStorage unavailable (private mode / SSR) — fall through */
    }
    return DEFAULT_THINKING_LEVEL;
  });

  const handleThinkingLevelChange = useCallback(
    (_e: React.MouseEvent<HTMLElement>, next: ThinkingLevel | null) => {
      if (!next) return; // ignore deselect (ToggleButtonGroup fires null on re-click)
      setThinkingLevel(next);
      try {
        localStorage.setItem(THINKING_LEVEL_STORAGE_KEY, next);
      } catch {
        /* non-fatal — choice still applies for this session */
      }
    },
    [],
  );
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

      // Hard guard on outgoing message length — checked AFTER mention
      // expansion since a single @note chip can balloon into several KB
      // of body text. Backend has a matching byte cap as defense in
      // depth; this surfaces the limit before the network round-trip.
      if (outgoing.length > MAX_USER_MESSAGE_CHARS) {
        setMentionWarning(
          `Message is too long (${outgoing.length.toLocaleString()} characters; limit is ` +
            `${MAX_USER_MESSAGE_CHARS.toLocaleString()}). Try splitting it into smaller chunks ` +
            `or referencing fewer notes.`
        );
        return;
      }

      const imagesToSend = attachedImages.length > 0 ? [...attachedImages] : undefined;
      setInputMessage('');
      setAttachedImages([]);
      // Persist segments alongside the message so Edit can rebuild chips.
      const segmentsToPersist = mentionSegs.length > 0 ? segments : undefined;
      await sendMessage(outgoing, imagesToSend, segmentsToPersist, thinkingLevel);
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
          // Same compression path as the file picker: scale to 1600px on the
          // long edge + re-encode as JPEG. Without this, raw clipboard PNGs
          // (~5-10MB each) ship at full resolution and can blow past Gemini's
          // 20MB inline-payload limit when 4 are attached.
          //
          // Quality bumped from the default 0.85 → 0.92 because the dominant
          // paste use case in a trading app is chart/UI screenshots, which
          // contain small anti-aliased text and flat-color regions where
          // 0.85 introduces visible JPEG ringing.
          const dataUrl = await compressImageToDataUrl(file, 1600, 0.92);

          newImages.push({
            id: crypto.randomUUID(),
            url: dataUrl,
            mimeType: 'image/jpeg',
            name: `pasted-image-${Date.now()}.jpg`,
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
      // Base segments: persisted ones (note mentions) if present, otherwise a
      // single text segment from the stripped content (legacy / tag-only).
      // Then re-derive tag chips from the known tag list — tags travel the
      // wire as plain text, so without this they'd drop into the editor as raw
      // text instead of chips (same reconstruction the read-only bubble does).
      const baseSegments = editData.segments && editData.segments.length > 0
        ? editData.segments
        : [{ type: 'text' as const, value: stripReferencedBlocks(editData.content) }];
      const tokenized = tokenizeSegmentsWithTags(baseSegments, calendar?.tags || []);
      const hasChips = tokenized.some(s => s.type !== 'text');
      if (hasChips) {
        // Rebuild the editor with chip entities. setSegments calls onChange
        // internally to sync the parent's value, so the value-sync effect
        // sees a matching plain text and bails out instead of rebuilding
        // a plain EditorState that would wipe the chips.
        inputRef.current?.setSegments?.(tokenized);
      } else {
        // Pure text (no mentions, no tags) — keep the plain-text path so
        // multi-line messages stay split into proper blocks.
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
  }, [setInputForEdit, calendar?.tags]);

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
      {/* Context budget meter — sits flush at the very top of the chat
          surface (just below the parent's tab row) so users see usage
          accumulating without scanning to the input.
          - Hidden until the conversation has any real user/assistant turn.
          - <85%: edge-to-edge 2px line with a tiny % chip floated right.
          - ≥85% (or at limit): expands into an inline banner with copy +
            Start-New-Chat CTA when budget is exhausted. */}
      {(() => {
        const realTurns = messages.filter(
          (m) => m.id !== 'welcome' && (m.role === 'user' || m.role === 'assistant'),
        ).length;
        if (realTurns === 0) return null;
        const usagePct = tokenBudget > 0
          ? Math.min(100, Math.round((tokenUsage / tokenBudget) * 100))
          : 0;
        const meterColor = isAtContextLimit
          ? theme.palette.error.main
          : usagePct >= 85
            ? theme.palette.warning.main
            : violet;
        const showAlert = usagePct >= 85 || isAtContextLimit;

        if (!showAlert) {
          return (
            <Box sx={{ position: 'relative', flexShrink: 0 }}>
              <Box
                role="progressbar"
                aria-label="Conversation context budget"
                aria-valuenow={usagePct}
                aria-valuemin={0}
                aria-valuemax={100}
                sx={{
                  width: '100%',
                  height: 2,
                  backgroundColor: alpha(meterColor, 0.14),
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    width: `${Math.max(usagePct, 1)}%`,
                    height: '100%',
                    backgroundColor: alpha(meterColor, 0.75),
                    transition: 'width 240ms ease',
                  }}
                />
              </Box>
              <Typography
                component="span"
                sx={{
                  ...monoLabelSx,
                  position: 'absolute',
                  top: 4,
                  right: 8,
                  fontSize: '0.58rem',
                  color: theme.palette.text.secondary,
                  pointerEvents: 'none',
                }}
              >
                {usagePct}%
              </Typography>
            </Box>
          );
        }

        return (
          <Box sx={{ p: 1.5, pb: 0, flexShrink: 0 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.5,
                p: 1.5,
                borderRadius: 1.5,
                backgroundColor: alpha(meterColor, 0.08),
                border: `1px solid ${alpha(meterColor, 0.35)}`,
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                    <Typography
                      component="span"
                      sx={{
                        ...monoLabelSx,
                        fontSize: '0.66rem',
                        color: meterColor,
                      }}
                    >
                      {isAtContextLimit ? 'Context Budget Reached' : 'Context Budget'}
                    </Typography>
                    <Tooltip
                      title={isAtContextLimit
                        ? 'This conversation has used its context budget. Start a new chat to keep responses sharp.'
                        : 'This conversation is getting long. Responses may start to drift — consider starting a new chat soon.'}
                      arrow
                      placement="top"
                      enterTouchDelay={0}
                      leaveTouchDelay={4000}
                    >
                      <InfoIcon
                        sx={{
                          fontSize: '0.85rem',
                          color: meterColor,
                          opacity: 0.7,
                          cursor: 'help',
                          '&:hover': { opacity: 1 },
                        }}
                      />
                    </Tooltip>
                  </Box>
                  <Typography
                    component="span"
                    sx={{
                      ...monoLabelSx,
                      fontSize: '0.66rem',
                      color: meterColor,
                    }}
                  >
                    {usagePct}%
                  </Typography>
                </Box>
                <Box
                  role="progressbar"
                  aria-label="Conversation context budget"
                  aria-valuenow={usagePct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  sx={{
                    width: '100%',
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: alpha(meterColor, 0.18),
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      width: `${usagePct}%`,
                      height: '100%',
                      backgroundColor: meterColor,
                      transition: 'width 240ms ease',
                    }}
                  />
                </Box>
              </Box>
              {isAtContextLimit && (
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
              )}
            </Box>
          </Box>
        );
      })()}

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

        {/* Tier/budget block card: rendered when the ai-trading-agent edge
            function rejected the most recent send because the user is on a
            non-paid tier or has exhausted their Orion token budget. Sits in
            the scroll container so it scrolls with the messages and visually
            replaces the empty assistant reply. */}
        {blockedState && (
          <OrionUpgradeCard
            reason={blockedState.reason}
            resetAt={blockedState.resetAt}
            tokensConsumed={blockedState.tokensConsumed}
            tokensBudget={blockedState.tokensBudget}
          />
        )}

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
                <OrionMark
                  size={24}
                  state={orionExpression.state}
                  runId={orionExpression.runId}
                  color={violet}
                  catchColor={violetSoft}
                />
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

        {/* Reasoning depth — Fast / Balanced / Deep. Sets Gemini's thinking
            level for the next send; choice is remembered locally. Market
            research is unaffected (separate batch path). */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 0.75 }}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={thinkingLevel}
            onChange={handleThinkingLevelChange}
            disabled={isReadOnly || isLoading}
            aria-label="Reasoning depth"
            sx={{
              '& .MuiToggleButton-root': {
                px: 1.25,
                py: 0.25,
                fontSize: '0.68rem',
                lineHeight: 1.4,
                textTransform: 'none',
                border: `1px solid ${hairline}`,
                color: theme.palette.text.secondary,
                '&.Mui-selected': {
                  color: violet,
                  backgroundColor: violetSoft,
                  '&:hover': { backgroundColor: violetSofter },
                },
              },
            }}
          >
            {THINKING_LEVEL_OPTIONS.map(opt => (
              <Tooltip key={opt.value} title={opt.hint} placement="top">
                <ToggleButton value={opt.value} aria-label={opt.label}>
                  {opt.label}
                </ToggleButton>
              </Tooltip>
            ))}
          </ToggleButtonGroup>
        </Box>

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
            disabled={isLoading || isAtContextLimit}
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
            disabled={isReadOnly || isLoading || isAtContextLimit || attachedImages.length >= MAX_IMAGES}
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
              disabled={
                (!inputMessage.trim() && attachedImages.length === 0) ||
                isAtContextLimit ||
                inputMessage.length > MAX_USER_MESSAGE_CHARS
              }
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

        {/* Helper Text + char counter (counter only renders when nearing the cap) */}
        <Box
          sx={{
            mt: 0.875,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          <Typography
            component="span"
            sx={{
              fontSize: '0.68rem',
              fontWeight: 400,
              letterSpacing: 0,
              textTransform: 'none',
              lineHeight: 1.5,
              color: alpha(theme.palette.text.secondary, 0.7),
            }}
          >
            {`Enter to send · Shift+Enter newline · / for commands · @ for notes & tags · Up to ${MAX_IMAGES} images`}
          </Typography>
          {inputMessage.length >= CHAR_COUNTER_WARN_AT && (
            <Typography
              component="span"
              sx={{
                fontSize: '0.68rem',
                fontWeight: 600,
                lineHeight: 1.5,
                color: inputMessage.length > MAX_USER_MESSAGE_CHARS
                  ? theme.palette.error.main
                  : theme.palette.warning.main,
              }}
            >
              {`${inputMessage.length.toLocaleString()} / ${MAX_USER_MESSAGE_CHARS.toLocaleString()}`}
            </Typography>
          )}
        </Box>
      </Box>

    </Box>
  );
});

AIChatInterface.displayName = 'AIChatInterface';

export default AIChatInterface;
