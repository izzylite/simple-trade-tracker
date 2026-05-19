import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Box,
  IconButton,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  CallMadeOutlined as TradeArrowIcon,
  CallReceivedOutlined as TradeShortArrowIcon,
} from '@mui/icons-material';
import {
  pink, purple, deepPurple, indigo, lightBlue, cyan,
  teal, lightGreen, lime, yellow, amber, deepOrange,
  brown, grey, blueGrey,
} from '@mui/material/colors';
import type { Theme } from '@mui/material';
import { convertFromRaw } from 'draft-js';

import { Note } from 'features/notes/types/note';
import { Trade } from 'features/calendar/types/dualWrite';
import { scrollbarStyles } from 'styles/scrollbarStyles';
import type { TradeChipData } from 'components/common/RichTextEditor/utils/tradeEntityUtils';
import { getSharedTrade } from 'features/calendar/services/sharingService';
import { logger } from 'utils/logger';
import TradeGalleryDialog from 'features/calendar/components/TradeGalleryDialog';
import ImageZoomDialog, { ImageZoomProp } from 'features/calendar/components/ImageZoomDialog';
import { EYEBROW_SX, TNUM, getInsetTileSx } from 'styles/designTokens';
import EyebrowRow from 'components/common/EyebrowRow';
import StatTile from 'components/common/StatTile';

interface NoteMetaPanelProps {
  note: Note | null;
  notes?: Note[];
  onSelectNote?: (note: Note) => void;
}

interface Heading {
  level: 2 | 3;
  text: string;
  id: string;
}

function extractHeadings(content: string): Heading[] {
  if (!content) return [];
  try {
    const raw = JSON.parse(content);
    return (raw.blocks as Array<{ type: string; text: string; key: string }>)
      .filter(b => b.type === 'header-two' || b.type === 'header-three')
      .map(b => ({
        level: b.type === 'header-two' ? 2 : 3,
        text: b.text,
        id: b.key,
      })) as Heading[];
  } catch {
    return [];
  }
}

/**
 * Pull every TRADE_LINK entity from a note's Draft.js JSON content,
 * de-duped by tradeId (so a trade referenced twice only appears once in
 * the side-panel list). Returns them in the order they were first
 * referenced in the document.
 */
function extractLinkedTrades(content: string): TradeChipData[] {
  if (!content) return [];
  try {
    const raw = JSON.parse(content);
    const entityMap = raw?.entityMap;
    if (!entityMap || typeof entityMap !== 'object') return [];
    const seen = new Set<string>();
    const out: TradeChipData[] = [];
    Object.values(entityMap).forEach((e: any) => {
      if (e?.type !== 'TRADE_LINK') return;
      const data = e?.data;
      if (!data?.tradeId || !data?.shareId) return;
      if (seen.has(data.tradeId)) return;
      seen.add(data.tradeId);
      out.push({
        shareId: data.shareId,
        tradeId: data.tradeId,
        date: data.date,
        pnl: typeof data.pnl === 'number' ? data.pnl : 0,
        direction: data.direction,
      });
    });
    return out;
  } catch {
    return [];
  }
}

function countWords(content: string): number {
  if (!content) return 0;
  try {
    const text = convertFromRaw(JSON.parse(content)).getPlainText();
    return text.trim().split(/\s+/).filter(Boolean).length;
  } catch {
    return content.trim().split(/\s+/).filter(Boolean).length;
  }
}

const getColorMap = (theme: Theme): Record<string, string> => ({
  red: theme.palette.error.main,
  pink: pink[500],
  purple: purple[500],
  deepPurple: deepPurple[500],
  indigo: indigo[500],
  blue: theme.palette.info.main,
  lightBlue: lightBlue[500],
  cyan: cyan[500],
  teal: teal[500],
  green: theme.palette.success.main,
  lightGreen: lightGreen[500],
  lime: lime[500],
  yellow: yellow[600],
  amber: amber[500],
  orange: theme.palette.warning.main,
  deepOrange: deepOrange[500],
  brown: brown[500],
  grey: grey[500],
  blueGrey: blueGrey[500],
});

const extractPreview = (content: string): string => {
  if (!content) return '';
  if (content.startsWith('{"blocks"')) {
    try {
      const parsed = JSON.parse(content);
      if (parsed.blocks) {
        return parsed.blocks
          .map((b: { text?: string }) => b.text || '')
          .filter(Boolean)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
    } catch { /* fall through */ }
  }
  return content
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
};

const DISMISS_DURATION_MS = 240;

interface ReminderCardStackProps {
  notes: Note[];
  onSelect: (note: Note) => void;
}

const ReminderCardStack: React.FC<ReminderCardStackProps> = ({ notes, onSelect }) => {
  const theme = useTheme();
  const colorMap = getColorMap(theme);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDismissClick = useCallback((noteId: string) => {
    if (dismissingId) return;
    setDismissingId(noteId);
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => {
      setDismissedIds(prev => {
        const next = new Set(prev);
        next.add(noteId);
        return next;
      });
      setDismissingId(null);
    }, DISMISS_DURATION_MS);
  }, [dismissingId]);

  const activeNotes = notes.filter(n => !dismissedIds.has(n.id));
  if (activeNotes.length === 0) return null;

  const front = activeNotes[0];
  const frontColor = front.color
    ? colorMap[front.color] || theme.palette.grey[700]
    : theme.palette.grey[700];
  const preview = extractPreview(front.content);
  const remaining = activeNotes.length - 1;

  return (
    <Box
      onClick={() => onSelect(front)}
      sx={{
        borderRadius: `${theme.palette.custom.radius.lg}px`,
        bgcolor: alpha(frontColor, 0.15),
        height: 200,
        border: `1px solid ${alpha(frontColor, 0.3)}`,
        cursor: 'pointer',
        boxShadow: theme.palette.mode === 'dark'
          ? `0 1px 2px ${alpha(theme.palette.common.black, 0.4)}, 0 8px 20px ${alpha(theme.palette.common.black, 0.45)}, 0 16px 40px ${alpha(frontColor, 0.18)}`
          : `0 1px 2px ${alpha(frontColor, 0.18)}, 0 8px 20px ${alpha(frontColor, 0.22)}, 0 16px 40px ${alpha(frontColor, 0.14)}`,
        opacity: dismissingId === front.id ? 0 : 1,
        transform: dismissingId === front.id ? 'translateY(-12px)' : 'translateY(0)',
        transition: `
          opacity ${DISMISS_DURATION_MS}ms ${theme.palette.custom.easing.smooth},
          transform ${DISMISS_DURATION_MS}ms ${theme.palette.custom.easing.smooth},
          background-color 200ms ${theme.palette.custom.easing.smooth},
          border-color 200ms ${theme.palette.custom.easing.smooth},
          box-shadow 200ms ${theme.palette.custom.easing.smooth}
        `,
        pointerEvents: dismissingId === front.id ? 'none' : 'auto',
        px: 2,
        py: 1.5,
        '&:hover': {
          bgcolor: alpha(frontColor, 0.22),
          borderColor: alpha(frontColor, 0.45),
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 600,
            fontSize: '0.875rem',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {front.title || 'Untitled'}
        </Typography>
        {remaining > 0 && (
          <Typography
            variant="caption"
            sx={{ fontSize: '0.75rem', color: 'text.secondary', flexShrink: 0 }}
          >
            +{remaining}
          </Typography>
        )}
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            handleDismissClick(front.id);
          }}
          sx={{
            p: 0.25,
            color: 'text.secondary',
            '&:hover': { color: 'text.primary' },
          }}
        >
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      {preview && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            fontSize: '0.8125rem',
            lineHeight: 1.7,
            display: '-webkit-box',
            WebkitLineClamp: 7,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {preview}
        </Typography>
      )}
    </Box>
  );
};

const NoteMetaPanel: React.FC<NoteMetaPanelProps> = ({ note, notes, onSelectNote }) => {
  const theme = useTheme();

  const headings = useMemo(() => (note ? extractHeadings(note.content) : []), [note?.content]);
  const linkedTrades = useMemo(() => (note ? extractLinkedTrades(note.content) : []), [note?.content]);
  const wordCount = useMemo(() => (note ? countWords(note.content) : 0), [note?.content]);
  const readMins = Math.max(1, Math.round(wordCount / 200));

  // Shared-trade preview state. Owned locally so the panel works
  // regardless of whether the note is being edited (editor mounted) or
  // viewed (read-only panel mounted) — both surfaces are siblings.
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTrade, setPreviewTrade] = useState<Trade | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [zoomedImages, setZoomedImages] = useState<ImageZoomProp | null>(null);

  const handleOpenLinkedTrade = useCallback(async (shareId: string) => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewTrade(null);
    try {
      const data = await getSharedTrade(shareId);
      if (data?.trade) setPreviewTrade(data.trade);
    } catch (err) {
      logger.error('Error loading shared trade for linked-trades panel:', err);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const reminderNotes = useMemo(
    () => (notes ?? []).filter(n => n.is_reminder_active === true),
    [notes]
  );

  const handleSelect = useCallback(
    (n: Note) => onSelectNote?.(n),
    [onSelectNote]
  );

  const showStats = !!note;
  const hasReminders = reminderNotes.length > 0;

  return (
    <Box
      sx={{
        borderLeft: `1px solid ${theme.palette.divider}`,
        height: '100%',
        overflowY: 'auto',
        bgcolor: 'background.default',
        ...scrollbarStyles(theme),
      }}
    >
      <Box sx={{ px: 2.75, py: 3, display: 'flex', flexDirection: 'column', gap: 3.25 }}>

         {/* Reminders — persists across note selection */}
        {hasReminders && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <EyebrowRow label="Reminders" />
            <ReminderCardStack notes={reminderNotes} onSelect={handleSelect} />
          </Box>
        )}

        {/* Stats */}
        {showStats && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <EyebrowRow label="Stats" />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <StatTile label="Words" value={wordCount.toLocaleString()} size="sm" />
              <StatTile label="Read" value={`${readMins}m`} size="sm" />
            </Box>
          </Box>
        )}

        {/* Empty placeholder when no note + no reminders */}
        {!showStats && !hasReminders && (
          <Box
            sx={{
              minHeight: 200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="caption" color="text.disabled">
              No note selected
            </Typography>
          </Box>
        )}

        {/* Linked trades — surfaces every TRADE_LINK chip embedded in the
            note so the user can jump back to a referenced trade without
            scrolling the body. Hidden when the note has none. */}
        {note && linkedTrades.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <EyebrowRow label="Linked Trades" />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {linkedTrades.map((t) => {
                const isWin = t.pnl >= 0;
                const color = isWin
                  ? theme.palette.success.main
                  : theme.palette.error.main;
                const Arrow = t.direction === 'short'
                  ? TradeShortArrowIcon
                  : TradeArrowIcon;
                let dateLabel = t.date;
                let timeLabel: string | null = null;
                try {
                  const d = new Date(t.date);
                  if (!isNaN(d.getTime())) {
                    dateLabel = d.toLocaleDateString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric',
                    });
                    const hh = d.getHours();
                    const mm = d.getMinutes();
                    if (hh !== 0 || mm !== 0) {
                      timeLabel = d.toLocaleTimeString('en-US', {
                        hour: '2-digit', minute: '2-digit', hour12: false,
                      });
                    }
                  }
                } catch { /* keep raw */ }
                const sign = t.pnl >= 0 ? '+' : '-';
                const pnlLabel = `${sign}$${Math.abs(t.pnl).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
                return (
                  <Box
                    key={t.tradeId}
                    onClick={() => { void handleOpenLinkedTrade(t.shareId); }}
                    sx={{
                      ...getInsetTileSx(theme),
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      p: 0,
                      px: 1.25,
                      py: 0.85,
                      cursor: 'pointer',
                      transition: `background-color 150ms ${theme.palette.custom.easing.smooth}, border-color 150ms ${theme.palette.custom.easing.smooth}`,
                      '&:hover': {
                        bgcolor: alpha(color, 0.08),
                        borderColor: alpha(color, 0.35),
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: 22,
                        height: 22,
                        borderRadius: `${theme.palette.custom.radius.sm}px`,
                        bgcolor: alpha(color, 0.14),
                        color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Arrow sx={{ fontSize: '0.95rem' }} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          color: 'text.primary',
                          lineHeight: 1.25,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {dateLabel}{timeLabel ? ` · ${timeLabel}` : ''}
                      </Typography>
                      <Typography
                        sx={{
                          ...EYEBROW_SX,
                          color: 'text.tertiary',
                          fontWeight: 500,
                          letterSpacing: '0.04em',
                          lineHeight: 1.3,
                        }}
                      >
                        {t.direction === 'short' ? 'Short' : t.direction === 'long' ? 'Long' : 'Shared trade'}
                      </Typography>
                    </Box>
                    <Typography
                      sx={{
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        color,
                        fontFeatureSettings: TNUM,
                        letterSpacing: '-0.01em',
                        flexShrink: 0,
                      }}
                    >
                      {pnlLabel}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

        {/* Outline */}
        {note && headings.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <EyebrowRow label="Outline" />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              {headings.map((h, i) => (
                <Box
                  key={`${h.id}-${i}`}
                  onClick={() => {
                    const el = document.querySelector(`.note-anchor-${h.id}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: h.level === 3 ? 2 : 1.25,
                    py: 0.5,
                    color: 'text.secondary',
                    fontSize: h.level === 3 ? '0.78rem' : '0.83rem',
                    fontWeight: h.level === 3 ? 500 : 600,
                    cursor: 'pointer',
                    borderRadius: `${theme.palette.custom.radius.sm}px`,
                    transition: `color 150ms ${theme.palette.custom.easing.smooth}, background-color 150ms ${theme.palette.custom.easing.smooth}`,
                    '&:hover': {
                      color: 'text.primary',
                      bgcolor: theme.palette.custom.tintViolet.soft,
                    },
                    '&::before': {
                      content: '""',
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      bgcolor: 'text.disabled',
                      flexShrink: 0,
                    },
                  }}
                >
                  <Typography
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: 'inherit',
                      fontWeight: 'inherit',
                      color: 'inherit',
                    }}
                  >
                    {h.text}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* Details */}
        {note && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <EyebrowRow label="Details" />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <DetailRow
                label="Created"
                value={new Date(note.created_at).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                })}
              />
              <DetailRow
                label="Updated"
                value={new Date(note.updated_at).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                })}
              />
              {note.is_pinned && <DetailRow label="Status" value="Pinned" valueColor="primary.main" />}
              {note.is_archived && <DetailRow label="Status" value="Archived" valueColor="warning.main" />}
              {note.by_assistant && <DetailRow label="Author" value="Orion" valueColor="primary.light" />}
            </Box>
          </Box>
        )}



      </Box>

      {/* Shared-trade preview surfaced when a Linked Trades row is clicked.
          Read-only — this panel never edits trades. */}
      {previewOpen && (
        <TradeGalleryDialog
          open={previewOpen}
          onClose={() => { setPreviewOpen(false); setPreviewTrade(null); }}
          trades={previewTrade ? [previewTrade] : []}
          initialTradeId={previewTrade?.id}
          loading={previewLoading}
          setZoomedImage={(url, allImages, initialIndex) => {
            setZoomedImages({ selectetdImageIndex: initialIndex || 0, allImages: allImages || [url] });
          }}
          title={previewTrade?.name || 'Trade Preview'}
          isReadOnly
          tradeOperations={{
            onZoomImage: (url, allImages, initialIndex) => {
              setZoomedImages({ selectetdImageIndex: initialIndex || 0, allImages: allImages || [url] });
            },
            onUpdateTradeProperty: undefined,
            calendarId: undefined,
            onOpenGalleryMode: undefined,
            economicFilter: undefined,
            isTradeUpdating: undefined,
            isReadOnly: true,
          }}
        />
      )}

      {zoomedImages && (
        <ImageZoomDialog
          open={!!zoomedImages}
          onClose={() => setZoomedImages(null)}
          imageProp={zoomedImages}
        />
      )}
    </Box>
  );
};

const DetailRow: React.FC<{ label: string; value: string; valueColor?: string }> = ({
  label,
  value,
  valueColor,
}) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
    <Typography sx={{ ...EYEBROW_SX, color: 'text.tertiary' }}>
      {label}
    </Typography>
    <Typography
      sx={{
        fontSize: '0.75rem',
        fontWeight: 600,
        color: valueColor ?? 'text.secondary',
        textAlign: 'right',
        fontFeatureSettings: TNUM,
      }}
    >
      {value}
    </Typography>
  </Box>
);

export default NoteMetaPanel;
