import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Collapse,
  Tooltip,
  alpha,
  useTheme,
  CircularProgress
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Description as DescriptionIcon,
  Edit as EditIcon,
  CalendarMonth,
  Check as CheckIcon,
  Error as ErrorIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import RichTextEditor from './common/RichTextEditor';
import { Calendar } from '../types/calendar';

interface CalendarNoteDataProps {
  calendarNote: string;
  calendarId: string;
  onUpdateCalendarProperty?: (calendarId: string, updateCallback: (calendar: Calendar) => Calendar ) => Promise<void>;
  isEditable?: boolean;
  title?: string;
  emptyStateText?: string;
  // Optional props for trade link navigation
  trades?: Array<{ id: string; [key: string]: any }>;
  onOpenGalleryMode?: (trades: any[], initialTradeId?: string, title?: string) => void;
}

const CalendarNote: React.FC<CalendarNoteDataProps> = ({
  calendarNote,
  onUpdateCalendarProperty,
  calendarId,
  isEditable = true,
  title = "Description",
  emptyStateText = "No description available. Click the edit button to description to calendar.",
  trades,
  onOpenGalleryMode
}) => {
  const [expanded, setExpanded] = useState(false);
  const [editedData, setEditedData] = useState(calendarNote);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const theme = useTheme();

  // Update editedData when calendarNote prop changes
  useEffect(() => {
    setEditedData(calendarNote);
  }, [calendarNote]);

  // Auto-save when editedData changes
  useEffect(() => {
    if (editedData !== calendarNote) {
      setSaveStatus('saving');
      const saveTimeout = setTimeout(() => {
        handleSave();
      }, 1000); // Debounce save for 1 second

      return () => clearTimeout(saveTimeout);
    }
  }, [editedData]);

  const handleToggleExpand = () => {
    setExpanded(!expanded);
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      handleSave();
    }
  };

   

  const handleSave = async () => {
    try {
      if (!onUpdateCalendarProperty) {
        throw new Error('onUpdateCalendarProperty is undefined');
      }

      setSaveStatus('saving');

      await onUpdateCalendarProperty(calendarId!!, (calendar) => {
        return {
          ...calendar,
          note: editedData
        };
      });

      setSaveStatus('saved');
      // Reset to idle after showing saved status for 2 seconds
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
    catch (error) {
      console.error('Error saving notes:', error);
      setSaveStatus('error');
      // Reset to idle after showing error status for 3 seconds
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  return (
    <Paper
      elevation={3}
      sx={{
        mb: 2,
        borderRadius: 2,
        overflow: 'hidden',
        border: '1px solid',
        borderColor:  'divider',
        backgroundColor: theme.palette.background.paper,
        minHeight: !expanded ? '60px' : 'auto',
        transition: 'all 0.3s ease',
        boxShadow:  `0 2px 8px ${alpha(theme.palette.grey[500], 0.1)}`,
        '&:hover': {
          boxShadow: `0 4px 12px ${alpha(theme.palette.grey[500], 0.15)}`,
          transform: 'translateY(-2px)'
        }
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 1.5,
          pl: 2,
          backgroundColor:  alpha(theme.palette.primary.main, 0.08),
          borderBottom: expanded ? `1px solid ${theme.palette.divider}` : 'none',
          transition: 'background-color 0.3s ease'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: '50%',
              backgroundColor: alpha(theme.palette.warning.main, 0.15),
              mr: 1.5
            }}
          >
            <CalendarMonth
              sx={{
                color: theme.palette.warning.main,
                fontSize: '1.5rem'
              }}
            />
          </Box>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              fontSize: '1.1rem',
              letterSpacing: '-0.3px',
              background: 'inherit',
              WebkitBackgroundClip: 'unset',
              WebkitTextFillColor: 'inherit',
            }}
          >
            {title}
          </Typography>

          {/* Save Status Indicator */}
          {saveStatus !== 'idle' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {saveStatus === 'saving' && (
                <>
                  <CircularProgress size={12} sx={{ color: theme.palette.warning.main }} />
                  <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontSize: '0.7rem' }}>
                    Saving...
                  </Typography>
                </>
              )}
              {saveStatus === 'saved' && (
                <>
                  <CheckIcon sx={{ color: theme.palette.success.main, fontSize: '1rem' }} />
                  <Typography variant="caption" sx={{ color: theme.palette.success.main, fontSize: '0.7rem' }}>
                    Saved
                  </Typography>
                </>
              )}
              {saveStatus === 'error' && (
                <>
                  <ErrorIcon sx={{ color: theme.palette.error.main, fontSize: '1rem' }} />
                  <Typography variant="caption" sx={{ color: theme.palette.error.main, fontSize: '0.7rem' }}>
                    Error saving
                  </Typography>
                </>
              )}
            </Box>
          )}
        </Box>
        <Box>
          
          <Tooltip title={expanded ? "Hide description" : "Show description"}>
            <IconButton
              size="small"
              onClick={handleToggleExpand}
              sx={{
                color: 'text.secondary',
                backgroundColor: alpha(theme.palette.grey[500], 0.08),
                '&:hover': {
                  backgroundColor: alpha(theme.palette.grey[500], 0.15),
                }
              }}
            >
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ p: 2 }} onKeyDown={handleKeyDown}>
          <RichTextEditor
            value={editedData}
            onChange={setEditedData}
            placeholder="Enter a description about your calendar, trading strategy, plans, or mindset..."
            minHeight={300}
            calendarId={calendarId}
            trades={trades}
            onOpenGalleryMode={onOpenGalleryMode}
          />
        </Box>
      </Collapse>
    </Paper>
  );
};

export default CalendarNote;
