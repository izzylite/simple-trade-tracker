/**
 * AI Chat Bottom Sheet Component
 * Modern bottom sheet interface for AI trading analysis
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Tooltip,
  Divider,
  useTheme,
  alpha,
  Avatar
} from '@mui/material';
import {
  Send as SendIcon,
  SmartToy as AIIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { v4 as uuidv4 } from 'uuid';
import ChatMessage from './ChatMessage';
import {
  ChatMessage as ChatMessageType,
  ChatError
} from '../../types/aiChat';
import { Trade } from '../../types/trade';
import { Calendar } from '../../types/calendar';
import { supabaseAIChatService } from '../../services/supabaseAIChatService';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import { logger } from '../../utils/logger';
import { useAuth } from '../../contexts/SupabaseAuthContext';

interface AIChatDrawerProps {
  open: boolean;
  onClose: () => void;
  trades: Trade[];
  calendar: Calendar;
  onOpenGalleryMode?: (trades: Trade[], initialTradeId?: string, title?: string) => void;
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
  onOpenGalleryMode
}) => {
  const theme = useTheme();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // State
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);

  const chatConfig = {
    autoScroll: true
  };



  // Auto-scroll to bottom
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



  const handleSendMessage = async () => {
    const messageText = inputMessage.trim();
    if (!messageText || isLoading) return;

    // Clear error and input
    setError(null);
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

    try {
      if (!user) {
        throw new Error('User not authenticated');
      }

      if (!calendar.id) {
        throw new Error('Calendar ID is required');
      }

      // Send message to Supabase AI agent
      const response = await supabaseAIChatService.sendMessage(
        messageText,
        user.uid,
        calendar.id,
        messages
      );

      if (!response.success) {
        throw new Error(response.message || 'Failed to get AI response');
      }

      logger.log(`AI response received from Supabase edge function`);

      // Add AI response with HTML and citations
      const aiMessage: ChatMessageType = {
        id: uuidv4(),
        role: 'assistant',
        content: response.message,
        messageHtml: response.messageHtml,
        citations: response.citations,
        timestamp: new Date(),
        status: 'received'
      };

      setMessages(prev => [...prev, aiMessage]);

    } catch (error) {
      logger.error('Error sending message to Supabase AI agent:', error);

      const chatError: ChatError = {
        type: 'network_error',
        message: 'Failed to send message',
        details: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      };

      setError(chatError);

      // Add error message
      const errorMessage: ChatMessageType = {
        id: uuidv4(),
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your message. Please try again.',
        timestamp: new Date(),
        status: 'error',
        error: chatError.message
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleRetry = () => {
    setError(null);
    // Simply clear the error - the next message will regenerate context
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
        updatedMessages
      );

      if (!response.success) {
        throw new Error(response.message || 'Failed to get AI response');
      }

      // Add the new response
      const newAssistantMessage: ChatMessageType = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.message,
        messageHtml: response.messageHtml,
        citations: response.citations,
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
              {/* Settings button commented out - Vector Migration is for testing only */}
              {/* <Tooltip title="Settings">
                <IconButton
                  size="small"
                  onClick={() => setShowSettingsDialog(true)}
                  sx={{
                    color: 'text.secondary',
                    '&:hover': { backgroundColor: alpha(theme.palette.action.hover, 0.5) }
                  }}
                >
                  <SettingsIcon fontSize="small" />
                </IconButton>
              </Tooltip> */}

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

          {/* Content */}
          <Box sx={{
            height: '720px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
 




              {/* Messages */}
              <Box
                sx={{
                  flex: 1,
                  overflow: 'auto',
                  p: 3,
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
                    showTokenCount={false}
                    onRetry={handleMessageRetry}
                    isLatestMessage={index === displayMessages.length - 1}
                    enableAnimation={index > 0}
                    allTrades={trades}
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
                      // TODO: Implement event detail view or economic calendar navigation
                      logger.log('Economic event clicked:', event);
                      // For now, just log the event. In the future, this could:
                      // - Open an event detail dialog
                      // - Navigate to the economic calendar with the event highlighted
                      // - Show related trades that occurred during this event
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
                        AI is thinking...
                      </Typography>
                    </Box>
                  </Box>
                )}

                <div ref={messagesEndRef} />
              </Box>

              <Divider sx={{ borderColor: alpha(theme.palette.divider, 0.5) }} />

              {/* Input Area */}
              <Box sx={{
                p: 2,
                backgroundColor: alpha(theme.palette.background.paper, 0.8),
                backdropFilter: 'blur(10px)'
              }}>
                <Box sx={{
                  display: 'flex',
                  gap: 1,
                  alignItems: 'flex-end',
                  backgroundColor: 'background.paper',
                  borderRadius: 3,
                  p: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  '&:focus-within': {
                    borderColor: 'primary.main',
                    boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}`
                  }
                }}>
                  <TextField
                    ref={inputRef}
                    fullWidth
                    multiline
                    maxRows={4}
                    placeholder="Ask me about your trading performance..."
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    disabled={isLoading}
                    variant="standard"
                    InputProps={{
                      disableUnderline: true,
                      sx: {
                        fontSize: '0.95rem',
                        lineHeight: 1.4
                      }
                    }}
                    sx={{
                      '& .MuiInputBase-input': {
                        padding: '8px 0'
                      }
                    }}
                  />
                  <IconButton
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isLoading}
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
                  Press Enter to send • Shift+Enter for new line
                </Typography>
              </Box>
            </Box>

        </Box>
      </Box>

      {/* Vector Migration Dialog - Commented out for testing only */}
      {/* <AIChatSettingsDialog
        open={showSettingsDialog}
        onClose={() => setShowSettingsDialog(false)}
        calendar={calendar}
      /> */}
    </>
  );
};

export default AIChatDrawer;
