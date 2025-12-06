/**
 * NoteListItem Component
 * Displays a note as a list item optimized for drawer views
 */

import React, { useState } from 'react';
import {
  ListItemButton,
  ListItemText,
  Typography,
  Box,
  useTheme,
  alpha,
  IconButton,
  Chip,
  Stack,
} from '@mui/material';
import {
  PushPin as PinIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
  PushPinOutlined as PinOutlinedIcon,
  NotificationsActive as ReminderIcon,
  SmartToy as AIIcon,
} from '@mui/icons-material';
import { convertFromRaw } from 'draft-js';
import { Note } from '../../types/note';
import { Calendar } from '../../types/calendar';

interface NoteListItemProps {
  note: Note;
  onClick: (note: Note) => void;
  onPin?: (note: Note) => void;
  onArchive?: (note: Note) => void;
  onUnarchive?: (note: Note) => void;
  calendar?: Calendar; // For showing calendar name in multi-calendar view
  showCalendarBadge?: boolean;
}

/**
 * Extract plain text from Draft.js JSON content
 */
const extractPlainText = (content: string): string => {
  if (!content) return '';

  try {
    // Try to parse as Draft.js JSON
    const contentState = convertFromRaw(JSON.parse(content));
    return contentState.getPlainText();
  } catch (error) {
    // Fallback to plain text if not valid JSON
    return content;
  }
};

export const NoteListItem: React.FC<NoteListItemProps> = ({
  note,
  onClick,
  onPin,
  onArchive,
  onUnarchive,
  calendar,
  showCalendarBadge = false,
}) => {
  const theme = useTheme();
  const [isHovered, setIsHovered] = useState(false);

  // Extract plain text from rich text content
  const plainText = extractPlainText(note.content);

  // Truncate content for preview
  const MAX_CONTENT_LENGTH = 80;
  const contentPreview = plainText.length > MAX_CONTENT_LENGTH
    ? plainText.substring(0, MAX_CONTENT_LENGTH) + '...'
    : plainText;

  const handlePinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPin) onPin(note);
  };

  const handleArchiveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (note.is_archived && onUnarchive) {
      onUnarchive(note);
    } else if (!note.is_archived && onArchive) {
      onArchive(note);
    }
  };

  return (
    <ListItemButton
      onClick={() => onClick(note)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        borderRadius: 1,
        mb: 0.5, 
        p: 1.5,
        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        bgcolor: note.is_pinned
          ? alpha(theme.palette.primary.main, 0.03)
          : 'transparent',
        '&:hover': {
          bgcolor: note.is_pinned
            ? alpha(theme.palette.primary.main, 0.08)
            : alpha(theme.palette.action.hover, 0.05),
          boxShadow: 1,
        },
        transition: 'all 0.2s ease',
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0, mr: 1 }}>
        {/* Title row with pin indicator, reminder badge, AI badge, and calendar badge */}
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
          {note.is_pinned && (
            <PinIcon
              fontSize="small"
              sx={{ color: 'primary.main', fontSize: '0.9rem' }}
            />
          )}
          {note.is_reminder_active && note.reminder_type && note.reminder_type !== 'none' && (
            <ReminderIcon
              fontSize="small"
              sx={{ color: 'info.main', fontSize: '0.9rem' }}
              titleAccess={`${note.reminder_type === 'weekly' ? 'Weekly' : 'One-time'} reminder`}
            />
          )}
          {note.by_assistant && (
            <AIIcon
              fontSize="small"
              sx={{ color: 'primary.main', fontSize: '0.9rem' }}
              titleAccess="AI-generated note"
            />
          )}
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              fontSize: '0.9rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {note.title}
          </Typography>
          {showCalendarBadge && calendar && (
            <Chip
              label={calendar.name}
              size="small"
              sx={{
                height: 18,
                fontSize: '0.7rem',
                bgcolor: alpha(theme.palette.secondary.main, 0.1),
                color: 'secondary.main',
                fontWeight: 600,
              }}
            />
          )}
        </Stack>

        {/* Content preview */}
        {contentPreview && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              lineHeight: 1.4,
              fontSize: '0.8rem',
              mb: 0.5,
            }}
          >
            {contentPreview}
          </Typography>
        )}

        {/* Date */}
        <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem' }}>
          {new Date(note.updated_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </Typography>
      </Box>

      {/* Action buttons (always rendered, visibility controlled by opacity to prevent layout shift) */}
      <Stack
        direction="row"
        spacing={0.5}
        sx={{
          opacity: isHovered || note.is_pinned ? 1 : 0,
          transition: 'opacity 0.15s ease',
        }}
      >
        {onPin && (
          <IconButton
            size="small"
            onClick={handlePinClick}
            sx={{
              p: 0.5,
              color: note.is_pinned ? 'primary.main' : 'text.secondary',
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: 'primary.main',
              },
            }}
          >
            {note.is_pinned ? (
              <PinIcon sx={{ fontSize: '1.1rem' }} />
            ) : (
              <PinOutlinedIcon sx={{ fontSize: '1.1rem' }} />
            )}
          </IconButton>
        )}

        {(onArchive || onUnarchive) && (
          <IconButton
            size="small"
            onClick={handleArchiveClick}
            sx={{
              p: 0.5,
              color: 'text.secondary',
              '&:hover': {
                bgcolor: alpha(theme.palette.warning.main, 0.1),
                color: 'warning.main',
              },
            }}
          >
            {note.is_archived ? (
              <UnarchiveIcon sx={{ fontSize: '1.1rem' }} />
            ) : (
              <ArchiveIcon sx={{ fontSize: '1.1rem' }} />
            )}
          </IconButton>
        )}
      </Stack>

      {/* Cover image thumbnail (if exists) */}
      {note.cover_image && (
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: 1,
            backgroundImage: `url(${note.cover_image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            ml: 1.5,
            flexShrink: 0,
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          }}
        />
      )}
    </ListItemButton>
  );
};

export default NoteListItem;
