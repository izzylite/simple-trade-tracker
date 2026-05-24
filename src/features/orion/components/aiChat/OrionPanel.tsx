/**
 * OrionPanel
 *
 * Slide-in Orion chat panel rendered as a flex sibling next to a host's
 * main content (e.g. TradeGalleryDialog). Mirrors NoteViewerPanel's
 * shape so the dialog can stack a NoteViewerPanel on top without
 * fighting for width — the outer wrapper collapses to 0 when closed,
 * the inner holds a fixed width so the slide is smooth.
 *
 * Owns the chat ↔ history pager so the consumer just renders
 * `<OrionPanel open ... />` with an existing useAIChat hook payload.
 * Parent must mount this inside a `display:flex; flex-direction:row`
 * container.
 */

import React, { useCallback } from 'react';
import {
  Box,
  IconButton,
  Toolbar,
  Typography,
  Tooltip,
  Stack,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemButton,
  Alert,
  alpha,
  useTheme,
  CircularProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  AddComment as NewChatIcon,
  History as HistoryIcon,
  ArrowBack as BackIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';

import { AIConversation, ChatMessage as ChatMessageType, AttachedImage } from 'features/orion/types/aiChat';
import { Trade } from 'features/calendar/types/trade';
import { Calendar } from 'features/calendar/types/calendar';
import { EconomicEvent } from 'features/events/types/economicCalendar';
import { Note } from 'features/notes/types/note';
import { scrollbarStyles } from 'styles/scrollbarStyles';
import { Z_INDEX } from 'styles/zIndex';
import Shimmer from 'components/Shimmer';
import OrionMark from 'features/orion/components/aiChat/OrionMark';
import { useOrionExpression } from 'features/orion/hooks/useOrionExpression';
import AIChatInterface, { QuestionTemplate } from 'features/orion/components/aiChat/AIChatInterface';
import type { OrionBlockedState } from 'features/orion/hooks/useAIChat';
import { OrionUsageRing } from 'features/billing/components/OrionUsageRing';

// Same width tier as NoteViewerPanel — keeps the slide-in slot
// consistent when both panels share the right rail (mutex: one open at
// a time).
const PANEL_WIDTH = { xs: '100%', sm: 'min(45%, 380px)' } as const;
const INNER_WIDTH = { xs: '100%', sm: 'min(45vw, 380px)' } as const;

interface AIChatBundle {
  messages: ChatMessageType[];
  isLoading: boolean;
  isTyping: boolean;
  toolExecutionStatus: string;
  isAtContextLimit: boolean;
  tokenUsage: number;
  tokenBudget: number;
  blockedState: OrionBlockedState | null;
  sendMessage: (text: string, images?: AttachedImage[], segments?: ChatMessageType['segments']) => Promise<void>;
  cancelRequest: () => void;
  setInputForEdit: (messageId: string) => { content: string; images?: AttachedImage[]; segments?: ChatMessageType['segments'] } | null;
  startNewChat: () => Promise<void>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessageType[]>>;
  getWelcomeMessage: () => ChatMessageType;
  conversations: AIConversation[];
  loadingConversations: boolean;
  /** True while the messages JSONB for the just-selected conversation is
   *  being fetched. Drives the skeleton bubbles in the chat surface. */
  loadingMessages: boolean;
  /** Server-side pinned-only filter for the history list. */
  pinnedOnly: boolean;
  setPinnedFilter: (value: boolean) => Promise<void>;
  selectConversation: (conversation: AIConversation) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<boolean>;
}

interface OrionPanelProps {
  open: boolean;
  onClose: () => void;
  aiChat: AIChatBundle;
  showHistory: boolean;
  onToggleHistory: () => void;
  userId?: string;
  calendar?: Calendar;
  trades?: Trade[];
  questionTemplates?: QuestionTemplate[];
  isReadOnly?: boolean;
  onTradeClick?: (tradeId: string, contextTrades: Trade[]) => void;
  onEventClick?: (event: EconomicEvent) => void;
  onNoteClick?: (noteId: string, note?: Note) => void;
}

const getPreviewText = (conversation: AIConversation): string => {
  // Read from the denormalized `last_message_preview` column — list rows
  // no longer carry the full `messages` array (loaded lazily on selection).
  const raw = conversation.last_message_preview ?? '';
  if (!raw) return 'No messages';
  return raw.length > 80 ? `${raw.substring(0, 80)}...` : raw;
};

const OrionPanel: React.FC<OrionPanelProps> = ({
  open,
  onClose,
  aiChat,
  showHistory,
  onToggleHistory,
  userId,
  calendar,
  trades,
  questionTemplates,
  isReadOnly = false,
  onTradeClick,
  onEventClick,
  onNoteClick,
}) => {
  const theme = useTheme();
  const orionExpression = useOrionExpression(
    aiChat.isLoading,
    aiChat.messages.length,
    { toolStatus: aiChat.toolExecutionStatus },
  );

  const handleNewChat = useCallback(async () => {
    await aiChat.startNewChat();
  }, [aiChat]);

  const handleSelectConversation = useCallback(
    (conversation: AIConversation) => {
      // Fire-and-forget — `selectConversation` lazy-loads the full messages
      // and exposes progress via `aiChat.loadingMessages`. Toggling history
      // immediately keeps the click responsive while the fetch resolves.
      void aiChat.selectConversation(conversation);
      onToggleHistory();
    },
    [aiChat, onToggleHistory],
  );

  const handleDeleteConversation = useCallback(
    async (conversationId: string, event: React.MouseEvent) => {
      event.stopPropagation();
      await aiChat.deleteConversation(conversationId);
    },
    [aiChat],
  );

  return (
    <Box
      sx={{
        width: open ? PANEL_WIDTH : 0,
        flexShrink: 0,
        overflow: 'hidden',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        borderLeft: open
          ? `1px solid ${alpha(theme.palette.divider, 0.12)}`
          : 'none',
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          width: INNER_WIDTH,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        <Toolbar
          sx={{
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            gap: 1,
            minHeight: 56,
          }}
        >
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ flex: 1, minWidth: 0 }}
          >
            <OrionMark
              size={20}
              state={orionExpression.state}
              runId={orionExpression.runId}
            />
            <Typography variant="h6" noWrap>
              {showHistory ? 'History' : 'Ask Orion'}
            </Typography>
            {showHistory && (
              <Chip
                label={aiChat.conversations.length}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.7rem',
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: 'primary.main',
                }}
              />
            )}
          </Stack>

          <Tooltip
            title="New Chat"
            slotProps={{ popper: { sx: { zIndex: Z_INDEX.TOOLTIP } } }}
          >
            <span>
              <IconButton
                size="small"
                onClick={handleNewChat}
                disabled={aiChat.messages.length === 0}
                sx={{ color: 'primary.main' }}
              >
                <NewChatIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip
            title={showHistory ? 'Back to Chat' : 'Conversation History'}
            slotProps={{ popper: { sx: { zIndex: Z_INDEX.TOOLTIP } } }}
          >
            <IconButton
              size="small"
              onClick={onToggleHistory}
              sx={{ color: showHistory ? 'primary.main' : 'text.secondary' }}
            >
              {showHistory ? (
                <BackIcon sx={{ fontSize: 18 }} />
              ) : (
                <HistoryIcon sx={{ fontSize: 18 }} />
              )}
            </IconButton>
          </Tooltip>

          <OrionUsageRing refreshTrigger={aiChat.messages.length} />

          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Toolbar>

        {/* Sliding pager: chat ↔ history */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              width: '200%',
              height: '100%',
              transform: showHistory ? 'translateX(-50%)' : 'translateX(0)',
              transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {/* Chat View. AIChatInterface was sized for a full-width
                drawer; in this 380px-wide focus panel the default type
                scale dominates the message column. The selectors below
                trim the message body, input, helper text, template
                chips, and inline buttons down a tier so the chat reads
                comfortably in the narrower slot. Scoped via descendant
                selectors so AIChatInterface stays unchanged for other
                hosts (AIChatDrawer, etc.). */}
            <Box
              sx={{
                width: '50%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                position: 'relative',
                '& .MuiTypography-body1': { fontSize: '0.82rem', lineHeight: 1.45 },
                '& .MuiTypography-body2': { fontSize: '0.76rem', lineHeight: 1.4 },
                '& .MuiTypography-caption': { fontSize: '0.65rem', lineHeight: 1.35 },
                '& .MuiTypography-h6': { fontSize: '0.92rem' },
                '& .MuiTypography-subtitle1': { fontSize: '0.85rem' },
                '& .MuiTypography-subtitle2': { fontSize: '0.78rem' },
                '& .MuiInputBase-input': { fontSize: '0.82rem' },
                '& .MuiButton-root': { fontSize: '0.74rem' },
                '& .MuiChip-label': { fontSize: '0.7rem' },
                // The message-input editor is Draft.js, not an MUI input
                // — these selectors target the editable content and the
                // placeholder string so the chat input matches the rest
                // of the compact panel.
                '& .public-DraftEditor-content, & .public-DraftEditorPlaceholder-root': {
                  fontSize: '0.8rem',
                  lineHeight: 1.4,
                },
              }}
            >
              <AIChatInterface
                {...aiChat}
                userId={userId}
                calendar={calendar}
                trades={trades}
                questionTemplates={questionTemplates}
                autoScroll={aiChat.messages.length > 0}
                onTradeClick={onTradeClick}
                onEventClick={onEventClick}
                onNoteClick={onNoteClick}
                isReadOnly={isReadOnly}
              />
              {/* Loading overlay while a just-selected conversation's full
                  messages lazy-load. Mirrors AIChatContent's overlay so the
                  trade-gallery / event-detail focus panel gets the same
                  hydration feedback. */}
              {aiChat.loadingMessages && (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: theme.palette.background.default,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 15,
                  }}
                >
                  <CircularProgress size={28} />
                </Box>
              )}
            </Box>

            {/* History View */}
            <Box
              sx={{
                width: '50%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  flex: 1,
                  overflow: 'auto',
                  ...scrollbarStyles(theme),
                }}
              >
                {aiChat.loadingConversations ? (
                  <List sx={{ p: 0 }}>
                    {Array.from({ length: 5 }).map((_, index) => (
                      <React.Fragment key={index}>
                        <ListItem sx={{ py: 2, px: 2 }}>
                          <Box sx={{ width: '100%' }}>
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                mb: 1,
                              }}
                            >
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
                            <Shimmer
                              height={14}
                              width={120}
                              borderRadius={4}
                              variant="default"
                              intensity="low"
                            />
                          </Box>
                        </ListItem>
                        {index < 4 && <Divider />}
                      </React.Fragment>
                    ))}
                  </List>
                ) : aiChat.conversations.length === 0 ? (
                  <Box sx={{ p: 3 }}>
                    <Alert severity="info">
                      No conversation history yet. Start chatting to create your
                      first conversation for this trade.
                    </Alert>
                  </Box>
                ) : (
                  <List sx={{ p: 0 }}>
                    {aiChat.conversations.map((conversation, index) => (
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
                                backgroundColor: alpha(
                                  theme.palette.primary.main,
                                  0.08,
                                ),
                              },
                            }}
                          >
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1,
                                  mb: 0.5,
                                }}
                              >
                                <Typography
                                  variant="subtitle1"
                                  sx={{
                                    fontWeight: 600,
                                    fontSize: '0.9rem',
                                    flex: 1,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {conversation.title}
                                </Typography>
                                <Chip
                                  label={`${conversation.message_count}`}
                                  size="small"
                                  sx={{
                                    height: 18,
                                    minWidth: 24,
                                    fontSize: '0.65rem',
                                    backgroundColor: alpha(
                                      theme.palette.primary.main,
                                      0.1,
                                    ),
                                    color: 'primary.main',
                                  }}
                                />
                              </Box>

                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{
                                  fontSize: '0.8rem',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  mb: 0.5,
                                }}
                              >
                                {getPreviewText(conversation)}
                              </Typography>

                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 0.5,
                                }}
                              >
                                <ScheduleIcon
                                  sx={{ fontSize: 13, color: 'text.disabled' }}
                                />
                                <Typography
                                  variant="caption"
                                  color="text.disabled"
                                  sx={{ fontSize: '0.7rem' }}
                                >
                                  {format(
                                    conversation.updated_at,
                                    'MMM d • h:mm a',
                                  )}
                                </Typography>
                              </Box>
                            </Box>

                            <IconButton
                              onClick={(e) =>
                                handleDeleteConversation(conversation.id, e)
                              }
                              size="small"
                              sx={{
                                color: 'error.main',
                                flexShrink: 0,
                                mt: 0.5,
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </ListItemButton>
                        </ListItem>
                        {index < aiChat.conversations.length - 1 && <Divider />}
                      </React.Fragment>
                    ))}
                  </List>
                )}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default OrionPanel;
