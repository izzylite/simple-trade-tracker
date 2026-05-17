import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Typography,
  useTheme,
  alpha,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Circle as UnreadIcon,
  AutoAwesome as AutoAwesomeIcon,
  ErrorOutline as ErrorIcon,
  Close as CloseIcon,
  NoteAddOutlined as NoteAddIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import Collapse from '@mui/material/Collapse';
import { format } from 'date-fns';
import type { OrionTaskResult, Significance } from '../../types/orionTask';
import { TASK_TYPE_LABELS, TASK_TYPE_COLORS } from '../../types/orionTask';
import { useDialogTokens, MONO_FONT } from '../../styles/dialogTokens';
import CitationsSection from '../aiChat/CitationsSection';
import HtmlMessageRenderer from '../aiChat/HtmlMessageRenderer';
import ToolUsageChip, { type ToolUsageEntry } from '../aiChat/ToolUsageChip';
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
  const {
    violet,
    violetSoft,
    violetSofter,
    violetBorder,
    surfaceInset,
    hairline,
    monoLabelSx,
    monoSectionLabelSx,
  } = useDialogTokens();

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

  const accentColor = isError ? theme.palette.error.main : violet;
  const canOpenDialogs = !!calendar && !!tradeOperations;
  const isUnread = !result.is_read;
  const taskColor = TASK_TYPE_COLORS[result.task_type];

  // Inset-card style: surfaceInset bg, hairline border on all 4 sides.
  // Unread cards add a violet left accent rail via inset box-shadow — the rail
  // is the only colored edge so the card doesn't read as a full violet outline.
  // No hover lift: cards are click-to-expand, hover would imply navigation.
  const cardSx = {
    position: 'relative' as const,
    mb: 1.25,
    borderRadius: 1.5,
    cursor: 'pointer',
    overflow: 'hidden',
    backgroundColor: isError
      ? alpha(theme.palette.error.main, 0.05)
      : surfaceInset,
    border: `1px solid ${
      isError ? alpha(theme.palette.error.main, 0.45) : hairline
    }`,
    boxShadow: isUnread && !isError ? `inset 3px 0 0 0 ${violet}` : 'none',
  };

  return (
    <Card onClick={() => setExpanded((v) => !v)} sx={cardSx} elevation={0}>
      <CardContent
        sx={{
          p: 1.5,
          pl: isUnread && !isError ? 1.75 : 1.5,
          '&:last-child': { pb: 1.5 },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            mb: 0.75,
          }}
        >
          {/* Mono section label: dot + task type name + NEW badge + FAILED / sig pill */}
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              minWidth: 0,
              flex: 1,
            }}
          >
            <Box
              sx={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: taskColor,
                flexShrink: 0,
              }}
            />
            <Typography
              component="span"
              sx={{
                ...monoSectionLabelSx,
                color: taskColor,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {TASK_TYPE_LABELS[result.task_type]}
            </Typography>

            {isUnread && !isError && (
              <Box
                component="span"
                sx={{
                  fontFamily: MONO_FONT,
                  fontSize: '0.58rem',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  color: violet,
                  backgroundColor: violetSofter,
                  border: `1px solid ${violetBorder}`,
                  borderRadius: 0.75,
                  px: 0.5,
                  py: 0.05,
                  lineHeight: 1.4,
                  flexShrink: 0,
                }}
              >
                NEW
              </Box>
            )}

            {isError && (
              <Box
                component="span"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.35,
                  fontFamily: MONO_FONT,
                  fontSize: '0.58rem',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  color: theme.palette.error.main,
                  backgroundColor: alpha(theme.palette.error.main, 0.12),
                  border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
                  borderRadius: 0.75,
                  px: 0.5,
                  py: 0.05,
                  lineHeight: 1.4,
                  flexShrink: 0,
                }}
              >
                <ErrorIcon sx={{ fontSize: 10 }} />
                FAILED
              </Box>
            )}

            {!isError && result.significance && (
              <Box
                component="span"
                sx={{
                  fontFamily: MONO_FONT,
                  fontSize: '0.58rem',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  color: SIGNIFICANCE_COLORS[result.significance],
                  backgroundColor: alpha(
                    SIGNIFICANCE_COLORS[result.significance],
                    0.12
                  ),
                  border: `1px solid ${alpha(
                    SIGNIFICANCE_COLORS[result.significance],
                    0.3
                  )}`,
                  borderRadius: 0.75,
                  px: 0.5,
                  py: 0.05,
                  lineHeight: 1.4,
                  flexShrink: 0,
                }}
              >
                {result.significance.toUpperCase()}
              </Box>
            )}
          </Box>

          {/* Right cluster — time + tiny actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
            <Typography
              variant="caption"
              sx={{
                fontFamily: MONO_FONT,
                color: 'text.secondary',
                fontSize: '0.66rem',
                letterSpacing: '0.04em',
                mr: 0.25,
              }}
            >
              {format(new Date(result.created_at), 'h:mm a')}
            </Typography>
            {isUnread && (
              <Tooltip title="Mark as read">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkRead(result.id);
                  }}
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
                  onClick={(e) => {
                    e.stopPropagation();
                    onHide(result.id);
                  }}
                  sx={{
                    p: 0.25,
                    color: 'text.secondary',
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.text.primary, 0.06),
                    },
                  }}
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title={expanded ? 'Collapse' : 'Expand'}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((v) => !v);
                }}
                sx={{
                  p: 0.25,
                  color: 'text.secondary',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.text.primary, 0.06),
                  },
                }}
              >
                <ExpandMoreIcon
                  sx={{
                    fontSize: 16,
                    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 200ms ease',
                  }}
                />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Collapse in={expanded} timeout="auto" onClick={(e) => e.stopPropagation()}>
          <Box sx={{ mt: 0.25 }}>
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

          {(() => {
            const citations = Array.isArray(result.metadata?.citations)
              ? (result.metadata!.citations as Citation[])
              : [];
            const toolCalls = Array.isArray(result.metadata?.tool_calls)
              ? (result.metadata!.tool_calls as ToolUsageEntry[])
              : [];
            const hasAny = citations.length > 0 || toolCalls.length > 0;
            if (!hasAny) return null;
            return (
              <Box
                sx={{
                  mt: 1.25,
                  pt: 1.25,
                  borderTop: `1px solid ${hairline}`,
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                {citations.length > 0 && (
                  <CitationsSection citations={citations} compact />
                )}
                {toolCalls.length > 0 && (
                  <ToolUsageChip toolCalls={toolCalls} variant="popover" />
                )}
              </Box>
            );
          })()}
        </Collapse>

        {(onFollowup || onSaveNote) && expanded && isUnread && (
          <Box
            onClick={(e) => e.stopPropagation()}
            sx={{
              mt: 1.25,
              pt: 1.25,
              borderTop: `1px solid ${hairline}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 0.5,
              flexWrap: 'wrap',
            }}
          >
            {onSaveNote && (
              <Button
                size="small"
                startIcon={
                  isSaving ? (
                    <CircularProgress size={12} thickness={5} sx={{ color: 'inherit' }} />
                  ) : (
                    <NoteAddIcon sx={{ fontSize: 14 }} />
                  )
                }
                onClick={handleSaveNote}
                disabled={isSaving}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  color: 'text.secondary',
                  backgroundColor: 'transparent',
                  border: `1px solid ${hairline}`,
                  borderRadius: 1,
                  px: 1,
                  py: 0.25,
                  minHeight: 0,
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.text.primary, 0.04),
                    borderColor: alpha(theme.palette.text.primary, 0.2),
                  },
                  '&.Mui-disabled': {
                    color: alpha(theme.palette.text.secondary, 0.5),
                    borderColor: hairline,
                  },
                }}
              >
                {isSaving ? 'Saving…' : 'Save as Note'}
              </Button>
            )}
            {onFollowup && (
              <Button
                size="small"
                startIcon={<AutoAwesomeIcon sx={{ fontSize: 14 }} />}
                onClick={() => onFollowup(result)}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  color: violet,
                  backgroundColor: violetSofter,
                  border: `1px solid ${violetBorder}`,
                  borderRadius: 1,
                  px: 1,
                  py: 0.25,
                  minHeight: 0,
                  '&:hover': { backgroundColor: violetSoft },
                }}
              >
                Ask Orion
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
