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
} from '../types/aiChat';
import { Calendar } from '../types/calendar';
import { Trade } from '../types/trade';
import { supabaseAIChatService } from '../services/supabaseAIChatService';
import {
  ConversationRepository,
  ConversationPaginationOptions
} from '../services/repository/repositories/ConversationRepository';
import { logger } from '../utils/logger';
import { supabase } from '../config/supabase';

const CONVERSATIONS_PAGE_SIZE = 15;

const TOOL_LABELS: Record<string, string> = {
  execute_sql: 'Querying database',
  search_web: 'Searching web',
  scrape_url: 'Reading article',
  analyze_image: 'Analyzing chart',
  generate_chart: 'Generating chart',
  get_crypto_price: 'Checking crypto price',
  get_forex_price: 'Checking forex price',
  create_note: 'Creating note',
  update_note: 'Updating note',
  delete_note: 'Deleting note',
  search_notes: 'Searching notes',
  update_memory: 'Updating memory',
  get_tag_definition: 'Looking up tag',
  save_tag_definition: 'Saving tag definition',
  get_recent_orion_briefings: 'Reading briefings',
  search_conversations: 'Searching conversations',
  get_conversation: 'Loading conversation',
};

export interface UseAIChatOptions {
  userId: string | undefined;
  calendar?: Calendar;
  trade?: Trade;
  messageLimit?: number;
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
  hasMoreConversations: boolean;
  totalConversationsCount: number;
  isAtMessageLimit: boolean;
  editingMessageId: string | null;

  // Actions
  sendMessage: (messageText: string, images?: AttachedImage[], segments?: ChatMessageType['segments']) => Promise<void>;
  cancelRequest: () => void;
  editMessage: (messageId: string) => string | null;
  setInputForEdit: (messageId: string) => { content: string; images?: AttachedImage[]; segments?: ChatMessageType['segments'] } | null;
  clearEditingState: () => void;

  // Conversation management
  loadConversations: () => Promise<void>;
  loadMoreConversations: () => Promise<void>;
  selectConversation: (conversation: AIConversation) => void;
  deleteConversation: (conversationId: string) => Promise<boolean>;
  togglePinConversation: (conversationId: string) => Promise<boolean>;
  startNewChat: () => Promise<void>;

  // Message management
  setMessages: React.Dispatch<React.SetStateAction<ChatMessageType[]>>;

  // Utilities
  getWelcomeMessage: () => ChatMessageType;
}

const MESSAGE_LIMIT_DEFAULT = 50;

export function useAIChat({
  userId,
  calendar,
  trade,
  messageLimit = MESSAGE_LIMIT_DEFAULT,
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
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [totalConversationsCount, setTotalConversationsCount] = useState(0);
  const [isAtMessageLimit, setIsAtMessageLimit] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

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

  // Check message limit whenever messages change
  useEffect(() => {
    setIsAtMessageLimit(messages.length >= messageLimit);
  }, [messages.length, messageLimit]);

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

  /**
   * Load conversations - either trade-specific or calendar-level
   * If trade is provided: loads trade-specific conversations
   * If only calendar: loads calendar-level conversations (without trade_id)
   * Resets pagination and loads first page
   */
  const loadConversations = useCallback(async () => {
    // Trade-specific: load conversations for this trade
    if (trade?.id) {
      setLoadingConversations(true);
      try {
        const result = await conversationRepo.findByTradeId(trade.id, {
          limit: CONVERSATIONS_PAGE_SIZE,
          offset: 0
        });
        setConversations(result.conversations);
        setHasMoreConversations(result.hasMore);
        setTotalConversationsCount(result.totalCount);
      } catch (error) {
        logger.error('Error loading trade conversations:', error);
      } finally {
        setLoadingConversations(false);
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
          offset: 0
        });
        setConversations(result.conversations);
        setHasMoreConversations(result.hasMore);
        setTotalConversationsCount(result.totalCount);
      } catch (error) {
        logger.error('Error loading conversations:', error);
      } finally {
        setLoadingConversations(false);
      }
      return;
    }

    // User-level: load by userId (no calendar filter)
    if (!userId) return;

    setLoadingConversations(true);
    try {
      const result = await conversationRepo.findUserLevel(userId, {
        limit: CONVERSATIONS_PAGE_SIZE,
        offset: 0
      });
      setConversations(result.conversations);
      setHasMoreConversations(result.hasMore);
      setTotalConversationsCount(result.totalCount);
    } catch (error) {
      logger.error('Error loading user-level conversations:', error);
    } finally {
      setLoadingConversations(false);
    }
  }, [userId, calendar?.id, trade?.id, conversationRepo]);

  /**
   * Load more conversations (pagination)
   * Appends to existing conversations list
   */
  const loadMoreConversations = useCallback(async () => {
    if (loadingMoreConversations || !hasMoreConversations) return;

    const currentOffset = conversations.length;

    // Trade-specific
    if (trade?.id) {
      setLoadingMoreConversations(true);
      try {
        const result = await conversationRepo.findByTradeId(trade.id, {
          limit: CONVERSATIONS_PAGE_SIZE,
          offset: currentOffset
        });
        setConversations(prev => [...prev, ...result.conversations]);
        setHasMoreConversations(result.hasMore);
      } catch (error) {
        logger.error('Error loading more trade conversations:', error);
      } finally {
        setLoadingMoreConversations(false);
      }
      return;
    }

    // Calendar-level (skip if saveAsUserLevel)
    if (calendar?.id && !saveAsUserLevel) {
      setLoadingMoreConversations(true);
      try {
        const result = await conversationRepo.findByCalendarId(calendar.id, {
          limit: CONVERSATIONS_PAGE_SIZE,
          offset: currentOffset
        });
        setConversations(prev => [...prev, ...result.conversations]);
        setHasMoreConversations(result.hasMore);
      } catch (error) {
        logger.error('Error loading more conversations:', error);
      } finally {
        setLoadingMoreConversations(false);
      }
      return;
    }

    // User-level
    if (!userId) return;

    setLoadingMoreConversations(true);
    try {
      const result = await conversationRepo.findUserLevel(userId, {
        limit: CONVERSATIONS_PAGE_SIZE,
        offset: currentOffset
      });
      setConversations(prev => [...prev, ...result.conversations]);
      setHasMoreConversations(result.hasMore);
    } catch (error) {
      logger.error('Error loading more user-level conversations:', error);
    } finally {
      setLoadingMoreConversations(false);
    }
  }, [
    userId,
    calendar?.id,
    trade?.id,
    conversations.length,
    loadingMoreConversations,
    hasMoreConversations,
    conversationRepo
  ]);

  /**
   * Save current conversation
   * If trade is provided, saves as trade-specific conversation
   * Otherwise saves as calendar-level conversation
   */
  const saveCurrentConversation = useCallback(async (updatedMessages: ChatMessageType[]) => {
    if (!userId || updatedMessages.length === 0 || !autoSaveConversation) return;

    try {
      const storageCalendarId = saveAsUserLevel ? null : (calendar?.id || null);
      const result = await conversationRepo.saveConversation(
        currentConversationId,
        storageCalendarId,
        userId,
        updatedMessages,
        undefined, // title - auto-generated
        trade?.id || null // tradeId - null for calendar/user-level
      );

      if (result.success && result.data) {
        setCurrentConversationId(result.data.id);
        logger.log('Conversation saved:', result.data.id,
          trade?.id ? '(trade)' : calendar?.id ? '(calendar)' : '(user-level)');
        await loadConversations();
      }
    } catch (error) {
      logger.error('Error saving conversation:', error);
    }
  }, [userId, calendar?.id, trade?.id, currentConversationId, autoSaveConversation, conversationRepo, loadConversations]);

  /**
   * Start a new chat
   */
  const startNewChat = useCallback(async () => {
    const msgs = messages;  
    setMessages([]);
    setCurrentConversationId(null);
    setIsAtMessageLimit(false);
    setEditingMessageId(null);
     if (msgs.length > 0) {
      await saveCurrentConversation(msgs);
    }
    logger.log('Started new conversation');
  }, [messages, saveCurrentConversation]);

  /**
   * Select a conversation from history
   */
  const selectConversation = useCallback((conversation: AIConversation) => {
    setMessages(conversation.messages as ChatMessageType[]);
    setCurrentConversationId(conversation.id);
    setIsAtMessageLimit(conversation.message_count >= messageLimit);
    setEditingMessageId(null);
    logger.log('Loaded conversation:', conversation.id);
  }, [messageLimit]);

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

    let baseHistory: ChatMessageType[];
    let userMessage: ChatMessageType;

    // Handle edit mode
    if (editingMessageId) {
      const messageIndex = messages.findIndex(
        msg => msg.id === editingMessageId && msg.role === 'user'
      );

      if (messageIndex === -1) {
        baseHistory = messages;
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
        baseHistory = messages.slice(0, messageIndex);
        const originalMessage = messages[messageIndex];
        userMessage = {
          ...originalMessage,
          content: trimmedMessage,
          images: images,
          segments: segments,
          timestamp: new Date(),
          status: 'sent'
        };
        const updatedMessages = [...baseHistory, userMessage];
        setMessages(updatedMessages);
      }
      setEditingMessageId(null);
    } else {
      baseHistory = messages;
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

      for await (const event of supabaseAIChatService.sendMessageStreaming(
        trimmedMessage,
        userId,
        calendar,
        baseHistory,
        abortController.signal,
        trade?.id,
        images
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
            toolCallsInProgress.push(name);
            toolCallHistory.push({ name, label: TOOL_LABELS[name] || name });
            setToolExecutionStatus(
              toolCallsInProgress.map(t => TOOL_LABELS[t] || t).join(', ')
            );
            break;
          }

          case 'tool_result': {
            logger.log(`Tool result: ${event.data.name}`);
            toolCallsInProgress = toolCallsInProgress.filter(t => t !== event.data.name);
            setToolExecutionStatus(
              toolCallsInProgress.length > 0
                ? toolCallsInProgress.map(t => TOOL_LABELS[t] || t).join(', ')
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

          case 'done':
            messageHtml = event.data.messageHtml || '';
            logger.log('AI response streaming complete');
            break;

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

      const conversationMessages = [...baseHistory, userMessage, finalMessage];
      await saveCurrentConversation(conversationMessages);

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
  }, [userId, calendar, trade, messages, editingMessageId, isLoading, saveCurrentConversation]);

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
    hasMoreConversations,
    totalConversationsCount,
    isAtMessageLimit,
    editingMessageId,

    // Actions
    sendMessage,
    cancelRequest,
    editMessage,
    setInputForEdit,
    clearEditingState,

    // Conversation management
    loadConversations,
    loadMoreConversations,
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
