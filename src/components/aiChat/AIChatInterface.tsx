/**
 * AIChatInterface Component
 * Reusable AI chat interface that can be embedded in different containers
 * Contains: Messages, Templates, Typing Indicator, Input Area, Notes Popup
 */

import React, { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import {
  Box,
  IconButton,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Divider,
  useTheme,
  alpha,
  List,
  ListItemButton,
  Popper,
  Paper,
  ClickAwayListener
} from '@mui/material';
import {
  Send as SendIcon,
  AddComment as NewChatIcon,
  Stop as StopIcon,
  Notes as NotesIcon
} from '@mui/icons-material';
import ChatMessage from './ChatMessage';
import AIChatMentionInput from './AIChatMentionInput';
import { ChatMessage as ChatMessageType } from '../../types/aiChat';
import { Trade } from '../../types/trade';
import { Calendar } from '../../types/calendar';
import { EconomicEvent } from '../../types/economicCalendar';
import { Note } from '../../types/note';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import { logger } from '../../utils/logger';
import * as notesService from '../../services/notesService';

// Type for question templates
export interface QuestionTemplate {
  category: string;
  questions: string[];
}

// Default question templates for new users
const defaultQuestionTemplates = [
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

export interface AIChatInterfaceProps {
  // Core state from useAIChat hook
  messages: ChatMessageType[];
  isLoading: boolean;
  isTyping: boolean;
  toolExecutionStatus: string;
  isAtMessageLimit: boolean;

  // Actions from useAIChat hook
  sendMessage: (messageText: string) => Promise<void>;
  cancelRequest: () => void;
  retryMessage: (messageId: string) => Promise<void>;
  setInputForEdit: (messageId: string) => string | null;
  startNewChat: () => Promise<void>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessageType[]>>;
  getWelcomeMessage: () => ChatMessageType;

  // Context
  userId?: string;
  calendar?: Calendar;
  trades?: Trade[];

  // Callbacks for interactions
  onTradeClick?: (tradeId: string, contextTrades: Trade[]) => void;
  onEventClick?: (event: EconomicEvent) => void;
  onNoteClick?: (noteId: string, note?: Note) => void;

  // Configuration
  isReadOnly?: boolean;
  showTemplates?: boolean;
  autoScroll?: boolean;
  messageLimit?: number;
  questionTemplates?: QuestionTemplate[];
}

export interface AIChatInterfaceRef {
  focus: () => void;
  scrollToBottom: () => void;
}

const AIChatInterface = forwardRef<AIChatInterfaceRef, AIChatInterfaceProps>(({
  messages,
  isLoading,
  isTyping,
  toolExecutionStatus,
  isAtMessageLimit,
  sendMessage,
  cancelRequest,
  retryMessage,
  setInputForEdit,
  startNewChat,
  setMessages,
  getWelcomeMessage,
  userId,
  calendar,
  trades,
  onTradeClick,
  onEventClick,
  onNoteClick,
  isReadOnly = false,
  showTemplates: showTemplatesProp,
  autoScroll = true,
  messageLimit = 50,
  questionTemplates = defaultQuestionTemplates
}, ref) => {
  const theme = useTheme();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<any>(null);

  // Local UI state
  const [inputMessage, setInputMessage] = useState('');

  // Notes context popup state
  const [notesAnchorEl, setNotesAnchorEl] = useState<HTMLElement | null>(null);
  const [availableNotes, setAvailableNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    },
    scrollToBottom: () => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }));

  // Auto-scroll to bottom whenever messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (autoScroll) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom, autoScroll]);

  // Event Handlers
  const handleSendMessage = async () => {
    const messageText = inputMessage.trim();
    if (!messageText || isLoading) return;

    setInputMessage('');
    await sendMessage(messageText);
  };

  const handleCancelRequest = () => {
    cancelRequest();
  };

  const handleEditMessage = (messageId: string) => {
    const content = setInputForEdit(messageId);
    if (content) {
      setInputMessage(content);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleMessageRetry = useCallback(async (messageId: string) => {
    await retryMessage(messageId);
  }, [retryMessage]);

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleTemplateClick = (question: string) => {
    setInputMessage(question);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleNewChat = async () => {
    await startNewChat();
  };

  // Notes context popup handlers
  const handleOpenNotesContext = async (event: React.MouseEvent<HTMLElement>) => {
    if (!userId || isReadOnly) return;

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
        : await notesService.getUserNotes(userId);

      const sortedNotes = [...notes].sort((a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );

      setAvailableNotes(sortedNotes.filter(note => !note.is_archived && !note.by_assistant));
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

  // Determine what to display
  const displayMessages = messages.length === 0 ? [getWelcomeMessage()] : messages;
  const shouldShowTemplates = showTemplatesProp !== undefined ? showTemplatesProp : messages.length === 0;

  return (
    <Box sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
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
        {displayMessages.map((message, index) => (
          <ChatMessage
            key={message.id}
            message={message}
            showTimestamp={true}
            onRetry={handleMessageRetry}
            isLatestMessage={index === displayMessages.length - 1}
            enableAnimation={index > 0}
            onTradeClick={(tradeId, contextTrades) => {
              if (onTradeClick) {
                onTradeClick(tradeId, contextTrades);
              } else {
                logger.log('Trade clicked but handler not provided:', tradeId);
              }
            }}
            onEventClick={(event) => {
              logger.log('Economic event clicked:', event);
              onEventClick?.(event);
            }}
            onNoteClick={async (noteId) => {
              logger.log('Note clicked:', noteId);
              // Find the note from embedded notes in messages
              const note = messages
                .flatMap(m => m.embeddedNotes ? Object.values(m.embeddedNotes) : [])
                .find(n => n.id === noteId);

              onNoteClick?.(noteId, note || undefined);
            }}
            onEdit={handleEditMessage}
            trades={trades}
          />
        ))}

        {/* Question Templates - Only show when no conversation started */}
        {shouldShowTemplates && (
          <Box sx={{ mt: 3 }}>
            <Typography
              variant="h6"
              sx={{
                mb: 2,
                color: 'text.primary',
                fontWeight: 600
              }}
            >
              Try these questions:
            </Typography>

            {questionTemplates.map((category: QuestionTemplate, categoryIndex: number) => (
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
                Pro Tip: You can ask complex questions like "I've been struggling with my breakout strategy on Tuesdays. Can you show me all my losing trades tagged 'breakout' that occurred on a Tuesday in the last 6 months, and analyze if there were any specific economic events or market conditions that contributed to these losses?" - I'll analyze your data and provide detailed insights!
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
              This conversation has reached the maximum length of {messageLimit} messages.
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
            disabled={isReadOnly || !userId}
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

      {/* Notes Context Popup */}
      {notesAnchorEl && (
        <ClickAwayListener onClickAway={() => setNotesAnchorEl(null)}>
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
                              maxWidth: 200,
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
        </ClickAwayListener>
      )}
    </Box>
  );
});

AIChatInterface.displayName = 'AIChatInterface';

export default AIChatInterface;
