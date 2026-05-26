/**
 * useAIChat Hook
 * Reusable hook for AI chat functionality
 * Extracts core AI chat logic for use across different UI components
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  ChatMessage as ChatMessageType,
  AIConversation,
  AttachedImage
} from 'features/orion/types/aiChat';
import { Calendar } from 'features/calendar/types/calendar';
import { Trade } from 'features/calendar/types/trade';
import { supabaseAIChatService, type ConversationGate } from 'features/orion/services/supabaseAIChatService';
import { generateConversationTitle } from 'features/orion/utils/conversationTitle';
import {
  ConversationRepository,
  ConversationPaginationOptions
} from 'services/repositories/ConversationRepository';
import { logger } from 'utils/logger';
import { supabase } from 'config/supabase';

const CONVERSATIONS_PAGE_SIZE = 15;

const TOOL_LABELS: Record<string, string> = {
  execute_sql: 'Querying database',
  search_web: 'Searching web',
  scrape_url: 'Reading article',
  analyze_image: 'Analyzing chart',
  generate_chart: 'Generating chart',
  get_market_data: 'Fetching market data',
  update_memory: 'Updating memory',
  apply_rule_change: 'Updating memory',
  get_recent_orion_briefings: 'Reading briefings',
  // Merged action-dispatched tools — generic fallbacks
  manage_note: 'Working with notes',
  manage_event: 'Episodic memory',
  manage_tag: 'Working with tags',
  recall_conversations: 'Searching conversations',
  manage_reminder: 'Working with reminders',
  // Merged tools — per-action labels (resolved via `${name}:${action}`)
  'manage_note:create': 'Creating note',
  'manage_note:update': 'Updating note',
  'manage_note:delete': 'Deleting note',
  'manage_note:search': 'Searching notes',
  'manage_event:record': 'Logging event',
  'manage_event:recall': 'Recalling events',
  'manage_tag:get': 'Looking up tag',
  'manage_tag:save': 'Saving tag definition',
  'recall_conversations:search': 'Searching conversations',
  'recall_conversations:get': 'Loading conversation',
  'manage_reminder:set': 'Setting reminder',
  'manage_reminder:list': 'Checking reminders',
  'manage_reminder:cancel': 'Cancelling reminder',
  'manage_reminder:edit': 'Editing reminder',
  code_execution: 'Running code',
  'get_market_data:quote': 'Checking market price',
  'get_market_data:history': 'Pulling historical candles',
  'get_market_data:indicator': 'Computing indicator',
  'get_market_data:search': 'Searching symbols',
};

const labelForToolCall = (name: string, args?: unknown): string => {
  const action =
    args && typeof args === 'object' && typeof (args as Record<string, unknown>).action === 'string'
      ? (args as Record<string, unknown>).action as string
      : undefined;
  if (action && TOOL_LABELS[`${name}:${action}`]) return TOOL_LABELS[`${name}:${action}`];
  if (TOOL_LABELS[name]) return TOOL_LABELS[name];
  // User-defined webhook tools — strip the internal `user_tool_` namespace
  // prefix (kept in sync with _shared/toolLabels.ts).
  if (name.startsWith('user_tool_')) return name.slice('user_tool_'.length);
  return name;
};

/**
 * Local UI state for a tier/budget-blocked Orion response. Mirrors the
 * `blocked` payload emitted by ai-trading-agent
 * (`supabase/functions/ai-trading-agent/index.ts:2531-2541`). Surfaced
 * via the hook's return so the chat surface can render an upgrade card
 * instead of an empty assistant bubble.
 */
export interface OrionBlockedState {
  reason: 'orion_paid_only' | 'orion_budget_exhausted';
  tier: 'free' | 'lite' | 'pro' | 'elite';
  resetAt: string | null;
  tokensConsumed: number | null;
  tokensBudget: number | null;
}

export interface UseAIChatOptions {
  userId: string | undefined;
  calendar?: Calendar;
  trade?: Trade;
  autoSaveConversation?: boolean;
  /**
   * When true, conversations save to userId only (calendar_id = null)
   * even when a calendar is provided for AI context.
   * Used by Home page where calendar selection changes AI context
   * but conversations should persist independently of any calendar.
   */
  saveAsUserLevel?: boolean;
}

export interface UseAIChatReturn {
  // State
  messages: ChatMessageType[];
  isLoading: boolean;
  isTyping: boolean;
  toolExecutionStatus: string;
  currentConversationId: string | null;
  conversations: AIConversation[];
  loadingConversations: boolean;
  loadingMoreConversations: boolean;
  /** True while the messages JSONB for the just-selected conversation is
   *  being fetched. Drives the skeleton bubbles in the chat surface. */
  loadingMessages: boolean;
  hasMoreConversations: boolean;
  totalConversationsCount: number;
  /** True once the server-published gate.used reaches gate.softLimit — input is locked. */
  isAtContextLimit: boolean;
  /** Server-published prompt tokens used by the current conversation (alias for gate.used). */
  tokenUsage: number;
  /** Server-published soft limit the UI locks against (alias for gate.softLimit). */
  tokenBudget: number;
  editingMessageId: string | null;
  /** Set when the agent returns a blocked tier/budget response. Null otherwise.
   *  Cleared on the next successful send and on conversation switch / new chat. */
  blockedState: OrionBlockedState | null;

  // Actions
  sendMessage: (messageText: string, images?: AttachedImage[], segments?: ChatMessageType['segments']) => Promise<void>;
  cancelRequest: () => void;
  editMessage: (messageId: string) => string | null;
  setInputForEdit: (messageId: string) => { content: string; images?: AttachedImage[]; segments?: ChatMessageType['segments'] } | null;
  clearEditingState: () => void;

  // Conversation management
  loadConversations: () => Promise<void>;
  loadMoreConversations: () => Promise<void>;
  /** Run a server-side ILIKE search against the `searchable` column (scoped
   *  to the current context — calendar / trade / userLevel) and swap the
   *  history list with the results. Pass an empty / sub-2-char string to
   *  exit search mode and reload the default first page. */
  searchConversations: (query: string) => Promise<void>;
  /** Server-side pinned-only filter (true ⇒ list only pinned). */
  pinnedOnly: boolean;
  /** Toggle the pinned filter and trigger a reload in the current mode. */
  setPinnedFilter: (value: boolean) => Promise<void>;
  selectConversation: (conversation: AIConversation) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<boolean>;
  togglePinConversation: (conversationId: string) => Promise<boolean>;
  startNewChat: () => Promise<void>;

  // Message management
  setMessages: React.Dispatch<React.SetStateAction<ChatMessageType[]>>;

  // Utilities
  getWelcomeMessage: () => ChatMessageType;
}

// Fallback defaults for the gate before the server has published one
// (brand-new chat, or a row whose last_prompt_tokens is still NULL).
// Server overrides these on the first done event and on findById.
const GATE_DEFAULT_SOFT = 80_000;
const GATE_DEFAULT_HARD = 250_000;

export function useAIChat({
  userId,
  calendar,
  trade,
  autoSaveConversation = true,
  saveAsUserLevel = false,
}: UseAIChatOptions): UseAIChatReturn {
  // State
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [toolExecutionStatus, setToolExecutionStatus] = useState<string>('');
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMoreConversations, setLoadingMoreConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  // When non-null, the history list reflects server-side search results
  // for this query (scoped to the current calendar/trade/userLevel).
  // `loadMoreConversations` consults this to decide which paginator to call.
  // Cleared by `loadConversations()` and by `searchConversations('')`.
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const searchQueryRef = useRef<string | null>(null);
  searchQueryRef.current = searchQuery;
  // Server-side pinned-only filter. Mirrored to a ref so the loadMore /
  // search callbacks can read the current value without rebinding on every
  // toggle (they already depend on enough things).
  const [pinnedOnly, setPinnedOnlyState] = useState(false);
  const pinnedOnlyRef = useRef(false);
  pinnedOnlyRef.current = pinnedOnly;
  // Monotonic request token. Every conversation list fetch (load / search /
  // loadMore) increments this and checks it before writing — so if a newer
  // fetch started before an older one resolves (rapid filter toggle, scope
  // switch mid-loadMore, search debounce overlap), the older write is
  // discarded. Prevents stale-overwrite flicker that the query-only guards
  // can't catch when scope changes between fetches.
  const loadTokenRef = useRef(0);
  const [totalConversationsCount, setTotalConversationsCount] = useState(0);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  // Server-published gate. Seeded from `last_prompt_tokens` on
  // selectConversation; updated on every streaming `done` event; reset on
  // startNewChat. Defaults model a fresh conversation (0 used); server
  // overrides on first turn.
  const [gateUsed, setGateUsed] = useState<number>(0);
  const [gateSoftLimit, setGateSoftLimit] = useState<number>(GATE_DEFAULT_SOFT);
  const [_gateHardLimit, setGateHardLimit] = useState<number>(GATE_DEFAULT_HARD);
  // Set when ai-trading-agent returns a tier/budget-blocked response. Drives
  // the OrionUpgradeCard in the chat surface. Cleared on any new successful
  // send, conversation switch, or startNewChat.
  const [blockedState, setBlockedState] = useState<OrionBlockedState | null>(null);

  const tokenUsage = gateUsed;
  const tokenBudget = gateSoftLimit;
  const isAtContextLimit = gateUsed >= gateSoftLimit;

  // Refs
  const conversationRepo = useRef(new ConversationRepository()).current;
  const abortControllerRef = useRef<AbortController | null>(null);
  const cancelRequestedRef = useRef(false);
  const activeRequestRef = useRef<{ userId: string; aiId: string } | null>(null);
  const messageUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingTextRef = useRef<string>('');
  const embedChannelIdRef = useRef(
    `ai-chat-embeds-pg-${Math.random().toString(36).slice(2, 8)}`
  );

  // Live-patch embeddedNotes / embeddedTrades snapshots inside chat messages
  // when the underlying row changes. Without this, a chip rendered in turn N
  // keeps showing pre-update content even after Orion edits the row in turn
  // N+1, and the detail dialog opens stale.
  useEffect(() => {
    if (!userId) return;

    const patchEmbed = (
      key: 'embeddedNotes' | 'embeddedTrades',
      eventType: string,
      newRow: { id?: string } | undefined,
      oldRow: { id?: string } | undefined,
    ) => {
      const changedId = newRow?.id || oldRow?.id;
      if (!changedId) return;
      setMessages(prev => {
        let touched = false;
        const next = prev.map(msg => {
          const embedded = (msg as any)[key] as Record<string, any> | undefined;
          if (!embedded || !embedded[changedId]) return msg;
          touched = true;
          const nextEmbedded = { ...embedded };
          if (eventType === 'DELETE') {
            delete nextEmbedded[changedId];
          } else if (newRow) {
            nextEmbedded[changedId] = { ...embedded[changedId], ...newRow };
          }
          return { ...msg, [key]: nextEmbedded };
        });
        return touched ? next : prev;
      });
    };

    const channel = supabase
      .channel(embedChannelIdRef.current)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes' },
        (payload: any) => patchEmbed('embeddedNotes', payload.eventType, payload.new, payload.old)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trades' },
        (payload: any) => patchEmbed('embeddedTrades', payload.eventType, payload.new, payload.old)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Listen for reminder-fired messages on the active conversation. The reminder
  // fire path runs entirely server-side (cron → dispatch-reminders →
  // ai-trading-agent in mode='reminder' → ai_conversations.messages append),
  // so without realtime the open chat doesn't see the new message until next
  // mount. We dedupe by id and only adopt messages tagged with
  // metadata.triggered_by='reminder:...' to avoid fighting the optimistic
  // streaming UI on normal chat sends (where client and server use different
  // message ids).
  //
  // Backfill: on (re)subscribe we also fetch the conversation row once and
  // merge any reminder messages we missed. Without this, fires that happen
  // while the chat panel is closed never reach local state — the UI shows
  // stale messages from the conversations-list cache until next full mount.
  useEffect(() => {
    if (!currentConversationId) return;

    const mergeReminderMessages = (incoming: unknown): void => {
      const arr = Array.isArray(incoming) ? incoming : [];
      const reminderMsgs = arr.filter(
        (m: any) =>
          m && typeof m === 'object' &&
          typeof m.metadata?.triggered_by === 'string' &&
          m.metadata.triggered_by.startsWith('reminder:')
      );
      if (reminderMsgs.length === 0) return;
      setMessages(prev => {
        const have = new Set(prev.map(m => m.id));
        const toAppend = reminderMsgs.filter((m: any) => !have.has(m.id));
        if (toAppend.length === 0) return prev;
        // Convert stored timestamps (ISO strings) back to Date for the UI.
        const normalized = toAppend.map((m: any) => ({
          ...m,
          timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
        }));
        return [...prev, ...normalized];
      });
    };

    // Refresh the gate meter when the row's last_prompt_tokens changes —
    // happens on every reminder fire (which writes a new assistant message
    // via appendAssistantMessage). Without this the meter stays stale until
    // the user re-selects the conversation.
    const refreshGateFromRow = (next: unknown): void => {
      const lpt = (next as { last_prompt_tokens?: unknown } | null | undefined)
        ?.last_prompt_tokens;
      if (typeof lpt === 'number' && Number.isFinite(lpt) && lpt >= 0) {
        setGateUsed(lpt);
      }
    };

    const channel = supabase
      .channel(`ai-convo-realtime-${currentConversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ai_conversations',
          filter: `id=eq.${currentConversationId}`,
        },
        (payload: any) => {
          mergeReminderMessages(payload?.new?.messages);
          refreshGateFromRow(payload?.new);
        }
      )
      .subscribe((status) => {
        // SUBSCRIBED fires on first subscribe AND every reconnect — backfill
        // each time so any reminder fires that landed during a disconnect
        // (or while the panel was closed) get adopted on reopen/reconnect.
        if (status !== 'SUBSCRIBED') return;
        void conversationRepo.findById(currentConversationId).then((convo) => {
          if (!convo) return;
          mergeReminderMessages(convo.messages);
          refreshGateFromRow(convo);
        });
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentConversationId, conversationRepo]);

  /**
   * Resolve the active history scope from the current chat context.
   * Centralized so loadConversations, loadMoreConversations, and
   * searchConversations all dispatch identically.
   */
  const getActiveScope = useCallback(():
    | { kind: 'trade'; tradeId: string }
    | { kind: 'calendar'; calendarId: string }
    | { kind: 'user'; userId: string }
    | null => {
    if (trade?.id) return { kind: 'trade', tradeId: trade.id };
    if (calendar?.id && !saveAsUserLevel) {
      return { kind: 'calendar', calendarId: calendar.id };
    }
    if (userId) return { kind: 'user', userId };
    return null;
  }, [trade?.id, calendar?.id, saveAsUserLevel, userId]);

  /**
   * Load conversations - either trade-specific or calendar-level
   * If trade is provided: loads trade-specific conversations
   * If only calendar: loads calendar-level conversations (without trade_id)
   * Resets pagination and loads first page. Also exits search mode if
   * the caller was in it — calendar/trade context changes should always
   * land on the default list.
   */
  const loadConversations = useCallback(async () => {
    setSearchQuery(null);
    const pinned = pinnedOnlyRef.current;
    const token = ++loadTokenRef.current;
    // Trade-specific: load conversations for this trade
    if (trade?.id) {
      setLoadingConversations(true);
      try {
        const result = await conversationRepo.findByTradeId(trade.id, {
          limit: CONVERSATIONS_PAGE_SIZE,
          offset: 0,
          pinnedOnly: pinned,
        });
        if (token !== loadTokenRef.current) return;
        setConversations(result.conversations);
        setHasMoreConversations(result.hasMore);
        setTotalConversationsCount(result.totalCount);
      } catch (error) {
        logger.error('Error loading trade conversations:', error);
      } finally {
        if (token === loadTokenRef.current) setLoadingConversations(false);
      }
      return;
    }

    // Calendar-level: load conversations without trade_id
    // (skip if saveAsUserLevel — always use user-level storage)
    if (calendar?.id && !saveAsUserLevel) {
      setLoadingConversations(true);
      try {
        const result = await conversationRepo.findByCalendarId(calendar.id, {
          limit: CONVERSATIONS_PAGE_SIZE,
          offset: 0,
          pinnedOnly: pinned,
        });
        if (token !== loadTokenRef.current) return;
        setConversations(result.conversations);
        setHasMoreConversations(result.hasMore);
        setTotalConversationsCount(result.totalCount);
      } catch (error) {
        logger.error('Error loading conversations:', error);
      } finally {
        if (token === loadTokenRef.current) setLoadingConversations(false);
      }
      return;
    }

    // User-level: load by userId (no calendar filter)
    if (!userId) return;

    setLoadingConversations(true);
    try {
      const result = await conversationRepo.findUserLevel(userId, {
        limit: CONVERSATIONS_PAGE_SIZE,
        offset: 0,
        pinnedOnly: pinned,
      });
      if (token !== loadTokenRef.current) return;
      setConversations(result.conversations);
      setHasMoreConversations(result.hasMore);
      setTotalConversationsCount(result.totalCount);
    } catch (error) {
      logger.error('Error loading user-level conversations:', error);
    } finally {
      if (token === loadTokenRef.current) setLoadingConversations(false);
    }
  }, [userId, calendar?.id, trade?.id, conversationRepo]);

  /**
   * Run a server-side search against the `searchable` column and replace
   * the history list with the matches. Pass an empty / sub-2-char query
   * to exit search mode and restore the default list. The UI is expected
   * to debounce calls — every keystroke would otherwise hit Postgres.
   */
  const searchConversations = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      // Exiting search mode — fall back to the default loader.
      if (searchQueryRef.current !== null) {
        await loadConversations();
      }
      return;
    }

    const scope = getActiveScope();
    if (!scope) return;

    setSearchQuery(trimmed);
    setLoadingConversations(true);
    const token = ++loadTokenRef.current;
    try {
      const result = await conversationRepo.searchConversations(scope, trimmed, {
        limit: CONVERSATIONS_PAGE_SIZE,
        offset: 0,
        pinnedOnly: pinnedOnlyRef.current,
      });
      // Guard against out-of-order responses or any newer fetch (search
      // typed further, scope changed, pinned toggled). The token check
      // subsumes the query-only check.
      if (token !== loadTokenRef.current) return;
      setConversations(result.conversations);
      setHasMoreConversations(result.hasMore);
      setTotalConversationsCount(result.totalCount);
    } catch (error) {
      logger.error('Error searching conversations:', error);
    } finally {
      if (token === loadTokenRef.current) setLoadingConversations(false);
    }
  }, [getActiveScope, conversationRepo, loadConversations]);

  /**
   * Load more conversations (pagination).
   * Dispatches by current mode: search results when a query is active,
   * otherwise the default list scoped to trade/calendar/userLevel.
   */
  const loadMoreConversations = useCallback(async () => {
    if (loadingMoreConversations || !hasMoreConversations) return;

    const currentOffset = conversations.length;
    const pinned = pinnedOnlyRef.current;
    // Same token gate as load/search — if a fresh load fires while this
    // append is in flight (filter toggle, calendar switch, new search),
    // the in-flight append should NOT clobber the new list.
    const token = ++loadTokenRef.current;

    // Search mode: paginate the search results, not the default list.
    if (searchQuery) {
      const scope = getActiveScope();
      if (!scope) return;
      setLoadingMoreConversations(true);
      try {
        const result = await conversationRepo.searchConversations(scope, searchQuery, {
          limit: CONVERSATIONS_PAGE_SIZE,
          offset: currentOffset,
          pinnedOnly: pinned,
        });
        if (token !== loadTokenRef.current) return;
        setConversations(prev => [...prev, ...result.conversations]);
        setHasMoreConversations(result.hasMore);
      } catch (error) {
        logger.error('Error loading more search results:', error);
      } finally {
        if (token === loadTokenRef.current) setLoadingMoreConversations(false);
      }
      return;
    }

    // Trade-specific
    if (trade?.id) {
      setLoadingMoreConversations(true);
      try {
        const result = await conversationRepo.findByTradeId(trade.id, {
          limit: CONVERSATIONS_PAGE_SIZE,
          offset: currentOffset,
          pinnedOnly: pinned,
        });
        if (token !== loadTokenRef.current) return;
        setConversations(prev => [...prev, ...result.conversations]);
        setHasMoreConversations(result.hasMore);
      } catch (error) {
        logger.error('Error loading more trade conversations:', error);
      } finally {
        if (token === loadTokenRef.current) setLoadingMoreConversations(false);
      }
      return;
    }

    // Calendar-level (skip if saveAsUserLevel)
    if (calendar?.id && !saveAsUserLevel) {
      setLoadingMoreConversations(true);
      try {
        const result = await conversationRepo.findByCalendarId(calendar.id, {
          limit: CONVERSATIONS_PAGE_SIZE,
          offset: currentOffset,
          pinnedOnly: pinned,
        });
        if (token !== loadTokenRef.current) return;
        setConversations(prev => [...prev, ...result.conversations]);
        setHasMoreConversations(result.hasMore);
      } catch (error) {
        logger.error('Error loading more conversations:', error);
      } finally {
        if (token === loadTokenRef.current) setLoadingMoreConversations(false);
      }
      return;
    }

    // User-level
    if (!userId) return;

    setLoadingMoreConversations(true);
    try {
      const result = await conversationRepo.findUserLevel(userId, {
        limit: CONVERSATIONS_PAGE_SIZE,
        offset: currentOffset,
        pinnedOnly: pinned,
      });
      if (token !== loadTokenRef.current) return;
      setConversations(prev => [...prev, ...result.conversations]);
      setHasMoreConversations(result.hasMore);
    } catch (error) {
      logger.error('Error loading more user-level conversations:', error);
    } finally {
      if (token === loadTokenRef.current) setLoadingMoreConversations(false);
    }
  }, [
    userId,
    calendar?.id,
    trade?.id,
    conversations.length,
    loadingMoreConversations,
    hasMoreConversations,
    conversationRepo,
    searchQuery,
    getActiveScope,
  ]);

  /**
   * Toggle the server-side pinned-only history filter. Updates the ref
   * synchronously so the immediate reload sees the new value (state
   * updates from setPinnedOnlyState don't flush in time for the call
   * inside the same callback). If a search is active, the reload stays
   * in search mode with the new pinned flag applied; otherwise it
   * re-fetches the default first page.
   */
  const setPinnedFilter = useCallback(async (value: boolean) => {
    if (pinnedOnlyRef.current === value) return;
    pinnedOnlyRef.current = value;
    setPinnedOnlyState(value);

    if (searchQueryRef.current) {
      await searchConversations(searchQueryRef.current);
    } else {
      await loadConversations();
    }
  }, [searchConversations, loadConversations]);

  /**
   * Abort any in-flight streaming request without the message-filter
   * cleanup `cancelRequest` does. Used by selectConversation /
   * startNewChat — they're about to overwrite messages state anyway, so
   * the filter step is wasteful and could briefly flash empty bubbles
   * before the new state lands.
   */
  const abortActiveStream = useCallback(() => {
    if (!abortControllerRef.current) return;
    cancelRequestedRef.current = true;
    abortControllerRef.current.abort();
    abortControllerRef.current = null;
    activeRequestRef.current = null;
    setIsLoading(false);
    setIsTyping(false);
    setToolExecutionStatus('');
  }, []);

  /**
   * Start a new chat
   */
  const startNewChat = useCallback(async () => {
    // Kill any in-flight send for the previous chat — otherwise its done
    // event would fire after we've reset state and overwrite gate/messages
    // for the now-departed conversation.
    abortActiveStream();
    setMessages([]);
    setCurrentConversationId(null);
    setEditingMessageId(null);
    setGateUsed(0);
    setBlockedState(null);
    logger.log('Started new conversation (local reset)');
  }, [abortActiveStream]);

  /**
   * Select a conversation from history.
   *
   * List queries don't carry the heavy `messages` JSONB blob, so we fetch the
   * full row via `findById` here. If the caller already has messages (e.g.
   * the reminder navigation path that calls `findById` itself before handing
   * us the conversation), we skip the fetch and use them directly. The
   * `loadingMessages` flag drives the skeleton bubbles in the chat surface.
   *
   * `currentConversationId` is set first so realtime subscriptions to the
   * row attach immediately — without that, a reminder fire that lands while
   * the fetch is in flight would be missed.
   */
  const selectConversation = useCallback(async (conversation: AIConversation) => {
    // Kill any in-flight send for the previous chat before switching —
    // otherwise its done event lands after we've swapped state and
    // overwrites gate/messages for the wrong conversation.
    abortActiveStream();
    setEditingMessageId(null);
    setBlockedState(null);
    setCurrentConversationId(conversation.id);

    // Fire-and-forget: bump last_accessed_at so cleanup-stale-ai-conversations
    // treats this as a fresh access. Day-gated server-side (max 1 write/day
    // per row), so spamming open/close doesn't write-amplify. Errors are
    // logged inside .touch() and never propagate.
    if (userId) {
      void conversationRepo.touch(conversation.id, userId);
    }

    // Apply messages + seed gate from the row in one place so both the
    // preloaded-row branch and the lazy-load branch stay in sync. The list
    // queries don't carry last_prompt_tokens (they exclude the heavy cols),
    // so the preloaded branch usually gates from 0 until findById fires;
    // the lazy branch always lands on the real value.
    const applyConversation = (convo: AIConversation) => {
      setMessages((convo.messages ?? []) as ChatMessageType[]);
      setGateUsed(typeof convo.last_prompt_tokens === 'number' ? convo.last_prompt_tokens : 0);
    };

    if (conversation.messages) {
      applyConversation(conversation);
      logger.log('Loaded conversation (preloaded):', conversation.id);
      return;
    }

    setMessages([]);
    setGateUsed(0);
    setLoadingMessages(true);
    try {
      const full = await conversationRepo.findById(conversation.id);
      if (!full) {
        logger.warn('Conversation not found on lazy load:', conversation.id);
        return;
      }
      applyConversation(full);
      logger.log('Loaded conversation (lazy):', conversation.id);
    } catch (error) {
      logger.error('Error lazy-loading conversation messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  }, [conversationRepo, userId, abortActiveStream]);

  /**
   * Delete a conversation
   */
  const deleteConversation = useCallback(async (conversationId: string): Promise<boolean> => {
    try {
      const result = await conversationRepo.delete(conversationId);
      if (result.success) {
        logger.log('Conversation deleted:', conversationId);
        if (conversationId === currentConversationId) {
          await startNewChat();
        }
        setConversations(prev => prev.filter(c => c.id !== conversationId));
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Error deleting conversation:', error);
      return false;
    }
  }, [conversationRepo, currentConversationId, startNewChat]);

  /**
   * Toggle the pinned flag on a conversation and re-sort locally so pinned
   * items stay at the top without a full refetch.
   */
  const togglePinConversation = useCallback(async (conversationId: string): Promise<boolean> => {
    const target = conversations.find(c => c.id === conversationId);
    if (!target) return false;

    const nextPinned = !target.pinned;

    // Optimistic update + re-sort (pinned first, then updated_at desc)
    setConversations(prev => {
      const updated = prev.map(c =>
        c.id === conversationId ? { ...c, pinned: nextPinned } : c
      );
      return [...updated].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.updated_at.getTime() - a.updated_at.getTime();
      });
    });

    try {
      const result = await conversationRepo.setPinned(conversationId, nextPinned);
      if (!result.success) {
        // Revert on failure
        setConversations(prev =>
          prev.map(c =>
            c.id === conversationId ? { ...c, pinned: target.pinned } : c
          )
        );
        return false;
      }
      return true;
    } catch (error) {
      logger.error('Error toggling conversation pin:', error);
      setConversations(prev =>
        prev.map(c =>
          c.id === conversationId ? { ...c, pinned: target.pinned } : c
        )
      );
      return false;
    }
  }, [conversations, conversationRepo]);

  /**
   * Cancel the current request
   */
  const cancelRequest = useCallback(() => {
    const active = activeRequestRef.current;

    if (!abortControllerRef.current && !active) {
      return;
    }

    cancelRequestedRef.current = true;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (active) {
      setMessages(prev =>
        prev.filter(msg => msg.id !== active.userId && msg.id !== active.aiId)
      );
      activeRequestRef.current = null;
    }

    setIsLoading(false);
    setIsTyping(false);
    setToolExecutionStatus('');
  }, []);

  /**
   * Send a message to the AI
   */
  const sendMessage = useCallback(async (messageText: string, images?: AttachedImage[], segments?: ChatMessageType['segments']) => {
    const trimmedMessage = messageText.trim();
    if ((!trimmedMessage && (!images || images.length === 0)) || isLoading || !userId) return;

    cancelRequestedRef.current = false;
    // Clear any stale block from a previous denied send. If this attempt is
    // also blocked, the 'blocked' SSE handler will repopulate it.
    setBlockedState(null);

    // Capture the edit-mode signal before we reset it below — the backend
    // needs it to truncate the persisted messages array. Without this, the
    // edit-and-resend flow leaves orphaned old turns in the DB, and they
    // reappear on next reload.
    const editTargetId = editingMessageId;
    const isFirstSend = !editingMessageId && messages.length === 0;
    let userMessage: ChatMessageType;

    // Handle edit mode. The server now reads history from the DB so we no
    // longer build a `baseHistory` payload — the slice below (when an edit
    // truncation happens) is purely for the optimistic UI update.
    if (editingMessageId) {
      const messageIndex = messages.findIndex(
        msg => msg.id === editingMessageId && msg.role === 'user'
      );

      if (messageIndex === -1) {
        userMessage = {
          id: uuidv4(),
          role: 'user',
          content: trimmedMessage,
          images: images,
          segments: segments,
          timestamp: new Date(),
          status: 'sent'
        };
        setMessages(prev => [...prev, userMessage]);
      } else {
        const baseHistoryForUI = messages.slice(0, messageIndex);
        const originalMessage = messages[messageIndex];
        userMessage = {
          ...originalMessage,
          content: trimmedMessage,
          images: images,
          segments: segments,
          timestamp: new Date(),
          status: 'sent'
        };
        // Preserve reminder-fired messages from the discarded tail — they're
        // independent events (cron-triggered, not turn-tree replies) and
        // shouldn't disappear when the user edits an earlier message.
        // Mirrors the server-side preservation in conversationStore.ts.
        const preservedFires = messages
          .slice(messageIndex)
          .filter((m) =>
            typeof (m as { metadata?: { triggered_by?: string } }).metadata
              ?.triggered_by === 'string' &&
            (m as { metadata: { triggered_by: string } }).metadata.triggered_by.startsWith('reminder:')
          );
        setMessages([...baseHistoryForUI, userMessage, ...preservedFires]);
      }
      setEditingMessageId(null);
    } else {
      userMessage = {
        id: uuidv4(),
        role: 'user',
        content: trimmedMessage,
        images: images,
        segments: segments,
        timestamp: new Date(),
        status: 'sent'
      };
      setMessages(prev => [...prev, userMessage]);
    }

    setIsLoading(true);
    setIsTyping(true);
    setToolExecutionStatus('');

    // Generate the conversation id on the very first send. Backend uses this
    // for the turn-start upsert and tools (set_reminder, etc.) use it for
    // ownership checks.
    let activeConversationId = currentConversationId;
    if (!activeConversationId) {
      activeConversationId = uuidv4();
      setCurrentConversationId(activeConversationId);
    }

    const aiMessageId = uuidv4();
    let aiMessageAdded = false;

    activeRequestRef.current = { userId: userMessage.id, aiId: aiMessageId };

    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      let accumulatedText = '';
      let accumulatedReasoning = '';
      let messageHtml = '';
      let citations: any[] | undefined;
      let embeddedTrades: any | undefined;
      let embeddedEvents: any | undefined;
      let embeddedNotes: any | undefined;
      let toolCallsInProgress: string[] = [];
      const toolCallHistory: Array<{ name: string; label: string }> = [];
      const toolLabelByName = new Map<string, string>();
      const labelOf = (name: string) =>
        toolLabelByName.get(name)
        || TOOL_LABELS[name]
        || (name.startsWith('user_tool_') ? name.slice('user_tool_'.length) : name);

      // Title hint is only meaningful on the very first send of a new
      // conversation (the backend's upsert uses `ignoreDuplicates: true`,
      // so subsequent sends won't overwrite an existing title). Computed
      // from the user message content with slash-command and note-reference
      // framing stripped, so the History sidebar reads naturally instead
      // of "[Referenced command: ...]".
      const titleHint = isFirstSend
        ? generateConversationTitle(userMessage.content)
        : undefined;

      for await (const event of supabaseAIChatService.sendMessageStreaming(
        trimmedMessage,
        userId,
        calendar,
        abortController.signal,
        trade?.id,
        images,
        activeConversationId,
        userMessage.id,
        editTargetId ?? undefined,
        titleHint,
      )) {
        switch (event.type) {
          case 'text_chunk':
            accumulatedText += event.data.text;
            pendingTextRef.current = accumulatedText;

            // Clear existing timeout
            if (messageUpdateTimeoutRef.current) {
              clearTimeout(messageUpdateTimeoutRef.current);
            }

            // Debounce: batch updates every 100ms
            messageUpdateTimeoutRef.current = setTimeout(() => {
              if (!aiMessageAdded) {
                const newMessage: ChatMessageType = {
                  id: aiMessageId,
                  role: 'assistant',
                  content: pendingTextRef.current,
                  timestamp: new Date(),
                  status: 'receiving'
                };
                setMessages(prev => [...prev, newMessage]);
                aiMessageAdded = true;
              } else {
                setMessages(prev => prev.map(msg =>
                  msg.id === aiMessageId
                    ? { ...msg, content: pendingTextRef.current, status: 'receiving' as const }
                    : msg
                ));
              }
            }, 100);
            break;

          case 'reasoning_chunk': {
            accumulatedReasoning += event.data.text;
            const reasoningSnapshot = accumulatedReasoning;
            if (aiMessageAdded) {
              setMessages(prev => prev.map(msg =>
                msg.id === aiMessageId ? { ...msg, reasoning: reasoningSnapshot } : msg
              ));
            } else {
              const newMessage: ChatMessageType = {
                id: aiMessageId,
                role: 'assistant',
                content: '',
                reasoning: reasoningSnapshot,
                timestamp: new Date(),
                status: 'receiving'
              };
              setMessages(prev => [...prev, newMessage]);
              aiMessageAdded = true;
            }
            break;
          }

          case 'text_reset':
            // Narration text was streamed before we knew a function call was coming.
            // Reset accumulated text but keep reasoning (it's still valid context for
            // the upcoming tool call + final answer).
            accumulatedText = '';
            pendingTextRef.current = '';
            if (messageUpdateTimeoutRef.current) {
              clearTimeout(messageUpdateTimeoutRef.current);
              messageUpdateTimeoutRef.current = null;
            }
            if (aiMessageAdded) {
              if (accumulatedReasoning) {
                setMessages(prev => prev.map(msg =>
                  msg.id === aiMessageId
                    ? { ...msg, content: '', reasoning: accumulatedReasoning }
                    : msg
                ));
              } else {
                setMessages(prev => prev.filter(msg => msg.id !== aiMessageId));
                aiMessageAdded = false;
              }
            }
            break;

          case 'tool_call': {
            const name = event.data.name as string;
            logger.log(`Tool called: ${name}`);
            const label = labelForToolCall(name, event.data.args);
            toolLabelByName.set(name, label);
            toolCallsInProgress.push(name);
            toolCallHistory.push({ name, label });
            setToolExecutionStatus(
              toolCallsInProgress.map(labelOf).join(', ')
            );
            break;
          }

          case 'tool_result': {
            logger.log(`Tool result: ${event.data.name}`);
            toolCallsInProgress = toolCallsInProgress.filter(t => t !== event.data.name);
            setToolExecutionStatus(
              toolCallsInProgress.length > 0
                ? toolCallsInProgress.map(labelOf).join(', ')
                : ''
            );
            break;
          }

          case 'citation':
            citations = event.data.citations;
            break;

          case 'embedded_data':
            embeddedTrades = event.data.embeddedTrades;
            embeddedEvents = event.data.embeddedEvents;
            embeddedNotes = event.data.embeddedNotes;
            break;

          case 'done': {
            messageHtml = event.data.messageHtml || '';
            // Validate every numeric field before committing to state — a
            // partial usageMetadata on the server can produce NaN/Infinity
            // which would render the meter as "NaN%" and break the
            // tokenUsage >= softLimit comparison.
            const rawGate = event.data.gate as ConversationGate | undefined;
            if (
              rawGate &&
              Number.isFinite(rawGate.used) &&
              Number.isFinite(rawGate.softLimit) &&
              Number.isFinite(rawGate.hardLimit) &&
              rawGate.softLimit > 0 &&
              rawGate.hardLimit > 0
            ) {
              setGateUsed(Math.max(0, rawGate.used));
              setGateSoftLimit(rawGate.softLimit);
              setGateHardLimit(rawGate.hardLimit);
            } else if (rawGate) {
              logger.warn('Dropping malformed gate payload from done event:', rawGate);
            }
            logger.log('AI response streaming complete');
            break;
          }

          case 'blocked': {
            // Tier/budget gate denied the request. The server never persisted
            // the user message (gate runs BEFORE appendUserMessage), so to
            // mirror server state we strip the optimistic user bubble + any
            // assistant draft. The OrionUpgradeCard renders from blockedState
            // in its place.
            const blockedData = event.data as {
              reason: 'orion_paid_only' | 'orion_budget_exhausted';
              tier: 'free' | 'lite' | 'pro' | 'elite';
              reset_at: string | null;
              tokens_consumed: number | null;
              tokens_budget: number | null;
            };
            setBlockedState({
              reason: blockedData.reason,
              tier: blockedData.tier,
              resetAt: blockedData.reset_at,
              tokensConsumed: blockedData.tokens_consumed,
              tokensBudget: blockedData.tokens_budget,
            });
            setMessages(prev =>
              prev.filter(m => m.id !== userMessage.id && m.id !== aiMessageId)
            );
            // Skip the post-stream commit — the finally block resets the
            // loading flags. The OrionUpgradeCard renders from blockedState.
            return;
          }

          case 'error':
            throw new Error(event.data.error || 'Streaming error');
        }
      }

      // Clear any pending debounced update
      if (messageUpdateTimeoutRef.current) {
        clearTimeout(messageUpdateTimeoutRef.current);
        messageUpdateTimeoutRef.current = null;
      }

      if (cancelRequestedRef.current || (!aiMessageAdded && !accumulatedText)) {
        return;
      }

      const finalMessage: ChatMessageType = {
        id: aiMessageId,
        role: 'assistant',
        content: accumulatedText,
        messageHtml: messageHtml,
        citations,
        embeddedTrades,
        embeddedEvents,
        embeddedNotes,
        toolCalls: toolCallHistory.length > 0 ? toolCallHistory : undefined,
        reasoning: accumulatedReasoning || undefined,
        timestamp: new Date(),
        status: 'received'
      };

      if (aiMessageAdded) {
        setMessages(prev => prev.map(msg =>
          msg.id === aiMessageId ? finalMessage : msg
        ));
      } else {
        setMessages(prev => [...prev, finalMessage]);
      }

      // Refresh the history list after a successful turn. Backend persisted
      // the row turn-by-turn; without this the in-memory list drifts from
      // the DB and the History panel shows stale entries when reopened.
      // Fire-and-forget — don't block the UI on a list refetch.
      void loadConversations();

    } catch (error) {
      const isAbortError =
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        (error as any).name === 'AbortError';

      if (isAbortError || cancelRequestedRef.current) {
        logger.log('AI chat request cancelled by user');
        return;
      }

      logger.error('Error sending message to Supabase AI agent:', error);

      // Backend's formatErrorResponse + classifyProviderError already produced
      // the user-friendly markdown — error.message is safe to render verbatim.
      const userMessage = error instanceof Error
        ? error.message
        : 'Sorry, I encountered an error processing your message. Please try again.';

      const errorMessage: ChatMessageType = {
        id: aiMessageId,
        role: 'assistant',
        content: userMessage,
        timestamp: new Date(),
        status: 'error',
        error: userMessage,
      };

      if (aiMessageAdded) {
        setMessages(prev => prev.map(msg =>
          msg.id === aiMessageId ? errorMessage : msg
        ));
      } else {
        setMessages(prev => [...prev, errorMessage]);
      }
    } finally {
      // Clear any pending debounced update
      if (messageUpdateTimeoutRef.current) {
        clearTimeout(messageUpdateTimeoutRef.current);
        messageUpdateTimeoutRef.current = null;
      }
      abortControllerRef.current = null;
      activeRequestRef.current = null;
      cancelRequestedRef.current = false;
      setIsLoading(false);
      setIsTyping(false);
      setToolExecutionStatus('');
    }
  }, [userId, calendar, trade, messages, editingMessageId, isLoading, loadConversations]);

  /**
   * Set up message for editing and return its content and images
   */
  const setInputForEdit = useCallback((messageId: string): { content: string; images?: AttachedImage[]; segments?: ChatMessageType['segments'] } | null => {
    const messageToEdit = messages.find(msg => msg.id === messageId);
    if (!messageToEdit || messageToEdit.role !== 'user') return null;

    setEditingMessageId(messageId);
    return {
      content: messageToEdit.content,
      images: messageToEdit.images,
      segments: messageToEdit.segments
    };
  }, [messages]);

  /**
   * Legacy edit message function (returns content for input field)
   */
  const editMessage = useCallback((messageId: string): string | null => {
    const result = setInputForEdit(messageId);
    return result ? result.content : null;
  }, [setInputForEdit]);

  /**
   * Clear editing state
   */
  const clearEditingState = useCallback(() => {
    setEditingMessageId(null);
  }, []);

  /**
   * Get welcome message
   */
  const getWelcomeMessage = useCallback((): ChatMessageType => {
    // Trade-specific welcome message
    if (trade) {
      const tradeName = trade.name || 'this trade';
      const tradeType = trade.trade_type;
      const isWin = tradeType === 'win';
      const isLoss = tradeType === 'loss';

      const resultEmoji = isWin ? '✅' : isLoss ? '❌' : '➖';
      const resultText = isWin ? 'winning' : isLoss ? 'losing' : '';

      return {
        id: 'welcome',
        role: 'assistant',
        content: `${resultEmoji} I'm Orion, your trading analyst. I'm ready to analyze your ${resultText} trade on **${tradeName}**.

I can help you understand what worked${isLoss ? " or didn't work" : ''}, identify patterns, and provide insights to improve your trading.

What would you like to know about this trade?`,
        timestamp: new Date(),
        status: 'received'
      };
    }

    // Calendar-specific welcome message
    const calendarInfo = calendar
      ? `You're working with the "${calendar.name}" calendar. `
      : 'You can ask me about your trading performance across all your calendars. ';

    const historyNote = '';

    return {
      id: 'welcome',
      role: 'assistant',
      content: `👋 Hello! I'm Orion, your AI trading analyst. ${calendarInfo}I can help you analyze your trading performance, identify patterns, and provide insights to improve your trading.

💡 I'll analyze your trading data to give you focused and accurate insights!${historyNote}

What would you like to know about your trading?`,
      timestamp: new Date(),
      status: 'received'
    };
  }, [calendar, trade]);

  return {
    // State
    messages,
    isLoading,
    isTyping,
    toolExecutionStatus,
    currentConversationId,
    conversations,
    loadingConversations,
    loadingMoreConversations,
    loadingMessages,
    hasMoreConversations,
    totalConversationsCount,
    isAtContextLimit,
    tokenUsage,
    tokenBudget,
    editingMessageId,
    blockedState,

    // Actions
    sendMessage,
    cancelRequest,
    editMessage,
    setInputForEdit,
    clearEditingState,

    // Conversation management
    loadConversations,
    loadMoreConversations,
    searchConversations,
    pinnedOnly,
    setPinnedFilter,
    selectConversation,
    deleteConversation,
    togglePinConversation,
    startNewChat,

    // Message management
    setMessages,

    // Utilities
    getWelcomeMessage,
  };
}

export default useAIChat;
