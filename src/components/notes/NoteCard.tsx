/**
 * NoteCard Component
 * Displays a note card with cover image, title, and content preview
 */

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  useTheme,
  alpha,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  PushPin as PinIcon,
  Archive as ArchiveIcon,
  Delete as DeleteIcon,
  PushPinOutlined as PinOutlinedIcon
} from '@mui/icons-material';
import { convertFromRaw } from 'draft-js';
import { Note } from '../../types/note';

interface NoteCardProps {
  note: Note;
  onClick: () => void;
  onPin?: (noteId: string) => void;
  onArchive?: (noteId: string) => void;
  onDelete?: (noteId: string) => void;
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

export const NoteCard: React.FC<NoteCardProps> = ({ note, onClick, onPin, onArchive, onDelete }) => {
  const theme = useTheme();
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);

  // Extract plain text from rich text content
  const plainText = extractPlainText(note.content);

  // Truncate content for preview
  const MAX_CONTENT_LENGTH = 100;
  const contentPreview = plainText.length > MAX_CONTENT_LENGTH
    ? plainText.substring(0, MAX_CONTENT_LENGTH) + '...'
    : plainText;

  const handleMenuClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setMenuAnchorEl(e.currentTarget);
  };

  const handleMenuClose = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setMenuAnchorEl(null);
  };

  const handleMenuItemClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    handleMenuClose();
    action();
  };

  return (
    <Card
      onClick={onClick}
      sx={{
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        borderRadius: 2,
        overflow: 'hidden',
        position: 'relative',
        '&:hover': {
          boxShadow: 4,
          transform: 'translateY(-2px)',
        },
        '&:hover .note-actions': {
          opacity: 1,
        },
      }}
    >
      {/* Cover image or placeholder */}
      <Box
        sx={{
          height: { xs: 120, sm: 140 },
          width: '100%',
          backgroundImage: note.cover_image ? `url(${note.cover_image})` : 'none',
          backgroundColor: note.cover_image ? 'transparent' : alpha(theme.palette.divider, 0.1),
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
        }}
      >
        {/* Pin indicator */}
        {note.is_pinned && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              left: 8,
              bgcolor: alpha(theme.palette.background.paper, 0.9),
              borderRadius: 1,
              p: 0.5,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <PinIcon fontSize="small" sx={{ color: 'primary.main' }} />
          </Box>
        )}

        {/* Actions menu button */}
        <Box
          className="note-actions"
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            opacity: 0,
            transition: 'opacity 0.2s',
          }}
        >
          <IconButton
            size="small"
            onClick={handleMenuClick}
            sx={{
              bgcolor: alpha(theme.palette.background.paper, 0.9),
              '&:hover': {
                bgcolor: theme.palette.background.paper,
              },
            }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
      <CardContent sx={{ p: 2 }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 600,
            fontSize: '1rem',
            mb: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {note.title}
        </Typography>
        {contentPreview && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              lineHeight: 1.5,
            }}
          >
            {contentPreview}
          </Typography>
        )}
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.disabled">
            {new Date(note.updated_at).toLocaleDateString()}
          </Typography>
        </Box>
      </CardContent>

      {/* Actions Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={(e: any) => handleMenuClose(e)}
        onClick={(e) => e.stopPropagation()}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {onPin && (
          <MenuItem onClick={(e) => handleMenuItemClick(e, () => onPin(note.id))}>
            <ListItemIcon>
              {note.is_pinned ? (
                <PinIcon fontSize="small" sx={{ color: 'primary.main' }} />
              ) : (
                <PinOutlinedIcon fontSize="small" />
              )}
            </ListItemIcon>
            <ListItemText>{note.is_pinned ? 'Unpin' : 'Pin'}</ListItemText>
          </MenuItem>
        )}

        {onArchive && (
          <MenuItem onClick={(e) => handleMenuItemClick(e, () => onArchive(note.id))}>
            <ListItemIcon>
              <ArchiveIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{note.is_archived ? 'Unarchive' : 'Archive'}</ListItemText>
          </MenuItem>
        )}

        {onDelete && (
          <MenuItem
            onClick={(e) => handleMenuItemClick(e, () => onDelete(note.id))}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon>
              <DeleteIcon fontSize="small" sx={{ color: 'error.main' }} />
            </ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </Card>
  );
};

export default NoteCard;
