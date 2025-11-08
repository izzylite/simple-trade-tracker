/**
 * NoteEditor Page
 * Notion-style note editor with cover image, title, and content
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  TextField,
  IconButton,
  Tooltip,
  Toolbar,
  useTheme,
  alpha,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Alert,
  Fab,
} from '@mui/material';
import {
  Image as ImageIcon,
  Close as CloseIcon,
  Home as HomeIcon,
  Note as NoteIcon,
  PushPin as PinIcon,
  PushPinOutlined as PinOutlinedIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
  Delete as DeleteIcon,
  SmartToy as SmartToyIcon,
} from '@mui/icons-material';

import Breadcrumbs, { BreadcrumbItem, BreadcrumbButton } from '../components/common/Breadcrumbs';
import ImagePickerDialog from '../components/heroImage/ImagePickerDialog';
import RichTextEditor from '../components/common/RichTextEditor';
import Shimmer from '../components/Shimmer';
import { useAuth } from '../contexts/SupabaseAuthContext';
import * as notesService from '../services/notesService';
import { Note } from '../types/note';
import { scrollbarStyles } from '../styles/scrollbarStyles';
import { logger } from '../utils/logger';
import AIChatDrawer from '../components/aiChat/AIChatDrawer';
import { Trade } from '../types/trade';
import { Calendar } from '../types/calendar';
import { TradeRepository } from '../services/repository/repositories/TradeRepository';
import { CalendarRepository } from '../services/repository/repositories/CalendarRepository';

interface NoteEditorPageProps {
  onToggleTheme: () => void;
  mode: 'light' | 'dark';
}

const NoteEditorPage: React.FC<NoteEditorPageProps> = ({ onToggleTheme, mode }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { noteId } = useParams<{ noteId: string }>();
  const { user } = useAuth();

  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('Untitled');
  const [content, setContent] = useState('');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // AI Chat state and context
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [aiTrades, setAiTrades] = useState<Trade[]>([]);
  const [primaryCalendar, setPrimaryCalendar] = useState<Calendar | null>(null);

  // Load AI context (trades + primary calendar) when chat opens
  useEffect(() => {
    const loadAIContext = async () => {
      if (!isAIChatOpen || !user?.uid) return;
      try {
        const tradeRepo = new TradeRepository();
        const calendarRepo = new CalendarRepository();
        const [trades, calendars] = await Promise.all([
          tradeRepo.findByUserId(user.uid),
          calendarRepo.findByUserId(user.uid),
        ]);
        setAiTrades(trades);
        setPrimaryCalendar(calendars[0] || null);
      } catch (error) {
        logger.error('Error loading AI context:', error);
        setAiTrades([]);
        setPrimaryCalendar(null);
      }
    };

    loadAIContext();
  }, [isAIChatOpen, user?.uid]);


  // Load note if editing
  useEffect(() => {
    if (noteId && noteId !== 'new') {
      loadNote();
    }
  }, [noteId]);

  const loadNote = async () => {
    if (!noteId || noteId === 'new') return;

    try {
      setLoading(true);
      const loadedNote = await notesService.getNote(noteId);
      if (loadedNote) {
        setNote(loadedNote);
        setTitle(loadedNote.title);
        setContent(loadedNote.content);
        setCoverImage(loadedNote.cover_image);
      } else {
        navigate('/notes');
      }
    } catch (error) {
      logger.error('Error loading note:', error);
      navigate('/notes');
    } finally {
      setLoading(false);
    }
  };

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
        });
      } else {
        // Create new note
        const newNote = await notesService.createNote({
          user_id: user.uid,
          title,
          content,
          cover_image: coverImage,
        });
        setNote(newNote)
      }
    } catch (error) {
      logger.error('Error saving note:', error);
    } finally {
      setSaving(false);
    }
  };

  // Auto-save on changes (debounced)
  useEffect(() => {
    if (!note && !title && !content) return; // Don't save empty new notes
    

    const timeout = setTimeout(() => {
      saveNote();
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeout);
  }, [title, content, coverImage]);

  const handleBack = () => {
    navigate('/notes');
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
 
    } catch (error) {
      logger.error('Error toggling pin:', error);
    }
  };

  const handleArchiveNote = async () => {
    if (!note) return;
    try {
      await notesService.archiveNote(note.id);
      // Navigate back to notes list
      navigate('/notes');
    } catch (error) {
      logger.error('Error archiving note:', error);
    }
  };

  const handleUnarchiveNote = async () => {
    if (!note) return;
    try {
      await notesService.unarchiveNote(note.id);
      setNote(prev => prev ? { ...prev, is_archived: false } : null);
    } catch (error) {
      logger.error('Error unarchiving note:', error);
    }
  };

  const handleDeleteNote = () => {
    if (!note) return;
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!note) return;

    try {
      await notesService.deleteNote(note.id);
      setDeleteDialogOpen(false);
      // Navigate back to notes list
      navigate('/notes');
    } catch (error) {
      logger.error('Error deleting note:', error);
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
  };

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Home', path: '/', icon: <HomeIcon sx={{ fontSize: 18 }} /> },
    { label: 'Notes', path: '/notes', icon: <NoteIcon sx={{ fontSize: 18 }} /> },
    { label: title || 'Untitled', path: `/notes/${noteId}` }
  ];

	  const breadcrumbButtons: BreadcrumbButton[] = [
	    {
	      key: 'cover',
	      icon: <ImageIcon fontSize="small" />,
	      onClick: () => setImagePickerOpen(true),
	      tooltip: coverImage ? 'Change cover' : 'Add cover image',
	    },
	    ...(note
	      ? [
	          {
	            key: 'pin',
	            icon: note.is_pinned ? <PinIcon fontSize="small" /> : <PinOutlinedIcon fontSize="small" />,
	            onClick: handlePinNote,
	            tooltip: note.is_pinned ? 'Unpin note' : 'Pin note',
	          },
	          {
	            key: 'archive',
	            icon: note.is_archived ? <UnarchiveIcon fontSize="small" /> : <ArchiveIcon fontSize="small" />,
	            onClick: note.is_archived ? handleUnarchiveNote : handleArchiveNote,
	            tooltip: note.is_archived ? 'Unarchive note' : 'Archive note',
	          },
	          {
	            key: 'delete',
	            icon: <DeleteIcon fontSize="small" />,
	            onClick: handleDeleteNote,
	            tooltip: 'Delete note',
	          },
	        ]
	      : []),
	  ];


  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>


      {/* Breadcrumbs */}
      <Breadcrumbs items={breadcrumbItems} buttons={breadcrumbButtons} />

      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          bgcolor: 'background.default',
          ...(scrollbarStyles(theme) as any),
        }}
      >
        {loading ? (
          <>
            

            {/* Content Area Shimmer */}
            <Box
              sx={{
                maxWidth: 900,
                margin: '0 auto',
                px: { xs: 2, md: 6 },
                py: 4,
              }}
            >
              {/* Title Shimmer */}
              <Box sx={{ mb: 3 }}>
                <Shimmer height={60} width="60%" variant="pulse" intensity="medium" />
              </Box>

              {/* Content Shimmers */}
              <Box sx={{ mb: 2 }}>
                <Shimmer height={20} width="100%" variant="pulse" intensity="low" />
              </Box>
              <Box sx={{ mb: 2 }}>
                <Shimmer height={20} width="95%" variant="pulse" intensity="low" />
              </Box>
              <Box sx={{ mb: 2 }}>
                <Shimmer height={20} width="90%" variant="pulse" intensity="low" />
              </Box>
              <Box sx={{ mb: 2 }}>
                <Shimmer height={20} width="85%" variant="pulse" intensity="low" />
              </Box>
              <Box sx={{ mb: 2 }}>
                <Shimmer height={20} width="92%" variant="pulse" intensity="low" />
              </Box>
              <Shimmer height={20} width="88%" variant="pulse" intensity="low" />
            </Box>
          </>
        ) : (
          <>
            {/* Cover Image (only render when an image exists) */}
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
                  <Tooltip title={"Change cover"}>
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
                  </Tooltip>
                  <Tooltip title="Remove cover">
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
                  </Tooltip>
                </Box>
              </Box>
            )}

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
                  <Button onClick={handleUnarchiveNote} size="small" variant="outlined" sx={{ ml: 2 }}>
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
                sx={{ mb: 2 }}
              />


              {/* Content */}
              <RichTextEditor
                value={content}
                onChange={setContent}
                placeholder="Document your emotions, game plan, lessons learned, or trading insights..."
                minHeight={300}
                hideCharacterCount={true}
              />
            </Box>
          </>
        )}
      </Box>

      {/* Image Picker Dialog */}
      <ImagePickerDialog
        open={imagePickerOpen}
        onClose={() => setImagePickerOpen(false)}
        onImageSelect={handleImageSelect}
        title="Choose a cover image"
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCancelDelete}
      >
        <DialogTitle>Delete Note?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to permanently delete this note? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* AI Chat Drawer */}
      {primaryCalendar && (
        <AIChatDrawer
          open={isAIChatOpen}
          onClose={() => setIsAIChatOpen(false)}
          trades={aiTrades}
          calendar={primaryCalendar}
          isReadOnly={false}
        />
      )}

      {/* AI Chat FAB */}
      {user && (
        <Tooltip title="AI Trading Assistant" placement="left">
          <Fab
            color="secondary"
            aria-label="open ai chat"
            onClick={() => setIsAIChatOpen(true)}
            sx={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              zIndex: 1200
            }}
          >
            <SmartToyIcon />
          </Fab>
        </Tooltip>
      )}

    </Box>
  );
};

export default NoteEditorPage;
