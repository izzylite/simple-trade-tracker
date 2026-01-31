import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Chip,
  useTheme,
  alpha
} from '@mui/material';
import { Link as LinkIcon, LinkOff as UnlinkIcon } from '@mui/icons-material';
import { Calendar } from '../../types/dualWrite';
import { dialogProps } from '../../styles/dialogStyles';

interface CalendarLinkDialogProps {
  open: boolean;
  calendar: Calendar | null;
  calendars: Calendar[];
  isLoading: boolean;
  onClose: () => void;
  onLink: (targetCalendarId: string) => Promise<void>;
  onUnlink: () => Promise<void>;
}

export const CalendarLinkDialog: React.FC<CalendarLinkDialogProps> = ({
  open,
  calendar,
  calendars,
  isLoading,
  onClose,
  onLink,
  onUnlink
}) => {
  const theme = useTheme();
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter out:
  // 1. Current calendar (self-link)
  // 2. Calendars that link to this calendar (would create immediate cycle)
  const availableCalendars = calendars.filter(
    (c) => c.id !== calendar?.id && c.linked_to_calendar_id !== calendar?.id
  );

  // Find the currently linked calendar
  const linkedCalendar = calendar?.linked_to_calendar_id
    ? calendars.find((c) => c.id === calendar.linked_to_calendar_id)
    : null;

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedCalendarId('');
      setError(null);
    }
  }, [open]);

  const handleLink = async () => {
    if (!selectedCalendarId) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await onLink(selectedCalendarId);
      onClose();
    } catch (err) {
      console.error('Error linking calendar:', err);
      const message = err instanceof Error ? err.message : 'Failed to link calendar';
      // Handle circular link error from database
      if (message.toLowerCase().includes('circular')) {
        setError('Cannot link: this would create a circular link chain.');
      } else {
        setError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlink = async () => {
    setIsSubmitting(true);
    try {
      await onUnlink();
      onClose();
    } catch (error) {
      console.error('Error unlinking calendar:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isProcessing = isLoading || isSubmitting;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      {...dialogProps}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          color: 'primary.main'
        }}
      >
        <LinkIcon fontSize="small" />
        Link Calendar
      </DialogTitle>
      <DialogContent>
        {isProcessing ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              py: 4
            }}
          >
            <CircularProgress size={40} sx={{ mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              {isSubmitting ? 'Updating link...' : 'Loading...'}
            </Typography>
          </Box>
        ) : (
          <Stack spacing={3}>
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              <Typography variant="body2">
                When you link calendars, trades created in "{calendar?.name}" will
                automatically be copied to the target calendar. Updates and deletes
                sync for 24 hours after trade creation.
              </Typography>
            </Alert>

            {error && (
              <Alert severity="error" sx={{ borderRadius: 2 }}>
                <Typography variant="body2">{error}</Typography>
              </Alert>
            )}

            {linkedCalendar ? (
              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  Currently linked to:
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 2,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={linkedCalendar.name}
                      color="primary"
                      variant="outlined"
                    />
                    <Typography variant="body2" color="text.secondary">
                      Trades sync to this calendar
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    startIcon={<UnlinkIcon />}
                    onClick={handleUnlink}
                    disabled={isProcessing}
                  >
                    Unlink
                  </Button>
                </Box>
              </Box>
            ) : (
              <FormControl fullWidth>
                <InputLabel id="target-calendar-label">Target Calendar</InputLabel>
                <Select
                  labelId="target-calendar-label"
                  value={selectedCalendarId}
                  label="Target Calendar"
                  onChange={(e) => setSelectedCalendarId(e.target.value)}
                  disabled={isProcessing}
                >
                  {availableCalendars.length === 0 ? (
                    <MenuItem value="" disabled>
                      No available calendars
                    </MenuItem>
                  ) : (
                    availableCalendars.map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.name}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
            )}

            {!linkedCalendar && availableCalendars.length === 0 && (
              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                <Typography variant="body2">
                  No calendars available to link. Create another calendar first.
                </Typography>
              </Alert>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isProcessing} sx={{ color: 'text.secondary' }}>
          Cancel
        </Button>
        {!linkedCalendar && (
          <Button
            variant="contained"
            onClick={handleLink}
            disabled={isProcessing || !selectedCalendarId}
            startIcon={<LinkIcon />}
          >
            Link Calendar
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
