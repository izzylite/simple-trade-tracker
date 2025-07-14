/**
 * Chat Message Component
 * Displays user and AI messages with proper formatting
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Avatar,
  IconButton,
  Tooltip,
  Chip,
  Alert,
  useTheme,
  alpha
} from '@mui/material';
import AnimatedText from './AnimatedText';
import {
  Person as PersonIcon,
  SmartToy as AIIcon,
  ContentCopy as CopyIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { ChatMessage as ChatMessageType, MessageStatus } from '../../types/aiChat';
import { format } from 'date-fns';
import { logger } from '../../utils/logger';

interface ChatMessageProps {
  message: ChatMessageType;
  showTimestamp?: boolean;
  showTokenCount?: boolean;
  onRetry?: (messageId: string) => void;
  isLatestMessage?: boolean;
  enableAnimation?: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  showTimestamp = true,
  showTokenCount = false,
  onRetry,
  isLatestMessage = false,
  enableAnimation = true
}) => {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      logger.log('Message copied to clipboard');
    } catch (error) {
      logger.error('Failed to copy message:', error);
    }
  };

  const getStatusIcon = () => {
    switch (message.status) {
      case 'sending':
        return <ScheduleIcon sx={{ fontSize: 14, color: 'text.secondary' }} />;
      case 'sent':
      case 'received':
        return <CheckIcon sx={{ fontSize: 14, color: 'success.main' }} />;
      case 'error':
        return <ErrorIcon sx={{ fontSize: 14, color: 'error.main' }} />;
      default:
        return null;
    }
  };

  const getMessageBackground = () => {
    if (isUser) {
      return theme.palette.primary.main;
    }
    
    if (message.status === 'error') {
      return alpha(theme.palette.error.main, 0.1);
    }
    
    return theme.palette.mode === 'dark' 
      ? alpha(theme.palette.background.paper, 0.8)
      : alpha(theme.palette.grey[100], 0.8);
  };

  const getTextColor = () => {
    if (isUser) {
      return theme.palette.primary.contrastText;
    }
    
    return theme.palette.text.primary;
  };

  // Format message content with basic markdown-like formatting
  const formatContent = (content: string) => {
    // Split content by code blocks
    const parts = content.split(/(```[\s\S]*?```|`[^`]+`)/);
    
    return parts.map((part, index) => {
      // Code blocks
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3).trim();
        const lines = code.split('\n');
        const language = lines[0]?.match(/^[a-zA-Z]+$/) ? lines.shift() : '';
        const codeContent = lines.join('\n');
        
        return (
          <Paper
            key={index}
            variant="outlined"
            sx={{
              p: 2,
              my: 1,
              backgroundColor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              overflow: 'auto'
            }}
          >
            {language && (
              <Chip 
                label={language} 
                size="small" 
                sx={{ mb: 1, fontSize: '0.75rem' }} 
              />
            )}
            <Typography
              component="pre"
              sx={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'inherit'
              }}
            >
              {codeContent}
            </Typography>
          </Paper>
        );
      }
      
      // Inline code
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <Box
            key={index}
            component="span"
            sx={{
              backgroundColor: alpha(theme.palette.text.primary, 0.1),
              padding: '2px 4px',
              borderRadius: 1,
              fontFamily: 'monospace',
              fontSize: '0.875em'
            }}
          >
            {part.slice(1, -1)}
          </Box>
        );
      }
      
      // Regular text with line breaks
      return (
        <Typography
          key={index}
          component="span"
          sx={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}
        >
          {part}
        </Typography>
      );
    });
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        gap: 1.5,
        mb: 3,
        alignItems: 'flex-start',
        px: 1,
        animation: isLatestMessage && isAssistant ? 'fadeInUp 0.3s ease-out' : 'none',
        '@keyframes fadeInUp': {
          '0%': {
            opacity: 0,
            transform: 'translateY(10px)'
          },
          '100%': {
            opacity: 1,
            transform: 'translateY(0)'
          }
        }
      }}
    >
      {/* Avatar */}
      <Avatar
        sx={{
          width: 36,
          height: 36,
          backgroundColor: isUser ? 'primary.main' : 'secondary.main',
          flexShrink: 0,
          boxShadow: 1
        }}
      >
        {isUser ? <PersonIcon sx={{ fontSize: 20 }} /> : <AIIcon sx={{ fontSize: 20 }} />}
      </Avatar>

      {/* Message Content */}
      <Box
        sx={{
          maxWidth: isUser ? '80%' : '85%',
          minWidth: 0,
          flex: 1
        }}
      >
        {/* Message Bubble */}
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            backgroundColor: getMessageBackground(),
            color: getTextColor(),
            borderRadius: 4,
            borderTopLeftRadius: isUser ? 4 : 1,
            borderTopRightRadius: isUser ? 1 : 4,
            borderBottomLeftRadius: isUser ? 4 : 4,
            borderBottomRightRadius: isUser ? 4 : 4,
            position: 'relative',
            maxWidth: '100%',
            boxShadow: isUser
              ? '0 2px 8px rgba(0,0,0,0.1)'
              : '0 1px 4px rgba(0,0,0,0.05)',
            border: isUser ? 'none' : '1px solid',
            borderColor: isUser ? 'transparent' : alpha(theme.palette.divider, 0.3),
            '&:hover .message-actions': {
              opacity: 1
            }
          }}
        >
          {/* Message Content */}
          <Box sx={{ mb: message.error ? 1 : 0 }}>
            {isAssistant && enableAnimation && isLatestMessage ? (
              <AnimatedText
                text={message.content}
                speed={Math.min(50, Math.max(20, message.content.length / 10))}
                isAnimating={message.status === 'received'}
              />
            ) : (
              formatContent(message.content)
            )}
          </Box>

          {/* Error Message */}
          {message.error && (
            <Alert severity="error" sx={{ mt: 1, fontSize: '0.875rem' }}>
              {message.error}
            </Alert>
          )}

          {/* Message Actions */}
          <Box
            className="message-actions"
            sx={{
              position: 'absolute',
              top: 4,
              right: 4,
              opacity: 0,
              transition: 'opacity 0.2s',
              display: 'flex',
              gap: 0.5
            }}
          >
            {/* Retry button for assistant messages */}
            {isAssistant && onRetry && (
              <Tooltip title="Regenerate response">
                <IconButton
                  size="small"
                  onClick={() => onRetry(message.id)}
                  sx={{
                    backgroundColor: alpha(theme.palette.background.paper, 0.8),
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.background.paper, 0.9)
                    }
                  }}
                >
                  <RefreshIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}

            <Tooltip title={copied ? 'Copied!' : 'Copy message'}>
              <IconButton
                size="small"
                onClick={handleCopy}
                sx={{
                  backgroundColor: alpha(theme.palette.background.paper, 0.8),
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.background.paper, 0.9)
                  }
                }}
              >
                {copied ? <CheckIcon sx={{ fontSize: 16 }} /> : <CopyIcon sx={{ fontSize: 16 }} />}
              </IconButton>
            </Tooltip>
          </Box>
        </Paper>

        {/* Message Metadata */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mt: 0.5,
            px: 1,
            justifyContent: isUser ? 'flex-end' : 'flex-start'
          }}
        >
          {/* Timestamp */}
          {showTimestamp && (
            <Typography variant="caption" color="text.secondary">
              {format(message.timestamp, 'HH:mm')}
            </Typography>
          )}

          {/* Status Icon */}
          {getStatusIcon()}

          {/* Provider Badge */}
          {isAssistant && message.provider && (
            <Chip
              label={message.provider.toUpperCase()}
              size="small"
              variant="outlined"
              sx={{ 
                fontSize: '0.6rem', 
                height: 16,
                '& .MuiChip-label': { px: 0.5 }
              }}
            />
          )}

          {/* Token Count */}
          {showTokenCount && message.tokenCount && (
            <Tooltip title="Token count">
              <Typography variant="caption" color="text.secondary">
                {message.tokenCount} tokens
              </Typography>
            </Tooltip>
          )}
        </Box>

        {/* Trading Insights */}
        {message.metadata?.tradingInsights && message.metadata.tradingInsights.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Key Insights:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {message.metadata.tradingInsights.slice(0, 3).map((insight, index) => (
                <Chip
                  key={index}
                  label={`${insight.title}: ${insight.value}`}
                  size="small"
                  variant="outlined"
                  color={insight.type === 'warning' ? 'warning' : 'default'}
                  sx={{ fontSize: '0.7rem' }}
                />
              ))}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ChatMessage;
