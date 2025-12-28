/**
 * NoteViewerDialog Component
 * Read-only dialog for viewing notes in shared calendars
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  IconButton,
  Box,
  useTheme,
  alpha,
  Toolbar,
  Typography,
  useMediaQuery,
  Chip,
  Stack,
} from '@mui/material';
import {
  Close as CloseIcon,
  PushPin as PinIcon,
  SmartToy as AIIcon,
} from '@mui/icons-material';

import { Note } from '../../types/note';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import { getTagDisplayLabel } from './NoteEditorDialog';
import RichTextViewer from '../common/RichTextEditor/RichTextViewer';
import { format } from 'date-fns';

interface NoteViewerDialogProps {
  open: boolean;
  onClose: () => void;
  note: Note | null;
}

const NoteViewerDialog: React.FC<NoteViewerDialogProps> = ({
  open,
  onClose,
  note,
}) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));

  if (!note) return null;

  const formattedDate = note.updated_at
    ? format(new Date(note.updated_at), 'MMM d, yyyy')
    : note.created_at
      ? format(new Date(note.created_at), 'MMM d, yyyy')
      : '';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          height: fullScreen ? '100%' : '85vh',
          m: fullScreen ? 0 : 2,
          borderRadius: fullScreen ? 0 : 3,
        },
      }}
    >
      {/* Toolbar with title and close */}
      <Toolbar
        sx={{
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          gap: 1,
          minHeight: 56,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1 }}>
          <Typography variant="h6" noWrap>
            View Note
          </Typography>
          {note.is_pinned && (
            <PinIcon sx={{ fontSize: '1rem', color: 'primary.main' }} />
          )}
          {note.by_assistant && (
            <Chip
              icon={<AIIcon sx={{ fontSize: '0.9rem !important' }} />}
              label="AI"
              size="small"
              sx={{
                height: 20,
                '& .MuiChip-label': { px: 0.75, fontSize: '0.7rem' },
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: 'primary.main',
              }}
            />
          )}
        </Stack>

        <IconButton size="small" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Toolbar>

      <DialogContent
        sx={{
          p: 0,
          overflowY: 'auto',
          bgcolor: 'background.default',
          ...(scrollbarStyles(theme) as any),
        }}
      >
        {/* Cover Image */}
        {note.cover_image && (
          <Box
            sx={{
              width: '100%',
              height: 220,
              backgroundImage: `url(${note.cover_image})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        )}

        {/* Content Area */}
        <Box
          sx={{
            maxWidth: 800,
            margin: '0 auto',
            px: { xs: 2, md: 5 },
            py: 4,
          }}
        >
          {/* Tags */}
          {note.tags && note.tags.length > 0 && (
            <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mb: 2 }}>
              {note.tags.map((tag) => (
                <Chip
                  key={tag}
                  label={getTagDisplayLabel(tag)}
                  size="small"
                  sx={{
                    bgcolor: alpha(theme.palette.secondary.main, 0.1),
                    color: 'secondary.main',
                    fontWeight: 500,
                    fontSize: '0.75rem',
                    height: 24,
                  }}
                />
              ))}
            </Stack>
          )}

          {/* Title */}
          <Typography
            variant="h3"
            sx={{
              fontWeight: 700,
              lineHeight: 1.2,
              mb: 2,
              wordBreak: 'break-word',
            }}
          >
            {note.title || 'Untitled'}
          </Typography>

          {/* Date */}
          {formattedDate && (
            <Typography variant="caption" color="text.secondary" sx={{ mb: 3, display: 'block' }}>
              {note.updated_at ? 'Updated' : 'Created'} {formattedDate}
            </Typography>
          )}

          {/* Content */}
          <Box sx={{ mt: 3 }}>
            {note.content ? (
              <RichTextViewer content={note.content} />
            ) : (
              <Typography variant="body1" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                No content
              </Typography>
            )}
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default NoteViewerDialog;
