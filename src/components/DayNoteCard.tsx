import React, { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip
} from '@mui/material';
import { convertRichTextToHtml } from '../utils/richTextUtils';
import {
  EventNote as EventNoteIcon,
  Edit as EditIcon,
  NoteAdd as NoteAddIcon,
  Add as AddIcon
} from '@mui/icons-material';

interface DayNoteCardProps {
  calendarNotes: Map<string, string>;
  setIsDayNotesDialogOpen: (day: string) => void;
}

const DayNoteCard: React.FC<DayNoteCardProps> = ({
  calendarNotes,
  setIsDayNotesDialogOpen
}) => {
  const theme = useTheme();
  const [isContentOverflowing, setIsContentOverflowing] = useState(false);

  // Get current day of week (Sun, Mon, Tue, etc.)
  const currentDayOfWeek = format(new Date(), 'EEE');
  const hasNoteForToday = calendarNotes && calendarNotes.has(currentDayOfWeek) && calendarNotes.get(currentDayOfWeek)?.trim() !== '';

  // Function to check if content overflows
  const checkOverflow = useCallback((contentElement: HTMLElement, containerElement: HTMLElement) => {
    // Create a temporary element to measure the actual content height without duplication
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.visibility = 'hidden';
    tempDiv.style.height = 'auto';
    tempDiv.style.width = containerElement.clientWidth + 'px';
    tempDiv.style.fontSize = '0.8rem';
    tempDiv.style.lineHeight = '1.3';
    tempDiv.innerHTML = convertRichTextToHtml(calendarNotes?.get(currentDayOfWeek) || '');

    document.body.appendChild(tempDiv);
    const actualContentHeight = tempDiv.offsetHeight;
    document.body.removeChild(tempDiv);

    const containerHeight = containerElement.clientHeight;
    const isOverflowing = actualContentHeight > containerHeight;

    setIsContentOverflowing(isOverflowing);
    return isOverflowing;
  }, [calendarNotes, currentDayOfWeek]);

  // Common paper styles for both states
  const paperStyles = {
    display: 'flex',
    flexDirection: 'column',
    gap: 1.5,
    p: 2,
    borderRadius: 2,
    bgcolor: 'background.paper',
    border: '1px solid',
    borderColor: hasNoteForToday ? theme.palette.info.main : alpha(theme.palette.primary.main, 0.3),
    boxShadow: hasNoteForToday
      ? `0 0 8px ${alpha(theme.palette.info.main, 0.2)}`
      : `0 0 8px ${alpha(theme.palette.primary.main, 0.1)}`,
    position: 'relative',
    overflow: 'hidden',
    flex: { xs: 1, md: 0.5 },
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    height: '100%',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: theme.shadows[4],
      borderColor: theme.palette.primary.main
    }
  };

  return (
    <Paper
      elevation={2}
      sx={paperStyles}
      onClick={() => setIsDayNotesDialogOpen(currentDayOfWeek)}
    >
      {/* Card Header - Different for empty vs filled states */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: alpha(hasNoteForToday ? theme.palette.info.main : theme.palette.primary.main, 0.1),
              color: hasNoteForToday ? theme.palette.info.main : theme.palette.primary.main
            }}
          >
            <EventNoteIcon fontSize="small" />
          </Box>
          <Typography variant="subtitle1" sx={{ color: 'text.primary', fontWeight: 600 }}>
            Today's Notes
          </Typography>
        </Box>
        <Tooltip title={hasNoteForToday ? "Edit Notes" : "Add Notes"}>
          <IconButton
            size="small"
            sx={{
              color: hasNoteForToday ? 'info.main' : 'primary.main',
              bgcolor: alpha(hasNoteForToday ? theme.palette.info.main : theme.palette.primary.main, 0.08),
              '&:hover': {
                bgcolor: alpha(hasNoteForToday ? theme.palette.info.main : theme.palette.primary.main, 0.15),
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              setIsDayNotesDialogOpen(currentDayOfWeek);
            }}
          >
            {hasNoteForToday ? <EditIcon fontSize="small" /> : <AddIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Card Content - Different for empty vs filled states */}
      {hasNoteForToday ? (
        // Content when notes exist
        <Box sx={{
          backgroundColor: alpha(theme.palette.background.default, 0.5),
          p: 1.2,
          borderRadius: 1.5,
          mt: 0.5,
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          width: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <Box
            className="auto-scroll-container"
            sx={{
              overflow: 'hidden',
              height: '100%',
              maxHeight: '170px',
              position: 'relative',
              width: '100%',
              '& .MuiTypography-root': {
                margin: 0
              },
              '& .auto-scroll-content': {
                position: 'relative',
                whiteSpace: 'normal',
                width: '100%',
                textAlign: 'left',
                boxSizing: 'border-box',
                fontSize: '0.8rem'
              },
              '&:hover': {
                '& .infinite-scroll-wrapper': {
                  animationPlayState: 'paused'
                }
              },
              '@keyframes scrollText': {
                '0%, 100%': { transform: 'translateY(0)' }
              }
            }}
          >
            <Box
              className="scroll-container"
              sx={{
                position: 'relative',
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                '&:hover .scroll-content': {
                  animationPlayState: 'paused'
                }
              }}
            >
              <Box
                className="scroll-content"
                sx={{
                  animation: 'marquee var(--scroll-duration, 15s) linear infinite',
                  paddingBottom: '20px',
                  '@keyframes marquee': {
                    '0%': { transform: 'translateY(0)' },
                    '100%': { transform: 'translateY(-50%)' }
                  }
                }}
                ref={(el: HTMLDivElement | null) => {
                  if (el) {
                    // Check if content overflows the container
                    const container = el.parentElement;
                    if (container) {
                      // Wait for content to render
                      setTimeout(() => {
                        const isOverflowing = checkOverflow(el, container);

                        if (isOverflowing) {
                          // Calculate content length and set appropriate duration
                          const contentLength = el.textContent?.length || 0;
                          // Base duration on content length - longer content scrolls slower
                          const duration = Math.max(10, Math.min(30, contentLength / 20));
                          el.style.setProperty('--scroll-duration', `${duration}s`);
                          el.style.animationPlayState = 'running';
                        } else {
                          // Disable animation for short content
                          el.style.animationPlayState = 'paused';
                          el.style.transform = 'translateY(0)';
                        }
                      }, 100);
                    }
                  }
                }}
                dangerouslySetInnerHTML={{
                  __html: `
                    <div style="font-size: 0.8rem; line-height: 1.3; text-align: left;">
                      ${convertRichTextToHtml(calendarNotes?.get(currentDayOfWeek) || '')}
                    </div>
                    ${isContentOverflowing ? `
                      <div style="height: 30px;"></div>
                      <div style="font-size: 0.8rem; line-height: 1.3; text-align: left;">
                        ${convertRichTextToHtml(calendarNotes?.get(currentDayOfWeek) || '')}
                      </div>
                    ` : ''}
                  `
                }}
              />
            </Box>
          </Box>
          <Box
            className="scroll-indicator"
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '30px',
              background: `linear-gradient(to bottom, transparent, ${theme.palette.mode === 'dark' ? 'rgba(30,30,30,0.8)' : 'rgba(255,255,255,0.8)'})`,
              pointerEvents: 'none',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-end',
              paddingBottom: '4px',
              opacity: 0,
              transition: 'opacity 0.3s ease',
              '&::after': {
                content: '""',
                width: '40px',
                height: '4px',
                borderRadius: '2px',
                backgroundColor: alpha(theme.palette.info.main, 0.3),
                animation: 'pulseIndicator 2s ease-in-out infinite'
              },
              '@keyframes pulseIndicator': {
                '0%, 100%': { opacity: 0.3 },
                '50%': { opacity: 0.7 }
              }
            }}
            ref={(el: HTMLDivElement | null) => {
              if (el) {
                // Show indicator only when content is overflowing
                setTimeout(() => {
                  el.style.opacity = isContentOverflowing ? '1' : '0';
                }, 150);
              }
            }}
          />
        </Box>
      ) : (
        // Empty state content
        <Box sx={{
          backgroundColor: alpha(theme.palette.background.default, 0.5),
          p: 1,
          borderRadius: 1.5, 
          flex: 1,
          pb: 3,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: 2
        }}>
          <Box sx={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            mt: 1,
            backgroundColor: alpha(theme.palette.primary.main, 0.1),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.palette.primary.main, 
          }}>
            <NoteAddIcon sx={{ fontSize: '2rem' }} />
          </Box>
          <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.primary' }}>
            No notes for {format(new Date(), 'EEEE')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: '80%' }}>
            Add notes about market conditions, your trading mindset, or lessons learned for today.
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default DayNoteCard;
