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
import {
  Person as PersonIcon,
  SmartToy as AIIcon,
  ContentCopy as CopyIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { ChatMessage as ChatMessageType, MessageStatus } from '../../types/aiChat';
import { format } from 'date-fns';
import { logger } from '../../utils/logger';

interface ChatMessageProps {
  message: ChatMessageType;
  showTimestamp?: boolean;
  showTokenCount?: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  showTimestamp = true,
  showTokenCount = false
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
        gap: 1,
        mb: 2,
        alignItems: 'flex-start'
      }}
    >
      {/* Avatar */}
      <Avatar
        sx={{
          width: 32,
          height: 32,
          backgroundColor: isUser ? 'primary.main' : 'secondary.main',
          flexShrink: 0
        }}
      >
        {isUser ? <PersonIcon sx={{ fontSize: 18 }} /> : <AIIcon sx={{ fontSize: 18 }} />}
      </Avatar>

      {/* Message Content */}
      <Box
        sx={{
          maxWidth: '75%',
          minWidth: 0
        }}
      >
        {/* Message Bubble */}
        <Paper
          elevation={1}
          sx={{
            p: 2,
            backgroundColor: getMessageBackground(),
            color: getTextColor(),
            borderRadius: 2,
            borderTopLeftRadius: isUser ? 2 : 0.5,
            borderTopRightRadius: isUser ? 0.5 : 2,
            position: 'relative',
            '&:hover .message-actions': {
              opacity: 1
            }
          }}
        >
          {/* Message Content */}
          <Box sx={{ mb: message.error ? 1 : 0 }}>
            {formatContent(message.content)}
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
