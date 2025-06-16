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
  CalendarMonth
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
  const [isSaving, setIsSaving] = useState(false);
  const theme = useTheme();

  // Auto-save when editedData changes
  useEffect(() => {
   
    if (editedData !== calendarNote) {
      const saveTimeout = setTimeout(() => {
        handleSave();
      }, 1000); // Debounce save for 1 second

      return () => clearTimeout(saveTimeout);
    }
  }, [editedData]);

  const handleToggleExpand = () => {
    setExpanded(!expanded);
  };

   

  const handleSave = async () => {
    try {
      if (!onUpdateCalendarProperty) {
        throw new Error('onUpdateCalendarProperty is undefined');
      }
       
      setIsSaving(true);
      await onUpdateCalendarProperty(calendarId!!, (calendar) => {
        return {
          ...calendar,
          note: editedData
        };
      });
    }
    catch (error) {
      console.error('Error saving notes:', error);
    }
    finally {
      setIsSaving(false); 
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

          {isSaving && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <CircularProgress size={10} sx={{ color: theme.palette.warning.main }} />
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
      <Box sx={{ p: 2 }}>
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
