import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Box,
  IconButton,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import {
  pink, purple, deepPurple, indigo, lightBlue, cyan,
  teal, lightGreen, lime, yellow, amber, deepOrange,
  brown, grey, blueGrey,
} from '@mui/material/colors';
import type { Theme } from '@mui/material';
import { convertFromRaw } from 'draft-js';

import { Note } from '../../types/note';
import { scrollbarStyles } from '../../styles/scrollbarStyles';

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
        borderRadius: 1.5,
        bgcolor: alpha(frontColor, 0.15),
        height: 200,
        border: `1px solid ${alpha(frontColor, 0.3)}`,
        cursor: 'pointer',
        boxShadow: theme.palette.mode === 'dark'
          ? `0 1px 2px ${alpha('#000', 0.4)}, 0 8px 20px ${alpha('#000', 0.45)}, 0 16px 40px ${alpha(frontColor, 0.18)}`
          : `0 1px 2px ${alpha(frontColor, 0.18)}, 0 8px 20px ${alpha(frontColor, 0.22)}, 0 16px 40px ${alpha(frontColor, 0.14)}`,
        opacity: dismissingId === front.id ? 0 : 1,
        transform: dismissingId === front.id ? 'translateY(-12px)' : 'translateY(0)',
        transition: `
          opacity ${DISMISS_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1),
          transform ${DISMISS_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1),
          background-color 200ms cubic-bezier(0.22, 1, 0.36, 1),
          border-color 200ms cubic-bezier(0.22, 1, 0.36, 1),
          box-shadow 200ms cubic-bezier(0.22, 1, 0.36, 1)
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
  const wordCount = useMemo(() => (note ? countWords(note.content) : 0), [note?.content]);
  const readMins = Math.max(1, Math.round(wordCount / 200));

  const reminderNotes = useMemo(
    () => (notes ?? []).filter(n => n.is_reminder_active === true),
    [notes]
  );

  const sectionLabelSx = {
    fontSize: '0.65rem',
    fontWeight: 600,
    letterSpacing: '0.16em',
    textTransform: 'uppercase' as const,
    color: 'text.disabled',
    mb: 1.25,
  };

  const statCardSx = {
    bgcolor: alpha(theme.palette.common.white, theme.palette.mode === 'dark' ? 0.03 : 0.6),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: '10px',
    px: 1.5,
    py: 1.25,
  };

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

        {/* Stats */}
        {showStats && (
          <Box>
            <Typography sx={sectionLabelSx}>Stats</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <Box sx={statCardSx}>
                <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Words
                </Typography>
                <Typography sx={{ fontWeight: 700, fontFeatureSettings: "'tnum' on", fontSize: '1rem', mt: 0.25, letterSpacing: '-0.015em' }}>
                  {wordCount.toLocaleString()}
                </Typography>
              </Box>
              <Box sx={statCardSx}>
                <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Read
                </Typography>
                <Typography sx={{ fontWeight: 700, fontFeatureSettings: "'tnum' on", fontSize: '1rem', mt: 0.25, letterSpacing: '-0.015em' }}>
                  {readMins}m
                </Typography>
              </Box>
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

        {/* Outline */}
        {note && headings.length > 0 && (
          <Box>
            <Typography sx={sectionLabelSx}>Outline</Typography>
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
                    borderRadius: '6px',
                    transition: 'all 150ms',
                    '&:hover': {
                      color: 'text.primary',
                      bgcolor: alpha(theme.palette.common.white, theme.palette.mode === 'dark' ? 0.03 : 0),
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
          <Box>
            <Typography sx={sectionLabelSx}>Details</Typography>
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

        {/* Reminders — persists across note selection */}
        {hasReminders && (
          <Box>
            <Typography sx={sectionLabelSx}>Reminders</Typography>
            <ReminderCardStack notes={reminderNotes} onSelect={handleSelect} />
          </Box>
        )}

      </Box>
    </Box>
  );
};

const DetailRow: React.FC<{ label: string; value: string; valueColor?: string }> = ({
  label,
  value,
  valueColor,
}) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
    <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', fontWeight: 500 }}>
      {label}
    </Typography>
    <Typography
      sx={{
        fontSize: '0.75rem',
        fontWeight: 600,
        color: valueColor ?? 'text.secondary',
        textAlign: 'right',
      }}
    >
      {value}
    </Typography>
  </Box>
);

export default NoteMetaPanel;
