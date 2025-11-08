import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Collapse,
  Tooltip,
  alpha,
  useTheme,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Button,
  Divider
} from '@mui/material';
import { logger } from '../utils/logger';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CalendarMonth,
  Check as CheckIcon,
  Error as ErrorIcon,
  Image as ImageIcon,
  Delete as DeleteIcon,
  Photo,
  EventNote as EventNoteIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Note,
  Save as SaveIcon,
  Share as ShareIcon
} from '@mui/icons-material';
import RichTextEditor from './common/RichTextEditor';
import { Calendar } from '../types/calendar';
import { ImageAttribution } from './heroImage';
import { convertRichTextToHtml } from '../utils/richTextUtils'; 
import ShareButton from './sharing/ShareButton';

interface CalendarNoteDataProps {
  calendarNote: string;
  calendarId: string;
  onUpdateCalendarProperty?: (calendarId: string, updateCallback: (calendar: Calendar) => Calendar) => Promise<Calendar | undefined>;
  title?: string;
  heroImageUrl?: string;
  heroImageAttribution?: ImageAttribution;

  onOpenImagePicker?: () => void;
  onRemoveHeroImage?: () => void;
  // Optional props for trade link navigation
  trades?: Array<{ id: string;[key: string]: any }>;
  onOpenGalleryMode?: (trades: any[], initialTradeId?: string, title?: string) => void;
  // Day notes props
  calendarDayNotes?: Map<string, string>;
  setIsDayNotesDialogOpen?: (day: string) => void;
  // Calendar sharing props
  calendar?: Calendar;

  // Control visibility of header buttons (default true)
  showImageButton?: boolean;
  showShareButton?: boolean;
  showExpandToggle?: boolean;

  // Optional controlled expand state
  expanded?: boolean;
  onToggleExpand?: () => void;

  // Read-only mode
  isReadOnly?: boolean;
}

const CalendarNote: React.FC<CalendarNoteDataProps> = ({
  calendarNote,
  onUpdateCalendarProperty,
  calendarId,
  title = "Description",
  heroImageUrl,
  heroImageAttribution,
  onOpenImagePicker,
  onRemoveHeroImage,
  trades,
  onOpenGalleryMode,
  calendarDayNotes,
  setIsDayNotesDialogOpen,
  calendar,
  showImageButton = true,
  showShareButton = true,
  showExpandToggle = true,
  expanded: controlledExpanded,
  onToggleExpand,
  isReadOnly = false
}) => {
  const [expandedState, setExpandedState] = useState(false);
  const isControlled = controlledExpanded !== undefined;
  const isExpanded = isControlled ? !!controlledExpanded : expandedState;
  const [editedData, setEditedData] = useState(calendarNote);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [imageMenuAnchor, setImageMenuAnchor] = useState<HTMLElement | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // State for hiding day notes section
  const [isDayNotesHidden, setIsDayNotesHidden] = useState(() => {
    const saved = localStorage.getItem(`dayNotes-hidden-${calendarId}`) || 'false';
    return saved === 'true';
  });

  const theme = useTheme();
  const MAX_NOTE_LENGTH = 600;

  // Update editedData when calendarNote prop changes
  useEffect(() => {
    setEditedData(calendarNote);
    setHasUnsavedChanges(false);
  }, [calendarNote]);

  // Track changes
  useEffect(() => {
    setHasUnsavedChanges(editedData !== calendarNote);
  }, [editedData, calendarNote]);

  const handleToggleExpand = async () => {
    const next = !isExpanded;
    // If we're collapsing and there are unsaved changes, save them automatically
    if (isExpanded && !next && hasUnsavedChanges && onUpdateCalendarProperty) {
      try {
        setSaveStatus('saving');
        await onUpdateCalendarProperty(calendarId, (calendar) => {
          return {
            ...calendar,
            note: editedData
          };
        });
        setSaveStatus('saved');
        setHasUnsavedChanges(false);
        // Reset to idle after showing saved status for 2 seconds
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (error) {
        logger.error('Error auto-saving notes:', error);
        setSaveStatus('error');
        // Reset to idle after showing error status for 3 seconds
        setTimeout(() => setSaveStatus('idle'), 3000);
        // Don't collapse if save failed
        return;
      }
    }

    if (isControlled) {
      onToggleExpand && onToggleExpand();
    } else {
      setExpandedState(next);
    }
  };

  const handleToggleDayNotesHidden = () => {
    const newHiddenState = !isDayNotesHidden;
    setIsDayNotesHidden(newHiddenState);
    localStorage.setItem(`dayNotes-hidden-${calendarId}`, newHiddenState.toString());
  };

  // Handle image button click
  const handleImageButtonClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();

    if (heroImageUrl) {
      // If hero image exists, show menu with change/remove options
      setImageMenuAnchor(event.currentTarget);
    } else {
      // If no hero image, directly open image picker
      if (onOpenImagePicker) {
        onOpenImagePicker();
      }
    }
  };

  const handleImageMenuClose = () => {
    setImageMenuAnchor(null);
  };

  const handleChangeImage = () => {
    handleImageMenuClose();
    if (onOpenImagePicker) {
      onOpenImagePicker();
    }
  };

  const handleRemoveImage = () => {
    handleImageMenuClose();
    if (onRemoveHeroImage) {
      onRemoveHeroImage();
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Only handle shortcuts when expanded
    if (!isExpanded) return;

    if ((event.ctrlKey || event.metaKey)) {
      if (event.key === 's') {
        event.preventDefault();
        if (hasUnsavedChanges) {
          handleSave();
        }
      } else if (event.key === 'e') {
        event.preventDefault();
        handleToggleExpand();
      }
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
      setHasUnsavedChanges(false);
      // Reset to idle after showing saved status for 2 seconds
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
    catch (error) {
      logger.error('Error saving notes:', error);
      setSaveStatus('error');
      // Reset to idle after showing error status for 3 seconds
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  return (
    <Paper
      elevation={3}
      sx={{
        overflow: 'hidden',
        borderRadius: 0,
        backgroundColor: alpha(theme.palette.background.paper, 0.5),
        minHeight: 'auto',
        transition: 'all 0.3s ease',
        boxShadow: `0 2px 8px ${alpha(theme.palette.grey[500], 0.1)}`,
        '&:hover': {
          boxShadow: `0 4px 12px ${alpha(theme.palette.grey[500], 0.15)}`,
          transform: 'translateY(-2px)'
        },
      }}
    >
      <Box sx={{ 
        zIndex: 2
      }}>
        {/* Hero Image Section */}
        {heroImageUrl && (
          <Box sx={{ position: 'relative' }}>
            <Box
              sx={{
                position: 'relative',
                overflow: 'hidden',
                height: 200,
                backgroundImage: `url(${heroImageUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                imageRendering: 'high-quality',
                WebkitBackfaceVisibility: 'hidden',
                backfaceVisibility: 'hidden',
                transform: 'translateZ(0)', // Force hardware acceleration
                willChange: 'transform', // Optimize for changes
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: `linear-gradient(to bottom, ${alpha(theme.palette.common.black, 0.1)}, ${alpha(theme.palette.common.black, 0.3)})`,
                  zIndex: 1
                }
              }}
            />

            {/* Attribution overlay - only show for Unsplash images */}
            {heroImageAttribution && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  background: 'linear-gradient(45deg, transparent, rgba(0,0,0,0.7))',
                  color: 'white',
                  p: 1,
                  borderTopLeftRadius: 1,
                  zIndex: 2
                }}
              >
                <Typography variant="caption" sx={{ fontSize: '0.7rem', display: 'block' }}>
                  Photo by{' '}
                  <a
                    href={heroImageAttribution.photographerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'white', textDecoration: 'underline' }}
                  >
                    {heroImageAttribution.photographer}
                  </a>
                  {' '}on{' '}
                  <a
                    href={heroImageAttribution.unsplashUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'white', textDecoration: 'underline' }}
                  >
                    Unsplash
                  </a>
                </Typography>
              </Box>
            )}
          </Box>
        )}

      
      </Box>

      <Collapse in={isExpanded}>
        <Box sx={{ p: 2 }} onKeyDown={isReadOnly ? undefined : handleKeyDown} tabIndex={isReadOnly ? -1 : 0}>
          <RichTextEditor
            value={editedData}
            onChange={isReadOnly ? () => { } : setEditedData}
            placeholder="Enter a description about your calendar, trading strategy, plans, or mindset..."
            minHeight={300}
            calendarId={calendarId}
            trades={trades}
            onOpenGalleryMode={onOpenGalleryMode}
            disabled={isReadOnly}
            hideCharacterCount={isReadOnly}
          />
        </Box>
      </Collapse>

      {/* Day Notes Display - Below header */}
      {calendarDayNotes && !isExpanded && setIsDayNotesDialogOpen && (() => {
        const currentDayOfWeek = format(new Date(), 'EEE');
        const fullDayName = format(new Date(), 'EEEE');
        const hasNoteForToday = calendarDayNotes.has(currentDayOfWeek) && calendarDayNotes.get(currentDayOfWeek)?.trim() !== '';

        if (hasNoteForToday) {
          const noteContent = calendarDayNotes.get(currentDayOfWeek) || '';

          return (
            <Box sx={{
              px: 2,
              py: 1,
              borderBottom: `1px solid ${theme.palette.divider}`,
              backgroundColor: alpha(theme.palette.info.main, 0.05),
              borderLeft: `4px solid ${theme.palette.info.main}`
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <EventNoteIcon sx={{ fontSize: '1rem', color: 'info.main' }} />
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontSize: '0.875rem',
                      color: 'info.main',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                  >
                    {fullDayName} Note
                  </Typography>
                </Box>

                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  <Box
                    onClick={handleToggleDayNotesHidden}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      cursor: 'pointer',
                      color: 'info.main'
                    }}
                  >
                    <Note fontSize="small" />
                    <Typography
                      variant="body1"
                      sx={{
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        color: 'text.main',
                        textTransform: 'none',
                      }}
                      onClick={() => setIsDayNotesDialogOpen(currentDayOfWeek)}
                    >
                      {'Edit Note'}
                    </Typography>
                  </Box>

                  <Box
                    onClick={handleToggleDayNotesHidden}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      cursor: 'pointer',
                      color: 'info.main'
                    }}
                  >
                    {isDayNotesHidden ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        textTransform: 'none'
                      }}
                    >
                      {isDayNotesHidden ? 'Show Note' : 'Hide Note'}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {!isDayNotesHidden && (
                <>
                  <Divider sx={{ my: 1, borderColor: theme.palette.divider, borderRadius: 1 }} />
                  <RichTextEditor
                    value={noteContent}
                    disabled={true}
                    hideCharacterCount={true}
                    minHeight={50}
                    maxHeight={400}
                    calendarId={calendarId}
                    trades={trades}
                    onOpenGalleryMode={onOpenGalleryMode}
                  />
                </>
              )}
            </Box>
          );
        }
        return null;
      })()}
    </Paper>
  );
};

export default CalendarNote;
