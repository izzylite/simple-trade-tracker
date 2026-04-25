/**
 * Chat Message Component
 * Displays user and AI messages with proper formatting
 */

import React, { useState, useMemo } from 'react';
import OrionIcon from './OrionIcon';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  Alert,
  useTheme,
  alpha
} from '@mui/material';
import HtmlMessageRenderer from './HtmlMessageRenderer';
import CitationsSection from './CitationsSection';
import MarkdownRenderer from './MarkdownRenderer';
import ToolUsageChip from './ToolUsageChip';
import {
  ContentCopy as CopyIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  Edit as EditIcon,
  Check as CopiedIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { stripReferencedBlocks } from '../../utils/chatMentions';
import { ChatMessage as ChatMessageType } from '../../types/aiChat';
import { Trade } from '../../types/trade';
import { EconomicEvent } from '../../types/economicCalendar';
import { format } from 'date-fns';
import { logger } from '../../utils/logger';
import { getTagChipStyles } from '../../utils/tagColors';
import ImageZoomDialog, { ImageZoomProp } from '../ImageZoomDialog';

interface ChatMessageProps {
  message: ChatMessageType;
  showTimestamp?: boolean;
  isLatestMessage?: boolean;
  onTradeClick?: (tradeId: string, contextTrades: Trade[]) => void;
  onEventClick?: (event: EconomicEvent) => void;
  onNoteClick?: (noteId: string) => void;
  onEdit?: (messageId: string) => void;
  trades?: Trade[];
  availableTags?: string[];
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  showTimestamp = true,
  isLatestMessage = false,
  onTradeClick,
  onEventClick,
  onNoteClick,
  onEdit,
  trades = [],
  availableTags = []
}) => {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);
  const [reasoningExpanded, setReasoningExpanded] = useState(false);
  const [zoomImage, setZoomImage] = useState<ImageZoomProp | null>(null);

  const openImageZoom = (index: number) => {
    const urls = (message.images || []).map(img => img.url).filter(Boolean);
    if (urls.length === 0) return;
    setZoomImage({ selectetdImageIndex: index, allImages: urls });
  };
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isDark = theme.palette.mode === 'dark';

  // Render a note-mention as a simple title chip — matches the editor's
  // NoteMentionEntity styling so the chip in the transcript looks identical
  // to the chip that appears while editing.
  const noteChipSx = useMemo(() => ({
    display: 'inline-flex',
    verticalAlign: 'middle',
    height: 22,
    fontSize: '0.75rem',
    mx: 0.25,
    cursor: 'default',
    backgroundColor: alpha(theme.palette.info.main, 0.1),
    color: theme.palette.info.main,
    border: `1px solid ${alpha(theme.palette.info.main, 0.3)}`,
  }), [theme]);

  // Render a run of plain text, with any availableTags substrings converted
  // to tag chips (same behaviour as before for typed text).
  const renderTextWithTagChips = (text: string, keyPrefix: string): React.ReactNode[] => {
    if (availableTags.length === 0) return [text];
    const sortedTags = [...availableTags].sort((a, b) => b.length - a.length);
    const matches: Array<{ start: number; end: number; tag: string }> = [];
    for (const tag of sortedTags) {
      let searchFrom = 0;
      while (searchFrom < text.length) {
        const idx = text.indexOf(tag, searchFrom);
        if (idx === -1) break;
        const end = idx + tag.length;
        const overlaps = matches.some(m => idx < m.end && end > m.start);
        if (!overlaps) matches.push({ start: idx, end, tag });
        searchFrom = idx + 1;
      }
    }
    if (matches.length === 0) return [text];
    matches.sort((a, b) => a.start - b.start);
    const out: React.ReactNode[] = [];
    let lastIdx = 0;
    matches.forEach((m, i) => {
      if (m.start > lastIdx) out.push(text.substring(lastIdx, m.start));
      out.push(
        <Chip
          key={`${keyPrefix}-tag-${i}`}
          label={m.tag}
          size="small"
          sx={{
            ...getTagChipStyles(m.tag, theme),
            display: 'inline-flex',
            verticalAlign: 'middle',
            height: 20,
            fontSize: '0.75rem',
            mx: 0.25,
            cursor: 'default',
          }}
        />
      );
      lastIdx = m.end;
    });
    if (lastIdx < text.length) out.push(text.substring(lastIdx));
    return out;
  };

  // User message rendering:
  //  - If segments were persisted (note mentions present), render each text
  //    segment with tag-chip splitting + each note-mention as a title chip.
  //    This is the common case for mentions and gives transcript↔editor parity.
  //  - Otherwise, strip any leftover [Referenced ...:] blocks from the raw
  //    content (legacy messages) and render typed text with tag chips only.
  const renderUserContentWithTagChips = useMemo(() => {
    if (!isUser) return null;

    if (message.segments && message.segments.length > 0) {
      const out: React.ReactNode[] = [];
      message.segments.forEach((seg, i) => {
        if (seg.type === 'text') {
          out.push(...renderTextWithTagChips(seg.value, `seg-${i}`));
        } else {
          out.push(
            <Chip
              key={`seg-${i}-note`}
              label={seg.noteTitle}
              size="small"
              sx={noteChipSx}
            />
          );
        }
      });
      return out;
    }

    const plain = stripReferencedBlocks(message.content);
    const rendered = renderTextWithTagChips(plain, 'plain');
    if (rendered.length === 1 && typeof rendered[0] === 'string' && rendered[0] === message.content) {
      return null; // no transformation happened — let the fallback renderer handle it
    }
    return rendered;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUser, message.content, message.segments, availableTags, theme, noteChipSx]);

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
        return <ScheduleIcon sx={{ fontSize: 12, color: 'text.disabled' }} />;
      case 'sent':
      case 'received':
        return <CheckIcon sx={{ fontSize: 12, color: 'success.main', opacity: 0.6 }} />;
      case 'error':
        return <ErrorIcon sx={{ fontSize: 12, color: 'error.main' }} />;
      default:
        return null;
    }
  };

  const renderMessageContent = () => (
    <Box
      sx={{
        animation: message.status === 'receiving' && isAssistant ? 'subtlePulse 0.5s ease-in-out' : 'none',
        '@keyframes subtlePulse': {
          '0%': { opacity: 0.85 },
          '50%': { opacity: 1 },
          '100%': { opacity: 0.95 }
        },
        transition: 'opacity 0.5s ease-in-out'
      }}
    >
      {message.messageHtml ? (
        <HtmlMessageRenderer
          html={message.messageHtml}
          embeddedTrades={message.embeddedTrades}
          embeddedEvents={message.embeddedEvents}
          embeddedNotes={message.embeddedNotes}
          onTradeClick={onTradeClick}
          onEventClick={onEventClick}
          onNoteClick={onNoteClick}
          trades={trades}
        />
      ) : isUser && renderUserContentWithTagChips ? (
        <Typography
          component="div"
          sx={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
            lineHeight: 1.65,
            fontSize: '0.95rem'
          }}
        >
          {renderUserContentWithTagChips}
        </Typography>
      ) : (
        <MarkdownRenderer content={message.content} />
      )}
    </Box>
  );

  const imageZoomDialog = zoomImage && (
    <ImageZoomDialog
      open={!!zoomImage}
      onClose={() => setZoomImage(null)}
      imageProp={zoomImage}
    />
  );

  // ── ASSISTANT MESSAGE ──────────────────────────────────────────────────────
  if (isAssistant) {
    return (
      <>
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          mb: 4,
          alignItems: 'flex-start',
          px: 1,
          animation: isLatestMessage ? 'fadeInUp 0.25s ease-out' : 'none',
          '@keyframes fadeInUp': {
            '0%': { opacity: 0, transform: 'translateY(8px)' },
            '100%': { opacity: 1, transform: 'translateY(0)' }
          }
        }}
      >
        {/* Orion avatar */}
        <Tooltip title="Orion" placement="left">
          <OrionIcon size={26} sx={{ mt: 0.25 }} />
        </Tooltip>

        {/* Content — no bubble, flows on background */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            position: 'relative',
            '&:hover .msg-actions': { opacity: 1 }
          }}
        >
          {/* User-attached images in assistant context (rare but supported) */}
          {Array.isArray(message.images) && message.images.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
              {message.images.map((image, index) => (
                <Box
                  key={image.id || index}
                  component="img"
                  src={image.url}
                  alt={image.name || `Image ${index + 1}`}
                  sx={{
                    maxWidth: '100%',
                    maxHeight: 200,
                    borderRadius: 2,
                    objectFit: 'contain',
                    cursor: 'pointer',
                    '&:hover': { opacity: 0.9 }
                  }}
                  onClick={() => openImageZoom(index)}
                />
              ))}
            </Box>
          )}

          {/* Reasoning (Gemini chain-of-thought) — collapsed by default, above answer */}
          {isAssistant && message.reasoning && (
            <Box sx={{ mb: 1.5 }}>
              <Box
                onClick={() => setReasoningExpanded(v => !v)}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  cursor: 'pointer',
                  color: 'text.secondary',
                  '&:hover': { color: 'text.primary' },
                }}
              >
                <Typography variant="caption" sx={{ fontSize: '0.82rem', lineHeight: 1 }}>
                  {message.status === 'receiving' ? 'Thinking' : 'Reasoning'}
                </Typography>
                {reasoningExpanded
                  ? <ExpandLessIcon sx={{ fontSize: 16 }} />
                  : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
              </Box>
              {reasoningExpanded && (
                <Box sx={{ mt: 0.75, color: 'text.secondary', fontSize: '0.82rem' }}>
                  <MarkdownRenderer content={message.reasoning} />
                </Box>
              )}
            </Box>
          )}

          {renderMessageContent()}

          {/* Citations */}
          {message.citations && message.citations.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <CitationsSection citations={message.citations} />
            </Box>
          )}

          {/* Tool calls — collapsed by default, shows what tools Orion used */}
          {isAssistant && message.toolCalls && message.toolCalls.length > 0 && (
            <Box sx={{ mt: 1.5 }}>
              <ToolUsageChip toolCalls={message.toolCalls} />
            </Box>
          )}

          {/* Error */}
          {message.error && (
            <Alert severity="error" sx={{ mt: 1.5, fontSize: '0.85rem', borderRadius: 2 }}>
              {message.error}
            </Alert>
          )}

          {/* Metadata + floating copy */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mt: 1.5
            }}
          >
            {showTimestamp && (
              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem' }}>
                {format(message.timestamp, 'HH:mm')}
              </Typography>
            )}
            {getStatusIcon()}

            {/* Copy button - inline after timestamp */}
            <Box
              className="msg-actions"
              sx={{ opacity: 0, transition: 'opacity 0.15s', display: 'flex', gap: 0.5 }}
            >
              <Tooltip title={copied ? 'Copied!' : 'Copy'}>
                <IconButton
                  size="small"
                  onClick={handleCopy}
                  sx={{
                    width: 24,
                    height: 24,
                    color: 'text.disabled',
                    '&:hover': { color: 'text.primary', backgroundColor: alpha(theme.palette.divider, 0.5) }
                  }}
                >
                  {copied
                    ? <CopiedIcon sx={{ fontSize: 13 }} />
                    : <CopyIcon sx={{ fontSize: 13 }} />
                  }
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Box>
      </Box>
      {imageZoomDialog}
      </>
    );
  }

  // ── USER MESSAGE ───────────────────────────────────────────────────────────
  return (
    <>
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'flex-end',
        mb: 4,
        px: 1,
        animation: isLatestMessage ? 'fadeInUp 0.2s ease-out' : 'none',
        '@keyframes fadeInUp': {
          '0%': { opacity: 0, transform: 'translateY(8px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' }
        }
      }}
    >
      <Box sx={{ maxWidth: '78%', minWidth: 0 }}>
        {/* User pill bubble */}
        <Paper
          elevation={0}
          sx={{
            px: 2.5,
            py: 1.5,
            backgroundColor: isDark
              ? alpha(theme.palette.primary.main, 0.13)
              : alpha(theme.palette.primary.main, 0.07),
            border: '1px solid',
            borderColor: alpha(theme.palette.primary.main, isDark ? 0.22 : 0.18),
            borderRadius: '18px 18px 4px 18px',
            position: 'relative',
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
            '& a': {
              color: alpha(theme.palette.primary.light, 0.9),
              textDecorationColor: alpha(theme.palette.primary.light, 0.4)
            },
            '&:hover .msg-actions': { opacity: 1 }
          }}
        >
          {/* Attached images */}
          {Array.isArray(message.images) && message.images.length > 0 && (
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1,
                mb: message.content ? 1.5 : 0
              }}
            >
              {message.images.map((image, index) => (
                <Box
                  key={image.id || index}
                  component="img"
                  src={image.url}
                  alt={image.name || `Attached image ${index + 1}`}
                  sx={{
                    maxWidth: '100%',
                    maxHeight: 200,
                    borderRadius: 2,
                    objectFit: 'contain',
                    backgroundColor: alpha(theme.palette.common.black, 0.1),
                    cursor: 'pointer',
                    '&:hover': { opacity: 0.9 }
                  }}
                  onClick={() => openImageZoom(index)}
                />
              ))}
            </Box>
          )}

          {renderMessageContent()}

          {/* Hover edit action */}
          {onEdit && (
            <Box
              className="msg-actions"
              sx={{
                position: 'absolute',
                top: 6,
                left: -36,
                opacity: 0,
                transition: 'opacity 0.15s'
              }}
            >
              <Tooltip title="Edit">
                <IconButton
                  size="small"
                  onClick={() => onEdit(message.id)}
                  sx={{
                    width: 28,
                    height: 28,
                    color: 'text.disabled',
                    '&:hover': {
                      color: 'text.primary',
                      backgroundColor: alpha(theme.palette.divider, 0.5)
                    }
                  }}
                >
                  <EditIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Paper>

        {/* Metadata */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 0.75,
            mt: 0.5,
            px: 0.5
          }}
        >
          {showTimestamp && (
            <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem' }}>
              {format(message.timestamp, 'HH:mm')}
            </Typography>
          )}
          {getStatusIcon()}
        </Box>
      </Box>
    </Box>
    {imageZoomDialog}
    </>
  );
};

export default React.memo(ChatMessage);
