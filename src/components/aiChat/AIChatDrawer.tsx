/**
 * AI Chat Drawer Component
 * Main chat interface for AI trading analysis
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
  alpha
} from '@mui/material';
import {
  Send as SendIcon,
  Settings as SettingsIcon,
  SmartToy as AIIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { v4 as uuidv4 } from 'uuid';
import UnifiedDrawer from '../common/UnifiedDrawer';
import ChatMessage from './ChatMessage';
import AIChatSettingsDialog from './AIChatSettingsDialogSimplified';
import {
  ChatMessage as ChatMessageType,
  AIProvider,
  ChatError,
  AIChatConfig,
  AIModelSettings
} from '../../types/aiChat';
import { Trade } from '../../types/trade';
import { Calendar } from '../../types/calendar';
import { firebaseAIChatService } from '../../services/ai/firebaseAIChatService';
import { aiChatConfigService } from '../../services/ai/aiChatConfigService';


import { scrollbarStyles } from '../../styles/scrollbarStyles';
import { logger } from '../../utils/logger';
import { useAuth } from '../../contexts/AuthContext';

interface AIChatDrawerProps {
  open: boolean;
  onClose: () => void;
  trades: Trade[];
  calendar: Calendar;
  onOpenGalleryMode?: (trades: Trade[], initialTradeId?: string, title?: string) => void;
}

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
  const [currentProvider] = useState<AIProvider>('firebase-ai');

  const [error, setError] = useState<ChatError | null>(null);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [isGeneratingContext, setIsGeneratingContext] = useState(false);
  const [isSearchingVectors, setIsSearchingVectors] = useState(false);
  const [chatConfig, setChatConfig] = useState(aiChatConfigService.getConfig());
  const [modelSettings, setModelSettings] = useState<AIModelSettings>({
    model: chatConfig.defaultModel,
    settings: {
      temperature: 0.7,
      maxTokens: 2000,
      topP: 1
    }
  });

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

      // Use AI-driven function calling for dynamic data fetching
      setIsSearchingVectors(true);
      setIsGeneratingContext(true);

      // Send message with AI-driven function calling
      const response = await firebaseAIChatService.sendMessageWithFunctionCalling(
        messageText,
        trades,
        calendar,
        messages,
        modelSettings,
        chatConfig
      );

      const functionCalls = response.functionCalls || [];

      setIsSearchingVectors(false);
      setIsGeneratingContext(false);

      logger.log(`AI executed ${functionCalls.length} function calls`);

      // Add AI response
      const aiMessage: ChatMessageType = {
        id: uuidv4(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
        status: 'received',
        provider: currentProvider,
        tokenCount: response.tokenCount,
        functionCalls: functionCalls
      };

      setMessages(prev => [...prev, aiMessage]);
      logger.log(`AI response received from Firebase AI Logic`);

    } catch (error) {
      logger.error('Error sending message to Firebase AI Logic:', error);

      // Handle Firebase AI Logic errors
      const chatError = error as ChatError;
      if (chatError && chatError.type) {
        setError(chatError);
      } else {
        setError({
          type: 'network_error',
          message: 'Failed to send message',
          details: error instanceof Error ? error.message : 'Unknown error',
          retryable: true
        });
      }

      // Add error message
      const errorMessage: ChatMessageType = {
        id: uuidv4(),
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your message. Please try again.',
        timestamp: new Date(),
        status: 'error',
        error: chatError?.message || 'Unknown error'
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
      // This includes the AI message being retried and any subsequent messages
      const updatedMessages = messages.slice(0, userMessageIndex + 1);
      setMessages(updatedMessages);

      // Set loading state
      setIsLoading(true);

      // Create conversation history up to the user message
      const conversationHistory = updatedMessages;

      if (!user) {
        throw new Error('User not authenticated');
      }

      // Regenerate the response using function calling
      const response = await firebaseAIChatService.sendMessageWithFunctionCalling(
        userMessage.content,
        trades,
        calendar,
        conversationHistory,
        modelSettings,
        chatConfig
      );


      // Add the new response
      const newAssistantMessage: ChatMessageType = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
        status: 'received',
        provider: currentProvider,
        tokenCount: response.tokenCount,
        functionCalls: response.functionCalls || []
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
  }, [messages, currentProvider, trades, calendar, chatConfig]);

  const handleConfigChange = useCallback((newConfig: AIChatConfig, newModelSettings?: AIModelSettings) => {
     
    aiChatConfigService.saveConfig(newConfig);
    logger.log('Configuration updated - context will be regenerated on next message');

    // Update state
    setChatConfig(newConfig);

    // Update model settings if provided
    if (newModelSettings) {
      setModelSettings(newModelSettings);
    }
 
  }, [chatConfig, trades, calendar]);



  const getWelcomeMessage = (): ChatMessageType => {
    const contextSummary = trades.length > 0
      ? `I can see you have ${trades.length} trades. `
      : '';

    return {
      id: 'welcome',
      role: 'assistant',
      content: `👋 Hello! I'm your AI trading analyst. ${contextSummary}I can help you analyze your trading performance, identify patterns, and provide insights to improve your trading.

Here are some things you can ask me:
• "What are my strongest trading sessions?"
• "Analyze my recent performance trends"
• "Which trading strategies work best for me?"
• "What's my risk management like?"
• "Show me patterns in my winning trades"
• "Find trades similar to my best EUR/USD wins"
• "Show me high risk-reward ratio trades"

💡 I'll analyze your trading data to give you focused and accurate insights!

What would you like to know about your trading?`,
      timestamp: new Date(),
      status: 'received',
      provider: currentProvider
    };
  };

  // Show welcome message if no messages
  const displayMessages = messages.length === 0 ? [getWelcomeMessage()] : messages;

  return (
    <>
      <UnifiedDrawer
        open={open}
        onClose={onClose}
        title="AI Trading Assistant"
        subtitle={
          trades.length > 0
            ? `${trades.length} trades ready`
            : 'Ready for trading analysis...'
        }
        icon={<AIIcon />}
        headerActions={
          <Tooltip title="Settings">
            <IconButton
              size="small"
              onClick={() => setShowSettingsDialog(true)}
              sx={{ color: 'text.secondary' }}
            >
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        }
        width={{ xs: '100%', sm: 500 }}
        headerVariant="enhanced"
      >
        <Box sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backgroundColor: 'background.default'
        }}>
          {/* Error Alert */}
          {error && (
            <Alert
              severity="error"
              sx={{
                m: 2,
                mb: 1,
                borderRadius: 2,
                '& .MuiAlert-message': {
                  width: '100%'
                }
              }}
              action={
                error.retryable ? (
                  <Button
                    size="small"
                    startIcon={<RefreshIcon />}
                    onClick={handleRetry}
                  >
                    Retry
                  </Button>
                ) : undefined
              }
            >
              <Typography variant="body2" fontWeight="medium">
                {error.message}
              </Typography>
              {error.details && (
                <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                  {error.details}
                </Typography>
              )}
            </Alert>
          )}



          {/* Loading Context */}
          {(isGeneratingContext || isSearchingVectors) && (
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              p: 2,
              mx: 2,
              mb: 1,
              backgroundColor: alpha(theme.palette.primary.main, 0.08),
              borderRadius: 2,
              border: '1px solid',
              borderColor: alpha(theme.palette.primary.main, 0.2)
            }}>
              <CircularProgress
                size={18}
                thickness={4}
                sx={{ color: 'primary.main' }}
              />
              <Typography
                variant="body2"
                color="primary.main"
                sx={{ fontWeight: 500 }}
              >
                {isSearchingVectors
                  ? 'AI is analyzing your request...'
                  : 'Processing your trading data...'
                }
              </Typography>
            </Box>
          )}

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
                showTokenCount={chatConfig.showTokenCount}
                onRetry={handleMessageRetry}
                isLatestMessage={index === displayMessages.length - 1}
                enableAnimation={index > 0}
                functionCalls={message.functionCalls}
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
              />
            ))}

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
      </UnifiedDrawer>

      {/* AI Chat Settings Dialog */}
      <AIChatSettingsDialog
        open={showSettingsDialog}
        onClose={() => setShowSettingsDialog(false)}
        config={chatConfig}
        modelSettings={modelSettings}
        onConfigChange={handleConfigChange}
        calendar={calendar}
      />
       
    </>
  );
};

export default AIChatDrawer;
