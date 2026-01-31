/**
 * NotesBottomSheet Component
 * Bottom sheet modal for viewing and navigating reminder notes
 * Slides up from bottom-left, follows AIChatDrawer pattern
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  IconButton,
  alpha,
  useTheme,
  Theme,
} from '@mui/material';
import {
  pink,
  purple,
  deepPurple,
  indigo,
  lightBlue,
  cyan,
  teal,
  lightGreen,
  lime,
  yellow,
  amber,
  deepOrange,
  brown,
  grey,
  blueGrey,
} from '@mui/material/colors';
import {
  Close as CloseIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Edit as EditIcon,
  EventNote as EventNoteIcon,
} from '@mui/icons-material';
import { Note } from '../../types/note';
import { Z_INDEX } from '../../styles/zIndex';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import RichTextEditor from '../common/RichTextEditor';
import NoteEditorDialog from '../notes/NoteEditorDialog';

interface NotesBottomSheetProps {
  open: boolean;
  onClose: () => void;
  notes: Note[];
  initialIndex?: number;
  calendarId: string;
  fullDayName: string;
  onNoteSaved?: (note: Note, isCreated?: boolean) => void;
  onNoteDeleted?: (noteId: string) => void;
}

// Color mapping
const getColorMap = (theme: Theme): Record<string, string> => ({
  'red': theme.palette.error.main,
  'pink': pink[500],
  'purple': purple[500],
  'deepPurple': deepPurple[500],
  'indigo': indigo[500],
  'blue': theme.palette.info.main,
  'lightBlue': lightBlue[500],
  'cyan': cyan[500],
  'teal': teal[500],
  'green': theme.palette.success.main,
  'lightGreen': lightGreen[500],
  'lime': lime[500],
  'yellow': yellow[600],
  'amber': amber[500],
  'orange': theme.palette.warning.main,
  'deepOrange': deepOrange[500],
  'brown': brown[500],
  'grey': grey[500],
  'blueGrey': blueGrey[500],
});

const NotesBottomSheet: React.FC<NotesBottomSheetProps> = ({
  open,
  onClose,
  notes,
  initialIndex = 0,
  calendarId,
  fullDayName,
  onNoteSaved,
  onNoteDeleted,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const colorMap = getColorMap(theme);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [editorOpen, setEditorOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Reset index when notes change or sheet opens
  useEffect(() => {
    if (open) {
      setCurrentIndex(Math.min(initialIndex, Math.max(0, notes.length - 1)));
    }
  }, [open, initialIndex, notes.length]);

  // Scroll to top when switching notes
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [currentIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } 
      // else if (e.key === 'ArrowLeft') {
      //   handlePrevious();
      // } else if (e.key === 'ArrowRight') {
      //   handleNext();
      // }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, notes.length]);

  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : notes.length - 1));
  }, [notes.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < notes.length - 1 ? prev + 1 : 0));
  }, [notes.length]);

  const handleEditNote = useCallback(() => {
    setEditorOpen(true);
  }, []);

  const handleEditorClose = useCallback(() => {
    setEditorOpen(false);
  }, []);

  const handleNoteSaved = useCallback((savedNote: Note, isCreated?: boolean) => {
    onNoteSaved?.(savedNote, isCreated);
  }, [onNoteSaved]);

  const handleNoteDeleted = useCallback(() => {
    onNoteDeleted?.(currentNote?.id || '');
    // Close bottom sheet if no more notes
    if (notes.length <= 1) {
      onClose();
    }
  }, [onNoteDeleted, notes.length, onClose]);

  // Safe access to current note
  const currentNote = notes[currentIndex];
  const hasMultipleNotes = notes.length > 1;

  if (!currentNote) {
    return null;
  }

  const baseColor = currentNote.color
    ? colorMap[currentNote.color] || theme.palette.info.main
    : theme.palette.info.main;

  return (
    <>
      {/* Backdrop */}
      <Box
        onClick={onClose}
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: alpha(theme.palette.common.black, 0.5),
          backdropFilter: 'blur(4px)',
          zIndex: Z_INDEX.AI_DRAWER_BACKDROP,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          cursor: 'pointer',
        }}
      />

      {/* Bottom Sheet */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: { xs: 0, sm: 20 },
          right: { xs: 0, sm: 'auto' },
          zIndex: Z_INDEX.AI_DRAWER,
          height: open ? 500 : 0,
          maxHeight: '70vh',
          width: '100%',
          maxWidth: { xs: '100%', sm: '420px' },
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          background: isDark
            ? 'linear-gradient(135deg, rgba(18, 18, 18, 0.98) 0%, rgba(30, 30, 30, 0.98) 100%)'
            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.98) 100%)',
          backdropFilter: 'blur(20px)',
          boxShadow: isDark
            ? '0 -8px 32px rgba(0, 0, 0, 0.6)'
            : '0 -8px 32px rgba(0, 0, 0, 0.15)',
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          borderBottom: 'none',
          transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          overflow: 'hidden',
          pointerEvents: open ? 'auto' : 'none',
        }}
      >
        <Box
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 2,
              pb: 1.5,
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              background: alpha(baseColor, isDark ? 0.1 : 0.15),
              borderLeft: `4px solid ${baseColor}`,
            }}
          >
            {/* Left side - Icon and Title */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <EventNoteIcon sx={{ fontSize: '1.25rem', color: baseColor }} />
              <Box>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontSize: '0.875rem',
                    color: baseColor,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {fullDayName} Reminder
                </Typography>
                {hasMultipleNotes && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      fontSize: '0.75rem',
                    }}
                  >
                    {currentIndex + 1} of {notes.length}
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Right side - Actions */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {/* Navigation buttons */}
              {hasMultipleNotes && (
                <>
                  <IconButton
                    size="small"
                    onClick={handlePrevious}
                    sx={{ color: baseColor }}
                    title="Previous (←)"
                  >
                    <ChevronLeftIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={handleNext}
                    sx={{ color: baseColor }}
                    title="Next (→)"
                  >
                    <ChevronRightIcon />
                  </IconButton>
                </>
              )}

              {/* Edit button */}
              <IconButton
                size="small"
                onClick={handleEditNote}
                sx={{ color: 'text.secondary' }}
                title="Edit note"
              >
                <EditIcon fontSize="small" />
              </IconButton>

              {/* Close button */}
              <IconButton
                size="small"
                onClick={onClose}
                sx={{ color: 'text.secondary' }}
                title="Close (Esc)"
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          {/* Content */}
          <Box
            ref={contentRef}
            sx={{
              flex: 1,
              overflow: 'auto',
              ...scrollbarStyles(theme),
            }}
          >
            {/* Cover Image */}
            {currentNote.cover_image && (
              <Box
                sx={{
                  width: '100%',
                  height: 160,
                  backgroundImage: `url(${currentNote.cover_image})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }}
              />
            )}

            {/* Text Content */}
            <Box sx={{ p: 2 }}>
              {/* Note Title */}
              {currentNote.title && currentNote.title.trim() !== '' && (
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 600,
                    color: 'text.primary',
                    mb: 2,
                  }}
                >
                  {currentNote.title}
                </Typography>
              )}

              {/* Note Content */}
              <Box
                sx={{
                  '& .DraftEditor-root': {
                    fontSize: '0.95rem',
                    lineHeight: 1.6,
                  },
                }}
              >
                <RichTextEditor
                  value={currentNote.content}
                  disabled
                  hideCharacterCount
                  minHeight={200}
                />
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Note Editor Dialog */}
      <NoteEditorDialog
        open={editorOpen}
        onClose={handleEditorClose}
        note={currentNote}
        calendarId={calendarId}
        onSave={handleNoteSaved}
        onDelete={handleNoteDeleted}
      />
    </>
  );
};

export default NotesBottomSheet;
