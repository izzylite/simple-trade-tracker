/**
 * CalendarSelectorDialog Component
 * Dialog for selecting which calendar to create a note in
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  Box,
  useTheme,
  alpha,
  Chip,
  CircularProgress,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Search as SearchIcon,
  CalendarToday as CalendarIcon,
  Add as AddIcon,
} from '@mui/icons-material';

import { Calendar } from '../../types/calendar';
import { useAuth } from '../../contexts/SupabaseAuthContext';
import { CalendarRepository } from '../../services/repository/repositories/CalendarRepository';
import * as notesService from '../../services/notesService';
import { logger } from '../../utils/logger';

interface CalendarSelectorDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (calendar: Calendar) => void;
}

const CalendarSelectorDialog: React.FC<CalendarSelectorDialogProps> = ({
  open,
  onClose,
  onSelect,
}) => {
  const theme = useTheme();
  const { user } = useAuth();

  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [noteCounts, setNoteCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (open) {
      loadCalendars();
    }
  }, [open]);

  const loadCalendars = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      const calendarRepo = new CalendarRepository();
      const userCalendars = await calendarRepo.findByUserId(user.uid);
      setCalendars(userCalendars);

      // Load note counts for each calendar
      const counts = new Map<string, number>();
      await Promise.all(
        userCalendars.map(async (calendar) => {
          const notes = await notesService.getCalendarNotes(calendar.id);
          counts.set(calendar.id, notes.length);
        })
      );
      setNoteCounts(counts);
    } catch (error) {
      logger.error('Error loading calendars:', error);
      setCalendars([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredCalendars = calendars.filter((calendar) =>
    calendar.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (calendar: Calendar) => {
    onSelect(calendar);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CalendarIcon color="primary" />
          <Typography variant="h6" sx={{ flex: 1 }}>
            Select Calendar
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Choose which calendar to create the note in
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ px: 0 }}>
        {/* Search */}
        <Box sx={{ px: 3, pb: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search calendars..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
              sx: {
                borderRadius: 2,
                bgcolor: alpha(theme.palette.background.paper, 0.5),
              },
            }}
          />
        </Box>

        {/* Calendar List */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : filteredCalendars.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4, px: 3 }}>
            <CalendarIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {searchQuery ? 'No calendars found' : 'No calendars yet'}
            </Typography>
            <Typography variant="body2" color="text.disabled">
              {searchQuery
                ? 'Try a different search term'
                : 'Create your first calendar to get started'}
            </Typography>
          </Box>
        ) : (
          <List sx={{ px: 2 }}>
            {filteredCalendars.map((calendar) => {
              const noteCount = noteCounts.get(calendar.id) || 0;
              return (
                <ListItemButton
                  key={calendar.id}
                  onClick={() => handleSelect(calendar)}
                  sx={{
                    borderRadius: 2,
                    mb: 1,
                    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.05),
                      borderColor: alpha(theme.palette.primary.main, 0.3),
                    },
                    transition: 'all 0.2s ease',
                  }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography
                          variant="subtitle1"
                          sx={{ fontWeight: 600, flex: 1 }}
                        >
                          {calendar.name}
                        </Typography>
                        <Chip
                          label={`${noteCount} note${noteCount !== 1 ? 's' : ''}`}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.7rem',
                            bgcolor: alpha(theme.palette.info.main, 0.1),
                            color: 'info.main',
                            fontWeight: 600,
                          }}
                        />
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="text.disabled">
                        Last updated:{' '}
                        {new Date(calendar.updated_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Typography>
                    }
                  />
                </ListItemButton>
              );
            })}
          </List>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
};

export default CalendarSelectorDialog;
