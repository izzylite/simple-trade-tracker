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
  Notes as NotesIcon,
  Image as ImageIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import ChatMessage from './ChatMessage';
import AIChatMentionInput from './AIChatMentionInput';
import { ChatMessage as ChatMessageType, AttachedImage } from '../../types/aiChat';
import { Trade } from '../../types/trade';
import { Calendar } from '../../types/calendar';
import { EconomicEvent } from '../../types/economicCalendar';
import { Note } from '../../types/note';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import { Z_INDEX } from '../../styles/zIndex';
import { logger } from '../../utils/logger';
import * as notesService from '../../services/notesService';

// Image limit for AI agent requests (must match backend MAX_IMAGES_PER_REQUEST)
const MAX_IMAGES = 4;

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
  sendMessage: (messageText: string, images?: AttachedImage[]) => Promise<void>;
  cancelRequest: () => void;
  setInputForEdit: (messageId: string) => { content: string; images?: AttachedImage[] } | null;
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
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if ((!messageText && attachedImages.length === 0) || isLoading) return;

    const imagesToSend = attachedImages.length > 0 ? [...attachedImages] : undefined;
    setInputMessage('');
    setAttachedImages([]);
    await sendMessage(messageText, imagesToSend);
  };

  // Image upload handlers
  const handleImageUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newImages: AttachedImage[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file type
      if (!file.type.startsWith('image/')) {
        logger.warn('Skipping non-image file:', file.name);
        continue;
      }

      // Limit file size to 10MB
      if (file.size > 10 * 1024 * 1024) {
        logger.warn('Skipping large file:', file.name, file.size);
        continue;
      }

      try {
        // Convert to base64 data URL
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        newImages.push({
          id: crypto.randomUUID(),
          url: dataUrl,
          mimeType: file.type,
          name: file.name,
          size: file.size
        });
      } catch (error) {
        logger.error('Error reading file:', error);
      }
    }

    if (newImages.length > 0) {
      setAttachedImages(prev => [...prev, ...newImages].slice(0, MAX_IMAGES));
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (imageId: string) => {
    setAttachedImages(prev => prev.filter(img => img.id !== imageId));
  };

  // Handle paste event for images (Ctrl+V)
  const handlePaste = useCallback(async (event: React.ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    const newImages: AttachedImage[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Check if it's an image
      if (item.type.startsWith('image/')) {
        event.preventDefault(); // Prevent default paste behavior for images

        const file = item.getAsFile();
        if (!file) continue;

        // Limit file size to 10MB
        if (file.size > 10 * 1024 * 1024) {
          logger.warn('Skipping large pasted image:', file.size);
          continue;
        }

        try {
          // Convert to base64 data URL
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          newImages.push({
            id: crypto.randomUUID(),
            url: dataUrl,
            mimeType: file.type,
            name: `pasted-image-${Date.now()}.${file.type.split('/')[1] || 'png'}`,
            size: file.size
          });
        } catch (error) {
          logger.error('Error reading pasted image:', error);
        }
      }
    }

    if (newImages.length > 0) {
      setAttachedImages(prev => [...prev, ...newImages].slice(0, MAX_IMAGES));
    }
  }, []);

  const handleCancelRequest = () => {
    cancelRequest();
  };

  const handleEditMessage = (messageId: string) => {
    const editData = setInputForEdit(messageId);
    if (editData) {
      setInputMessage(editData.content);
      // Restore images when editing
      if (editData.images && editData.images.length > 0) {
        setAttachedImages(editData.images);
      } else {
        setAttachedImages([]);
      }
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

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
        {/* Image Preview Section */}
        {attachedImages.length > 0 && (
          <Box sx={{
            display: 'flex',
            gap: 1,
            mb: 1.5,
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <Typography
              variant="caption"
              sx={{
                color: attachedImages.length >= MAX_IMAGES ? 'warning.main' : 'text.secondary',
                fontWeight: 500,
                mr: 0.5
              }}
            >
              {attachedImages.length}/{MAX_IMAGES}
            </Typography>
            {attachedImages.map((image) => (
              <Box
                key={image.id}
                sx={{
                  position: 'relative',
                  width: 64,
                  height: 64,
                  borderRadius: 1.5,
                  overflow: 'hidden',
                  border: '1px solid',
                  borderColor: 'divider'
                }}
              >
                <Box
                  component="img"
                  src={image.url}
                  alt={image.name || 'Attached image'}
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
                <IconButton
                  size="small"
                  onClick={() => handleRemoveImage(image.id)}
                  sx={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    width: 18,
                    height: 18,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: 'rgba(0,0,0,0.8)'
                    }
                  }}
                >
                  <CloseIcon sx={{ fontSize: 12 }} />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleImageSelect}
        />

        <Box
          onPaste={handlePaste}
          sx={{
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
          }}
        >
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
          {/* Image upload button */}
          <IconButton
            aria-label="Attach image"
            onClick={handleImageUploadClick}
            disabled={isReadOnly || isLoading || isAtMessageLimit || attachedImages.length >= MAX_IMAGES}
            size="small"
            sx={{
              backgroundColor: attachedImages.length > 0
                ? alpha(theme.palette.primary.main, 0.1)
                : 'background.default',
              color: attachedImages.length > 0 ? 'primary.main' : 'text.secondary',
              width: 32,
              height: 32,
              borderRadius: 2,
              border: '1px solid',
              borderColor: attachedImages.length > 0 ? 'primary.main' : 'divider',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.12),
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
            <ImageIcon sx={{ fontSize: 18 }} />
          </IconButton>
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
            disabled={(!inputMessage.trim() && attachedImages.length === 0 && !isLoading) || isAtMessageLimit}
            size="small"
            sx={{
              backgroundColor: isLoading
                ? 'error.main'
                : (inputMessage.trim() || attachedImages.length > 0)
                  ? 'primary.main'
                  : 'action.disabledBackground',
              color: isLoading
                ? 'error.contrastText'
                : (inputMessage.trim() || attachedImages.length > 0)
                  ? 'primary.contrastText'
                  : 'action.disabled',
              width: 36,
              height: 36,
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                backgroundColor: isLoading
                  ? 'error.dark'
                  : (inputMessage.trim() || attachedImages.length > 0)
                    ? 'primary.dark'
                    : 'action.disabledBackground',
                transform: (inputMessage.trim() || attachedImages.length > 0) && !isLoading ? 'scale(1.05)' : 'none'
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
          {`Enter to send • Shift+Enter newline • @ for tags • Up to ${MAX_IMAGES} images`}
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
            sx={{ zIndex: Z_INDEX.DIALOG_POPUP }}
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
