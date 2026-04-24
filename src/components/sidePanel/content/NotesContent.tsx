/**
 * NotesContent Component
 * Inner content for notes management — usable inside a drawer (mobile) or side panel (desktop)
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
  CircularProgress,
  MenuItem,
  Select,
  FormControl,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Notes as NotesIcon,
  Clear as ClearIcon,
  SmartToy as AIIcon,
  Person as PersonIcon,
  ViewModule as CardViewIcon,
  LocalOffer as TagViewIcon,
} from '@mui/icons-material';

import RoundedTabs from '../../common/RoundedTabs';
import NoteListItem from '../../notes/NoteListItem';
import NotesTagView from '../../notes/NotesTagView';
import { useNotesViewMode } from '../../../hooks/useNotesViewMode';
import EconomicEventShimmer from '../../economicCalendar/EconomicEventShimmer';
import NoteEditorDialog from '../../notes/NoteEditorDialog';
import NoteViewerDialog from '../../notes/NoteViewerDialog';
import { Note } from '../../../types/note';
import { Calendar } from '../../../types/calendar';
import * as notesService from '../../../services/notesService';
import { logger } from '../../../utils/logger';
import { useAuthState } from '../../../contexts/AuthStateContext';
import { CalendarRepository } from '../../../services/repository/repositories/CalendarRepository';
import { scrollbarStyles } from '../../../styles/scrollbarStyles';
import { useNotes } from '../../../hooks/useNotes';
import type { Currency, ImpactLevel } from '../../../types/economicCalendar';

export interface NotesContentProps {
  /** Controls whether data fetching and hooks are active (replaces `open` from drawer) */
  isActive?: boolean;
  calendarId?: string;
  showCalendarPicker?: boolean;
  onNoteClick?: (note: Note) => void;
  isReadOnly?: boolean;
  availableTradeTags?: string[];
  pinnedEvents?: Array<{
    event_id: string;
    event: string;
    currency?: Currency;
    impact?: ImpactLevel;
  }>;
  /**
   * Called with the bound `handleNewNote` function once the component mounts.
   * Allows parent containers (e.g. drawer header buttons) to trigger new-note creation.
   */
  onNewNoteReady?: (triggerNewNote: () => void) => void;
  /** Show footer with Add Note button (panel mode). Hidden in drawer mode. */
  showFooter?: boolean;
}

type TabValue = 'all' | 'pinned' | 'archived';


const NotesContent: React.FC<NotesContentProps> = ({
  isActive = true,
  calendarId,
  showCalendarPicker = false,
  onNoteClick,
  isReadOnly = false,
  availableTradeTags = [],
  pinnedEvents,
  onNewNoteReady,
  showFooter = true,
}) => {
  const theme = useTheme();
  const { user } = useAuthState();

  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | undefined>();
  const [selectedCalendarForNew, setSelectedCalendarForNew] = useState<string | undefined>(
    calendarId
  );
  const [selectedCalendarFilter, setSelectedCalendarFilter] = useState<string>('all');
  const [creatorFilter, setCreatorFilter] = useState<'assistant' | 'me'>('me');
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerNote, setViewerNote] = useState<Note | null>(null);
  const [viewMode, setViewMode] = useNotesViewMode();

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
    isOpen: isActive,
    activeTab,
    searchQuery,
    selectedCalendarFilter,
    creatorFilter,
  });

  // Load calendars when content becomes active (for calendar picker)
  useEffect(() => {
    if (isActive && showCalendarPicker) {
      loadCalendars();
    }
  }, [isActive, showCalendarPicker]);

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
      if (selectedCalendarFilter === 'all') {
        logger.warn('Please select a calendar to create a note');
        return;
      }
      setSelectedCalendarForNew(selectedCalendarFilter);
      setSelectedNote(undefined);
      setEditorOpen(true);
    } else {
      setSelectedCalendarForNew(calendarId);
      setSelectedNote(undefined);
      setEditorOpen(true);
    }
  };

  // Notify parent of the new-note trigger so drawer/panel headers can bind to it
  useEffect(() => {
    if (onNewNoteReady) {
      onNewNoteReady(handleNewNote);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onNewNoteReady]);

  const handleNoteClick = (note: Note) => {
    if (isReadOnly) {
      setViewerNote(note);
      setViewerOpen(true);
      if (onNoteClick) onNoteClick(note);
      return;
    }
    setSelectedNote(note);
    setSelectedCalendarForNew(note.calendar_id ?? calendarId ?? selectedCalendarFilter);
    setEditorOpen(true);
    if (onNoteClick) onNoteClick(note);
  };

  const handleViewerClose = () => {
    setViewerOpen(false);
    setViewerNote(null);
  };

  const handleEditorClose = () => {
    setEditorOpen(false);
    setSelectedNote(undefined);
  };

  const handlePin = async (note: Note) => {
    if (!note) return;

    try {
      updateNote(note.id, { is_pinned: !note.is_pinned });

      if (note.is_pinned) {
        await notesService.unpinNote(note.id);
      } else {
        await notesService.pinNote(note.id);
      }
    } catch (error) {
      logger.error('Error toggling pin:', error);
      updateNote(note.id, { is_pinned: note.is_pinned });
    }
  };

  const handleArchive = async (note: Note) => {
    try {
      if (!note) return;

      removeNote(note.id);

      if (note.is_archived) {
        await notesService.unarchiveNote(note.id);
      } else {
        await notesService.archiveNote(note.id);
      }
    } catch (error) {
      logger.error('Error archiving note:', error);
    }
  };

  const handleConvertToUserNote = async (note: Note) => {
    try {
      updateNote(note.id, { by_assistant: false });
      await notesService.updateNote(note.id, { by_assistant: false });
    } catch (error) {
      logger.error('Error converting note:', error);
      updateNote(note.id, { by_assistant: true });
    }
  };

  const getCalendarForNote = (note: Note): Calendar | undefined => {
    return calendars.find(c => c.id === note.calendar_id);
  };

  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
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
                  bgcolor: 'background.default',
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
                borderRadius: '8px',
                bgcolor: 'background.default',
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
                  <Typography variant="body2">Orion</Typography>
                </Stack>
              </MenuItem>
            </Select>
          </FormControl>

          <ToggleButtonGroup
            size="small"
            exclusive
            value={viewMode}
            onChange={(_e, v) => v && setViewMode(v)}
            aria-label="View mode"
            sx={{ flexShrink: 0 }}
          >
            <ToggleButton value="card" aria-label="Card view">
              <CardViewIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="tag" aria-label="Tag view">
              <TagViewIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
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
            <EconomicEventShimmer count={8} />
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
            </Stack>
          ) : (
            <>
              {viewMode === 'tag' ? (
                <NotesTagView
                  notes={notes}
                  calendars={calendars}
                  showCalendarBadge={showCalendarPicker && !calendarId}
                  isReadOnly={isReadOnly}
                  onNoteClick={handleNoteClick}
                  onPin={note => { void handlePin(note); }}
                  onArchive={note => { void handleArchive(note); }}
                  onUnarchive={note => { void handleArchive(note); }}
                  onConvertToUserNote={note => { void handleConvertToUserNote(note); }}
                />
              ) : (
                <Box>
                  {notes.map((note) => (
                    <NoteListItem
                      key={note.id}
                      note={note}
                      onClick={handleNoteClick}
                      onPin={isReadOnly ? undefined : handlePin}
                      onArchive={isReadOnly ? undefined : handleArchive}
                      onUnarchive={isReadOnly ? undefined : handleArchive}
                      onConvertToUserNote={
                        isReadOnly ? undefined : handleConvertToUserNote
                      }
                      calendar={getCalendarForNote(note)}
                      showCalendarBadge={showCalendarPicker && !calendarId}
                    />
                  ))}
                </Box>
              )}

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

        {/* Footer — panel mode only. Hidden when using the calendar picker with "All" selected. */}
        {showFooter && !isReadOnly && !(showCalendarPicker && !calendarId && selectedCalendarFilter === 'all') && (
          <Box sx={{
            p: 1.5,
            borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            bgcolor: 'background.paper',
            display: 'flex',
            justifyContent: 'flex-end',
            flexShrink: 0,
          }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={handleNewNote}
            >
              Add Note
            </Button>
          </Box>
        )}
      </Box>

      {/* Note Editor Dialog */}
      {editorOpen && (selectedCalendarForNew || selectedNote) && (
        <NoteEditorDialog
          open={editorOpen}
          onClose={handleEditorClose}
          note={selectedNote}
          calendarId={selectedCalendarForNew || selectedNote?.calendar_id || calendarId || ''}
          onSave={(note: Note, isCreated?: boolean) =>
            isCreated ? addNote(note) : updateNote(note.id, note)
          }
          onDelete={(noteId: string) => removeNote(noteId)}
          availableTradeTags={availableTradeTags}
          calendarNotes={notes.map((n) => ({ id: n.id, title: n.title }))}
          pinnedEvents={pinnedEvents}
        />
      )}

      {/* Note Viewer Dialog (Read-only mode) */}
      <NoteViewerDialog
        open={viewerOpen}
        onClose={handleViewerClose}
        note={viewerNote}
      />
    </>
  );
};

export default NotesContent;
