/**
 * NoteViewerContent Component
 * Shared inner content for the note viewer — used by both
 * NoteViewerDialog (modal) and NoteViewerPanel (inline slide-in).
 */

import React from 'react';
import {
  Box,
  Typography,
  Chip,
  Stack,
  useTheme,
  alpha,
} from '@mui/material';
import { format } from 'date-fns';
import { Note } from '../../types/note';
import { getTagDisplayLabel } from './NoteEditorDialog';
import RichTextViewer from '../common/RichTextEditor/RichTextViewer';

interface NoteViewerContentProps {
  note: Note;
}

const NoteViewerContent: React.FC<NoteViewerContentProps> = ({ note }) => {
  const theme = useTheme();

  const formattedDate = note.updated_at
    ? format(new Date(note.updated_at), 'MMM d, yyyy')
    : note.created_at
      ? format(new Date(note.created_at), 'MMM d, yyyy')
      : '';

  return (
    <>
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

      <Box
        sx={{
          maxWidth: 800,
          margin: '0 auto',
          px: { xs: 2, md: 5 },
          py: 4,
        }}
      >
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

        {formattedDate && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mb: 3, display: 'block' }}
          >
            {note.updated_at ? 'Updated' : 'Created'} {formattedDate}
          </Typography>
        )}

        <Box sx={{ mt: 3 }}>
          {note.content ? (
            <RichTextViewer content={note.content} />
          ) : (
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ fontStyle: 'italic' }}
            >
              No content
            </Typography>
          )}
        </Box>
      </Box>
    </>
  );
};

export default NoteViewerContent;
