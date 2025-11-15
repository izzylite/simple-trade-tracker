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
  DialogActions
} from '@mui/material';
import {
  Send as SendIcon,
  SmartToy as AIIcon,
  Close as CloseIcon,
  AddComment as NewChatIcon,
  History as HistoryIcon,
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon
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

interface AIChatDrawerProps {
  open: boolean;
  onClose: () => void;
  trades: Trade[];
  calendar: Calendar;
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

  const chatConfig = {
    autoScroll: true
  };

  const MESSAGE_LIMIT = 50;



  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    if(messages.length > 0) {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
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

  // Load conversations when drawer opens
  useEffect(() => {
    if (open && calendar.id && user) {
      loadConversations();
    }
  }, [open, calendar.id, user]);

  // =====================================================
  // CONVERSATION MANAGEMENT FUNCTIONS
  // =====================================================

  const loadConversations = async () => {
    if (!calendar.id) return;

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
    if (!user || !calendar.id || updatedMessages.length === 0) return;

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

    // Clear input
    setInputMessage('');

    // Add user message
    const userMessage: ChatMessageType = {
      id: uuidv4(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
      status: 'sent'
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setIsTyping(true);
    setToolExecutionStatus(''); // Clear any previous tool status

    // Track AI message ID (don't add placeholder yet - wait for first chunk or tool call)
    const aiMessageId = uuidv4();
    let aiMessageAdded = false;

    try {
      if (!user) {
        throw new Error('User not authenticated');
      }

      if (!calendar.id) {
        throw new Error('Calendar ID is required');
      }

      // Stream message from Supabase AI agent
      let accumulatedText = '';
      let messageHtml = '';
      let citations: any[] | undefined;
      let embeddedTrades: any | undefined;
      let embeddedEvents: any | undefined;
      let toolCallsInProgress: string[] = [];

      for await (const event of supabaseAIChatService.sendMessageStreaming(
        messageText,
        user.uid,
        calendar.id,
        messages,
        calendar.tags || []
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
            break;

          case 'done':
            messageHtml = event.data.messageHtml || '';
            logger.log('AI response streaming complete');
            break;

          case 'error':
            throw new Error(event.data.error || 'Streaming error');
        }
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
      const updatedMessages = [...messages, userMessage, finalMessage];
      await saveCurrentConversation(updatedMessages);

    } catch (error) {
      logger.error('Error sending message to Supabase AI agent:', error);

      const chatError: ChatError = {
        type: 'network_error',
        message: 'Failed to send message',
        details: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      };

      // Add or update error message
      const errorMessage: ChatMessageType = {
        id: aiMessageId,
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your message. Please try again.',
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
      setIsLoading(false);
      setIsTyping(false);
      setToolExecutionStatus(''); // Clear tool status
    }
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

      // Set loading state
      setIsLoading(true);

      if (!user) {
        throw new Error('User not authenticated');
      }

      if (!calendar.id) {
        throw new Error('Calendar ID is required');
      }

      // Regenerate the response using Supabase AI agent
      const response = await supabaseAIChatService.sendMessage(
        userMessage.content,
        user.uid,
        calendar.id,
        updatedMessages,
        calendar.tags || []
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
        timestamp: new Date(),
        status: 'received'
      };

      setMessages(prev => [...prev, newAssistantMessage]);
      logger.log('Message regenerated successfully');

    } catch (error) {
      logger.error('Error regenerating message:', error);

      // Add error message
      const errorMessage: ChatMessageType = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Sorry, I encountered an error while regenerating the response. Please try again.',
        timestamp: new Date(),
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setToolExecutionStatus(''); // Clear tool status
    }
  }, [messages, user, calendar, trades]);





  const getWelcomeMessage = (): ChatMessageType => {
    const contextSummary = trades.length > 0
      ? `I can see you have ${trades.length} trades. `
      : '';

    return {
      id: 'welcome',
      role: 'assistant',
      content: `👋 Hello! I'm your AI trading analyst. ${contextSummary}I can help you analyze your trading performance, identify patterns, and provide insights to improve your trading.

💡 I'll analyze your trading data to give you focused and accurate insights!

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
                  {trades.length > 0
                    ? `${trades.length} trades ready`
                    : 'Ready for trading analysis...'
                  }
                </Typography>
              </Box>
            </Box>

            {/* Right side - Action buttons */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                    onTradeClick={(tradeId,contextTrades) => {
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
                    placeholder="(use @tag to mention tags)"
                    disabled={isLoading || isAtMessageLimit}
                    allTags={calendar.tags || []}
                    maxRows={4}
                    sx={{ flex: 1, minWidth: 0, fontSize: '0.95rem', lineHeight: 1.4 }}
                  />
                  <IconButton
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isLoading || isAtMessageLimit}
                    size="small"
                    sx={{
                      backgroundColor: inputMessage.trim() && !isLoading ? 'primary.main' : 'action.disabledBackground',
                      color: inputMessage.trim() && !isLoading ? 'primary.contrastText' : 'action.disabled',
                      width: 36,
                      height: 36,
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        backgroundColor: inputMessage.trim() && !isLoading ? 'primary.dark' : 'action.disabledBackground',
                        transform: inputMessage.trim() && !isLoading ? 'scale(1.05)' : 'none'
                      },
                      '&:disabled': {
                        backgroundColor: 'action.disabledBackground',
                        color: 'action.disabled'
                      }
                    }}
                  >
                    {isLoading ? (
                      <CircularProgress size={18} color="inherit" />
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
                  Enter to send • Shift+Enter newline • @ for tags
                </Typography>
              </Box>
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
      {selectedEvent && (
        <EconomicEventDetailDialog
          open={eventDetailDialogOpen}
          onClose={() => {
            setEventDetailDialogOpen(false);
            setSelectedEvent(null);
          }}
          event={selectedEvent}
          trades={trades}
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
    </>
  );
};

export default AIChatDrawer;
