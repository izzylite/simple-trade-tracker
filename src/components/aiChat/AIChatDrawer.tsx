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
  Chip,
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
  TradingDataContext,
  ChatError,
  AIChatConfig,
  AIModelSettings
} from '../../types/aiChat';
import { Trade } from '../../types/trade';
import { Calendar } from '../../types/calendar';
import { firebaseAIChatService } from '../../services/firebaseAIChatService';
import { tradingDataContextService } from '../../services/tradingDataContextService';
import { aiChatConfigService } from '../../services/aiChatConfigService';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import { logger } from '../../utils/logger';

interface AIChatDrawerProps {
  open: boolean;
  onClose: () => void;
  trades: Trade[];
  calendar: Calendar;
}

const AIChatDrawer: React.FC<AIChatDrawerProps> = ({
  open,
  onClose,
  trades,
  calendar
}) => {
  const theme = useTheme();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // State
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [currentProvider] = useState<AIProvider>('firebase-ai');
  const [tradingContext, setTradingContext] = useState<TradingDataContext | null>(null);
  const [error, setError] = useState<ChatError | null>(null);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [isGeneratingContext, setIsGeneratingContext] = useState(false);
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

  // Generate trading context when drawer opens
  useEffect(() => {
    if (open && !tradingContext && trades.length > 0) {
      generateTradingContext();
    }
  }, [open, trades, calendar]);

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

  const generateTradingContext = async (reason?: string) => {
    setIsGeneratingContext(true);
    try {
      const context = await tradingDataContextService.generateContext(
        trades,
        calendar,
        chatConfig
      );
      setTradingContext(context);
      logger.log(`Trading context generated for AI chat${reason ? ` (${reason})` : ''}`);
    } catch (error) {
      logger.error('Error generating trading context:', error);
      setError({
        type: 'context_too_large',
        message: 'Failed to prepare trading data',
        details: 'Unable to analyze your trading data for AI chat',
        retryable: true
      });
    } finally {
      setIsGeneratingContext(false);
    }
  };

  const handleSendMessage = async () => {
    const messageText = inputMessage.trim();
    if (!messageText || isLoading) return;

    // Check if we have trading context
    if (!tradingContext) {
      setError({
        type: 'context_too_large',
        message: 'Trading context not available',
        details: 'Please wait for trading data to be analyzed',
        retryable: true
      });
      return;
    }

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
      // Send message to AI using Firebase AI Logic
      const response = await firebaseAIChatService.sendMessage(
        messageText,
        currentProvider,
        tradingContext,
        messages,
        modelSettings
      );

      // Add AI response
      const aiMessage: ChatMessageType = {
        id: uuidv4(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
        status: 'received',
        provider: currentProvider,
        tokenCount: response.tokenCount
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
    if (error?.type === 'context_too_large') {
      generateTradingContext('retry after error');
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
      // Remove the assistant message being retried
      const updatedMessages = messages.filter(msg => msg.id !== messageId);
      setMessages(updatedMessages);

      // Set loading state
      setIsLoading(true);

      // Create conversation history up to the user message
      const conversationHistory = updatedMessages.slice(0, userMessageIndex + 1);

      // Regenerate the response using Firebase AI Logic
      const response = await firebaseAIChatService.sendMessage(
        userMessage.content,
        currentProvider,
        tradingContext!,
        conversationHistory,
        modelSettings
      );

      // Add the new response
      const newAssistantMessage: ChatMessageType = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
        status: 'received',
        provider: currentProvider,
        tokenCount: response.tokenCount
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
  }, [messages, tradingContext, currentProvider]);

  const handleConfigChange = useCallback((newConfig: AIChatConfig, newModelSettings?: AIModelSettings) => {
    const oldConfig = chatConfig; // Capture current state before update
    aiChatConfigService.saveConfig(newConfig);

    // Check if context-affecting settings changed
    const contextAffectingSettings = [
      'includeDetailedTrades',
      'includeTagAnalysis',
      'includeEconomicEvents',
      'includeRecentTrades',
      'maxContextTrades'
    ] as const;

    const shouldRegenerateContext = contextAffectingSettings.some(
      setting => newConfig[setting] !== oldConfig[setting]
    );

    // Update state
    setChatConfig(newConfig);

    // Update model settings if provided
    if (newModelSettings) {
      setModelSettings(newModelSettings);
    }

    // Regenerate context if needed (using the new config directly)
    if (shouldRegenerateContext) {
      logger.log('Regenerating trading context due to preference changes');
      setIsGeneratingContext(true);
      // Pass the new config directly to avoid stale state
      tradingDataContextService.generateContext(trades, calendar, newConfig)
        .then(context => {
          setTradingContext(context);
          logger.log('Trading context updated with new settings');
        })
        .catch(error => {
          logger.error('Error regenerating trading context:', error);
          setError({
            type: 'context_too_large',
            message: 'Failed to update trading data',
            details: 'Unable to regenerate context with new settings',
            retryable: true
          });
        })
        .finally(() => {
          setIsGeneratingContext(false);
        });
    }
  }, [chatConfig, trades, calendar]);



  const getWelcomeMessage = (): ChatMessageType => {
    const contextSummary = tradingContext 
      ? `I can see you have ${tradingContext.totalTrades} trades with a ${tradingContext.winRate.toFixed(1)}% win rate. `
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
        subtitle={tradingContext ? `${tradingContext.totalTrades} trades analyzed • ${chatConfig.defaultProvider.toUpperCase()} ${chatConfig.defaultModel}` : 'Analyzing your trading data...'}
        icon={<AIIcon />}
        headerActions={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip
              label={currentProvider.toUpperCase()}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.7rem' }}
            />
            <Tooltip title="Settings">
              <IconButton
                size="small"
                onClick={() => setShowSettingsDialog(true)}
                sx={{ color: 'text.secondary' }}
              >
                <SettingsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        }
        width={{ xs: '100%', sm: 500 }}
        headerVariant="enhanced"
      >
        <Box sx={{ 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Error Alert */}
          {error && (
            <Alert
              severity="error"
              sx={{ m: 2, mb: 1 }}
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
          {isGeneratingContext && (
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              p: 2,
              backgroundColor: alpha(theme.palette.primary.main, 0.1)
            }}>
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">
                {tradingContext ? 'Updating trading data analysis...' : 'Analyzing your trading data...'}
              </Typography>
            </Box>
          )}

          {/* Messages */}
          <Box
            sx={{
              flex: 1,
              overflow: 'auto',
              p: 2,
              ...scrollbarStyles(theme)
            }}
          >
            {displayMessages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                showTimestamp={true}
                showTokenCount={chatConfig.showTokenCount}
                onRetry={handleMessageRetry}
              />
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1, 
                p: 2,
                color: 'text.secondary'
              }}>
                <CircularProgress size={16} />
                <Typography variant="body2">
                  AI is thinking...
                </Typography>
              </Box>
            )}

            <div ref={messagesEndRef} />
          </Box>

          <Divider />

          {/* Input Area */}
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
              <TextField
                ref={inputRef}
                fullWidth
                multiline
                maxRows={4}
                placeholder="Ask me about your trading performance..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={isLoading || !tradingContext}
                variant="outlined"
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2
                  }
                }}
              />
              <IconButton
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading || !tradingContext}
                color="primary"
                sx={{
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': {
                    backgroundColor: 'primary.dark'
                  },
                  '&:disabled': {
                    backgroundColor: 'action.disabledBackground'
                  }
                }}
              >
                {isLoading ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  <SendIcon />
                )}
              </IconButton>
            </Box>

            {/* Helper Text */}
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Press Enter to send, Shift+Enter for new line
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
      />
    </>
  );
};

export default AIChatDrawer;
