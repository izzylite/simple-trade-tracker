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
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CalendarMonth,
  Check as CheckIcon,
  Error as ErrorIcon,
  Image as ImageIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Photo,
  CropFree as PositionIcon
} from '@mui/icons-material';
import RichTextEditor from './common/RichTextEditor';
import { Calendar } from '../types/calendar';
import { ImageAttribution } from './heroImage';

interface CalendarNoteDataProps {
  calendarNote: string;
  calendarId: string;
  onUpdateCalendarProperty?: (calendarId: string, updateCallback: (calendar: Calendar) => Calendar) => Promise<void>;
  title?: string;
  heroImageUrl?: string;
  heroImageAttribution?: ImageAttribution;
  heroImagePosition?: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top left' | 'top right' | 'bottom left' | 'bottom right';
  onOpenImagePicker?: () => void;
  onRemoveHeroImage?: () => void;
  // Optional props for trade link navigation
  trades?: Array<{ id: string;[key: string]: any }>;
  onOpenGalleryMode?: (trades: any[], initialTradeId?: string, title?: string) => void;
}

const CalendarNote: React.FC<CalendarNoteDataProps> = ({
  calendarNote,
  onUpdateCalendarProperty,
  calendarId,
  title = "Description",
  heroImageUrl,
  heroImageAttribution,
  heroImagePosition = 'center',
  onOpenImagePicker,
  onRemoveHeroImage,
  trades,
  onOpenGalleryMode
}) => {
  const [expanded, setExpanded] = useState(false);
  const [editedData, setEditedData] = useState(calendarNote);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [imageMenuAnchor, setImageMenuAnchor] = useState<HTMLElement | null>(null);
  const [positionMenuAnchor, setPositionMenuAnchor] = useState<HTMLElement | null>(null);
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
    <>


      <Paper
        elevation={3}
        sx={{  
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          backgroundColor: theme.palette.background.paper,
          minHeight: !expanded ? '60px' : 'auto',
          transition: 'all 0.3s ease',
          boxShadow: `0 2px 8px ${alpha(theme.palette.grey[500], 0.1)}`,
          '&:hover': {
            boxShadow: `0 4px 12px ${alpha(theme.palette.grey[500], 0.15)}`,
            transform: 'translateY(-2px)'
          },

        }}
      >
        <Box sx={{

          backgroundColor: heroImageUrl ? 'transparent' : alpha(theme.palette.primary.main, 0.08),

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

          {/* Header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 1.5,
              pl: 2,
              backgroundColor: heroImageUrl ? 'transparent' : alpha(theme.palette.primary.main, 0.08),
              borderBottom: expanded ? `1px solid ${theme.palette.divider}` : 'none',
              transition: 'background-color 0.3s ease',
              position: 'relative',
              zIndex: 2
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
                  color: 'inherit', 
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
                      <Typography variant="caption" sx={{
                        color: heroImageUrl ? 'white' : theme.palette.text.secondary,
                        fontSize: '0.7rem',
                        textShadow: heroImageUrl ? '0 1px 2px rgba(0,0,0,0.8)' : 'none'
                      }}>
                        Saving...
                      </Typography>
                    </>
                  )}
                  {saveStatus === 'saved' && (
                    <>
                      <CheckIcon sx={{ color: theme.palette.success.main, fontSize: '1rem' }} />
                      <Typography variant="caption" sx={{
                        color: heroImageUrl ? 'white' : theme.palette.success.main,
                        fontSize: '0.7rem',
                        textShadow: heroImageUrl ? '0 1px 2px rgba(0,0,0,0.8)' : 'none'
                      }}>
                        Saved
                      </Typography>
                    </>
                  )}
                  {saveStatus === 'error' && (
                    <>
                      <ErrorIcon sx={{ color: theme.palette.error.main, fontSize: '1rem' }} />
                      <Typography variant="caption" sx={{
                        color: heroImageUrl ? 'white' : theme.palette.error.main,
                        fontSize: '0.7rem',
                        textShadow: heroImageUrl ? '0 1px 2px rgba(0,0,0,0.8)' : 'none'
                      }}>
                        Error saving
                      </Typography>
                    </>
                  )}
                </Box>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {onUpdateCalendarProperty && onOpenImagePicker && (
                <>
                  <Tooltip title={heroImageUrl ? "Manage cover image" : "Add cover image"}>
                    <IconButton
                      size="small"
                      onClick={handleImageButtonClick}
                      sx={{
                        color: 'text.secondary',
                        backgroundColor: alpha(theme.palette.grey[500], 0.08),
                        '&:hover': {
                          backgroundColor: alpha(theme.palette.grey[500], 0.15),
                        }
                      }}
                    >
                      <ImageIcon />
                    </IconButton>
                  </Tooltip>

                  {/* Only show menu when hero image exists */}
                  {heroImageUrl && (
                    <Menu
                      anchorEl={imageMenuAnchor}
                      open={Boolean(imageMenuAnchor)}
                      onClose={handleImageMenuClose}
                      onClick={(e) => e.stopPropagation()}
                      transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                      anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                    >
                      <MenuItem onClick={handleChangeImage}>
                        <ListItemIcon>
                          <Photo fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>Change cover</ListItemText>
                      </MenuItem>

                      <MenuItem onClick={handleRemoveImage} sx={{ color: 'error.main' }}>
                        <ListItemIcon>
                          <DeleteIcon fontSize="small" sx={{ color: 'error.main' }} />
                        </ListItemIcon>
                        <ListItemText>Remove cover</ListItemText>
                      </MenuItem>
                    </Menu>
                  )}
                </>
              )}
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
    </>
  );
};

export default CalendarNote;
