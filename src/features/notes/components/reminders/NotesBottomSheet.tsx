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
  Close as CloseIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Edit as EditIcon,
  EventNote as EventNoteIcon,
} from '@mui/icons-material';
import { Note } from 'features/notes/types/note';
import { Z_INDEX } from 'styles/zIndex';
import { scrollbarStyles } from 'styles/scrollbarStyles';
import { EYEBROW_SX, getShadow } from 'styles/designTokens';
import RichTextEditor from 'components/common/RichTextEditor';
import NoteEditorDialog from 'features/notes/components/NoteEditorDialog';
import { getSharedTrade } from 'features/calendar/services/sharingService';
import { Trade } from 'features/calendar/types/dualWrite';
import TradeGalleryDialog from 'features/calendar/components/TradeGalleryDialog';
import ImageZoomDialog, { ImageZoomProp } from 'features/calendar/components/ImageZoomDialog';
import { logger } from 'utils/logger';

interface NotesBottomSheetProps {
  open: boolean;
  onClose: () => void;
  notes: Note[];
  initialIndex?: number;
  calendarId: string;
  fullDayName: string;
  onNoteSaved?: (note: Note, isCreated?: boolean) => void;
  onNoteDeleted?: (noteId: string) => void;
  availableTradeTags?: string[];
  pinnedEvents?: Array<{
    event_id: string;
    event: string;
    currency?: any;
    impact?: any;
  }>;
}

// ── Tone resolver ─────────────────────────────────────────────────────────
// Map the 18-color picker palette down to 4 semantic tones, then resolve to
// theme tokens. Keeps the per-color banner identity (red=Friday, etc.) but
// routes the actual colors through the theme so dark/light mode stay aligned.
type ReminderTone = 'violet' | 'success' | 'error' | 'warning' | 'neutral';

const noteColorToTone = (color?: string): ReminderTone => {
  switch (color) {
    case 'red':
    case 'pink':
      return 'error';
    case 'orange':
    case 'deepOrange':
    case 'amber':
    case 'yellow':
      return 'warning';
    case 'green':
    case 'lightGreen':
    case 'lime':
    case 'teal':
      return 'success';
    case 'grey':
    case 'blueGrey':
    case 'brown':
    case 'blue':
    case 'lightBlue':
    case 'cyan':
    case 'indigo':
      return 'neutral';
    case 'purple':
    case 'deepPurple':
    default:
      return 'violet';
  }
};

const getReminderTone = (theme: Theme, tone: ReminderTone) => {
  const accent =
    tone === 'success'
      ? theme.palette.success.main
      : tone === 'error'
        ? theme.palette.error.main
        : tone === 'warning'
          ? theme.palette.warning.main
          : tone === 'neutral'
            ? theme.palette.text.secondary
            : theme.palette.primary.main;
  return {
    accent,
    bg:
      tone === 'violet'
        ? theme.palette.custom.tintViolet.soft
        : alpha(accent, 0.1),
    border:
      tone === 'violet'
        ? alpha(theme.palette.primary.main, 0.15)
        : alpha(accent, 0.2),
  };
};

const NotesBottomSheet: React.FC<NotesBottomSheetProps> = ({
  open,
  onClose,
  notes,
  initialIndex = 0,
  calendarId,
  fullDayName,
  onNoteSaved,
  onNoteDeleted,
  availableTradeTags = [],
  pinnedEvents,
}) => {
  const theme = useTheme();
  const radius = theme.palette.custom.radius;
  const easing = theme.palette.custom.easing.smooth;

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [editorOpen, setEditorOpen] = useState(false);
  const [noteToEdit, setNoteToEdit] = useState<Note | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Trade preview state
  const [previewTrade, setPreviewTrade] = useState<Trade | null>(null);
  const [tradePreviewOpen, setTradePreviewOpen] = useState(false);
  const [tradePreviewLoading, setTradePreviewLoading] = useState(false);
  const [zoomedImages, setZoomedImages] = useState<ImageZoomProp | null>(null);

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
    setNoteToEdit(notes[currentIndex] || null);
    setEditorOpen(true);
    onClose();
  }, [onClose, notes, currentIndex]);

  const handleEditorClose = useCallback(() => {
    setEditorOpen(false);
    setNoteToEdit(null);
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

  const handleSharedTradeClick = useCallback(
    async (shareId: string, _tradeId: string) => {
      setTradePreviewOpen(true);
      setTradePreviewLoading(true);
      try {
        const data = await getSharedTrade(shareId);
        if (data?.trade) {
          setPreviewTrade(data.trade);
        }
      } catch (err) {
        logger.error('Error loading shared trade:', err);
      } finally {
        setTradePreviewLoading(false);
      }
    },
    []
  );

  // Safe access to current note
  const currentNote = notes[currentIndex];
  const hasMultipleNotes = notes.length > 1;

  const tone = getReminderTone(theme, noteColorToTone(currentNote?.color));

  // Shared icon-button sx for header actions (close, edit, nav)
  const headerBtnSx = {
    width: 30,
    height: 30,
    borderRadius: `${radius.md}px`,
    color: 'text.secondary',
    '&:hover': {
      color: 'text.primary',
      bgcolor: theme.palette.action.hover,
    },
  } as const;

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
          transition: `opacity 240ms ${easing}`,
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
          height: open ? 780 : 0,
          maxHeight: '85vh',
          width: '100%',
          maxWidth: { xs: '100%', sm: '420px' },
          borderTopLeftRadius: `${radius.xl}px`,
          borderTopRightRadius: `${radius.xl}px`,
          bgcolor: 'background.paper',
          boxShadow: getShadow(theme, 'xl'),
          border: `1px solid ${theme.palette.divider}`,
          borderBottom: 'none',
          transition: `height 240ms ${easing}, transform 240ms ${easing}`,
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
          {/* Header — tone-tinted band with eyebrow title + action buttons */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              px: 2,
              py: 1.5,
              borderBottom: `1px solid ${theme.palette.divider}`,
              bgcolor: tone.bg,
            }}
          >
            {/* Left side - Icon and Title */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
              <EventNoteIcon sx={{ fontSize: 18, color: tone.accent, flexShrink: 0 }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  sx={{
                    ...EYEBROW_SX,
                    color: tone.accent,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {fullDayName} Reminder
                </Typography>
                {hasMultipleNotes && (
                  <Typography
                    sx={{
                      mt: 0.25,
                      fontSize: '0.7rem',
                      color: 'text.tertiary',
                      fontFeatureSettings: "'tnum' on, 'lnum' on",
                    }}
                  >
                    {currentIndex + 1} of {notes.length}
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Right side - Actions */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {hasMultipleNotes && (
                <>
                  <IconButton
                    size="small"
                    onClick={handlePrevious}
                    sx={headerBtnSx}
                    title="Previous (←)"
                  >
                    <ChevronLeftIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={handleNext}
                    sx={headerBtnSx}
                    title="Next (→)"
                  >
                    <ChevronRightIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </>
              )}

              <IconButton
                size="small"
                onClick={handleEditNote}
                sx={headerBtnSx}
                title="Edit note"
              >
                <EditIcon sx={{ fontSize: 16 }} />
              </IconButton>

              <IconButton
                size="small"
                onClick={onClose}
                sx={headerBtnSx}
                title="Close (Esc)"
              >
                <CloseIcon sx={{ fontSize: 16 }} />
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
            {currentNote && (
              <>
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
                  {/* Note Title — canonical title type role */}
                  {currentNote.title && currentNote.title.trim() !== '' && (
                    <Typography
                      sx={{
                        fontSize: '1.125rem',
                        fontWeight: 600,
                        letterSpacing: '-0.015em',
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
                      calendarId={calendarId}
                      onSharedTradeClick={handleSharedTradeClick}
                    />
                  </Box>
                </Box>
              </>
            )}
          </Box>
        </Box>
      </Box>

      {/* Note Editor Dialog */}
      {noteToEdit && (
        <NoteEditorDialog
          open={editorOpen}
          onClose={handleEditorClose}
          note={noteToEdit}
          calendarId={calendarId}
          onSave={handleNoteSaved}
          onDelete={handleNoteDeleted}
          availableTradeTags={availableTradeTags}
          calendarNotes={notes.map((n) => ({ id: n.id, title: n.title }))}
          pinnedEvents={pinnedEvents}
        />
      )}

      {/* Trade Preview via TradeGalleryDialog */}
      {tradePreviewOpen && (
        <TradeGalleryDialog
          open={tradePreviewOpen}
          onClose={() => {
            setTradePreviewOpen(false);
            setPreviewTrade(null);
          }}
          trades={previewTrade ? [previewTrade] : []}
          initialTradeId={previewTrade?.id}
          loading={tradePreviewLoading}
          setZoomedImage={(
            url: string,
            allImages?: string[],
            initialIndex?: number
          ) => {
            setZoomedImages({
              selectetdImageIndex: initialIndex || 0,
              allImages: allImages || [url],
            });
          }}
          title={previewTrade?.name || 'Trade Preview'}
          isReadOnly={true}
          tradeOperations={{
            onZoomImage: (
              url: string,
              allImages?: string[],
              initialIndex?: number
            ) => {
              setZoomedImages({
                selectetdImageIndex: initialIndex || 0,
                allImages: allImages || [url],
              });
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

      {/* Image Zoom for Trade Preview */}
      {zoomedImages && (
        <ImageZoomDialog
          open={!!zoomedImages}
          onClose={() => setZoomedImages(null)}
          imageProp={zoomedImages}
        />
      )}
    </>
  );
};

export default NotesBottomSheet;
