/**
 * AIChatInterface Component
 * Reusable AI chat interface that can be embedded in different containers
 * Contains: Messages, Templates, Typing Indicator, Input Area
 */

import React, { useRef, useEffect, useCallback, useMemo, useState, forwardRef, useImperativeHandle } from 'react';
import OrionIcon from './OrionIcon';
import {
  Box,
  IconButton,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Divider,
  useTheme,
  alpha
} from '@mui/material';
import {
  Send as SendIcon,
  AddComment as NewChatIcon,
  Stop as StopIcon,
  Image as ImageIcon,
  Close as CloseIcon,
  KeyboardArrowDown as ScrollDownIcon
} from '@mui/icons-material';
import ChatMessage from './ChatMessage';
import AIChatMentionInput from './AIChatMentionInput';
import type { AIChatMentionInputHandle } from './AIChatMentionInput';
import { ChatMessage as ChatMessageType, AttachedImage } from '../../types/aiChat';
import { Trade } from '../../types/trade';
import { Calendar } from '../../types/calendar';
import { EconomicEvent } from '../../types/economicCalendar';
import { Note } from '../../types/note';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import { Z_INDEX } from '../../styles/zIndex';
import { logger } from '../../utils/logger';
import { compressImageToDataUrl } from '../../utils/fileValidation';
import * as notesService from '../../services/notesService';
import { expandMentionsForSend, stripReferencedBlocks } from '../../utils/chatMentions';

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
  setInput: (value: string) => void;
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
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<AIChatMentionInputHandle | null>(null);

  // Local UI state
  const [inputMessage, setInputMessage] = useState('');
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    },
    scrollToBottom: () => {
      const el = messagesAreaRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    },
    setInput: (value: string) => {
      setInputMessage(value);
      // Focus and move the Draft.js caret to the end of the injected text
      // so the user can type their question immediately.
      requestAnimationFrame(() => {
        inputRef.current?.focus?.();
        inputRef.current?.moveCursorToEnd?.();
      });
    }
  }));

  // Auto-scroll to bottom whenever messages change
  // Uses scrollTo on the messages container instead of scrollIntoView
  // to prevent ancestor containers from being scrolled
  const scrollToBottom = useCallback(() => {
    const el = messagesAreaRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (autoScroll && messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom, autoScroll]);

  // Track scroll position to show/hide the scroll-to-bottom button
  const handleMessagesScroll = useCallback(() => {
    const el = messagesAreaRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollDown(distanceFromBottom > 120);
  }, []);

  // Event Handlers
  const handleSendMessage = async () => {
    const plainText = inputMessage.trim();
    if ((!plainText && attachedImages.length === 0) || isLoading) return;

    const segments = inputRef.current?.getSegments() ?? [];
    const mentionedIds = segments
      .filter((s): s is Extract<typeof s, { type: 'note-mention' }> => s.type === 'note-mention')
      .map(s => s.noteId);
    const notesMap = new Map<string, { title: string; content: string; tags: string[] }>();
    if (mentionedIds.length > 0) {
      const fetched = await Promise.all(mentionedIds.map(id => notesService.getNote(id)));
      fetched.forEach(note => {
        if (note) notesMap.set(note.id, {
          title: note.title,
          content: note.content ?? '',
          tags: note.tags ?? [],
        });
      });
    }
    const outgoing = segments.length > 0
      ? expandMentionsForSend(segments, notesMap)
      : plainText;

    const imagesToSend = attachedImages.length > 0 ? [...attachedImages] : undefined;
    setInputMessage('');
    setAttachedImages([]);
    await sendMessage(outgoing, imagesToSend);
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
        const dataUrl = await compressImageToDataUrl(file);

        newImages.push({
          id: crypto.randomUUID(),
          url: dataUrl,
          mimeType: 'image/jpeg',
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

  const handleEditMessage = useCallback((messageId: string) => {
    const editData = setInputForEdit(messageId);
    if (editData) {
      // Strip [Referenced command/note:] blocks so the editor doesn't expose
      // the raw expansion syntax. User can re-trigger via "/" if they want.
      setInputMessage(stripReferencedBlocks(editData.content));
      // Restore images when editing
      if (editData.images && editData.images.length > 0) {
        setAttachedImages(editData.images);
      } else {
        setAttachedImages([]);
      }
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [setInputForEdit]);

  // Stable send handler ref so handleKeyPress can stay referentially stable
  // without being re-created every time inputMessage changes.
  const sendRef = useRef<() => void>(() => {});
  sendRef.current = () => { void handleSendMessage(); };

  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendRef.current();
    }
  }, []);

  const handleTemplateClick = useCallback((question: string) => {
    setInputMessage(question);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleNewChat = async () => {
    await startNewChat();
  };

  // Stable per-message callbacks so memoized ChatMessage components don't
  // re-render on every keystroke.
  const handleTradeClick = useCallback((tradeId: string, contextTrades: Trade[]) => {
    if (onTradeClick) {
      onTradeClick(tradeId, contextTrades);
    } else {
      logger.log('Trade clicked but handler not provided:', tradeId);
    }
  }, [onTradeClick]);

  const handleEventClick = useCallback((event: EconomicEvent) => {
    logger.log('Economic event clicked:', event);
    onEventClick?.(event);
  }, [onEventClick]);

  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const handleNoteClick = useCallback(async (noteId: string) => {
    logger.log('Note clicked:', noteId);
    const note = messagesRef.current
      .flatMap(m => m.embeddedNotes ? Object.values(m.embeddedNotes) : [])
      .find(n => n.id === noteId);
    onNoteClick?.(noteId, note || undefined);
  }, [onNoteClick]);

  // Memoize inputs passed to the mention input so its React.memo can stick.
  // calendar.notes is a JSONB mirror of {id, title, tags} maintained by a DB
  // trigger — we can read it directly without a round-trip to the notes table.
  const allTagsMemo = useMemo(() => calendar?.tags || [], [calendar?.tags]);
  const allNotesMemo = useMemo(
    () => (calendar?.notes ?? []).map(n => ({
      id: n.id,
      title: n.title,
      tags: n.tags ?? [],
    })),
    [calendar?.notes]
  );
  const availableTagsMemo = useMemo(() => calendar?.tags || [], [calendar?.tags]);
  const mentionInputSx = useMemo(
    () => ({ flex: 1, minWidth: 0, fontSize: '0.95rem', lineHeight: 1.4 }),
    []
  );

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
      <Box sx={{ flex: 1, position: 'relative', minHeight: 0 }}>
      <Box
        ref={messagesAreaRef}
        onScroll={handleMessagesScroll}
        sx={{
          position: 'absolute',
          inset: 0,
          overflow: 'auto',
          p: 2,
          pb: 1,
          ...scrollbarStyles(theme)
        }}
      >
        {displayMessages.map((message, index) => (
          <React.Fragment key={message.id}>
            
            <ChatMessage
              message={message}
              showTimestamp={true}
              isLatestMessage={index === displayMessages.length - 1}
              enableAnimation={index > 0}
              onTradeClick={handleTradeClick}
              onEventClick={handleEventClick}
              onNoteClick={handleNoteClick}
              onEdit={handleEditMessage}
              trades={trades}
              availableTags={availableTagsMemo}
            />
          </React.Fragment>
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 1, mb: 3 }}>
            <OrionIcon
              size={26}
              sx={{
                animation: 'orionPulse 1.5s ease-in-out infinite',
                '@keyframes orionPulse': {
                  '0%, 100%': { opacity: 0.6, transform: 'scale(0.95)' },
                  '50%': { opacity: 1, transform: 'scale(1.05)' }
                }
              }}
            />
            <Typography variant="body2" color="text.disabled" sx={{ fontSize: '0.85rem' }}>
              {toolExecutionStatus || 'Orion is thinking…'}
            </Typography>
          </Box>
        )}

        <div ref={messagesEndRef} />
      </Box>

        {/* Scroll-to-bottom button */}
        {showScrollDown && (
          <IconButton
            onClick={scrollToBottom}
            size="small"
            sx={{
              position: 'absolute',
              bottom: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10,
              backgroundColor: theme.palette.background.paper,
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: theme.shadows[4],
              width: 32,
              height: 32,
              color: 'text.secondary',
              '&:hover': {
                backgroundColor: alpha(theme.palette.background.paper, 1),
                color: 'primary.main',
                borderColor: alpha(theme.palette.primary.main, 0.3)
              }
            }}
          >
            <ScrollDownIcon sx={{ fontSize: 18 }} />
          </IconButton>
        )}
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
            placeholder={calendar ? "Ask Orion… (use / to mention tags & notes)" : "Ask Orion about your trading..."}
            disabled={isLoading || isAtMessageLimit}
            allTags={allTagsMemo}
            allNotes={allNotesMemo}
            maxRows={4}
            sx={mentionInputSx}
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
          {`Enter to send • Shift+Enter newline • / for commands • @ for notes & tags • Up to ${MAX_IMAGES} images`}
        </Typography>
      </Box>

    </Box>
  );
});

AIChatInterface.displayName = 'AIChatInterface';

export default AIChatInterface;
