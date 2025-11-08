/**
 * NotesPage - List view of all notes
 * Displays notes in a grid with "Recently visited" section
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Toolbar,
  Typography,
  Fab,
  Tooltip,
  Dialog,
  DialogTitle,
  Stack,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  useTheme,
} from '@mui/material';
import { Add as AddIcon, SmartToy as SmartToyIcon } from '@mui/icons-material';

import NoteCard from '../components/notes/NoteCard';
import Shimmer from '../components/Shimmer';
import { scrollbarStyles } from '../styles/scrollbarStyles';
import RoundedTabs, { TabPanel } from '../components/common/RoundedTabs';
import { useAuth } from '../contexts/SupabaseAuthContext';
import * as notesService from '../services/notesService';
import { Note } from '../types/note';
import { logger } from '../utils/logger';
import AIChatDrawer from '../components/aiChat/AIChatDrawer';
import { Trade } from '../types/trade';
import { Calendar } from '../types/calendar';
import { TradeRepository } from '../services/repository/repositories/TradeRepository';
import { CalendarRepository } from '../services/repository/repositories/CalendarRepository';

interface NotesPageProps {
  onToggleTheme: () => void;
  mode: 'light' | 'dark';
  onMenuClick: () => void;
}

const NotesPage: React.FC<NotesPageProps> = ({ onToggleTheme, mode, onMenuClick }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const theme = useTheme();

  const [notes, setNotes] = useState<Note[]>([]);

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

  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (user?.uid) {
      loadNotes();
    }
  }, [user?.uid]);

  const loadNotes = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      const userNotes = await notesService.getUserNotes(user.uid);
      setNotes(userNotes);
    } catch (error) {
      logger.error('Error loading notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewNote = () => {
    navigate('/notes/new');
  };

  const handleNoteClick = (noteId: string) => {
    navigate(`/notes/${noteId}`);
  };

  const handlePinNote = async (noteId: string) => {
    try {
      const note = notes.find(n => n.id === noteId);
      if (!note) return;

      if (note.is_pinned) {
        await notesService.unpinNote(noteId);
      } else {
        await notesService.pinNote(noteId);
      }

      // Reload notes to reflect changes
      await loadNotes();
    } catch (error) {
      logger.error('Error toggling pin:', error);
    }
  };

  const handleArchiveNote = async (noteId: string) => {
    try {
      await notesService.archiveNote(noteId);
      // Reload notes to update the lists
      await loadNotes();
    } catch (error) {
      logger.error('Error archiving note:', error);
    }
  };

  const handleUnarchiveNote = async (noteId: string) => {
    try {
      await notesService.unarchiveNote(noteId);
      // Reload notes to update the lists
      await loadNotes();
    } catch (error) {
      logger.error('Error unarchiving note:', error);
    }
  };

  const handleDeleteNote = (noteId: string) => {
    setNoteToDelete(noteId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!noteToDelete) return;

    try {
      await notesService.deleteNote(noteToDelete);
      // Remove note from list immediately
      setNotes(prevNotes => prevNotes.filter(n => n.id !== noteToDelete));
      setDeleteDialogOpen(false);
      setNoteToDelete(null);
    } catch (error) {
      logger.error('Error deleting note:', error);
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setNoteToDelete(null);
  };

  // Separate archived from active notes
  const activeNotes = notes.filter(n => !n.is_archived);
  const archivedNotes = notes.filter(n => n.is_archived);
  const archivedNotesSorted = [...archivedNotes].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  // For active notes: separate pinned from regular
  const pinnedNotes = activeNotes.filter(n => n.is_pinned);
  const unpinnedNotes = activeNotes.filter(n => !n.is_pinned);

  // Get recently visited notes (last 5 from unpinned, sorted by updated_at)
  const sortedUnpinned = [...unpinnedNotes].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  const recentNotes = sortedUnpinned.slice(0, 5);
  const otherUnpinnedNotes = sortedUnpinned.slice(5);

  const tabs = [
    { label: 'Notes', value: 'notes' },
    { label: 'Archived', value: 'archived' }
  ];

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>


    <Box sx={{ pt: 4, pb: 4, pl: 0, pr: 4, ...(scrollbarStyles(theme) as any) }}>
          {/* Title/Subtitle and Tabs - Horizontal Layout */}
            <Box sx={{ pt: 4, pb: 4, pl: 0, pr: 4 }}>
            {/* Title and Subtitle */}
            <Box sx={{ mb: 4, ml: 8, mr: 8 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                    My Notes
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    Capture your thoughts, ideas, and trade insights in one place
                  </Typography>
                </Box>
                <RoundedTabs
                  tabs={tabs}
                  size="large"
                  activeTab={activeTab}
                  onTabChange={handleTabChange}
                />
              </Stack>
            </Box>
            </Box>



            {/* Notes Tab */}
            <TabPanel value={activeTab} index={0}>
              {/* Pinned notes section */}
              {pinnedNotes.length > 0 && (
                <Box sx={{ mb: 4, ml: 8, mr: 8 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      color: 'text.secondary',
                      mb: 2,
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    Pinned
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: 'repeat(2, 1fr)',
                        sm: 'repeat(3, 1fr)',
                        md: 'repeat(4, 1fr)',
                        lg: 'repeat(5, 1fr)',
                      },
                      gap: 2,
                    }}
                  >
                    {pinnedNotes.map((note) => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        onClick={() => handleNoteClick(note.id)}
                        onPin={handlePinNote}
                        onArchive={handleArchiveNote}
                        onDelete={handleDeleteNote}
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {/* Recently visited section */}
              {recentNotes.length > 0 && (
                <Box sx={{ mb: 4, ml: 8, mr: 8 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      color: 'text.secondary',
                      mb: 2,
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <Box
                      component="span"
                      sx={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        border: '2px solid currentColor',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                      }}
                    >
                      ⌚
                    </Box>
                    Recently visited
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: 'repeat(2, 1fr)',
                        sm: 'repeat(3, 1fr)',
                        md: 'repeat(4, 1fr)',
                        lg: 'repeat(5, 1fr)',
                      },
                      gap: 2,
                    }}
                  >
                    {recentNotes.map((note) => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        onClick={() => handleNoteClick(note.id)}
                        onPin={handlePinNote}
                        onArchive={handleArchiveNote}
                        onDelete={handleDeleteNote}
                      />
                    ))}
                    {/* New note card */}
                    <Box
                      onClick={handleNewNote}
                      sx={{
                        height: 310,
                        border: '2px dashed',
                        borderColor: 'divider',
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': {
                          borderColor: 'primary.main',
                          bgcolor: 'action.hover',
                        },
                      }}
                    >
                      <Box sx={{ textAlign: 'center' }}>
                        <AddIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
                        <Typography variant="body2" color="text.secondary">
                          New page
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </Box>
              )}

              {/* All notes (excluding recent) */}
              {otherUnpinnedNotes.length > 0 && (
                <Box sx={{ mb: 4, ml: 8, mr: 8 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      color: 'text.secondary',
                      mb: 2,
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    All notes
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: 'repeat(2, 1fr)',
                        sm: 'repeat(3, 1fr)',
                        md: 'repeat(4, 1fr)',
                        lg: 'repeat(5, 1fr)',
                      },
                      gap: 2,
                    }}
                  >
                    {otherUnpinnedNotes.map((note) => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        onClick={() => handleNoteClick(note.id)}
                        onPin={handlePinNote}
                        onArchive={handleArchiveNote}
                        onDelete={handleDeleteNote}
                      />
                    ))}
                  </Box>
                </Box>
              )}


              {/* Empty state */}
              {notes.length === 0 && !loading && (
                <Box
                  sx={{
                    textAlign: 'center',
                    py: 8,
                  }}
                >
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No notes yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Click the + button to create your first note
                  </Typography>
                </Box>
              )}

              {loading && (
                <Box sx={{ ml: 8, mr: 8 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      color: 'text.secondary',
                      mb: 2,
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <Box
                      component="span"
                      sx={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        border: '2px solid currentColor',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                      }}
                    >
                      ⌚
                    </Box>
                    Recently visited
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: 'repeat(2, 1fr)',
                        sm: 'repeat(3, 1fr)',
                        md: 'repeat(4, 1fr)',
                        lg: 'repeat(5, 1fr)',
                      },
                      gap: 2,
                    }}
                  >
                    {[...Array(5)].map((_, index) => (
                      <Box
                        key={index}
                        sx={{
                          borderRadius: 2,
                          overflow: 'hidden',
                          bgcolor: 'background.paper',
                          boxShadow: 1,
                        }}
                      >
                        <Shimmer height={140} borderRadius={0} variant="wave" intensity="high" />
                        <Box sx={{ p: 2 }}>
                          <Box sx={{ mb: 1 }}>
                            <Shimmer height={24} width="80%" variant="pulse" intensity="medium" />
                          </Box>
                          <Box sx={{ mb: 0.5 }}>
                            <Shimmer height={16} width="100%" variant="pulse" intensity="medium" />
                          </Box>
                          <Box sx={{ mb: 1 }}>
                            <Shimmer height={16} width="60%" variant="pulse" intensity="medium" />
                          </Box>
                          <Shimmer height={14} width="40%" variant="pulse" intensity="low" />
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </TabPanel>

            {/* Archived Tab */}
            <TabPanel value={activeTab} index={1}>
              {loading ? (
                <Box sx={{ ml: 8, mr: 8 }}>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: 'repeat(2, 1fr)',
                        sm: 'repeat(3, 1fr)',
                        md: 'repeat(4, 1fr)',
                        lg: 'repeat(5, 1fr)',
                      },
                      gap: 2,
                    }}
                  >
                    {[...Array(5)].map((_, index) => (
                      <Box
                        key={index}
                        sx={{
                          borderRadius: 2,
                          overflow: 'hidden',
                          bgcolor: 'background.paper',
                          boxShadow: 1,
                        }}
                      >
                        <Shimmer height={140} borderRadius={0} variant="wave" intensity="high" />
                        <Box sx={{ p: 2 }}>
                          <Box sx={{ mb: 1 }}>
                            <Shimmer height={24} width="80%" variant="pulse" intensity="medium" />
                          </Box>
                          <Box sx={{ mb: 0.5 }}>
                            <Shimmer height={16} width="100%" variant="pulse" intensity="low" />
                          </Box>
                          <Box sx={{ mb: 1 }}>
                            <Shimmer height={16} width="60%" variant="pulse" intensity="low" />
                          </Box>
                          <Shimmer height={14} width="40%" variant="pulse" intensity="low" />
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
              ) : archivedNotes.length === 0 ? (
                <Box
                  sx={{
                    textAlign: 'center',
                    py: 8,
                    ml: 8,
                    mr: 8,
                  }}
                >
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No archived notes
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Notes you archive will appear here
                  </Typography>
                </Box>
              ) : (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'repeat(2, 1fr)',
                      sm: 'repeat(3, 1fr)',
                      md: 'repeat(4, 1fr)',
                      lg: 'repeat(5, 1fr)',
                    },
                    gap: 2,
                    ml: 8,
                    mr: 8,
                  }}
                >
                  {archivedNotesSorted.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      onClick={() => handleNoteClick(note.id)}
                      onPin={handlePinNote}
                      onArchive={handleUnarchiveNote}
                      onDelete={handleDeleteNote}
                    />
                  ))}
                </Box>
              )}
            </TabPanel>
        </Box>


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
              bottom: 96,
              right: 24,
              zIndex: 1200
            }}
          >
            <SmartToyIcon />
          </Fab>
        </Tooltip>
      )}

      {/* Floating Action Button */}
      <Tooltip title="New Note" placement="left">
        <Fab
          color="primary"
          onClick={handleNewNote}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
          }}
        >
          <AddIcon />
        </Fab>
      </Tooltip>

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
    </Box>
  );
};

export default NotesPage;
