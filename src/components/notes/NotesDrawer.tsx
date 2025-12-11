/**
 * NotesDrawer Component
 * Drawer for viewing and managing notes for a calendar or across all calendars
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Button,
  useTheme,
  alpha,
  Stack,
  IconButton,
  Skeleton,
  CircularProgress,
  MenuItem,
  Select,
  FormControl,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Notes as NotesIcon,
  Clear as ClearIcon,
  SmartToy as AIIcon,
  Person as PersonIcon,
} from '@mui/icons-material';

import UnifiedDrawer from '../common/UnifiedDrawer';
import RoundedTabs from '../common/RoundedTabs';
import NoteListItem from './NoteListItem';
import NoteEditorDialog from './NoteEditorDialog';
import { Note } from '../../types/note';
import { Calendar } from '../../types/calendar';
import * as notesService from '../../services/notesService';
import { logger } from '../../utils/logger';
import { useAuth } from '../../contexts/SupabaseAuthContext';
import { CalendarRepository } from '../../services/repository/repositories/CalendarRepository';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import { useNotes } from '../../hooks/useNotes';

interface NotesDrawerProps {
  open: boolean;
  onClose: () => void;
  calendarId?: string; // If provided, filter to calendar; otherwise show all
  showCalendarPicker?: boolean; // Show calendar selection for new notes (HomePage)
  onNoteClick?: (note: Note) => void;
}

type TabValue = 'all' | 'pinned' | 'archived';

/**
 * Shimmer loading component for note list items
 */
const NoteListItemShimmer: React.FC = () => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        borderRadius: 2,
        mb: 0.5,
        py: 1.5,
        px: 2,
        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Title */}
          <Skeleton variant="text" width="60%" height={20} sx={{ mb: 0.5 }} />

          {/* Content preview */}
          <Skeleton variant="text" width="100%" height={16} sx={{ mb: 0.3 }} />
          <Skeleton variant="text" width="80%" height={16} sx={{ mb: 0.5 }} />

          {/* Date */}
          <Skeleton variant="text" width="30%" height={14} />
        </Box>

        <Skeleton
          variant="rectangular"
          width={60}
          height={60}
          sx={{ borderRadius: 1.5, flexShrink: 0 }}
        />
      </Stack>
    </Box>
  );
};

const NotesDrawer: React.FC<NotesDrawerProps> = ({
  open,
  onClose,
  calendarId,
  showCalendarPicker = false,
  onNoteClick
}) => {
  const theme = useTheme();
  const { user } = useAuth();

  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | undefined>();
  const [selectedCalendarForNew, setSelectedCalendarForNew] = useState<string | undefined>(calendarId);
  const [selectedCalendarFilter, setSelectedCalendarFilter] = useState<string>('all'); // For filtering notes by calendar
  const [creatorFilter, setCreatorFilter] = useState<'assistant' | 'me'>('me'); // Filter by creator

  // Use custom hook for notes management
  const {
    notes,
    loading,
    loadingMore,
    hasMore,
    total,
    loadMore,
    updateNote,
    removeNote,
    addNote,
  } = useNotes({
    userId: user?.uid,
    calendarId,
    isOpen: open,
    activeTab,
    searchQuery,
    selectedCalendarFilter,
    creatorFilter,
  });

  // Load calendars when drawer opens (for calendar picker)
  useEffect(() => {
    if (open && showCalendarPicker) {
      loadCalendars();
    }
  }, [open, showCalendarPicker]);

  const loadCalendars = async () => {
    if (!user?.uid) return;

    try {
      const calendarRepo = new CalendarRepository();
      const userCalendars = await calendarRepo.findByUserId(user.uid);
      setCalendars(userCalendars);
    } catch (error) {
      logger.error('Error loading calendars:', error);
      setCalendars([]);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    const tabValues: TabValue[] = ['all', 'pinned', 'archived'];
    setActiveTab(tabValues[newValue]);
  };

  const handleNewNote = () => {
    if (showCalendarPicker && !calendarId) {
      // In multi-calendar view, require a calendar to be selected
      if (selectedCalendarFilter === 'all') {
        // No calendar selected - do nothing
        logger.warn('Please select a calendar to create a note');
        return;
      }
      // Use the selected calendar from dropdown
      setSelectedCalendarForNew(selectedCalendarFilter);
      setSelectedNote(undefined);
      setEditorOpen(true);
    } else {
      // In single-calendar view, use the provided calendarId
      setSelectedCalendarForNew(calendarId);
      setSelectedNote(undefined);
      setEditorOpen(true);
    }
  };

  const handleNoteClick = (note: Note) => {
    setSelectedNote(note);
    setSelectedCalendarForNew(note.calendar_id);
    setEditorOpen(true);
    if (onNoteClick) onNoteClick(note);
  };

  const handleEditorClose = () => {
    setEditorOpen(false);
    setSelectedNote(undefined);
  };

  const handlePin = async (note: Note) => {
    if (!note) return;

    try {
      // Optimistically update UI
      updateNote(note.id, { is_pinned: !note.is_pinned });

      // Call backend
      if (note.is_pinned) {
        await notesService.unpinNote(note.id);
      } else {
        await notesService.pinNote(note.id);
      }
    } catch (error) {
      logger.error('Error toggling pin:', error);
      // Revert on error
      updateNote(note.id, { is_pinned: note.is_pinned });
    }
  };

  const handleArchive = async (note: Note) => {
    try {
      if (!note) return;

      // Remove from UI immediately
      removeNote(note.id);

      // Call backend
      if (note.is_archived) {
        await notesService.unarchiveNote(note.id);
      } else {
        await notesService.archiveNote(note.id);
      }
    } catch (error) {
      logger.error('Error archiving note:', error);
      // Could add back to list on error, but for now just log
    }
  };

  

  // Get calendar for note (for multi-calendar view)
  const getCalendarForNote = (note: Note): Calendar | undefined => {
    return calendars.find(c => c.id === note.calendar_id);
  };

  // Header actions
  const headerActions = (
    <Button
      variant="contained"
      size="small"
      startIcon={<AddIcon />}
      onClick={handleNewNote}
      disabled={showCalendarPicker && (calendars.length === 0 || selectedCalendarFilter === 'all')}
      sx={{
        borderRadius: 2,
        textTransform: 'none',
        fontWeight: 600,
      }}
    >
      New Note
    </Button>
  );

  return (
    <>
      <UnifiedDrawer
        open={open}
        onClose={onClose}
        title="Notes"
        icon={<NotesIcon />}
        headerActions={headerActions}
        width={{ xs: '100%', sm: 450 }}
        headerVariant="enhanced"
        keepMounted={true}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Calendar Dropdown - only show in multi-calendar view */}
          {showCalendarPicker && !calendarId && (
            <Box sx={{ p: 2, pb: 1 }}>
              <FormControl fullWidth size="small">
                <Select
                  value={selectedCalendarFilter}
                  onChange={(e) => setSelectedCalendarFilter(e.target.value)}
                  displayEmpty
                  sx={{
                    borderRadius: 1,
                    bgcolor: alpha(theme.palette.background.paper, 0.5),
                  }}
                >
                  <MenuItem value="all">
                    <Typography variant="body2" color="text.secondary">
                      All Calendars
                    </Typography>
                  </MenuItem>
                  {calendars.map((calendar) => (
                    <MenuItem key={calendar.id} value={calendar.id}>
                      <Typography variant="body2">{calendar.name}</Typography>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          )}

          {/* Tabs */}
          <Box sx={{ p: 2, pb: 1, pt: showCalendarPicker && !calendarId ? 0 : 2 }}>
            <RoundedTabs
              tabs={[
                { label: 'All' },
                { label: 'Pinned' },
                { label: 'Archived' },
              ]}
              activeTab={['all', 'pinned', 'archived'].indexOf(activeTab)}
              onTabChange={handleTabChange}
              size="small"
              fullWidth
            />
          </Box>

          {/* Search and Filter Row */}
          <Box sx={{ px: 2, pb: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
            {/* Search - takes remaining space */}
            <TextField
              size="small"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ flex: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
                endAdornment: searchQuery && (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setSearchQuery('')}
                      edge="end"
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
                sx: {
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.background.paper, 0.5),
                },
              }}
            />

            {/* Creator Filter - compact */}
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                value={creatorFilter}
                onChange={(e) => setCreatorFilter(e.target.value as 'assistant' | 'me')}
                sx={{
                  borderRadius: 1,
                }}
              >
                <MenuItem value="me">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PersonIcon sx={{ fontSize: '1rem', color: 'text.secondary' }} />
                    <Typography variant="body2">My Notes</Typography>
                  </Stack>
                </MenuItem>
                <MenuItem value="assistant">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <AIIcon sx={{ fontSize: '1rem', color: 'primary.main' }} />
                    <Typography variant="body2">AI Assistant</Typography>
                  </Stack>
                </MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Notes List */}
          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              px: 2,
              pb: 2,
              ...scrollbarStyles(theme),
            }}
          >
            {loading ? (
              <Box>
                {Array.from({ length: 10 }).map((_, index) => (
                  <NoteListItemShimmer key={index} />
                ))}
              </Box>
            ) : notes.length === 0 ? (
              <Stack spacing={2} alignItems="center" sx={{ py: 8, textAlign: 'center' }}>
                <NotesIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
                <Typography variant="h6" color="text.secondary">
                  {searchQuery
                    ? 'No notes found'
                    : activeTab === 'pinned'
                      ? 'No pinned notes'
                      : activeTab === 'archived'
                        ? 'No archived notes'
                        : 'No notes yet'}
                </Typography>
                <Typography variant="body2" color="text.disabled">
                  {searchQuery
                    ? 'Try a different search term'
                    : activeTab === 'all'
                      ? 'Create your first note to get started'
                      : ''}
                </Typography>
                {!searchQuery && activeTab === 'all' && (
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleNewNote}
                    sx={{ mt: 2 }}
                  >
                    Create Note
                  </Button>
                )}
              </Stack>
            ) : (
              <>
                <Box>
                  {notes.map((note) => (
                    <NoteListItem
                      key={note.id}
                      note={note}
                      onClick={handleNoteClick}
                      onPin={handlePin}
                      onArchive={handleArchive}
                      onUnarchive={handleArchive}
                      calendar={getCalendarForNote(note)}
                      showCalendarBadge={showCalendarPicker && !calendarId}
                    />
                  ))}
                </Box>

                {/* Load More Button */}
                {hasMore && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, mb: 1 }}>
                    <Button
                      variant="outlined"
                      onClick={loadMore}
                      disabled={loadingMore}
                      sx={{
                        borderRadius: 2,
                        textTransform: 'none',
                        minWidth: 120,
                      }}
                    >
                      {loadingMore ? (
                        <>
                          <CircularProgress size={16} sx={{ mr: 1 }} />
                          Loading...
                        </>
                      ) : (
                        `Load More (${total - notes.length} remaining)`
                      )}
                    </Button>
                  </Box>
                )}
              </>
            )}
          </Box>
        </Box>
      </UnifiedDrawer>

      {/* Note Editor Dialog */}
      {editorOpen && selectedCalendarForNew && (
        <NoteEditorDialog
          open={editorOpen}
          onClose={handleEditorClose}
          note={selectedNote}
          calendarId={selectedCalendarForNew}
          onSave={(note: Note, isCreated?: boolean) =>
            isCreated ? addNote(note) : updateNote(note.id, note)
          }
          onDelete={(noteId: string) => removeNote(noteId)}
        />
      )}
    </>
  );
};

export default NotesDrawer;
