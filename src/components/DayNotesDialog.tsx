import React, { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  useTheme,
  alpha
} from '@mui/material';
import { EventNote as EventNoteIcon } from '@mui/icons-material';
import RichTextEditor from './common/RichTextEditor';
import { Calendar } from '../types/dualWrite';
import { BaseDialog } from './common';
import { logger } from '../utils/logger';
interface DayNotesDialogProps {
  open: boolean;
  onClose: () => void;
  day: string;
  notes: string;
  calendarId: string;
  onUpdateCalendarProperty?: (calendarId: string, updateCallback: (calendar: Calendar) => Calendar) => Promise<Calendar | undefined>;
  // Optional props for trade link navigation
  trades?: Array<{ id: string; [key: string]: any }>;
  onOpenGalleryMode?: (trades: any[], initialTradeId?: string, title?: string) => void;
}

const DayNotesDialog: React.FC<DayNotesDialogProps> = ({
  open,
  onClose,
  day,
  notes,
  calendarId,
  onUpdateCalendarProperty,
  trades,
  onOpenGalleryMode
}) => {
  const [currentNotes, setCurrentNotes] = useState(notes);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Update local state when props change
  useEffect(() => {
    setCurrentNotes(notes);
    setHasChanges(false);
  }, [notes, day]);

  const handleNotesChange = (value: string) => {
    setCurrentNotes(value);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!hasChanges) {
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      if (!onUpdateCalendarProperty) {
        throw new Error('onUpdateCalendarProperty is undefined');
      }

      await onUpdateCalendarProperty(calendarId, (calendar) => {
        // Create a new Record from the existing days_notes or a new empty Record
        const daysNotesRecord = calendar.days_notes ? { ...calendar.days_notes } : {};

        // Set the notes for this day - ensure consistent key format
        const dayKey = day.toString();
        daysNotesRecord[dayKey] = currentNotes;

        return {
          ...calendar,
          days_notes: daysNotesRecord
        };
      });

      setHasChanges(false);
      onClose();
    } catch (error) {
      logger.error('Error saving notes:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const theme = useTheme();
  const dayFullName =
    day === 'Sun' ? 'Sunday' :
    day === 'Mon' ? 'Monday' :
    day === 'Tue' ? 'Tuesday' :
    day === 'Wed' ? 'Wednesday' :
    day === 'Thu' ? 'Thursday' :
    day === 'Fri' ? 'Friday' :
    day === 'Sat' ? 'Saturday' : day;

  // Create a custom title with icon
  const dialogTitle = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 40,
          height: 40,
          borderRadius: '50%',
          backgroundColor: alpha(theme.palette.primary.main, 0.1),
          color: theme.palette.primary.main
        }}
      >
        <EventNoteIcon />
      </Box>
      <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
        Notes for {dayFullName}
      </Typography>
    </Box>
  );

  return (
    <BaseDialog
      open={open}
      onClose={() => {
        if (!isSaving) onClose();
      }}
      maxWidth="md"
      fullWidth
      title={dialogTitle}
      hideCloseButton={isSaving}
      hideFooterCancelButton={false}
      cancelButtonText="Cancel"
      cancelButtonAction={onClose}
      primaryButtonText={isSaving ? 'Saving...' : 'Save Notes'}
      primaryButtonAction={hasChanges ? handleSave : undefined}
      isSubmitting={isSaving}
      contentSx={{
        minHeight: 350,
        p: 3
      }}
    >
      <Box sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <RichTextEditor
          value={currentNotes}
          onChange={handleNotesChange}
          placeholder="Add notes for this day..."
          minHeight={300}
          calendarId={calendarId}
          trades={trades}
          onOpenGalleryMode={onOpenGalleryMode}
        />
      </Box>
    </BaseDialog>
  );
};

export default DayNotesDialog;
