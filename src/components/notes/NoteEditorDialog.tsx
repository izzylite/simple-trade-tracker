/**
 * NoteEditorDialog Component
 * Full-screen dialog for creating/editing notes
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  IconButton,
  Box,
  useTheme,
  alpha,
  Toolbar,
  Typography,
  Alert,
  Button,
  useMediaQuery,
  ToggleButtonGroup,
  ToggleButton,
  Chip,
  Divider,
  Collapse,
} from '@mui/material';
import {
  Close as CloseIcon,
  Image as ImageIcon,
  PushPin as PinIcon,
  PushPinOutlined as PinOutlinedIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
  Delete as DeleteIcon,
  NotificationsActive as ReminderIcon,
  NotificationsOff as NoReminderIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

import RichTextEditor from '../common/RichTextEditor';
import ImagePickerDialog from '../heroImage/ImagePickerDialog';
import ConfirmationDialog from '../common/ConfirmationDialog';
import { useAuth } from '../../contexts/SupabaseAuthContext';
import * as notesService from '../../services/notesService';
import { Note, ReminderType, DayAbbreviation } from '../../types/note';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import { logger } from '../../utils/logger';

interface NoteEditorDialogProps {
  open: boolean;
  onClose: () => void;
  note?: Note; // If provided, edit existing note; otherwise create new
  calendarId: string; // Required for new notes
  onSave?: (note: Note, isCreated?: boolean) => void;
  onDelete?: (noteId: string) => void;
}

const NoteEditorDialog: React.FC<NoteEditorDialogProps> = ({
  open,
  onClose,
  note: initialNote,
  calendarId,
  onSave,
  onDelete,
}) => {
  const theme = useTheme();
  const { user } = useAuth();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));

  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState('');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reminder states
  const [reminderType, setReminderType] = useState<ReminderType>('none');
  const [reminderDate, setReminderDate] = useState<Date | null>(null);
  const [reminderDays, setReminderDays] = useState<DayAbbreviation[]>([]);
  const [isReminderActive, setIsReminderActive] = useState(false);
  const [isReminderExpanded, setIsReminderExpanded] = useState(false);

  const allDays: DayAbbreviation[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Initialize note data when dialog opens
  useEffect(() => {
    if (open) {
      if (initialNote) {
        // Editing existing note - use passed note object
        setNote(initialNote);
        setTitle(initialNote.title);
        setContent(initialNote.content);
        setCoverImage(initialNote.cover_image);

        // Initialize reminder states
        setReminderType(initialNote.reminder_type || 'none');
        setReminderDate(initialNote.reminder_date || null);
        setReminderDays(initialNote.reminder_days || []);
        setIsReminderActive(initialNote.is_reminder_active || false);
        setIsReminderExpanded(initialNote.is_reminder_active || false);
      } else {
        // Creating new note - reset to defaults
        setNote(null);
        setTitle('');
        setContent('');
        setCoverImage(null);

        // Reset reminder states
        setReminderType('none');
        setReminderDate(null);
        setReminderDays([]);
        setIsReminderActive(false);
        setIsReminderExpanded(false);
      }
    }
  }, [open, initialNote]);

  const saveNote = async () => {
    if (!user?.uid) return;

    try {
      setSaving(true);

      if (note) {
        // Update existing note
        await notesService.updateNote(note.id, {
          title,
          content,
          cover_image: coverImage,
          reminder_type: reminderType,
          reminder_date: reminderDate,
          reminder_days: reminderDays,
          is_reminder_active: isReminderActive,
        });

        // Reload to get updated data
        const updatedNote = await notesService.getNote(note.id);
        if (updatedNote) {
          setNote(updatedNote);
          if (onSave) onSave(updatedNote, false);
        }
      } else {
        // Create new note
        const newNote = await notesService.createNote({
          user_id: user.uid,
          calendar_id: calendarId,
          title,
          content,
          cover_image: coverImage,
          reminder_type: reminderType,
          reminder_date: reminderDate,
          reminder_days: reminderDays,
          is_reminder_active: isReminderActive,
        });
        setNote(newNote);
        if (onSave) onSave(newNote, true);
      }
    } catch (error) {
      logger.error('Error saving note:', error);
    } finally {
      setSaving(false);
    }
  };

  // Check if there are changes compared to the initial note
  const hasChanges = () => {
    if (!note) {
      // For new notes, check if there's any content
      const hasNonEmptyTitle = title && title.trim() !== '';
      const hasNonEmptyContent = content && content.trim() !== '';
      const hasCoverImage = coverImage !== null;
      const hasReminder = reminderType !== 'none' && isReminderActive;

      return hasNonEmptyTitle || hasNonEmptyContent || hasCoverImage || hasReminder;
    } else {
      // For existing notes, check if anything changed
      const titleChanged = title !== note.title;
      const contentChanged = content !== note.content;
      const coverImageChanged = coverImage !== note.cover_image;
      const reminderTypeChanged = reminderType !== (note.reminder_type || 'none');
      const reminderDateChanged = reminderDate !== (note.reminder_date || null);
      const reminderDaysChanged = JSON.stringify(reminderDays) !== JSON.stringify(note.reminder_days || []);
      const reminderActiveChanged = isReminderActive !== (note.is_reminder_active || false);

      return titleChanged || contentChanged || coverImageChanged || reminderTypeChanged ||
        reminderDateChanged || reminderDaysChanged || reminderActiveChanged;
    }
  };

  // Auto-save on changes (debounced) - only for existing notes
  useEffect(() => {
    if (!open) return;
    if (!note) return; // Don't auto-save new notes
    if (!hasChanges()) return; // Don't save if nothing changed

    const timeout = setTimeout(() => {
      saveNote();
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeout);
  }, [title, content, coverImage, open, note]);

  const handleClose = async () => {
    // If it's a new note and has content, save it before closing
    // Or if it's an existing note with changes, save before closing
    if (hasChanges()) {
      await saveNote();
    }
    onClose();
  };

  const handleImageSelect = (imageUrl: string) => {
    setCoverImage(imageUrl);
    setImagePickerOpen(false);
  };

  const handleRemoveCover = () => {
    setCoverImage(null);
  };

  const handlePinNote = async () => {
    if (!note) return;

    try {
      if (note.is_pinned) {
        await notesService.unpinNote(note.id);
      } else {
        await notesService.pinNote(note.id);
      }
      setNote(prev => prev ? { ...prev, is_pinned: !prev.is_pinned } : null);
      if (onSave) {
        onSave({ ...note, is_pinned: !note.is_pinned });
      }
    } catch (error) {
      logger.error('Error toggling pin:', error);
    }
  };

  const handleArchiveNote = async () => {
    if (!note) return;

    try {
      if (note.is_archived) {
        await notesService.unarchiveNote(note.id);
        if (onSave) {
          onSave({ ...note, is_archived: !note.is_archived, archived_at: note.is_archived ? null : new Date() });
        }
        setNote(prev => prev ? { ...prev, is_archived: false } : null);
      } else {
        await notesService.archiveNote(note.id);
        setNote(prev => prev ? { ...prev, is_archived: true, archived_at: new Date() } : null);
        // Close dialog after archiving
        handleClose();
      }
    } catch (error) {
      logger.error('Error toggling archive:', error);
    }
  };

  const handleDeleteNote = () => {
    if (!note) return;
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!note) return;

    try {
      setDeleting(true);
      await notesService.deleteNote(note.id);
      if (onDelete) onDelete(note.id);
      setDeleteConfirmOpen(false);
      onClose(); // Close the editor dialog
    } catch (error) {
      logger.error('Error deleting note:', error);
      setDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmOpen(false);
  };

  // Reminder handlers
  const handleReminderTypeChange = (event: React.MouseEvent<HTMLElement>, newType: ReminderType | null) => {
    if (newType !== null) {
      setReminderType(newType);
      setIsReminderActive(newType !== 'none');

      // Clear fields based on type
      if (newType === 'none') {
        setReminderDate(null);
        setReminderDays([]);
      } else if (newType === 'once') {
        setReminderDays([]);
      } else if (newType === 'weekly') {
        setReminderDate(null);
      }
    }
  };

  const handleToggleDay = (day: DayAbbreviation) => {
    setReminderDays(prev => {
      if (prev.includes(day)) {
        return prev.filter(d => d !== day);
      } else {
        return [...prev, day];
      }
    });
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        fullScreen={fullScreen}
        maxWidth="md"
        sx={{
        zIndex: (theme) => theme.zIndex.modal + 100, // Ensure it's above the AIChatDrawer
      }}
        PaperProps={{
          sx: {
            height: fullScreen ? '100%' : '90vh',
            m: fullScreen ? 0 : 2,
          },
        }}
      >
        {/* Toolbar with title and close */}
        <Toolbar
          sx={{
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            gap: 1,
          }}
        >
          <Typography variant="h6" sx={{ flex: 1 }}>
            {note ? 'Edit Note' : 'New Note'}
          </Typography>

          <IconButton size="small" onClick={handleClose}>
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
          {coverImage && (
            <Box
              sx={{
                position: 'relative',
                width: '100%',
                height: 260,
                backgroundImage: `url(${coverImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                '&:hover .cover-actions': {
                  opacity: 1,
                },
              }}
            >
              <Box
                className="cover-actions"
                sx={{
                  position: 'absolute',
                  bottom: 16,
                  left: 16,
                  display: 'flex',
                  gap: 1,
                  opacity: 0,
                  transition: 'opacity 0.2s',
                }}
              >
                <IconButton
                  onClick={() => setImagePickerOpen(true)}
                  sx={{
                    bgcolor: alpha(theme.palette.background.paper, 0.9),
                    '&:hover': {
                      bgcolor: theme.palette.background.paper,
                    },
                  }}
                >
                  <ImageIcon />
                </IconButton>
                <IconButton
                  onClick={handleRemoveCover}
                  sx={{
                    bgcolor: alpha(theme.palette.background.paper, 0.9),
                    '&:hover': {
                      bgcolor: theme.palette.background.paper,
                    },
                  }}
                >
                  <CloseIcon />
                </IconButton>
              </Box>
            </Box>
          )}
            {/* Reminder Sub-Header */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 3,
                py: 1,
                bgcolor: alpha(theme.palette.info.main, 0.04),
                borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              }}
            >
              {/* Left side - Reminder toggle */}
              <Box
                onClick={() => setIsReminderExpanded(!isReminderExpanded)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  cursor: 'pointer',
                  py: 0.5,
                  '&:hover': {
                    opacity: 0.8,
                  },
                }}
              >
                {isReminderActive ? (
                  <ReminderIcon sx={{ color: 'info.main', fontSize: '1.1rem' }} />
                ) : (
                  <NoReminderIcon sx={{ color: 'text.secondary', fontSize: '1.1rem' }} />
                )}
                <Typography
                  variant="subtitle2"
                  fontWeight={600}
                  sx={{ color: isReminderActive ? 'info.main' : 'text.secondary' }}
                >
                  Reminder
                </Typography>
                {isReminderActive && reminderType !== 'none' && (
                  <Typography variant="caption" color="text.secondary">
                    {reminderType === 'weekly'
                      ? `${reminderDays.length} day${reminderDays.length !== 1 ? 's' : ''}`
                      : 'One-time'
                    }
                  </Typography>
                )}
                <IconButton size="small" sx={{ color: 'text.secondary', ml: -0.5 }}>
                  {isReminderExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                </IconButton>
              </Box>

              {/* Right side - Action buttons */}
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <IconButton
                  size="small"
                  onClick={() => setImagePickerOpen(true)}
                  title={coverImage ? 'Change cover' : 'Add cover image'}
                >
                  <ImageIcon fontSize="small" />
                </IconButton>

                {note && (
                  <>
                    <IconButton
                      size="small"
                      onClick={handlePinNote}
                      title={note.is_pinned ? 'Unpin note' : 'Pin note'}
                      sx={{
                        color: note.is_pinned ? 'primary.main' : 'inherit',
                      }}
                    >
                      {note.is_pinned ? <PinIcon fontSize="small" /> : <PinOutlinedIcon fontSize="small" />}
                    </IconButton>

                    <IconButton
                      size="small"
                      onClick={handleArchiveNote}
                      title={note.is_archived ? 'Unarchive note' : 'Archive note'}
                    >
                      {note.is_archived ? <UnarchiveIcon fontSize="small" /> : <ArchiveIcon fontSize="small" />}
                    </IconButton>

                    <IconButton
                      size="small"
                      onClick={handleDeleteNote}
                      title="Delete note"
                      sx={{ color: 'error.main' }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </>
                )}
              </Box>
            </Box>

            {/* Collapsible Reminder Content */}
            <Collapse in={isReminderExpanded}>
              <Box sx={{ px: 3, py: 2, bgcolor: alpha(theme.palette.info.main, 0.02) }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Set a reminder to display this note on specific days. Perfect for game plans, daily routines, or weekly trading strategies.
                </Typography>

                {/* Reminder Type Selector */}
              <ToggleButtonGroup
                value={reminderType}
                exclusive
                onChange={handleReminderTypeChange}
                size="small"
                sx={{ mb: 2 }}
              >
                <ToggleButton value="none">
                  <NoReminderIcon sx={{ mr: 1, fontSize: '1.2rem' }} />
                  None
                </ToggleButton>
                <ToggleButton value="once">
                  Once
                </ToggleButton>
                <ToggleButton value="weekly">
                  Weekly
                </ToggleButton>
              </ToggleButtonGroup>

              {/* One-time Reminder Date Picker */}
              {reminderType === 'once' && (
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Reminder Date"
                    value={reminderDate}
                    onChange={(newDate) => setReminderDate(newDate)}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        size: 'small',
                      },
                      popper: {
                        sx: { zIndex: 2100 },
                      },
                    }}
                  />
                </LocalizationProvider>
              )}

              {/* Weekly Reminder Day Selector */}
              {reminderType === 'weekly' && (
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Select days to show this reminder:
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {allDays.map((day) => (
                      <Chip
                        key={day}
                        label={day}
                        onClick={() => handleToggleDay(day)}
                        color={reminderDays.includes(day) ? 'primary' : 'default'}
                        variant={reminderDays.includes(day) ? 'filled' : 'outlined'}
                        sx={{
                          fontWeight: reminderDays.includes(day) ? 600 : 400,
                          cursor: 'pointer',
                        }}
                      />
                    ))}
                  </Box>
                  {reminderDays.length === 0 && (
                    <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                      Please select at least one day
                    </Typography>
                  )}
                </Box>
              )}
              </Box>
            </Collapse>

          {/* Content Area */}
          <Box
            sx={{
              maxWidth: 900,
              margin: '0 auto',
              px: { xs: 2, md: 6 },
              py: 4,
            }}
          >
            {/* Archived banner */}
            {note && note.is_archived && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                This note is archived.
                <Button
                  onClick={handleArchiveNote}
                  size="small"
                  variant="outlined"
                  sx={{ ml: 2 }}
                >
                  Unarchive
                </Button>
              </Alert>
            )}

          

            {/* Title */}
            <TextField
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled"
              fullWidth
              variant="standard"
              InputProps={{
                disableUnderline: true,
                sx: {
                  fontSize: '2.5rem',
                  fontWeight: 700,
                  '& input': {
                    padding: 0,
                  },
                },
              }}
              sx={{ mb: 3, mt: 3 }}
            />

            {/* Content */}
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="Document your emotions, game plan, lessons learned, or trading insights..."
              minHeight={300}
              maxLength={5000}
              hideCharacterCount={true}
            />
          </Box>
        </DialogContent>
      </Dialog>

      {/* Image Picker Dialog */}
      <ImagePickerDialog
        open={imagePickerOpen}
        onClose={() => setImagePickerOpen(false)}
        onImageSelect={handleImageSelect}
        title="Choose a cover image"
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteConfirmOpen}
        title="Delete Note"
        message="Are you sure you want to permanently delete this note? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmColor="error"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isSubmitting={deleting}
      />
    </>
  );
};

export default NoteEditorDialog;
