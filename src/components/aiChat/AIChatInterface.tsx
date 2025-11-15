/**
 * Reusable AI Chat Interface Component
 * Shared UI for both AIChatDrawer and ChatPage
 */

import React, { useRef, useEffect, useCallback } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Button,
  Typography,
  CircularProgress,
  Divider,
  useTheme,
  alpha,
  Chip
} from '@mui/material';
import {
  Send as SendIcon
} from '@mui/icons-material';
import ChatMessage from './ChatMessage';
import TagMentionInput from './TagMentionInput';
import { ChatMessage as ChatMessageType } from '../../types/aiChat';
import { Trade } from '../../types/trade';
import { EconomicEvent } from '../../types/economicCalendar';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import { logger } from '../../utils/logger';

interface AIChatInterfaceProps {
  messages: ChatMessageType[];
  inputMessage: string;
  isLoading: boolean;
  isTyping: boolean;
  toolExecutionStatus: string;
  allTags?: string[];
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onMessageRetry: (messageId: string) => void;
  onTradeClick?: (tradeId: string, contextTrades: Trade[]) => void;
  onEventClick?: (event: EconomicEvent) => void;
  disabled?: boolean;
  showTemplates?: boolean;
  questionTemplates?: Array<{
    category: string;
    questions: string[];
  }>;
  onTemplateClick?: (question: string) => void;
  welcomeMessage?: ChatMessageType;
}

const AIChatInterface: React.FC<AIChatInterfaceProps> = ({
  messages,
  inputMessage,
  isLoading,
  isTyping,
  toolExecutionStatus,
  allTags = [],
  onInputChange,
  onSendMessage,
  onMessageRetry,
  onTradeClick,
  onEventClick,
  disabled = false,
  showTemplates = false,
  questionTemplates = [],
  onTemplateClick,
  welcomeMessage
}) => {
  const theme = useTheme();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Focus input when not loading
  useEffect(() => {
    if (!isLoading) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isLoading]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSendMessage();
    }
  };

  // Display messages with welcome message if provided
  const displayMessages = messages.length === 0 && welcomeMessage ? [welcomeMessage] : messages;

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* Messages Area */}
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
        <Box sx={{ px: 2 }}>
          {displayMessages.map((message, index) => (
            <ChatMessage
              key={message.id}
              message={message}
              showTimestamp={true}
              onRetry={onMessageRetry}
              isLatestMessage={index === displayMessages.length - 1}
              enableAnimation={index > 0}
              onTradeClick={(tradeId, contextTrades) => {
                if (onTradeClick) {
                  onTradeClick(tradeId, contextTrades);
                } else {
                  logger.log('Trade clicked but handler not available:', tradeId);
                }
              }}
              onEventClick={(event) => {
                if (onEventClick) {
                  onEventClick(event);
                } else {
                  logger.log('Economic event clicked but handler not available:', event);
                }
              }}
            />
          ))}

          {/* Question Templates - Only show when no conversation started */}
          {showTemplates && questionTemplates.length > 0 && (
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
                        onClick={() => onTemplateClick?.(question)}
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


      </Box>
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
          {allTags.length > 0 ? (
            <TagMentionInput
              value={inputMessage}
              onChange={onInputChange}
              onKeyDown={handleKeyDown}
              placeholder="(use @tag to mention tags)"
              disabled={isLoading || disabled}
              allTags={allTags}
              multiline
              maxRows={4}
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
          ) : (
            <TextField
              fullWidth
              multiline
              maxRows={4}
              value={inputMessage}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything about your trades..."
              disabled={isLoading || disabled}
              variant="standard"
              InputProps={{
                disableUnderline: true,
                sx: {
                  fontSize: '0.95rem',
                  lineHeight: 1.4,
                  padding: '8px 0'
                }
              }}
            />
          )}
          <IconButton
            onClick={onSendMessage}
            disabled={!inputMessage.trim() || isLoading || disabled}
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
          Press Enter to send • Shift+Enter for new line{allTags.length > 0 ? ' • Type @ to mention tags' : ''}
        </Typography>
      </Box>
    </Box>
  );
};

export default AIChatInterface;

