/**
 * AI Chat Bottom Sheet Component
 * Modern bottom sheet interface for AI trading analysis
 * Uses the useAIChat hook for core AI chat functionality
 * Uses AIChatInterface for the reusable chat UI
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  IconButton,
  Button,
  Typography,
  Alert,
  Tooltip,
  Divider,
  useTheme,
  alpha,
  Avatar,
  List,
  ListItem,
  ListItemButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  InputAdornment
} from '@mui/material';
import {
  SmartToy as AIIcon,
  Close as CloseIcon,
  AddComment as NewChatIcon,
  History as HistoryIcon,
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
  Settings as SettingsIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import Shimmer from '../Shimmer';
import AIChatInterface, { AIChatInterfaceRef } from './AIChatInterface';
import { AIConversation } from '../../types/aiChat';
import { Trade } from '../../types/trade';
import { Calendar } from '../../types/calendar';
import { EconomicEvent } from '../../types/economicCalendar';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import { logger } from '../../utils/logger';
import { useAuth } from '../../contexts/SupabaseAuthContext';
import { useAIChat } from '../../hooks/useAIChat';
import EconomicEventDetailDialog from '../economicCalendar/EconomicEventDetailDialog';
import ApiKeySettingsDialog from './ApiKeySettingsDialog';
import NoteEditorDialog from '../notes/NoteEditorDialog';
import { Note } from '../../types/note';
import { TradeOperationsProps } from '../../types/tradeOperations';

interface AIChatDrawerProps {
  open: boolean;
  onClose: () => void;
  trades?: Trade[];
  calendar?: Calendar;
  isReadOnly?: boolean;

  // Trade operations - can be passed as object or individual props
  tradeOperations?: TradeOperationsProps;

  // Individual props (for backward compatibility)
  onOpenGalleryMode?: TradeOperationsProps['onOpenGalleryMode'];
  onUpdateTradeProperty?: TradeOperationsProps['onUpdateTradeProperty'];
  onEditTrade?: TradeOperationsProps['onEditTrade'];
  onDeleteTrade?: TradeOperationsProps['onDeleteTrade'];
  onDeleteMultipleTrades?: TradeOperationsProps['onDeleteMultipleTrades'];
  onZoomImage?: TradeOperationsProps['onZoomImage'];
  onUpdateCalendarProperty?: TradeOperationsProps['onUpdateCalendarProperty'];
  isTradeUpdating?: TradeOperationsProps['isTradeUpdating'];
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
  isReadOnly = false,
  tradeOperations,
  // Individual props (fallback if tradeOperations not provided)
  onOpenGalleryMode: onOpenGalleryModeProp,
  onUpdateTradeProperty: onUpdateTradePropertyProp,
  onEditTrade: onEditTradeProp,
  onDeleteTrade: onDeleteTradeProp,
  onDeleteMultipleTrades: onDeleteMultipleTradesProp,
  onZoomImage: onZoomImageProp,
  onUpdateCalendarProperty: onUpdateCalendarPropertyProp,
  isTradeUpdating: isTradeUpdatingProp
}) => {
  // Extract from tradeOperations or use individual props
  const onOpenGalleryMode = tradeOperations?.onOpenGalleryMode || onOpenGalleryModeProp;
  const onUpdateTradeProperty = tradeOperations?.onUpdateTradeProperty || onUpdateTradePropertyProp;
  const onEditTrade = tradeOperations?.onEditTrade || onEditTradeProp;
  const onDeleteTrade = tradeOperations?.onDeleteTrade || onDeleteTradeProp;
  const onDeleteMultipleTrades = tradeOperations?.onDeleteMultipleTrades || onDeleteMultipleTradesProp;
  const onZoomImage = tradeOperations?.onZoomImage || onZoomImageProp;
  const onUpdateCalendarProperty = tradeOperations?.onUpdateCalendarProperty || onUpdateCalendarPropertyProp;
  const isTradeUpdating = tradeOperations?.isTradeUpdating || isTradeUpdatingProp;
  const theme = useTheme();
  const { user } = useAuth();
  const chatInterfaceRef = useRef<AIChatInterfaceRef>(null);

  // Use the AI Chat hook for core functionality
  const {
    messages,
    isLoading,
    isTyping,
    toolExecutionStatus,
    conversations,
    loadingConversations,
    isAtMessageLimit,
    sendMessage,
    cancelRequest,
    retryMessage,
    setInputForEdit,
    loadConversations,
    selectConversation,
    deleteConversation,
    startNewChat,
    setMessages,
    getWelcomeMessage
  } = useAIChat({
    userId: user?.uid,
    calendar,
    messageLimit: 50,
    autoSaveConversation: true
  });

  // Local UI state for drawer-specific features
  const [showHistoryView, setShowHistoryView] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');

  // Economic event detail dialog state
  const [selectedEvent, setSelectedEvent] = useState<EconomicEvent | null>(null);
  const [eventDetailDialogOpen, setEventDetailDialogOpen] = useState(false);

  // Note editor dialog state
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);

  // API Key settings dialog state
  const [apiKeySettingsOpen, setApiKeySettingsOpen] = useState(false);

  // Prevent body scroll when drawer is open to fix mention dialog positioning
  useEffect(() => {
    if (open) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [open]);

  // Filter conversations based on search query
  const filteredConversations = React.useMemo(() => {
    if (!historySearchQuery.trim()) {
      return conversations;
    }

    const query = historySearchQuery.toLowerCase();
    return conversations.filter(conversation => {
      if (conversation.title?.toLowerCase().includes(query)) {
        return true;
      }
      if ((conversation as any).preview?.toLowerCase().includes(query)) {
        return true;
      }
      if (conversation.messages && Array.isArray(conversation.messages)) {
        const foundInMessages = conversation.messages.some(message =>
          message.content?.toLowerCase().includes(query)
        );
        if (foundInMessages) {
          return true;
        }
      }
      return false;
    });
  }, [conversations, historySearchQuery]);

  // Focus input when drawer opens
  useEffect(() => {
    if (open && !isLoading) {
      setTimeout(() => chatInterfaceRef.current?.focus(), 100);
    }
  }, [open, isLoading]);

  // Load conversations when drawer opens (only if calendar is provided)
  useEffect(() => {
    if (open && calendar?.id && user) {
      loadConversations();
    }
  }, [open, calendar?.id, user, loadConversations]);

  // =====================================================
  // UI EVENT HANDLERS (Drawer-specific)
  // =====================================================

  const handleNewChat = async () => {
    await startNewChat();
    setShowHistoryView(false);
  };

  const handleSelectConversation = (conversation: AIConversation) => {
    selectConversation(conversation);
    setShowHistoryView(false);
  };

  const handleDeleteClick = (conversationId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setConversationToDelete(conversationId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!conversationToDelete) return;

    const success = await deleteConversation(conversationToDelete);
    if (success) {
      logger.log('Conversation deleted:', conversationToDelete);
    }
    setDeleteDialogOpen(false);
    setConversationToDelete(null);
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setConversationToDelete(null);
  };

  const getPreviewText = (conversation: AIConversation): string => {
    const firstUserMessage = conversation.messages.find(msg => msg.role === 'user');
    if (firstUserMessage && firstUserMessage.content) {
      return firstUserMessage.content.substring(0, 80) +
        (firstUserMessage.content.length > 80 ? '...' : '');
    }
    return 'No messages';
  };



  return (
    <>
      {/* Backdrop - Click to close */}
      <Box
        onClick={onClose}
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 1399,
          opacity: open ? 1 : 0,
          visibility: open ? 'visible' : 'hidden',
          transition: 'opacity 0.3s ease-in-out, visibility 0.3s ease-in-out',
          cursor: 'pointer'
        }}
      />

      {/* Bottom Sheet Drawer */}
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
                  {calendar
                    ? (trades && trades.length > 0
                      ? `${trades.length} trades in ${calendar.name}`
                      : `${calendar.name} - Ready for analysis`)
                    : 'Ready for trading analysis across all calendars'
                  }
                </Typography>
              </Box>
            </Box>

            {/* Right side - Action buttons */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {/* Conversation features only available when calendar is provided */}
              {calendar && (
                <>
                  <Tooltip title="New Chat">
                    <IconButton
                      size="small"
                      onClick={handleNewChat}
                      disabled={messages.length === 0}
                      sx={{
                        color: 'primary.main',
                        '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.1) },
                        '&:disabled': { color: 'text.disabled' }
                      }}
                    >
                      <NewChatIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>

                  <Tooltip title={showHistoryView ? "Back to Chat" : "Conversation History"}>
                    <IconButton
                      size="small"
                      onClick={() => setShowHistoryView(!showHistoryView)}
                      sx={{
                        color: showHistoryView ? 'primary.main' : 'text.secondary',
                        '&:hover': { backgroundColor: alpha(theme.palette.action.hover, 0.5) }
                      }}
                    >
                      {showHistoryView ? <ArrowBackIcon fontSize="small" /> : <HistoryIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </>
              )}

              <Tooltip title="API Key Settings">
                <IconButton
                  size="small"
                  onClick={() => setApiKeySettingsOpen(true)}
                  sx={{
                    color: 'text.secondary',
                    '&:hover': { backgroundColor: alpha(theme.palette.action.hover, 0.5) }
                  }}
                >
                  <SettingsIcon fontSize="small" />
                </IconButton>
              </Tooltip>

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

          {/* Content - Sliding Pager */}
          <Box sx={{
            height: '720px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative'
          }}>
            {/* Pager Container */}
            <Box sx={{
              display: 'flex',
              width: '200%',
              height: '100%',
              transform: showHistoryView ? 'translateX(-50%)' : 'translateX(0)',
              transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
              {/* Chat View */}
              <Box sx={{
                width: '50%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}>
                <AIChatInterface
                  ref={chatInterfaceRef}
                  messages={messages}
                  isLoading={isLoading}
                  isTyping={isTyping}
                  toolExecutionStatus={toolExecutionStatus}
                  isAtMessageLimit={isAtMessageLimit}
                  sendMessage={sendMessage}
                  cancelRequest={cancelRequest}
                  retryMessage={retryMessage}
                  setInputForEdit={setInputForEdit}
                  startNewChat={startNewChat}
                  setMessages={setMessages}
                  getWelcomeMessage={getWelcomeMessage}
                  userId={user?.uid}
                  calendar={calendar}
                  trades={trades}
                  onTradeClick={(tradeId, contextTrades) => {
                    if (onOpenGalleryMode) {
                      const clickedTrade = contextTrades.find(t => t.id === tradeId);
                      if (clickedTrade) {
                        onOpenGalleryMode(contextTrades, tradeId, 'AI Chat - Trade Gallery');
                      }
                    } else {
                      logger.log('Trade clicked but gallery mode not available:', tradeId);
                    }
                  }}
                  onEventClick={(event) => {
                    logger.log('Economic event clicked:', event);
                    setSelectedEvent(event);
                    setEventDetailDialogOpen(true);
                  }}
                  onNoteClick={(noteId, note) => {
                    logger.log('Note clicked:', noteId);
                    if (note) {
                      setSelectedNote(note);
                      setNoteEditorOpen(true);
                    } else {
                      logger.warn('Note not found in embedded notes:', noteId);
                    }
                  }}
                  isReadOnly={isReadOnly}
                  messageLimit={50}
                />
              </Box>
              {/* End Chat View */}

              {/* History View */}
              <Box sx={{
                width: '50%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}>
                {/* Search Bar */}
                <Box sx={{ p: 2, pb: 1 }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search conversations..."
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        backgroundColor: alpha(theme.palette.background.paper, 0.8),
                        '&:hover': {
                          backgroundColor: theme.palette.background.paper,
                        },
                        '&.Mui-focused': {
                          backgroundColor: theme.palette.background.paper,
                        }
                      }
                    }}
                  />
                </Box>

                {/* History Content */}
                <Box sx={{
                  flex: 1,
                  overflow: 'auto',
                  ...scrollbarStyles(theme)
                }}>
                  {loadingConversations ? (
                    <List sx={{ p: 0 }}>
                      {Array.from({ length: 10 }).map((_, index) => (
                        <React.Fragment key={index}>
                          <ListItem sx={{ py: 2, px: 2 }}>
                            <Box sx={{ width: '100%' }}>
                              {/* Title and chip */}
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <Shimmer
                                  height={20}
                                  width="60%"
                                  borderRadius={4}
                                  variant="wave"
                                  intensity="medium"
                                />
                                <Shimmer
                                  height={20}
                                  width={60}
                                  borderRadius={10}
                                  variant="pulse"
                                  intensity="low"
                                />
                              </Box>

                              {/* Preview text */}
                              <Shimmer
                                height={16}
                                width="90%"
                                borderRadius={4}
                                variant="default"
                                intensity="low"
                                sx={{ mb: 0.5 }}
                              />


                              {/* Date */}
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Shimmer
                                  height={14}
                                  width={120}
                                  borderRadius={4}
                                  variant="default"
                                  intensity="low"
                                />
                              </Box>
                            </Box>
                          </ListItem>
                          {index < 4 && <Divider />}
                        </React.Fragment>
                      ))}
                    </List>
                  ) : filteredConversations.length === 0 ? (
                    <Box sx={{ p: 3 }}>
                      <Alert severity="info">
                        {historySearchQuery.trim() ? `No conversations found matching "${historySearchQuery}"` : 'No conversation history yet. Start chatting with the AI to create your first conversation!'}
                      </Alert>
                    </Box>
                  ) : (
                    <List sx={{ p: 0 }}>
                      {filteredConversations.map((conversation, index) => (
                        <React.Fragment key={conversation.id}>
                          <ListItem disablePadding>
                            <ListItemButton
                              onClick={() => handleSelectConversation(conversation)}
                              sx={{
                                py: 2,
                                px: 2,
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 1,
                                '&:hover': {
                                  backgroundColor: alpha(theme.palette.primary.main, 0.08)
                                }
                              }}
                            >
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                {/* Title and chip */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                  <Typography
                                    variant="subtitle1"
                                    sx={{
                                      fontWeight: 600,
                                      fontSize: '0.95rem',
                                      flex: 1,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    {conversation.title}
                                  </Typography>
                                  <Chip
                                    label={`${conversation.message_count} msgs`}
                                    size="small"
                                    sx={{
                                      height: 20,
                                      fontSize: '0.7rem',
                                      backgroundColor: alpha(theme.palette.primary.main, 0.1),
                                      color: 'primary.main'
                                    }}
                                  />
                                </Box>

                                {/* Preview text */}
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                  sx={{
                                    fontSize: '0.85rem',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    mb: 0.5
                                  }}
                                >
                                  {getPreviewText(conversation)}
                                </Typography>

                                {/* Date */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <ScheduleIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                                  <Typography variant="caption" color="text.disabled">
                                    {format(conversation.updated_at, 'MMM d, yyyy • h:mm a')}
                                  </Typography>
                                </Box>
                              </Box>

                              {/* Delete button */}
                              <IconButton
                                onClick={(e) => handleDeleteClick(conversation.id, e)}
                                size="small"
                                sx={{
                                  color: 'error.main',
                                  flexShrink: 0,
                                  mt: 0.5,
                                  '&:hover': {
                                    backgroundColor: alpha(theme.palette.error.main, 0.1)
                                  }
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </ListItemButton>
                          </ListItem>
                          {index < conversations.length - 1 && <Divider />}
                        </React.Fragment>
                      ))}
                    </List>
                  )}
                </Box>

                {/* Footer Info */}
                {!loadingConversations && conversations.length > 0 && (
                  <Box sx={{
                    p: 2,
                    borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    backgroundColor: alpha(theme.palette.background.default, 0.5)
                  }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                      {conversations.length} conversation{conversations.length !== 1 ? 's' : ''} saved
                    </Typography>
                  </Box>
                )}
              </Box>
              {/* End History View */}
            </Box>
            {/* End Pager Container */}
          </Box>
          {/* End Content */}

        </Box>
      </Box>

      {/* Economic Event Detail Dialog */}
      {selectedEvent && calendar && (
        <EconomicEventDetailDialog
          open={eventDetailDialogOpen}
          onClose={() => {
            setEventDetailDialogOpen(false);
            setSelectedEvent(null);
          }}
          event={selectedEvent}
          trades={trades || []}
          tradeOperations={tradeOperations}
          onUpdateTradeProperty={onUpdateTradeProperty}
          onEditTrade={onEditTrade}
          onDeleteTrade={onDeleteTrade}
          onDeleteMultipleTrades={onDeleteMultipleTrades}
          onZoomImage={onZoomImage}
          onOpenGalleryMode={onOpenGalleryMode}
          isTradeUpdating={isTradeUpdating}
          calendarId={calendar.id}
          calendar={calendar}
          onUpdateCalendarProperty={onUpdateCalendarProperty}
          isReadOnly={isReadOnly}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCancelDelete}
        maxWidth="xs"
        fullWidth
        sx={{
          zIndex: 1500 // Higher than drawer (1400) and backdrop (1399)
        }}
      >
        <DialogTitle>Delete Conversation?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this conversation? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button onClick={handleCancelDelete} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            autoFocus
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* API Key Settings Dialog */}
      <ApiKeySettingsDialog
        open={apiKeySettingsOpen}
        onClose={() => setApiKeySettingsOpen(false)}
      />

      {/* Note Editor Dialog */}
      {noteEditorOpen && selectedNote && calendar && (
        <NoteEditorDialog
          open={noteEditorOpen}
          onClose={() => {
            setNoteEditorOpen(false);
            setSelectedNote(null);
          }}
          note={selectedNote}
          calendarId={calendar.id}
          onSave={(updatedNote) => {
            // Update the note in embedded notes across all messages
            setMessages(prevMessages =>
              prevMessages.map(msg => {
                if (msg.embeddedNotes && msg.embeddedNotes[updatedNote.id]) {
                  return {
                    ...msg,
                    embeddedNotes: {
                      ...msg.embeddedNotes,
                      [updatedNote.id]: updatedNote
                    }
                  };
                }
                return msg;
              })
            );
          }}
          onDelete={(noteId) => {
            // Remove the note from embedded notes across all messages
            setMessages(prevMessages =>
              prevMessages.map(msg => {
                if (msg.embeddedNotes && msg.embeddedNotes[noteId]) {
                  const { [noteId]: _, ...remainingNotes } = msg.embeddedNotes;
                  return {
                    ...msg,
                    embeddedNotes: remainingNotes
                  };
                }
                return msg;
              })
            );
            setNoteEditorOpen(false);
            setSelectedNote(null);
          }}
        />
      )}
    </>
  );
};

export default AIChatDrawer;
