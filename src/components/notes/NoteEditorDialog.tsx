/**
 * NoteEditorDialog Component
 * Full-screen dialog for creating/editing notes
 */

import React, { useState, useEffect, useRef } from 'react';
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
  Autocomplete,
  Menu,
  MenuItem,
  Popover,
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
  Image as ImageIcon,
  PushPin as PinIcon,
  PushPinOutlined as PinOutlinedIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
  Delete as DeleteIcon,
  NotificationsActive as ReminderIcon,
  NotificationsNone as NoReminderIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  LocalOffer as TagIcon,
  Label as LabelIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

import RichTextEditor, { RichTextEditorHandle } from '../common/RichTextEditor';
import { Z_INDEX } from '../../styles/zIndex';
import EditorToolbar from '../common/RichTextEditor/components/EditorToolbar';
import ImagePickerDialog from '../heroImage/ImagePickerDialog';
import ConfirmationDialog from '../common/ConfirmationDialog';
import { useAuth } from '../../contexts/SupabaseAuthContext';
import * as notesService from '../../services/notesService';
import { Note, ReminderType, DayAbbreviation } from '../../types/note';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import { logger } from '../../utils/logger';

// Default tags with display labels and internal values (for AI compatibility)
export interface TagInfo {
  label: string;
  subtitle: string;
}

export const DEFAULT_NOTE_TAGS_MAP: Record<string, TagInfo> = {
  'STRATEGY': { label: 'Strategy', subtitle: 'Long-term trading approach and rules' },
  'GAME_PLAN': { label: 'Game Plan', subtitle: 'Specific plan for the upcoming session' },
  'INSIGHT': { label: 'Insight', subtitle: 'Market observations and patterns' },
  'LESSON_LEARNED': { label: 'Lesson Learned', subtitle: 'Review of mistakes and successes' },
  'GENERAL': { label: 'General', subtitle: 'General notes and thoughts' },
  'RISK_MANAGEMENT': { label: 'Risk Management', subtitle: 'Position sizing and stop-loss rules' },
  'PSYCHOLOGY': { label: 'Psychology', subtitle: 'Mental state and emotional control' },
  'GUIDELINE': { label: 'Guideline', subtitle: 'Instructions for the AI Assistant (Max 1)' },
};

// Helper to get display label for a tag (returns original if not a default tag)
export const getTagDisplayLabel = (tag: string): string => {
  return DEFAULT_NOTE_TAGS_MAP[tag]?.label || tag;
};

export const getTagSubtitle = (tag: string): string => {
  return DEFAULT_NOTE_TAGS_MAP[tag]?.subtitle || '';
};

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

  // Ref for external toolbar control
  const editorRef = useRef<RichTextEditorHandle>(null);
  const [isToolbarMenuOpen, setIsToolbarMenuOpen] = useState(false);
  const [editorMounted, setEditorMounted] = useState(false);

  // Force re-render when editor mounts to access the ref
  useEffect(() => {
    if (open) {
      // Small delay to ensure editor is mounted
      const timer = setTimeout(() => setEditorMounted(true), 50);
      return () => clearTimeout(timer);
    } else {
      setEditorMounted(false);
    }
  }, [open]);

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
  // Color state
  const [noteColor, setNoteColor] = useState(initialNote?.color);
  const [colorMenuAnchor, setColorMenuAnchor] = useState<null | HTMLElement>(null);

  // Tags states
  const [tags, setTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [isTagsExpanded, setIsTagsExpanded] = useState(false);
  const [hasExistingGuideline, setHasExistingGuideline] = useState(false);

  // Default tags list
  const allDays: DayAbbreviation[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const defaultTags = Object.keys(DEFAULT_NOTE_TAGS_MAP);

  // Check for existing guideline note on open
  useEffect(() => {
    const checkGuideline = async () => {
      if (open && user?.id) {
        try {
          const guidelineNotes = await notesService.getNotesByTag(user.id, 'GUIDELINE');
          const existingGuideline = guidelineNotes.find(n => n.id !== initialNote?.id);
          setHasExistingGuideline(!!existingGuideline);
        } catch (error) {
          console.error('Error checking for existing guideline:', error);
        }
      }
    };
    checkGuideline();
  }, [open, user?.id, initialNote?.id]);


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
        setIsReminderExpanded(false);
        setNoteColor(initialNote.color);

        // Initialize tags states
        setTags(initialNote.tags || []);
        setIsTagsExpanded(false);
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
        setNoteColor(undefined);

        // Reset tags states
        setTags([]);
        setIsTagsExpanded(false);
        setNewTagInput('');
      }
    }
  }, [open, initialNote]);

  const saveNote = async () => {
    if (!user?.uid) return;

    try {
      setSaving(true);

      if (note) {
        // Update existing note - only save tags if not an AI note
        const updates: any = {
          title,
          content,
          cover_image: coverImage,
          reminder_type: reminderType,
          reminder_date: reminderDate,
          reminder_days: reminderDays,
          is_reminder_active: isReminderActive,
          color: noteColor ?? null,
        };

        // Only update tags for user-created notes
        if (!note.by_assistant) {
          updates.tags = tags;
        }

        await notesService.updateNote(note.id, updates);

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
          color: (noteColor ?? null) as any,
          tags,
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
      const hasTags = tags.length > 0;
      const hasColor = noteColor !== undefined;

      return hasNonEmptyTitle || hasNonEmptyContent || hasCoverImage || hasReminder || hasTags || hasColor;
    } else {
      // For existing notes, check if anything changed
      const titleChanged = title !== note.title;
      const contentChanged = content !== note.content;
      const coverImageChanged = coverImage !== note.cover_image;
      const reminderTypeChanged = reminderType !== (note.reminder_type || 'none');
      const reminderDateChanged = reminderDate !== (note.reminder_date || null);
      const reminderDaysChanged = JSON.stringify(reminderDays) !== JSON.stringify(note.reminder_days || []);
      const reminderActiveChanged = isReminderActive !== (note.is_reminder_active || false);
      const tagsChanged = JSON.stringify(tags) !== JSON.stringify(note.tags || []);
      const colorChanged = noteColor !== note.color;

      return titleChanged || contentChanged || coverImageChanged || reminderTypeChanged ||
        reminderDateChanged || reminderDaysChanged || reminderActiveChanged || tagsChanged || colorChanged;
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
  }, [title, content, coverImage, tags, open, note]);

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

  // Tag handlers
  const handleAddTag = (tagValue: string) => {
    if (tagValue && !tags.includes(tagValue)) {
      setTags(prev => [...prev, tagValue]);
      setNewTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  // Check if tag editing is allowed (not for AI notes)
  const isTagEditingAllowed = !note?.by_assistant;

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

        {/* Editor Toolbar - sticky in header area */}
        {editorMounted && editorRef.current && (
          <EditorToolbar
            editorState={editorRef.current.editorState}
            disabled={false}
            variant="sticky"
            stickyPosition="top"
            toolbarRef={editorRef.current.toolbarRef}
            onToggleInlineStyle={(style) => editorRef.current?.toggleInlineStyle(style)}
            onToggleBlockType={(blockType) => editorRef.current?.toggleBlockType(blockType)}
            onApplyTextColor={(color) => editorRef.current?.applyTextColor(color)}
            onApplyBackgroundColor={(color) => editorRef.current?.applyBackgroundColor(color)}
            onApplyHeading={(heading) => editorRef.current?.applyHeading(heading)}
            onClearFormatting={() => editorRef.current?.clearFormatting()}
            onLinkClick={() => editorRef.current?.handleLinkClick()}
            onImageClick={() => editorRef.current?.handleImageClick()}
            onMenuOpenChange={(isOpen) => {
              setIsToolbarMenuOpen(isOpen);
              editorRef.current?.setIsMenuOpen(isOpen);
            }}
          />
        )}

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

              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                {/* Reminder Type Selector */}
                <ToggleButtonGroup
                  value={reminderType}
                  exclusive
                  onChange={handleReminderTypeChange}
                  size="small"
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

                {/* Color Template Selector */}
                {/* Color Template Selector */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', ml: { xs: 0, sm: 2 } }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                    Color:
                  </Typography>
                  {(() => {
                    const allPresets = [
                      { value: undefined, label: 'Default', color: theme.palette.background.paper },
                      { value: 'red', label: 'Red', color: theme.palette.error.main },
                      { value: 'pink', label: 'Pink', color: pink[500] },
                      { value: 'purple', label: 'Purple', color: purple[500] },
                      { value: 'deepPurple', label: 'Deep Purple', color: deepPurple[500] },
                      { value: 'indigo', label: 'Indigo', color: indigo[500] },
                      { value: 'blue', label: 'Blue', color: theme.palette.info.main },
                      { value: 'lightBlue', label: 'Light Blue', color: lightBlue[500] },
                      { value: 'cyan', label: 'Cyan', color: cyan[500] },
                      { value: 'teal', label: 'Teal', color: teal[500] },
                      { value: 'green', label: 'Green', color: theme.palette.success.main },
                      { value: 'lightGreen', label: 'Light Green', color: lightGreen[500] },
                      { value: 'lime', label: 'Lime', color: lime[500] },
                      { value: 'yellow', label: 'Yellow', color: yellow[600] },
                      { value: 'amber', label: 'Amber', color: amber[500] },
                      { value: 'orange', label: 'Orange', color: theme.palette.warning.main },
                      { value: 'deepOrange', label: 'Deep Orange', color: deepOrange[500] },
                      { value: 'brown', label: 'Brown', color: brown[500] },
                      { value: 'grey', label: 'Grey', color: grey[500] },
                      { value: 'blueGrey', label: 'Blue Grey', color: blueGrey[500] },
                    ];

                    const visiblePresets = allPresets.slice(0, 5);
                    const hiddenPresets = allPresets.slice(5);

                    // State for the menu (needs to be defined at component level, but for this refactor we'll use a local ref hack or just move state up. 
                    // Actually, I can't define state inside this expression. I must move the logic out or assume state exists.
                    // I will inject the state definition in a separate replace call effectively, but wait, I can't easily do that.
                    // I should have added the state in the previous step. 
                    // I will assume I can add the state in a separate edit to the top of the file.
                    // BUT, to avoid breaking, I will use a Popover that is self-contained? No, that's messy.
                    // I will render the list here assuming `colorMenuAnchor` exists, and I will add `colorMenuAnchor` in the next tool call (or previous if I could).
                    // Actually, I'll allow the build to break for one second or I'll add the state FIRST efficiently.
                    // For now, let's render the list and the menu trigger.

                    return (
                      <>
                        {visiblePresets.map((preset) => (
                          <Box
                            key={preset.label}
                            onClick={() => setNoteColor(preset.value)}
                            sx={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              bgcolor: preset.value ? alpha(preset.color, 0.2) : alpha(theme.palette.divider, 0.1),
                              border: `2px solid ${noteColor === preset.value ? theme.palette.primary.main : alpha(theme.palette.divider, 0.2)}`,
                              cursor: 'pointer',
                              transition: 'transform 0.2s',
                              '&:hover': {
                                transform: 'scale(1.1)',
                                border: `2px solid ${theme.palette.primary.main}`,
                              },
                            }}
                            title={preset.label}
                          />
                        ))}

                        {/* More Colors Button */}
                        <Box
                          onClick={(e) => setColorMenuAnchor(e.currentTarget)}
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            border: `1px dashed ${theme.palette.text.secondary}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            '&:hover': {
                              borderColor: theme.palette.primary.main,
                              color: theme.palette.primary.main,
                              bgcolor: alpha(theme.palette.primary.main, 0.05),
                            },
                          }}
                          title="More colors"
                        >
                          <AddIcon sx={{ fontSize: 16 }} />
                        </Box>

                        {/* Hidden Colors Menu */}
                        <Popover
                          open={Boolean(colorMenuAnchor)}
                          anchorEl={colorMenuAnchor}
                          onClose={() => setColorMenuAnchor(null)}
                          anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'left',
                          }}
                          transformOrigin={{
                            vertical: 'top',
                            horizontal: 'left',
                          }}
                          PaperProps={{
                            sx: { p: 2, maxWidth: 320 }
                          }}
                          sx={{ zIndex: Z_INDEX.DIALOG_POPUP }}
                        >
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5, px: 0.5 }}>
                            More Colors
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {hiddenPresets.map((preset) => (
                              <Box
                                key={preset.label}
                                onClick={() => {
                                  setNoteColor(preset.value);
                                  setColorMenuAnchor(null);
                                }}
                                sx={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: '50%',
                                  bgcolor: preset.value ? alpha(preset.color, 0.2) : alpha(theme.palette.divider, 0.1),
                                  border: `2px solid ${noteColor === preset.value ? theme.palette.primary.main : alpha(theme.palette.divider, 0.2)}`,
                                  cursor: 'pointer',
                                  transition: 'transform 0.2s',
                                  '&:hover': {
                                    transform: 'scale(1.1)',
                                    border: `2px solid ${theme.palette.primary.main}`,
                                  },
                                }}
                                title={preset.label}
                              />
                            ))}
                          </Box>
                        </Popover>
                      </>
                    );
                  })()}
                </Box>
              </Box>

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
                        sx: { zIndex: Z_INDEX.RICH_TEXT_DIALOG },
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

          {/* Tags Sub-Header */}
          <Box
            onClick={() => setIsTagsExpanded(!isTagsExpanded)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 3,
              py: 1,
              bgcolor: alpha(theme.palette.secondary.main, 0.04),
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              cursor: 'pointer',
              '&:hover': {
                opacity: 0.8,
              },
            }}
          >
            {/* Left side - Tags label */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <TagIcon sx={{ color: tags.length > 0 ? 'secondary.main' : 'text.secondary', fontSize: '1.1rem' }} />
              <Typography
                variant="subtitle2"
                fontWeight={600}
                sx={{ color: tags.length > 0 ? 'secondary.main' : 'text.secondary' }}
              >
                Tags
              </Typography>
              {/* AI note indicator */}
              {note?.by_assistant && (
                <Typography variant="caption" color="text.disabled">
                  (read-only)
                </Typography>
              )}
            </Box>

            {/* Right side - Tag count and expand icon */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {tags.length > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {tags.length} tag{tags.length !== 1 ? 's' : ''}
                </Typography>
              )}
              <IconButton size="small" sx={{ color: 'text.secondary' }}>
                {isTagsExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              </IconButton>
            </Box>
          </Box>

          {/* Collapsible Tags Content */}
          <Collapse in={isTagsExpanded}>
            <Box sx={{ px: 3, py: 2, bgcolor: alpha(theme.palette.secondary.main, 0.02) }}>
              {/* Existing tags */}
              {tags.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                  {tags.map((tag) => (
                    <Chip
                      key={tag}
                      label={getTagDisplayLabel(tag)}
                      size="small"
                      onDelete={isTagEditingAllowed ? () => handleRemoveTag(tag) : undefined}
                      sx={{
                        bgcolor: alpha(theme.palette.secondary.main, 0.1),
                        color: 'secondary.main',
                        fontWeight: 500,
                      }}
                    />
                  ))}
                </Box>
              )}

              {/* Add new tag input - only for user-created notes */}
              {isTagEditingAllowed ? (
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Autocomplete
                    size="small"
                    options={defaultTags.filter(t => {
                      if (tags.includes(t)) return false;
                      if (t === 'GUIDELINE' && hasExistingGuideline) return false;
                      return true;
                    })}
                    getOptionLabel={(option) => getTagDisplayLabel(option)}
                    value={null}
                    inputValue={newTagInput}
                    onInputChange={(_, value, reason) => {
                      if (reason !== 'reset') {
                        setNewTagInput(value);
                      }
                    }}
                    onChange={(_, value) => {
                      if (value && typeof value === 'string') {
                        handleAddTag(value);
                      }
                      setNewTagInput('');
                    }}
                    renderOption={(props, option) => (
                      <li {...props} style={{ display: 'block' }}>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {getTagDisplayLabel(option)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {getTagSubtitle(option)}
                          </Typography>
                        </Box>
                      </li>
                    )}
                    sx={{ flex: 1 }}
                    ListboxProps={{
                      sx: {
                        ...scrollbarStyles(theme),
                        maxHeight: 250, // Increase max height slightly for better visibility with subtitles
                      }
                    }}
                    slotProps={{
                      popper: {
                        sx: { zIndex: (theme) => theme.zIndex.modal + 200 },
                      },
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder="Add a tag..."
                        InputProps={{
                          ...params.InputProps,
                          sx: { borderRadius: 2 },
                        }}
                      />
                    )}
                  />

                </Box>
              ) : (
                tags.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No tags on this note.
                  </Typography>
                )
              )}

              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Select a tag from the list
              </Typography>
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
              multiline
              variant="standard"
              InputProps={{
                disableUnderline: true,
                sx: {
                  fontSize: '2.5rem',
                  fontWeight: 700,
                  lineHeight: 1.2,
                  '& textarea': {
                    padding: 0,
                  },
                },
              }}
              sx={{ mb: 3, mt: 3 }}
            />

            {/* Content */}
            <RichTextEditor
              ref={editorRef}
              value={content}
              onChange={setContent}
              placeholder="Document your emotions, game plan, lessons learned, or trading insights..."
              minHeight={300}
              maxLength={5000}
              hideCharacterCount={true}
              toolbarVariant="none"
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
        sx={{ zIndex: Z_INDEX.LOADING_PROGRESS }}
      />
    </>
  );
};

export default NoteEditorDialog;
