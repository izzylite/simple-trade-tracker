/**
 * StickyReminderCards Component
 * Renders stacked reminder note preview cards at the top of a panel.
 * Only the front card is fully visible.
 * Dismissing the front card reveals the next one underneath.
 * Clicking opens the NotesBottomSheet for that note.
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
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
import { Note } from '../../types/note';
import { Calendar } from '../../types/calendar';
import NotesBottomSheet from './NotesBottomSheet';

export interface StickyReminderCardsProps {
  notes: Note[];
  dismissedIds: Set<string>;
  onDismiss: (noteId: string) => void;
  calendar: Calendar;
  fullDayName: string;
  onNoteSaved?: (note: Note) => void;
  onNoteDeleted?: (noteId: string) => void;
}

const getColorMap = (
  theme: Theme
): Record<string, string> => ({
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

/** Extract plain text from Draft.js JSON or HTML */
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

const StickyReminderCards: React.FC<StickyReminderCardsProps> = ({
  notes,
  dismissedIds,
  onDismiss,
  calendar,
  fullDayName,
  onNoteSaved,
  onNoteDeleted,
}) => {
  const theme = useTheme();
  const colorMap = getColorMap(theme);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const [initialNoteIndex, setInitialNoteIndex] = useState(0);

  const activeNotes = notes.filter(
    (n) => !dismissedIds.has(n.id)
  );

  const handleCardClick = useCallback(
    (note: Note) => {
      const idx = notes.findIndex((n) => n.id === note.id);
      setInitialNoteIndex(idx >= 0 ? idx : 0);
      setBottomSheetOpen(true);
    },
    [notes]
  );

  if (activeNotes.length === 0) return null;

  const frontNote = activeNotes[0];
  const frontColor = frontNote.color
    ? colorMap[frontNote.color] || theme.palette.grey[700]
    : theme.palette.grey[700];
  const preview = extractPreview(frontNote.content);
  const remaining = activeNotes.length - 1;

  return (
    <>
      <Box
        sx={{
          px: 1.5,
          pt: 1,
          pb: 0.5,
          flexShrink: 0,
        }}
      >
        {/* Front card */}
        <Box
          onClick={() => handleCardClick(frontNote)}
          sx={{
            borderRadius: 1.5,
            bgcolor: alpha(frontColor, 0.15),
            height: 200,
            border: `1px solid ${alpha(frontColor, 0.3)}`,
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            px: 2,
            py: 1.5,
            '&:hover': {
              bgcolor: alpha(frontColor, 0.22),
              borderColor: alpha(frontColor, 0.45),
            },
          }}
        >
          {/* Title row + count + dismiss */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              mb: 0.5,
            }}
          >
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
              {frontNote.title || 'Untitled'}
            </Typography>
            {remaining > 0 && (
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.75rem',
                  color: 'text.secondary',
                  flexShrink: 0,
                }}
              >
                +{remaining}
              </Typography>
            )}
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(frontNote.id);
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

          {/* Truncated content preview */}
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
      </Box>

      <NotesBottomSheet
        open={bottomSheetOpen}
        onClose={() => setBottomSheetOpen(false)}
        notes={notes}
        initialIndex={initialNoteIndex}
        calendarId={calendar.id}
        fullDayName={fullDayName}
        onNoteSaved={onNoteSaved}
        onNoteDeleted={onNoteDeleted}
        availableTradeTags={calendar.tags}
        pinnedEvents={calendar.pinned_events}
      />
    </>
  );
};

export default StickyReminderCards;
