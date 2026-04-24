import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Typography,
  useTheme,
  alpha,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Circle as UnreadIcon,
  ChatBubbleOutline as ChatIcon,
  ErrorOutline as ErrorIcon,
  Close as CloseIcon,
  NoteAddOutlined as NoteAddIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import Collapse from '@mui/material/Collapse';
import { format } from 'date-fns';
import type { OrionTaskResult, Significance } from '../../types/orionTask';
import { TASK_TYPE_LABELS, TASK_TYPE_COLORS } from '../../types/orionTask';
import CitationsSection from '../aiChat/CitationsSection';
import HtmlMessageRenderer from '../aiChat/HtmlMessageRenderer';
import type { Citation } from '../../types/aiChat';
import type { Calendar, Trade } from '../../types/dualWrite';
import type { EconomicEvent } from '../../types/economicCalendar';
import type { Note } from '../../types/note';
import type { TradeOperationsProps } from '../../types/tradeOperations';
import { useBriefingEmbedded } from '../../hooks/useBriefingEmbedded';
import TradeGalleryDialog from '../TradeGalleryDialog';
import EconomicEventDetailDialog from '../economicCalendar/EconomicEventDetailDialog';
import NoteEditorDialog from '../notes/NoteEditorDialog';

interface TaskResultCardProps {
  result: OrionTaskResult;
  onMarkRead: (resultId: string) => void;
  /** Soft-delete: hides the card from the feed. The row stays in the database
   *  so Orion's dedup context (fetchRecentBriefings) still sees it and avoids
   *  re-reporting the same catalyst the user just dismissed. */
  onHide?: (resultId: string) => void;
  /** Optional: clicking the Follow-up button calls this with the result so the
   *  parent can switch to the Chat tab and seed the input with briefing context. */
  onFollowup?: (result: OrionTaskResult) => void;
  /** Optional: save this briefing as a note. */
  onSaveNote?: (result: OrionTaskResult) => Promise<void>;
  /** Calendar context so click-through dialogs (trade gallery, event detail,
   *  note editor) can render. If omitted, refs still render as chips but do
   *  nothing on click — acceptable degradation. */
  calendar?: Calendar;
  /** All trades for the calendar — used by TradeGalleryDialog to show context.
   *  Optional: the dialog falls back to fetching by year when omitted. */
  trades?: Trade[];
  /** Trade mutation callbacks for the embedded gallery / event / note dialogs. */
  tradeOperations?: TradeOperationsProps;
  isReadOnly?: boolean;
}

const SIGNIFICANCE_COLORS: Record<Significance, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#22c55e',
};

const TaskResultCard: React.FC<TaskResultCardProps> = ({
  result,
  onMarkRead,
  onHide,
  onFollowup,
  onSaveNote,
  calendar,
  trades,
  tradeOperations,
  isReadOnly,
}) => {
  const theme = useTheme();
  const [isSaving, setIsSaving] = useState(false);
  // Read cards start collapsed; unread start expanded
  const [expanded, setExpanded] = useState(!result.is_read);
  const isError = result.metadata?.error === true;

  // Fetch referenced entities only when the card is expanded. Collapsed briefings
  // stay cheap — no round-trips until the user opens them.
  const { embeddedTrades, embeddedEvents, embeddedNotes } = useBriefingEmbedded(
    result.content_html,
    expanded
  );

  // Click-through dialog state. Hosted locally so parent doesn't need to
  // manage per-briefing dialog stacks.
  const [galleryTradeId, setGalleryTradeId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EconomicEvent | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  const handleSaveNote = async () => {
    if (!onSaveNote || isSaving) return;
    setIsSaving(true);
    try {
      await onSaveNote(result);
    } finally {
      setIsSaving(false);
    }
  };

  const accentColor = isError
    ? theme.palette.error.main
    : theme.palette.primary.main;

  const canOpenDialogs = !!calendar && !!tradeOperations;

  return (
    <Card
      sx={{
        mb: 1.5,
        borderRadius: '10px',
        border: `1px solid ${isError
            ? alpha(theme.palette.error.main, 0.45)
            : result.is_read
              ? theme.palette.divider
              : alpha(theme.palette.primary.main, 0.3)
          }`,
        backgroundColor: isError
          ? alpha(theme.palette.error.main, 0.05)
          : result.is_read
            ? 'background.paper'
            : alpha(theme.palette.primary.main, 0.03),
        transition: 'all 0.2s ease',
        '&:hover': {
          transform: 'none'
        },
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={TASK_TYPE_LABELS[result.task_type]}
              size="small"
              sx={{
                fontSize: '0.7rem',
                height: 22,
                fontWeight: 600,
                backgroundColor: alpha(TASK_TYPE_COLORS[result.task_type], 0.18),
                color: TASK_TYPE_COLORS[result.task_type],
              }}
            />
            {isError && (
              <Chip
                icon={<ErrorIcon sx={{ fontSize: '12px !important' }} />}
                label="FAILED"
                size="small"
                sx={{
                  fontSize: '0.65rem',
                  height: 20,
                  fontWeight: 700,
                  backgroundColor: alpha(theme.palette.error.main, 0.15),
                  color: theme.palette.error.main,
                  '& .MuiChip-icon': { color: theme.palette.error.main },
                }}
              />
            )}
            {!isError && result.significance && (
              <Chip
                label={result.significance.toUpperCase()}
                size="small"
                sx={{
                  fontSize: '0.65rem',
                  height: 20,
                  fontWeight: 700,
                  backgroundColor: alpha(
                    SIGNIFICANCE_COLORS[result.significance],
                    0.15
                  ),
                  color: SIGNIFICANCE_COLORS[result.significance],
                }}
              />
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', fontSize: '0.7rem' }}
            >
              {format(new Date(result.created_at), 'MMM d · h:mm a')}
            </Typography>
            {!result.is_read && (
              <Tooltip title="Mark as read">
                <IconButton
                  size="small"
                  onClick={() => onMarkRead(result.id)}
                  sx={{ p: 0.25 }}
                >
                  <UnreadIcon sx={{ fontSize: 10, color: accentColor }} />
                </IconButton>
              </Tooltip>
            )}
            {onHide && (
              <Tooltip title="Dismiss from feed">
                <IconButton
                  size="small"
                  onClick={() => onHide(result.id)}
                  sx={{ p: 0.25 }}
                >
                  <CloseIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title={expanded ? 'Collapse' : 'Expand'}>
              <IconButton
                size="small"
                onClick={() => setExpanded((v) => !v)}
                sx={{ p: 0.25 }}
              >
                <ExpandMoreIcon
                  sx={{
                    fontSize: 16,
                    color: 'text.secondary',
                    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                  }}
                />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Collapse in={expanded} timeout="auto">
          <Box sx={{ mt: 0.5 }}>
            <HtmlMessageRenderer
              html={result.content_html}
              textColor="text.primary"
              embeddedTrades={embeddedTrades}
              embeddedEvents={embeddedEvents}
              embeddedNotes={embeddedNotes}
              trades={trades}
              onTradeClick={
                canOpenDialogs
                  ? (tradeId) => setGalleryTradeId(tradeId)
                  : undefined
              }
              onEventClick={
                canOpenDialogs
                  ? (event) => setSelectedEvent(event)
                  : undefined
              }
              onNoteClick={
                canOpenDialogs
                  ? (noteId) => {
                      const note = embeddedNotes?.[noteId];
                      if (note) setSelectedNote(note);
                    }
                  : undefined
              }
            />
          </Box>

          {Array.isArray(result.metadata?.citations) && (result.metadata.citations as Citation[]).length > 0 && (
            <CitationsSection
              citations={result.metadata.citations as Citation[]}
              compact
            />
          )}
        </Collapse>

        {(onFollowup || onSaveNote) && (expanded) && (
          <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
            {onSaveNote && (
              <Button
                size="small"
                startIcon={isSaving ? <CircularProgress size={12} color="inherit" /> : <NoteAddIcon sx={{ fontSize: 14 }} />}
                onClick={handleSaveNote}
                disabled={isSaving}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  py: 0.25,
                  px: 1,
                  color: 'text.secondary',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.action.active, 0.06),
                  },
                }}
              >
                Save as Note
              </Button>
            )}
            {onFollowup && (
              <Button
                size="small"
                startIcon={<ChatIcon sx={{ fontSize: 14 }} />}
                onClick={() => onFollowup(result)}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  py: 0.25,
                  px: 1,
                  color: theme.palette.primary.main,
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.08),
                  },
                }}
              >
                Follow up with Orion
              </Button>
            )}
          </Box>
        )}
      </CardContent>

      {/* Click-through dialogs — rendered only when a ref is clicked.
       *  We seed the gallery with the freshly-fetched embedded trades (which
       *  is guaranteed to contain the clicked trade). If that's somehow
       *  empty we fall back to the parent-supplied trades list — the gallery
       *  uses initialTradeId to pick which trade to show first. */}
      {galleryTradeId && calendar && tradeOperations && (
        <TradeGalleryDialog
          open
          onClose={() => setGalleryTradeId(null)}
          trades={
            embeddedTrades && Object.keys(embeddedTrades).length > 0
              ? Object.values(embeddedTrades)
              : (trades ?? [])
          }
          initialTradeId={galleryTradeId}
          setZoomedImage={() => {
            /* briefings don't need cross-dialog zoom; HtmlMessageRenderer
               handles inline image zoom via ImageZoomDialog already. */
          }}
          title="Trade from briefing"
          calendarId={calendar.id}
          calendar={calendar}
          aiOnlyMode={false}
          isReadOnly={isReadOnly}
          tradeOperations={tradeOperations}
        />
      )}

      {selectedEvent && calendar && tradeOperations && (
        <EconomicEventDetailDialog
          open
          onClose={() => setSelectedEvent(null)}
          event={selectedEvent}
          calendarId={calendar.id}
          tradeOperations={tradeOperations}
          isReadOnly={isReadOnly}
        />
      )}

      {selectedNote && calendar && (
        <NoteEditorDialog
          open
          onClose={() => setSelectedNote(null)}
          note={selectedNote}
          calendarId={calendar.id}
          availableTradeTags={calendar.tags || []}
          calendarNotes={calendar.notes}
          onSave={() => {
            /* The briefing's stored HTML still references the note by id;
               the next expand will re-fetch the updated version. */
          }}
          onDelete={() => {
            setSelectedNote(null);
          }}
        />
      )}
    </Card>
  );
};

export default TaskResultCard;
