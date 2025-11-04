import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  TextField,
  IconButton,
  Paper,
  Stack,
  useTheme,
  alpha,
  Avatar,
  Chip
} from '@mui/material';
import {
  Send as SendIcon,
  SmartToy as AIIcon
} from '@mui/icons-material';
import AppHeader from './common/AppHeader';

interface ChatPageProps {
  onToggleTheme: () => void;
  mode: 'light' | 'dark';
  onMenuClick?: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const ChatPage: React.FC<ChatPageProps> = ({ onToggleTheme, mode, onMenuClick }) => {
  const theme = useTheme();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your AI trading assistant. I can help you analyze your trades, provide insights, and answer questions about your trading performance across all your calendars. How can I help you today?',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages([...messages, newMessage]);
    setInputValue('');

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'This is a placeholder response. The AI chat functionality will be fully implemented soon with access to all your trading data and calendars.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiResponse]);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'custom.pageBackground', display: 'flex', flexDirection: 'column' }}>
      <AppHeader onToggleTheme={onToggleTheme} mode={mode} onMenuClick={onMenuClick} />

      <Container maxWidth="lg" disableGutters sx={{ flex: 1, display: 'flex', flexDirection: 'column', py: 4, px: 0 }}>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            AI Trading Assistant
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Chat with AI to get insights about your trading performance
          </Typography>
        </Box>

        {/* Chat Container */}
        <Paper
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 3,
            overflow: 'hidden',
            minHeight: 0
          }}
        >
          {/* Messages Area */}
          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              p: 3,
              display: 'flex',
              flexDirection: 'column',
              gap: 2
            }}
          >
            {messages.map((message) => (
              <Box
                key={message.id}
                sx={{
                  display: 'flex',
                  justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                  gap: 2
                }}
              >
                {message.role === 'assistant' && (
                  <Avatar
                    sx={{
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: theme.palette.primary.main
                    }}
                  >
                    <AIIcon />
                  </Avatar>
                )}
                <Box
                  sx={{
                    maxWidth: '70%',
                    bgcolor: message.role === 'user'
                      ? theme.palette.primary.main
                      : alpha(theme.palette.grey[500], 0.1),
                    color: message.role === 'user'
                      ? theme.palette.primary.contrastText
                      : theme.palette.text.primary,
                    borderRadius: 2,
                    p: 2
                  }}
                >
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                    {message.content}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      mt: 1,
                      display: 'block',
                      opacity: 0.7
                    }}
                  >
                    {message.timestamp.toLocaleTimeString()}
                  </Typography>
                </Box>
                {message.role === 'user' && (
                  <Avatar
                    sx={{
                      bgcolor: theme.palette.primary.main,
                      color: theme.palette.primary.contrastText
                    }}
                  >
                    U
                  </Avatar>
                )}
              </Box>
            ))}
          </Box>

          {/* Input Area */}
          <Box
            sx={{
              p: 2,
              borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              bgcolor: alpha(theme.palette.background.paper, 0.5)
            }}
          >
            <Stack direction="row" spacing={1} alignItems="flex-end">
              <TextField
                fullWidth
                multiline
                maxRows={4}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about your trades..."
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2
                  }
                }}
              />
              <IconButton
                color="primary"
                onClick={handleSendMessage}
                disabled={!inputValue.trim()}
                sx={{
                  bgcolor: theme.palette.primary.main,
                  color: theme.palette.primary.contrastText,
                  '&:hover': {
                    bgcolor: theme.palette.primary.dark
                  },
                  '&.Mui-disabled': {
                    bgcolor: alpha(theme.palette.primary.main, 0.3),
                    color: alpha(theme.palette.primary.contrastText, 0.5)
                  }
                }}
              >
                <SendIcon />
              </IconButton>
            </Stack>

            {/* Suggested Prompts */}
            <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
              <Chip
                label="Show my best trades"
                size="small"
                onClick={() => setInputValue('Show my best trades')}
                sx={{ cursor: 'pointer' }}
              />
              <Chip
                label="Analyze my win rate"
                size="small"
                onClick={() => setInputValue('Analyze my win rate')}
                sx={{ cursor: 'pointer' }}
              />
              <Chip
                label="What's my average profit?"
                size="small"
                onClick={() => setInputValue("What's my average profit?")}
                sx={{ cursor: 'pointer' }}
              />
              <Chip
                label="Show recent economic events"
                size="small"
                onClick={() => setInputValue('Show recent economic events')}
                sx={{ cursor: 'pointer' }}
              />
            </Stack>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default ChatPage;

