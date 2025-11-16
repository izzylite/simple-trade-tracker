/**
 * AI Chat Bottom Sheet Component
 * Modern bottom sheet interface for AI trading analysis
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  IconButton,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Tooltip,
  Divider,
  useTheme,
  alpha,
  Avatar,
  List,
  ListItem,
  ListItemButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Popper,
  Paper
} from '@mui/material';
import {
  Send as SendIcon,
  SmartToy as AIIcon,
  Close as CloseIcon,
  AddComment as NewChatIcon,
  History as HistoryIcon,
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
  Stop as StopIcon,
  Settings as SettingsIcon,
  Notes as NotesIcon
} from '@mui/icons-material';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import ChatMessage from './ChatMessage';
import Shimmer from '../Shimmer';
import AIChatMentionInput from './AIChatMentionInput';
import {
  ChatMessage as ChatMessageType,
  ChatError,
  AIConversation
} from '../../types/aiChat';
import { Trade } from '../../types/trade';
import { Calendar } from '../../types/calendar';
import { EconomicEvent } from '../../types/economicCalendar';
import { supabaseAIChatService } from '../../services/supabaseAIChatService';
import { ConversationRepository } from '../../services/repository/repositories/ConversationRepository';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import { logger } from '../../utils/logger';
import { useAuth } from '../../contexts/SupabaseAuthContext';
import EconomicEventDetailDialog from '../economicCalendar/EconomicEventDetailDialog';
import ApiKeySettingsDialog from './ApiKeySettingsDialog';
import NoteEditorDialog from '../notes/NoteEditorDialog';
import { Note } from '../../types/note';
import { hasApiKey } from '../../services/apiKeyStorage';
import * as notesService from '../../services/notesService';

interface AIChatDrawerProps {
  open: boolean;
  onClose: () => void;
  trades?: Trade[];
  calendar?: Calendar;
  onOpenGalleryMode?: (trades: Trade[], initialTradeId?: string, title?: string) => void;
  // Trade operation callbacks for EconomicEventDetailDialog
  onUpdateTradeProperty?: (tradeId: string, updateCallback: (trade: Trade) => Trade) => Promise<Trade | undefined>;
  onEditTrade?: (trade: Trade) => void;
  onDeleteTrade?: (tradeId: string) => void;
  onDeleteMultipleTrades?: (tradeIds: string[]) => void;
  onZoomImage?: (imageUrl: string, allImages?: string[], initialIndex?: number) => void;
  onUpdateCalendarProperty?: (calendarId: string, updateCallback: (calendar: Calendar) => Calendar) => Promise<Calendar | undefined>;
  isReadOnly?: boolean;
}

// Bottom sheet heights
const BOTTOM_SHEET_HEIGHTS = {
  default: 780
} as const;

const AIChatDrawer: React.FC<AIChatDrawerProps> = ({
  open,
  onClose,
  trades,
  calendar,
  onOpenGalleryMode,
  onUpdateTradeProperty,
  onEditTrade,
  onDeleteTrade,
  onDeleteMultipleTrades,
  onZoomImage,
  onUpdateCalendarProperty,
  isReadOnly = false
}) => {
  const theme = useTheme();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<any>(null);
  const conversationRepo = useRef(new ConversationRepository()).current;
  const abortControllerRef = useRef<AbortController | null>(null);
  const cancelRequestedRef = useRef(false);
  const activeRequestRef = useRef<{ userId: string; aiId: string } | null>(null);

  // Prevent body scroll when drawer is open to fix mention dialog positioning
  useEffect(() => {
    if (open) {
      // Store original overflow style
      const originalOverflow = document.body.style.overflow;
      // Prevent scrolling
      document.body.style.overflow = 'hidden';

      return () => {
        // Restore original overflow when drawer closes
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [open]);

  // State
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [toolExecutionStatus, setToolExecutionStatus] = useState<string>('');

  // Conversation management state
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [showHistoryView, setShowHistoryView] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [isAtMessageLimit, setIsAtMessageLimit] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);

  // Economic event detail dialog state
  const [selectedEvent, setSelectedEvent] = useState<EconomicEvent | null>(null);
  const [eventDetailDialogOpen, setEventDetailDialogOpen] = useState(false);

  // Note editor dialog state
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);

  // Notes context popup state
  const [notesAnchorEl, setNotesAnchorEl] = useState<HTMLElement | null>(null);
  const [availableNotes, setAvailableNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);

  // API Key settings dialog state
  const [apiKeySettingsOpen, setApiKeySettingsOpen] = useState(false);

  const chatConfig = {
    autoScroll: true
  };

  /**
   * Parse quota/API key errors from Gemini API and return user-friendly message
   */
  const parseQuotaError = (errorMessage: string): { isQuotaError: boolean; userMessage: string; retryDelay?: string } => {
    // Try to extract error details from JSON if present
    let errorCode = '';
    let errorReason = '';

    try {
      // Check if error message contains JSON (from edge function)
      const jsonMatch = errorMessage.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const errorJson = JSON.parse(jsonMatch[0]);
        if (errorJson.error) {
          errorCode = String(errorJson.error.code || '');
          errorReason = errorJson.error.details?.[0]?.reason || '';
        }
      }
    } catch {
      // If JSON parsing fails, use the original message
    }

    // Check if it's an API key error
    const isApiKeyError = errorMessage.toLowerCase().includes('api key expired') ||
                          errorMessage.toLowerCase().includes('api key invalid') ||
                          errorMessage.toLowerCase().includes('api_key_invalid') ||
                          errorReason === 'API_KEY_INVALID' ||
                          errorCode === '400';

    // Check if it's a quota/rate limit error
    const isQuotaError = errorMessage.toLowerCase().includes('quota') ||
                         errorMessage.includes('429') ||
                         errorMessage.toUpperCase().includes('RESOURCE_EXHAUSTED') ||
                         errorMessage.toLowerCase().includes('rate limit');

    if (!isQuotaError && !isApiKeyError) {
      return { isQuotaError: false, userMessage: errorMessage };
    }

    // Extract retry delay if available
    const retryMatch = errorMessage.match(/retry in (\d+\.?\d*)\s*s/i) ||
                       errorMessage.match(/retryDelay["\s:]+(\d+)s/i);
    const retryDelay = retryMatch ? retryMatch[1] : undefined;

    // Check if user has their own API key
    const userHasApiKey = hasApiKey();

    let userMessage = '';

    if (isApiKeyError) {
      userMessage = '⚠️ **API Key Error**\n\n';

      if (userHasApiKey) {
        userMessage += 'Your Gemini API key has expired or is invalid.\n\n';
        userMessage += '**What you can do:**\n';
        userMessage += '• Go to [Google AI Studio](https://aistudio.google.com/app/apikey)\n';
        userMessage += '• Generate a new API key\n';
        userMessage += '• Click the ⚙️ Settings button above to update your key\n';
      } else {
        userMessage += 'The shared API key has expired.\n\n';
        userMessage += '**Solution: Use Your Own API Key**\n';
        userMessage += '• Click the ⚙️ Settings button above\n';
        userMessage += '• Add your free Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)\n';
        userMessage += '• Get unlimited usage with your own quota\n';
      }
    } else {
      // Quota error
      userMessage = '⚠️ **API Quota Exceeded**\n\n';

      if (userHasApiKey) {
        userMessage += 'Your Gemini API key has reached its quota limit.\n\n';
        userMessage += '**What you can do:**\n';
        userMessage += '• Wait for your quota to reset (usually 24 hours)\n';
        userMessage += '• Check your usage at [Google AI Studio](https://aistudio.google.com/app/apikey)\n';
        userMessage += '• Upgrade to a paid plan for higher limits\n';
        if (retryDelay) {
          const seconds = Math.ceil(parseFloat(retryDelay));
          userMessage += `\n*You can retry in ${seconds} seconds*`;
        }
      } else {
        userMessage += 'The shared API key has reached its quota limit.\n\n';
        userMessage += '**Solution: Use Your Own API Key**\n';
        userMessage += '• Click the ⚙️ Settings button above\n';
        userMessage += '• Add your free Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)\n';
        userMessage += '• Get unlimited usage with your own quota\n';
        if (retryDelay) {
          const seconds = Math.ceil(parseFloat(retryDelay));
          userMessage += `\n*Or wait ${seconds} seconds to retry with the shared key*`;
        }
      }
    }

    return { isQuotaError: true, userMessage, retryDelay };
  };

  const MESSAGE_LIMIT = 50;



  // Auto-scroll to bottom whenever messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Note: No longer using embeddings - using smart keyword filtering instead

  // Auto-scroll when messages change
  useEffect(() => {
    if (chatConfig.autoScroll) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom, chatConfig.autoScroll]);



  // Focus input when drawer opens
  useEffect(() => {
    if (open && !isLoading) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, isLoading]);

  // Check message limit whenever messages change
  useEffect(() => {
    setIsAtMessageLimit(messages.length >= MESSAGE_LIMIT);
  }, [messages.length, MESSAGE_LIMIT]);

  // Load conversations when drawer opens (only if calendar is provided)
  useEffect(() => {
    if (open && calendar?.id && user) {
      loadConversations();
    }
  }, [open, calendar?.id, user]);

  // =====================================================
  // CONVERSATION MANAGEMENT FUNCTIONS
  // =====================================================

  const loadConversations = async () => {
    if (!calendar?.id) return;

    setLoadingConversations(true);
    try {
      const convos = await conversationRepo.findByCalendarId(calendar.id);
      setConversations(convos);
    } catch (error) {
      logger.error('Error loading conversations:', error);
    } finally {
      setLoadingConversations(false);
    }
  };

  const saveCurrentConversation = async (updatedMessages: ChatMessageType[]) => {
    if (!user || !calendar?.id || updatedMessages.length === 0) return;

    try {
      const result = await conversationRepo.saveConversation(
        currentConversationId,
        calendar.id,
        user.uid,
        updatedMessages
      );

      if (result.success && result.data) {
        setCurrentConversationId(result.data.id);
        logger.log('Conversation saved successfully:', result.data.id);
        // Reload conversations list
        await loadConversations();
      }
    } catch (error) {
      logger.error('Error saving conversation:', error);
    }
  };

  const handleNewChat = async () => {
    // Save current conversation before starting new one
    if (messages.length > 0) {
      await saveCurrentConversation(messages);
    }

    // Clear state and start fresh
    setMessages([]);
    setCurrentConversationId(null);
    setIsAtMessageLimit(false);
    setShowHistoryView(false); // Slide back to chat view
    logger.log('Started new conversation');
  };

  const handleSelectConversation = (conversation: AIConversation) => {
    // Conversation messages are already transformed to ChatMessage type by repository
    setMessages(conversation.messages as ChatMessageType[]);
    setCurrentConversationId(conversation.id);
    setIsAtMessageLimit(conversation.message_count >= MESSAGE_LIMIT);
    setShowHistoryView(false); // Go back to chat view
    logger.log('Loaded conversation:', conversation.id);
  };

  const handleDeleteClick = (conversationId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent conversation selection
    setConversationToDelete(conversationId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!conversationToDelete) return;

    try {
      const result = await conversationRepo.delete(conversationToDelete);
      if (result.success) {
        logger.log('Conversation deleted:', conversationToDelete);
        // If we deleted the current conversation, start a new one
        if (conversationToDelete === currentConversationId) {
          handleNewChat();
        }
        // Reload conversations list
        await loadConversations();
      }
    } catch (error) {
      logger.error('Error deleting conversation:', error);
    } finally {
      setDeleteDialogOpen(false);
      setConversationToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setConversationToDelete(null);
  };

  const getPreviewText = (conversation: AIConversation): string => {
    const firstUserMessage = conversation.messages.find(msg => msg.role === 'user');
    if (firstUserMessage && firstUserMessage.content) {
      return firstUserMessage.content.substring(0, 80) +
        (firstUserMessage.content.length > 80 ? '...' : '');
    }
    return 'No messages';
  };

  const handleSendMessage = async () => {
    const messageText = inputMessage.trim();
    if (!messageText || isLoading) return;

    cancelRequestedRef.current = false;

    let baseHistory: ChatMessageType[];
    let userMessage: ChatMessageType;

    // Determine whether this is a new message or an edit of an existing user message
    if (editingMessageId) {
      const messageIndex = messages.findIndex(
        msg => msg.id === editingMessageId && msg.role === 'user'
      );

      if (messageIndex === -1) {
        // Fallback: treat as a new message if something went wrong
        baseHistory = messages;
        userMessage = {
          id: uuidv4(),
          role: 'user',
          content: messageText,
          timestamp: new Date(),
          status: 'sent'
        };

        setMessages(prev => [...prev, userMessage]);
      } else {
        baseHistory = messages.slice(0, messageIndex);
        const originalMessage = messages[messageIndex];

        userMessage = {
          ...originalMessage,
          content: messageText,
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
        content: messageText,
        timestamp: new Date(),
        status: 'sent'
      };

      setMessages(prev => [...prev, userMessage]);
    }

    // Clear input
    setInputMessage('');

    setIsLoading(true);
    setIsTyping(true);
    setToolExecutionStatus(''); // Clear any previous tool status

    // Track AI message ID (don't add placeholder yet - wait for first chunk or tool call)
    const aiMessageId = uuidv4();
    let aiMessageAdded = false;

    activeRequestRef.current = { userId: userMessage.id, aiId: aiMessageId };

    try {
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Cancel any previous streaming request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Stream message from Supabase AI agent
      let accumulatedText = '';
      let messageHtml = '';
      let citations: any[] | undefined;
      let embeddedTrades: any | undefined;
      let embeddedEvents: any | undefined;
      let embeddedNotes: any | undefined;
      let toolCallsInProgress: string[] = [];

      for await (const event of supabaseAIChatService.sendMessageStreaming(
        messageText,
        user.uid,
        calendar,
        baseHistory,
        abortController.signal
      )) {
        switch (event.type) {
          case 'text_chunk':
            // Accumulate text
            accumulatedText += event.data.text;

            // Add AI message on first chunk
            if (!aiMessageAdded) {
              const newMessage: ChatMessageType = {
                id: aiMessageId,
                role: 'assistant',
                content: accumulatedText,
                timestamp: new Date(),
                status: 'receiving'
              };
              setMessages(prev => [...prev, newMessage]);
              aiMessageAdded = true;
            } else {
              // Update existing message
              setMessages(prev => prev.map(msg =>
                msg.id === aiMessageId
                  ? { ...msg, content: accumulatedText, status: 'receiving' as const }
                  : msg
              ));
            }
            break;

          case 'tool_call':
            logger.log(`Tool called: ${event.data.name}`);
            toolCallsInProgress.push(event.data.name);

            // Update typing indicator status
            setToolExecutionStatus(toolCallsInProgress.join(', '));
            break;

          case 'tool_result':
            logger.log(`Tool result: ${event.data.name}`);
            // Remove from in-progress list
            toolCallsInProgress = toolCallsInProgress.filter(t => t !== event.data.name);

            // Update typing indicator status
            if (toolCallsInProgress.length > 0) {
              setToolExecutionStatus(toolCallsInProgress.join(', '));
            } else {
              // All tools completed
              setToolExecutionStatus('');
            }
            break;

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

      // If request was cancelled, or we didn't receive any content (e.g. cancelled before first chunk), skip creating a message
      if (cancelRequestedRef.current || (!aiMessageAdded && !accumulatedText)) {
        return;
      }

      // Update or add final message with all data
      const finalMessage: ChatMessageType = {
        id: aiMessageId,
        role: 'assistant',
        content: accumulatedText,
        messageHtml: messageHtml,
        citations,
        embeddedTrades,
        embeddedEvents,
        embeddedNotes,
        timestamp: new Date(),
        status: 'received'
      };

      if (aiMessageAdded) {
        // Update existing message
        setMessages(prev => prev.map(msg =>
          msg.id === aiMessageId ? finalMessage : msg
        ));
      } else {
        // Add message if no text chunks were received
        setMessages(prev => [...prev, finalMessage]);
      }

      // Auto-save conversation after successful message exchange
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

      const errorDetails = error instanceof Error ? error.message : 'Unknown error';
      const quotaErrorInfo = parseQuotaError(errorDetails);

      const chatError: ChatError = {
        type: quotaErrorInfo.isQuotaError ? 'rate_limit' : 'network_error',
        message: quotaErrorInfo.isQuotaError ? 'API Quota Exceeded' : 'Failed to send message',
        details: errorDetails,
        retryable: true
      };

      // Add or update error message
      const errorMessage: ChatMessageType = {
        id: aiMessageId,
        role: 'assistant',
        content: quotaErrorInfo.isQuotaError
          ? quotaErrorInfo.userMessage
          : 'Sorry, I encountered an error processing your message. Please try again.',
        timestamp: new Date(),
        status: 'error',
        error: chatError.message
      };

      if (aiMessageAdded) {
        // Update existing message
        setMessages(prev => prev.map(msg =>
          msg.id === aiMessageId ? errorMessage : msg
        ));
      } else {
        // Add error message if not already added
        setMessages(prev => [...prev, errorMessage]);
      }
    } finally {
      abortControllerRef.current = null;
      activeRequestRef.current = null;
      cancelRequestedRef.current = false;
      setIsLoading(false);
      setIsTyping(false);
      setToolExecutionStatus(''); // Clear tool status
    }
  };

  const handleCancelRequest = () => {
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
  };

  const handleEditMessage = (messageId: string) => {
    const messageToEdit = messages.find(msg => msg.id === messageId);
    if (!messageToEdit || messageToEdit.role !== 'user') return;

    setInputMessage(messageToEdit.content);
    setEditingMessageId(messageId);

    // Focus the input so the user can continue typing immediately
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleOpenNotesContext = async (event: React.MouseEvent<HTMLElement>) => {
    if (!user || isReadOnly) return;

    if (notesAnchorEl) {
      handleCloseNotesContext();
      return;
    }

    setNotesAnchorEl(event.currentTarget);

    if (availableNotes.length > 0 || notesLoading) {
      return;
    }

    try {
      setNotesLoading(true);

      const notes = calendar?.id
        ? await notesService.getCalendarNotes(calendar.id)
        : await notesService.getUserNotes(user.uid);

      const sortedNotes = [...notes].sort((a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );

      setAvailableNotes(sortedNotes.filter(note => !note.is_archived));
    } catch (error) {
      logger.error('Error loading notes for AI context:', error);
    } finally {
      setNotesLoading(false);
    }
  };

  const handleCloseNotesContext = () => {
    setNotesAnchorEl(null);
  };

  const handleInsertNoteContext = (note: Note) => {
    const title = note.title || 'Untitled';

    // Use the insertNote method to create a note entity chip
    if (inputRef.current?.insertNote) {
      inputRef.current.insertNote(title);
    }

    handleCloseNotesContext();
  };


  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };


  const handleMessageRetry = useCallback(async (messageId: string) => {
    // Find the message to retry
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    const messageToRetry = messages[messageIndex];
    if (messageToRetry.role !== 'assistant') return;

    // Find the user message that prompted this response
    let userMessageIndex = messageIndex - 1;
    while (userMessageIndex >= 0 && messages[userMessageIndex].role !== 'user') {
      userMessageIndex--;
    }

    if (userMessageIndex < 0) return;

    const userMessage = messages[userMessageIndex];

    try {
      // Remove all messages after the user message that prompted the retried response
      const updatedMessages = messages.slice(0, userMessageIndex + 1);
      setMessages(updatedMessages);

      // Set loading and typing state so the user sees the "AI is thinking..." indicator
      setIsLoading(true);
      setIsTyping(true);
      setToolExecutionStatus('');

      if (!user) {
        throw new Error('User not authenticated');
      }

      // Regenerate the response using Supabase AI agent
      const response = await supabaseAIChatService.sendMessage(
        userMessage.content,
        user.uid,
        calendar,
        updatedMessages
      );

      if (!response.success) {
        throw new Error(response.message || 'Failed to get AI response');
      }

      // Add the new response with embedded data
      const newAssistantMessage: ChatMessageType = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.message,
        messageHtml: response.messageHtml,
        citations: response.citations,
        embeddedTrades: response.embeddedTrades,
        embeddedEvents: response.embeddedEvents,
        embeddedNotes: response.embeddedNotes,
        timestamp: new Date(),
        status: 'received'
      };

      setMessages(prev => [...prev, newAssistantMessage]);
      logger.log('Message regenerated successfully');

    } catch (error) {
      logger.error('Error regenerating message:', error);

      const errorDetails = error instanceof Error ? error.message : 'Unknown error';
      const quotaErrorInfo = parseQuotaError(errorDetails);

      // Add error message
      const errorMessage: ChatMessageType = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: quotaErrorInfo.isQuotaError
          ? quotaErrorInfo.userMessage
          : 'Sorry, I encountered an error while regenerating the response. Please try again.',
        timestamp: new Date(),
        status: 'error',
        error: quotaErrorInfo.isQuotaError ? 'API Quota Exceeded' : errorDetails
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
      setToolExecutionStatus(''); // Clear tool status
    }
  }, [messages, user, calendar, trades]);





  const getWelcomeMessage = (): ChatMessageType => {
    const contextSummary = (trades && trades.length > 0)
      ? `I can see you have ${trades.length} trades. `
      : '';

    const calendarInfo = calendar
      ? `You're working with the "${calendar.name}" calendar. `
      : 'You can ask me about your trading performance across all your calendars. ';

    const historyNote = !calendar
      ? '\n\n📝 Note: Conversation history is only available when working with a specific calendar.'
      : '';

    return {
      id: 'welcome',
      role: 'assistant',
      content: `👋 Hello! I'm your AI trading analyst. ${calendarInfo}${contextSummary}I can help you analyze your trading performance, identify patterns, and provide insights to improve your trading.

💡 I'll analyze your trading data to give you focused and accurate insights!${historyNote}

What would you like to know about your trading?`,
      timestamp: new Date(),
      status: 'received'
    };
  };

  // Question templates for new users
  const questionTemplates = [
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

  const handleTemplateClick = (question: string) => {
    setInputMessage(question);
    // Auto-focus the input after setting the question
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // Show welcome message and templates if no messages
  const displayMessages = messages.length === 0 ? [getWelcomeMessage()] : messages;
  const showTemplates = messages.length === 0;



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
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 1399,
          opacity: open ? 1 : 0,
          visibility: open ? 'visible' : 'hidden',
          transition: 'opacity 0.3s ease-in-out, visibility 0.3s ease-in-out',
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
          zIndex: 1400,
          height: open ? BOTTOM_SHEET_HEIGHTS.default : 0,
          maxHeight: '85vh',
          width: '100%',
          maxWidth: { xs: '100%', sm: '420px', md: '460px', lg: '500px' },
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          background: theme.palette.mode === 'dark'
            ? 'linear-gradient(135deg, rgba(18, 18, 18, 0.98) 0%, rgba(30, 30, 30, 0.98) 100%)'
            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.98) 100%)',
          backdropFilter: 'blur(20px)',
          boxShadow: theme.palette.mode === 'dark'
            ? '0 -8px 32px rgba(0, 0, 0, 0.6)'
            : '0 -8px 32px rgba(0, 0, 0, 0.15)',
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          borderBottom: 'none',
          transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          overflow: 'hidden',
          pointerEvents: open ? 'auto' : 'none' // Allow interaction only when open
        }}
      >
        <Box sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 2,
            pb: 1,
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            background: alpha(theme.palette.background.paper, 0.8),
            backdropFilter: 'blur(10px)'
          }}
          >
            {/* Left side - Logo and Title */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{
                width: 36,
                height: 36,
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                border: `2px solid ${alpha(theme.palette.primary.main, 0.2)}`
              }}>
                <AIIcon sx={{ fontSize: 20, color: 'white' }} />
              </Avatar>

              <Box>
                <Typography variant="h6" sx={{
                  fontWeight: 700,
                  fontSize: '1.1rem',
                  lineHeight: 1.2
                }}>
                  AI Trading Assistant
                </Typography>
                <Typography variant="caption" sx={{
                  color: 'text.secondary',
                  fontSize: '0.75rem'
                }}>
                  {calendar
                    ? (trades && trades.length > 0
                      ? `${trades.length} trades in ${calendar.name}`
                      : `${calendar.name} - Ready for analysis`)
                    : 'Ready for trading analysis across all calendars'
                  }
                </Typography>
              </Box>
            </Box>

            {/* Right side - Action buttons */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {/* Conversation features only available when calendar is provided */}
              {calendar && (
                <>
                  <Tooltip title="New Chat">
                    <IconButton
                      size="small"
                      onClick={handleNewChat}
                      disabled={messages.length === 0}
                      sx={{
                        color: 'primary.main',
                        '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.1) },
                        '&:disabled': { color: 'text.disabled' }
                      }}
                    >
                      <NewChatIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>

                  <Tooltip title={showHistoryView ? "Back to Chat" : "Conversation History"}>
                    <IconButton
                      size="small"
                      onClick={() => setShowHistoryView(!showHistoryView)}
                      sx={{
                        color: showHistoryView ? 'primary.main' : 'text.secondary',
                        '&:hover': { backgroundColor: alpha(theme.palette.action.hover, 0.5) }
                      }}
                    >
                      {showHistoryView ? <ArrowBackIcon fontSize="small" /> : <HistoryIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </>
              )}

              <Tooltip title="API Key Settings">
                <IconButton
                  size="small"
                  onClick={() => setApiKeySettingsOpen(true)}
                  sx={{
                    color: 'text.secondary',
                    '&:hover': { backgroundColor: alpha(theme.palette.action.hover, 0.5) }
                  }}
                >
                  <SettingsIcon fontSize="small" />
                </IconButton>
              </Tooltip>

              <Tooltip title="Close">
                <IconButton
                  size="small"
                  onClick={onClose}
                  sx={{
                    color: 'text.secondary',
                    '&:hover': { backgroundColor: alpha(theme.palette.action.hover, 0.5) }
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Content - Sliding Pager */}
          <Box sx={{
            height: '720px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative'
          }}>
            {/* Pager Container */}
            <Box sx={{
              display: 'flex',
              width: '200%',
              height: '100%',
              transform: showHistoryView ? 'translateX(-50%)' : 'translateX(0)',
              transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
              {/* Chat View */}
              <Box sx={{
                width: '50%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}>
                {/* Messages */}
                <Box
                sx={{
                  flex: 1,
                  overflow: 'auto',
                  p: 2,
                  pb: 1,
                  backgroundColor: alpha(theme.palette.background.default, 0.3),
                  backgroundImage: `radial-gradient(circle at 20% 80%, ${alpha(theme.palette.primary.main, 0.03)} 0%, transparent 50%),
                                   radial-gradient(circle at 80% 20%, ${alpha(theme.palette.secondary.main, 0.03)} 0%, transparent 50%)`,
                  ...scrollbarStyles(theme)
                }}
              >
                {displayMessages.map((message, index) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    showTimestamp={true}
                    onRetry={handleMessageRetry}
                    isLatestMessage={index === displayMessages.length - 1}
                    enableAnimation={index > 0}
                    onTradeClick={(tradeId, contextTrades) => {
                      if (onOpenGalleryMode) {
                        // Find the clicked trade
                        const clickedTrade = contextTrades.find(t => t.id === tradeId);
                        if (clickedTrade) {
                          // Open gallery mode with all trades, starting from the clicked trade
                          onOpenGalleryMode(contextTrades, tradeId, 'AI Chat - Trade Gallery');
                        }
                      } else {
                        logger.log('Trade clicked but gallery mode not available:', tradeId);
                      }
                    }}
                    onEventClick={(event) => {
                      logger.log('Economic event clicked:', event);
                      setSelectedEvent(event);
                      setEventDetailDialogOpen(true);
                    }}
                    onNoteClick={async (noteId) => {
                      logger.log('Note clicked:', noteId);
                      // Find the note from embedded notes in messages
                      const note = messages
                        .flatMap(m => m.embeddedNotes ? Object.values(m.embeddedNotes) : [])
                        .find(n => n.id === noteId);

                      if (note) {
                        setSelectedNote(note);
                        setNoteEditorOpen(true);
                      } else {
                        logger.warn('Note not found in embedded notes:', noteId);
                      }
                    }}
                    onEdit={handleEditMessage}
                  />
                ))}

                {/* Question Templates - Only show when no conversation started */}
                {showTemplates && (
                  <Box sx={{ mt: 3 }}>
                    <Typography
                      variant="h6"
                      sx={{
                        mb: 2,
                        color: 'text.primary',
                        fontWeight: 600
                      }}
                    >
                      💡 Try these questions:
                    </Typography>

                    {questionTemplates.map((category, categoryIndex) => (
                      <Box key={categoryIndex} sx={{ mb: 3 }}>
                        <Typography
                          variant="subtitle2"
                          sx={{
                            mb: 1.5,
                            color: 'primary.main',
                            fontWeight: 600,
                            fontSize: '0.85rem'
                          }}
                        >
                          {category.category}
                        </Typography>

                        <Box sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1
                        }}>
                          {category.questions.map((question, questionIndex) => (
                            <Button
                              key={questionIndex}
                              variant="outlined"
                              size="small"
                              onClick={() => handleTemplateClick(question)}
                              sx={{
                                justifyContent: 'flex-start',
                                textAlign: 'left',
                                py: 1.5,
                                px: 2,
                                borderRadius: 2,
                                textTransform: 'none',
                                fontSize: '0.875rem',
                                lineHeight: 1.4,
                                borderColor: alpha(theme.palette.primary.main, 0.3),
                                backgroundColor: alpha(theme.palette.background.paper, 0.8),
                                '&:hover': {
                                  borderColor: 'primary.main',
                                  backgroundColor: alpha(theme.palette.primary.main, 0.08),
                                  transform: 'translateY(-1px)',
                                  boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.2)}`
                                },
                                transition: 'all 0.2s ease-in-out'
                              }}
                            >
                              {question}
                            </Button>
                          ))}
                        </Box>
                      </Box>
                    ))}

                    <Box sx={{
                      mt: 3,
                      mb: 2,
                      p: 2,
                      backgroundColor: alpha(theme.palette.info.main, 0.08),
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: alpha(theme.palette.info.main, 0.2)
                    }}>
                      <Typography
                        variant="body2"
                        color="info.main"
                        sx={{ fontWeight: 500 }}
                      >
                        💡 Pro Tip: You can ask complex questions like "I've been struggling with my breakout strategy on Tuesdays. Can you show me all my losing trades tagged 'breakout' that occurred on a Tuesday in the last 6 months, and analyze if there were any specific economic events or market conditions that contributed to these losses?" - I'll analyze your data and provide detailed insights!
                      </Typography>
                    </Box>
                  </Box>
                )}

                {/* Typing Indicator */}
                {isTyping && (
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 2,
                    mb: 2
                  }}>
                    <Box sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      backgroundColor: alpha(theme.palette.grey[500], 0.1),
                      borderRadius: 2,
                      px: 2,
                      py: 1
                    }}>
                      <CircularProgress
                        size={16}
                        thickness={4}
                        sx={{ color: 'text.secondary' }}
                      />
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ fontStyle: 'italic' }}
                      >
                        {toolExecutionStatus
                          ? `AI is thinking... ${toolExecutionStatus}`
                          : 'AI is thinking...'}
                      </Typography>
                    </Box>
                  </Box>
                )}

                <div ref={messagesEndRef} />
              </Box>

              <Divider sx={{ borderColor: alpha(theme.palette.divider, 0.5) }} />

              {/* Message Limit Warning */}
              {isAtMessageLimit && (
                <Box sx={{ p: 2, pb: 0 }}>
                  <Alert
                    severity="warning"
                    action={
                      <Button
                        color="inherit"
                        size="small"
                        onClick={handleNewChat}
                        startIcon={<NewChatIcon />}
                        sx={{ fontWeight: 600 }}
                      >
                        Start New Chat
                      </Button>
                    }
                    sx={{
                      borderRadius: 2,
                      '& .MuiAlert-message': {
                        width: '100%'
                      }
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Conversation Limit Reached
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      This conversation has reached the maximum length of {MESSAGE_LIMIT} messages.
                      Please start a new conversation to continue.
                    </Typography>
                  </Alert>
                </Box>
              )}

              {/* Input Area */}
              <Box sx={{
                p: 2,
                backgroundColor: alpha(theme.palette.background.paper, 0.8),
                backdropFilter: 'blur(10px)'
              }}>
                <Box sx={{
                  display: 'flex',
                  gap: 1,
                  alignItems: 'center',
                  backgroundColor: 'background.paper',
                  borderRadius: 3,
                  p: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  '&:focus-within': {
                    borderColor: 'primary.main',
                    boxShadow: `0 0 0 1px ${alpha(theme.palette.primary.main, 0.15)}`
                  }
                }}>
                  <AIChatMentionInput
                    ref={inputRef}
                    value={inputMessage}
                    onChange={setInputMessage}
                    onKeyDown={handleKeyPress}
                    placeholder={calendar ? "(use @tag to mention tags)" : "Ask me anything about your trading..."}
                    disabled={isLoading || isAtMessageLimit}
                    allTags={calendar?.tags || []}
                    maxRows={4}
                    sx={{ flex: 1, minWidth: 0, fontSize: '0.95rem', lineHeight: 1.4 }}
                  />
                  <IconButton
                    aria-label="Insert note context"
                    onClick={handleOpenNotesContext}
                    disabled={isReadOnly || !user}
                    size="small"
                    sx={{
                      backgroundColor: 'background.default',
                      color: 'text.secondary',
                      width: 32,
                      height: 32,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.primary.main, 0.06),
                        borderColor: 'primary.main',
                        color: 'primary.main'
                      },
                      '&:disabled': {
                        backgroundColor: 'action.disabledBackground',
                        color: 'action.disabled',
                        borderColor: 'action.disabledBackground'
                      }
                    }}
                  >
                    <NotesIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                  <IconButton
                    onClick={isLoading ? handleCancelRequest : handleSendMessage}
                    disabled={(!inputMessage.trim() && !isLoading) || isAtMessageLimit}
                    size="small"
                    sx={{
                      backgroundColor: isLoading
                        ? 'error.main'
                        : inputMessage.trim()
                          ? 'primary.main'
                          : 'action.disabledBackground',
                      color: isLoading
                        ? 'error.contrastText'
                        : inputMessage.trim()
                          ? 'primary.contrastText'
                          : 'action.disabled',
                      width: 36,
                      height: 36,
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        backgroundColor: isLoading
                          ? 'error.dark'
                          : inputMessage.trim()
                            ? 'primary.dark'
                            : 'action.disabledBackground',
                        transform: inputMessage.trim() && !isLoading ? 'scale(1.05)' : 'none'
                      },
                      '&:disabled': {
                        backgroundColor: 'action.disabledBackground',
                        color: 'action.disabled'
                      }
                    }}
                  >
                    {isLoading ? (
                      <StopIcon sx={{ fontSize: 18 }} />
                    ) : (
                      <SendIcon sx={{ fontSize: 18 }} />
                    )}
                  </IconButton>
                </Box>

                {/* Helper Text */}
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    mt: 1,
                    display: 'block',
                    textAlign: 'center',
                    opacity: 0.7
                  }}
                >
                  {'Enter to send • Shift+Enter newline • @ for tags • Notes button inserts note:{title}'}
                </Typography>
              </Box>

              {notesAnchorEl && (
                <Popper
                  open={Boolean(notesAnchorEl)}
                  anchorEl={notesAnchorEl}
                  placement="top-end"
                  disablePortal
                  sx={{ zIndex: 1600 }}
                >
                  <Paper
                    elevation={8}
                    sx={{
                      maxWidth: 360,
                      maxHeight: 320,
                      overflow: 'hidden',
                      borderRadius: 2,
                      boxShadow: theme.shadows[8]
                    }}
                  >
                    <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        Add Context
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Select a note to insert into your message.
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        maxHeight: 250,
                        overflow: 'auto',
                        ...scrollbarStyles(theme)
                      }}
                    >
                      {notesLoading ? (
                        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CircularProgress size={16} />
                          <Typography variant="body2" color="text.secondary">
                            Loading notes...
                          </Typography>
                        </Box>
                      ) : availableNotes.length === 0 ? (
                        <Box sx={{ p: 2 }}>
                          <Typography variant="body2" color="text.secondary">
                            No notes found yet.
                          </Typography>
                        </Box>
                      ) : (
                        <List dense sx={{ p: 0 }}>
                          {availableNotes.map(note => (
                            <ListItemButton
                              key={note.id}
                              onClick={() => handleInsertNoteContext(note)}
                              sx={{
                                px: 1.5,
                                py: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-start'
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                <NotesIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontWeight: 600,
                                    flex: 1,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {note.title || 'Untitled'}
                                </Typography>
                              </Box>
                            </ListItemButton>
                          ))}
                        </List>
                      )}
                    </Box>
                  </Paper>
                </Popper>
              )}
              </Box>
              {/* End Chat View */}

              {/* History View */}
              <Box sx={{
                width: '50%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}>
                {/* History Content */}
                <Box sx={{
                  flex: 1,
                  overflow: 'auto',
                  ...scrollbarStyles(theme)
                }}>
                  {loadingConversations ? (
                    <List sx={{ p: 0 }}>
                      {Array.from({ length: 10 }).map((_, index) => (
                        <React.Fragment key={index}>
                          <ListItem sx={{ py: 2, px: 2 }}>
                            <Box sx={{ width: '100%' }}>
                              {/* Title and chip */}
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <Shimmer
                                  height={20}
                                  width="60%"
                                  borderRadius={4}
                                  variant="wave"
                                  intensity="medium"
                                />
                                <Shimmer
                                  height={20}
                                  width={60}
                                  borderRadius={10}
                                  variant="pulse"
                                  intensity="low"
                                />
                              </Box>

                              {/* Preview text */}
                              <Shimmer
                                height={16}
                                width="90%"
                                borderRadius={4}
                                variant="default"
                                intensity="low"
                                sx={{ mb: 0.5 }}
                              />


                              {/* Date */}
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Shimmer
                                  height={14}
                                  width={120}
                                  borderRadius={4}
                                  variant="default"
                                  intensity="low"
                                />
                              </Box>
                            </Box>
                          </ListItem>
                          {index < 4 && <Divider />}
                        </React.Fragment>
                      ))}
                    </List>
                  ) : conversations.length === 0 ? (
                    <Box sx={{ p: 3 }}>
                      <Alert severity="info">
                        No conversation history yet. Start chatting with the AI to create your first conversation!
                      </Alert>
                    </Box>
                  ) : (
                    <List sx={{ p: 0 }}>
                      {conversations.map((conversation, index) => (
                        <React.Fragment key={conversation.id}>
                          <ListItem disablePadding>
                            <ListItemButton
                              onClick={() => handleSelectConversation(conversation)}
                              sx={{
                                py: 2,
                                px: 2,
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 1,
                                '&:hover': {
                                  backgroundColor: alpha(theme.palette.primary.main, 0.08)
                                }
                              }}
                            >
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                {/* Title and chip */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                  <Typography
                                    variant="subtitle1"
                                    sx={{
                                      fontWeight: 600,
                                      fontSize: '0.95rem',
                                      flex: 1,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    {conversation.title}
                                  </Typography>
                                  <Chip
                                    label={`${conversation.message_count} msgs`}
                                    size="small"
                                    sx={{
                                      height: 20,
                                      fontSize: '0.7rem',
                                      backgroundColor: alpha(theme.palette.primary.main, 0.1),
                                      color: 'primary.main'
                                    }}
                                  />
                                </Box>

                                {/* Preview text */}
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                  sx={{
                                    fontSize: '0.85rem',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    mb: 0.5
                                  }}
                                >
                                  {getPreviewText(conversation)}
                                </Typography>

                                {/* Date */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <ScheduleIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                                  <Typography variant="caption" color="text.disabled">
                                    {format(conversation.updated_at, 'MMM d, yyyy • h:mm a')}
                                  </Typography>
                                </Box>
                              </Box>

                              {/* Delete button */}
                              <IconButton
                                onClick={(e) => handleDeleteClick(conversation.id, e)}
                                size="small"
                                sx={{
                                  color: 'error.main',
                                  flexShrink: 0,
                                  mt: 0.5,
                                  '&:hover': {
                                    backgroundColor: alpha(theme.palette.error.main, 0.1)
                                  }
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </ListItemButton>
                          </ListItem>
                          {index < conversations.length - 1 && <Divider />}
                        </React.Fragment>
                      ))}
                    </List>
                  )}
                </Box>

                {/* Footer Info */}
                {!loadingConversations && conversations.length > 0 && (
                  <Box sx={{
                    p: 2,
                    borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    backgroundColor: alpha(theme.palette.background.default, 0.5)
                  }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                      {conversations.length} conversation{conversations.length !== 1 ? 's' : ''} saved
                    </Typography>
                  </Box>
                )}
              </Box>
              {/* End History View */}
            </Box>
            {/* End Pager Container */}
          </Box>
          {/* End Content */}

        </Box>
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
          trades={trades || []}
          onUpdateTradeProperty={onUpdateTradeProperty}
          onEditTrade={onEditTrade}
          onDeleteTrade={onDeleteTrade}
          onDeleteMultipleTrades={onDeleteMultipleTrades}
          onZoomImage={onZoomImage}
          onOpenGalleryMode={onOpenGalleryMode}
          calendarId={calendar.id}
          calendar={calendar}
          onUpdateCalendarProperty={onUpdateCalendarProperty}
          isReadOnly={isReadOnly}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCancelDelete}
        maxWidth="xs"
        fullWidth
        sx={{
          zIndex: 1500 // Higher than drawer (1400) and backdrop (1399)
        }}
      >
        <DialogTitle>Delete Conversation?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this conversation? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button onClick={handleCancelDelete} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            autoFocus
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* API Key Settings Dialog */}
      <ApiKeySettingsDialog
        open={apiKeySettingsOpen}
        onClose={() => setApiKeySettingsOpen(false)}
      />

      {/* Note Editor Dialog */}
      {noteEditorOpen && selectedNote && calendar && (
        <NoteEditorDialog
          open={noteEditorOpen}
          onClose={() => {
            setNoteEditorOpen(false);
            setSelectedNote(null);
          }}
          note={selectedNote}
          calendarId={calendar.id}
          onSave={(updatedNote) => {
            // Update the note in embedded notes across all messages
            setMessages(prevMessages =>
              prevMessages.map(msg => {
                if (msg.embeddedNotes && msg.embeddedNotes[updatedNote.id]) {
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
            // Remove the note from embedded notes across all messages
            setMessages(prevMessages =>
              prevMessages.map(msg => {
                if (msg.embeddedNotes && msg.embeddedNotes[noteId]) {
                  const { [noteId]: _, ...remainingNotes } = msg.embeddedNotes;
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
          }}
        />
      )}
    </>
  );
};

export default AIChatDrawer;
