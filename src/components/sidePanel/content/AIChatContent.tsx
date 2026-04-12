/**
 * AIChatContent Component
 * Inner content for AI chat — usable inside AIChatDrawer (mobile bottom sheet)
 * or side panel (desktop). Contains all chat logic, history, and sub-dialogs.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  InputAdornment,
  CircularProgress,
  Select,
  MenuItem,
  FormControl
} from '@mui/material';
import {
  AddComment as NewChatIcon,
  History as HistoryIcon,
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
  Settings as SettingsIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import Shimmer from '../../Shimmer';
import AIChatInterface, { AIChatInterfaceRef, QuestionTemplate } from '../../aiChat/AIChatInterface';
import { AIConversation } from '../../../types/aiChat';
import { Trade } from '../../../types/trade';
import { Calendar } from '../../../types/calendar';
import { EconomicEvent } from '../../../types/economicCalendar';
import { scrollbarStyles } from '../../../styles/scrollbarStyles';
import { logger } from '../../../utils/logger';
import { useAuthState } from '../../../contexts/AuthStateContext';
import { useAIChat, UseAIChatReturn } from '../../../hooks/useAIChat';
import EconomicEventDetailDialog
  from '../../economicCalendar/EconomicEventDetailDialog';
import ApiKeySettingsDialog from '../../aiChat/ApiKeySettingsDialog';
import NoteEditorDialog from '../../notes/NoteEditorDialog';
import { Note } from '../../../types/note';
import { TradeOperationsProps } from '../../../types/tradeOperations';
import { Z_INDEX } from '../../../styles/zIndex';

export interface AIChatContentProps {
  trades?: Trade[];
  calendar?: Calendar;
  isReadOnly?: boolean;
  tradeOperations: TradeOperationsProps;
  isActive?: boolean;
  /** When provided, starts a focused AI analysis for this trade */
  initialTradeId?: string;
  /** When provided, uses this shared chat state instead of creating its own useAIChat instance */
  sharedChatState?: UseAIChatReturn;
  /** Available calendars for the context picker dropdown */
  availableCalendars?: Calendar[];
  /** Currently selected calendar ID for AI context */
  selectedCalendarId?: string;
  /** Callback when user changes the calendar context */
  onCalendarChange?: (calendarId: string) => void;
}

const AIChatContent: React.FC<AIChatContentProps> = ({
  trades,
  calendar,
  isReadOnly = false,
  tradeOperations,
  isActive = false,
  initialTradeId,
  sharedChatState,
  availableCalendars,
  selectedCalendarId = '',
  onCalendarChange,
}) => {
  const { onOpenGalleryMode } = tradeOperations;
  const theme = useTheme();
  const { user } = useAuthState();
  const chatInterfaceRef = useRef<AIChatInterfaceRef>(null);

  // Find the focused trade for AI analysis
  const focusedTrade = useMemo(() => {
    if (!initialTradeId || !trades) return undefined;
    return trades.find(t => t.id === initialTradeId);
  }, [initialTradeId, trades]);

  // Trade-specific question templates (when focused on a trade)
  const tradeQuestionTemplates: QuestionTemplate[] | undefined =
    useMemo(() => {
      if (!focusedTrade) return undefined;
      const name = focusedTrade.name || 'this trade';
      const isWin = focusedTrade.trade_type === 'win';
      const isLoss = focusedTrade.trade_type === 'loss';
      return [
        {
          category: 'Trade Analysis',
          questions: [
            `Why did ${name} ${isWin ? 'succeed' : isLoss ? 'fail' : 'break even'}?`,
            "What patterns do you see in this trade's setup?",
            'Analyze the entry and exit timing for this trade',
          ],
        },
        {
          category: 'Compare & Learn',
          questions: [
            'Show me similar trades from my history',
            'How does this trade compare to my winning trades?',
            'What could I have done differently in this trade?',
          ],
        },
        {
          category: 'Risk & Management',
          questions: [
            'Was my position size appropriate for this trade?',
            'Analyze the risk-reward ratio of this trade',
            'Did I follow my trading rules on this trade?',
          ],
        },
      ];
    }, [focusedTrade]);

  // Use shared chat state if provided, otherwise create own instance
  const ownChatState = useAIChat({
    userId: user?.uid,
    calendar,
    trade: focusedTrade,
    messageLimit: 50,
    autoSaveConversation: true
  });

  const {
    messages,
    isLoading,
    isTyping,
    toolExecutionStatus,
    conversations,
    loadingConversations,
    loadingMoreConversations,
    hasMoreConversations,
    totalConversationsCount,
    isAtMessageLimit,
    sendMessage,
    cancelRequest,
    setInputForEdit,
    loadConversations,
    loadMoreConversations,
    selectConversation,
    deleteConversation,
    startNewChat,
    setMessages,
    getWelcomeMessage
  } = sharedChatState || ownChatState;

  // Local UI state
  const [showHistoryView, setShowHistoryView] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] =
    useState<string | null>(null);
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  // Economic event detail dialog state
  const [selectedEvent, setSelectedEvent] =
    useState<EconomicEvent | null>(null);
  const [eventDetailDialogOpen, setEventDetailDialogOpen] =
    useState(false);

  // Note editor dialog state
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);

  // API Key settings dialog state
  const [apiKeySettingsOpen, setApiKeySettingsOpen] = useState(false);

  // Filter conversations based on search query
  const filteredConversations = useMemo(() => {
    if (!historySearchQuery.trim()) {
      return conversations;
    }
    const query = historySearchQuery.toLowerCase();
    return conversations.filter(conversation => {
      if (conversation.title?.toLowerCase().includes(query)) {
        return true;
      }
      if (
        (conversation as any).preview?.toLowerCase().includes(query)
      ) {
        return true;
      }
      if (conversation.messages && Array.isArray(conversation.messages)) {
        return conversation.messages.some(message =>
          message.content?.toLowerCase().includes(query)
        );
      }
      return false;
    });
  }, [conversations, historySearchQuery]);

  // Focus input when content becomes active
  useEffect(() => {
    if (isActive && !isLoading) {
      setTimeout(() => chatInterfaceRef.current?.focus(), 100);
    }
  }, [isActive, isLoading]);

  // Load conversations when content becomes active
  useEffect(() => {
    if (isActive && calendar?.id && user) {
      loadConversations();
    }
  }, [isActive, calendar?.id, user, loadConversations]);

  // =====================================================
  // UI EVENT HANDLERS
  // =====================================================

  const handleNewChat = async () => {
    await startNewChat();
    setShowHistoryView(false);
  };

  const handleSelectConversation = (conversation: AIConversation) => {
    selectConversation(conversation);
    setShowHistoryView(false);
  };

  const handleDeleteClick = (
    conversationId: string,
    event: React.MouseEvent
  ) => {
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
    const firstUserMessage =
      conversation.messages.find(msg => msg.role === 'user');
    if (firstUserMessage && firstUserMessage.content) {
      return firstUserMessage.content.substring(0, 80) +
        (firstUserMessage.content.length > 80 ? '...' : '');
    }
    return 'No messages';
  };

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
    }}>
      {/* Header Action Bar */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1,
        py: 0.5,
        flexShrink: 0,
        borderBottom: `1px solid ${theme.palette.divider}`
      }}>
        {/* Calendar context picker — inline in header */}
        {availableCalendars && availableCalendars.length > 0 && onCalendarChange && (
          <FormControl size="small" sx={{ flex: 1, minWidth: 0 }}>
            <Select
              value={selectedCalendarId}
              onChange={(e) => onCalendarChange(e.target.value)}
              displayEmpty
              MenuProps={{ sx: { zIndex: Z_INDEX.DIALOG_POPUP } }}
              sx={{
                borderRadius: 1,
                bgcolor: 'background.default',
                '& .MuiSelect-select': { py: 0.75, fontSize: '0.8rem' },
              }}
            >
              <MenuItem value="">
                <Typography variant="body2" color="text.secondary">
                  All Calendars
                </Typography>
              </MenuItem>
              {availableCalendars.map((cal) => (
                <MenuItem key={cal.id} value={cal.id}>
                  <Typography variant="body2">{cal.name}</Typography>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {user && (
          <>
            <Tooltip title="New Chat">
              <IconButton
                size="small"
                onClick={handleNewChat}
                disabled={messages.length === 0}
                sx={{
                  color: 'primary.main',
                  '&:hover': {
                    backgroundColor: alpha(
                      theme.palette.primary.main, 0.1
                    )
                  },
                  '&:disabled': { color: 'text.disabled' }
                }}
              >
                <NewChatIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Tooltip
              title={
                showHistoryView
                  ? "Back to Chat"
                  : "Conversation History"
              }
            >
              <IconButton
                size="small"
                onClick={() => setShowHistoryView(!showHistoryView)}
                sx={{
                  color: showHistoryView
                    ? 'primary.main'
                    : 'text.secondary',
                  '&:hover': {
                    backgroundColor: alpha(
                      theme.palette.action.hover, 0.5
                    )
                  }
                }}
              >
                {showHistoryView
                  ? <ArrowBackIcon fontSize="small" />
                  : <HistoryIcon fontSize="small" />
                }
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
              '&:hover': {
                backgroundColor: alpha(
                  theme.palette.action.hover, 0.5
                )
              }
            }}
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Content - Sliding Pager */}
      <Box sx={{
        flex: 1,
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
          transform: showHistoryView
            ? 'translateX(-50%)'
            : 'translateX(0)',
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
              setInputForEdit={setInputForEdit}
              startNewChat={startNewChat}
              setMessages={setMessages}
              getWelcomeMessage={getWelcomeMessage}
              userId={user?.uid}
              calendar={calendar}
              trades={trades}
              {...(tradeQuestionTemplates && {
                questionTemplates: tradeQuestionTemplates,
              })}
              onTradeClick={(tradeId, contextTrades) => {
                if (onOpenGalleryMode) {
                  const clickedTrade =
                    contextTrades.find(t => t.id === tradeId);
                  if (clickedTrade) {
                    onOpenGalleryMode(
                      contextTrades,
                      tradeId,
                      'AI Chat - Trade Gallery'
                    );
                  }
                } else {
                  logger.log(
                    'Trade clicked but gallery mode not available:',
                    tradeId
                  );
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
                  logger.warn(
                    'Note not found in embedded notes:', noteId
                  );
                }
              }}
              isReadOnly={isReadOnly}
              messageLimit={50}
            />
          </Box>

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
                      <SearchIcon
                        fontSize="small"
                        sx={{ color: 'text.secondary' }}
                      />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    backgroundColor: alpha(
                      theme.palette.background.paper, 0.8
                    ),
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
                          <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            mb: 1
                          }}>
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
                          <Shimmer
                            height={16}
                            width="90%"
                            borderRadius={4}
                            variant="default"
                            intensity="low"
                            sx={{ mb: 0.5 }}
                          />
                          <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5
                          }}>
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
                    {historySearchQuery.trim()
                      ? `No conversations found matching "${historySearchQuery}"`
                      : 'No conversation history yet. Start chatting with the AI to create your first conversation!'}
                  </Alert>
                </Box>
              ) : (
                <List sx={{ p: 0 }}>
                  {filteredConversations.map(
                    (conversation, index) => (
                      <React.Fragment key={conversation.id}>
                        <ListItem disablePadding>
                          <ListItemButton
                            onClick={() =>
                              handleSelectConversation(conversation)
                            }
                            sx={{
                              py: 2,
                              px: 2,
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 1,
                              '&:hover': {
                                backgroundColor: alpha(
                                  theme.palette.primary.main, 0.08
                                )
                              }
                            }}
                          >
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Box sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                mb: 0.5
                              }}>
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
                                  label={
                                    `${conversation.message_count} msgs`
                                  }
                                  size="small"
                                  sx={{
                                    height: 20,
                                    fontSize: '0.7rem',
                                    backgroundColor: alpha(
                                      theme.palette.primary.main, 0.1
                                    ),
                                    color: 'primary.main'
                                  }}
                                />
                              </Box>
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
                              <Box sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5
                              }}>
                                <ScheduleIcon
                                  sx={{
                                    fontSize: 14,
                                    color: 'text.disabled'
                                  }}
                                />
                                <Typography
                                  variant="caption"
                                  color="text.disabled"
                                >
                                  {format(
                                    conversation.updated_at,
                                    'MMM d, yyyy \u2022 h:mm a'
                                  )}
                                </Typography>
                              </Box>
                            </Box>
                            <IconButton
                              onClick={(e) =>
                                handleDeleteClick(conversation.id, e)
                              }
                              size="small"
                              sx={{
                                color: 'error.main',
                                flexShrink: 0,
                                mt: 0.5,
                                '&:hover': {
                                  backgroundColor: alpha(
                                    theme.palette.error.main, 0.1
                                  )
                                }
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </ListItemButton>
                        </ListItem>
                        {index < conversations.length - 1 && <Divider />}
                      </React.Fragment>
                    )
                  )}
                </List>
              )}
            </Box>

            {/* Load More Button */}
            {!loadingConversations && hasMoreConversations && (
              <Box sx={{
                p: 2,
                display: 'flex',
                justifyContent: 'center',
                borderTop:
                  `1px solid ${alpha(theme.palette.divider, 0.1)}`
              }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={loadMoreConversations}
                  disabled={loadingMoreConversations}
                  startIcon={loadingMoreConversations ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : null}
                  sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                    px: 3
                  }}
                >
                  {loadingMoreConversations
                    ? 'Loading...'
                    : 'Load More'}
                </Button>
              </Box>
            )}

            {/* Footer Info */}
            {!loadingConversations && conversations.length > 0 && (
              <Box sx={{
                p: 2,
                pt: hasMoreConversations ? 0 : 2,
                borderTop: hasMoreConversations
                  ? 'none'
                  : `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                backgroundColor: alpha(
                  theme.palette.background.default, 0.5
                )
              }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: '0.75rem' }}
                >
                  Showing {conversations.length} of{' '}
                  {totalConversationsCount} conversation
                  {totalConversationsCount !== 1 ? 's' : ''}
                </Typography>
              </Box>
            )}
          </Box>
          {/* End History View */}
        </Box>
        {/* End Pager Container */}
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
          calendarId={calendar.id}
          tradeOperations={tradeOperations}
          isReadOnly={isReadOnly}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCancelDelete}
        maxWidth="xs"
        fullWidth
        sx={{ zIndex: Z_INDEX.DIALOG }}
      >
        <DialogTitle>Delete Conversation?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this conversation?
            This action cannot be undone.
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
          availableTradeTags={calendar.tags || []}
          onSave={(updatedNote) => {
            setMessages(prevMessages =>
              prevMessages.map(msg => {
                if (
                  msg.embeddedNotes &&
                  msg.embeddedNotes[updatedNote.id]
                ) {
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
            setMessages(prevMessages =>
              prevMessages.map(msg => {
                if (msg.embeddedNotes && msg.embeddedNotes[noteId]) {
                  const {
                    [noteId]: _,
                    ...remainingNotes
                  } = msg.embeddedNotes;
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
    </Box>
  );
};

export default AIChatContent;
