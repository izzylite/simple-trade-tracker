import React, { useState, useEffect } from 'react';
import {
  Box,
  IconButton,
  Typography,
  useTheme,
  alpha,
  Chip,
  Fade,
  Slide,
  Tooltip
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  CalendarMonth,
  Today,
  KeyboardArrowDown
} from '@mui/icons-material';
import { format, isToday } from 'date-fns';

interface FloatingMonthNavigationProps {
  currentDate: Date;
  isVisible: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onMonthClick: () => void;
  onTodayClick?: () => void;
}

const FloatingMonthNavigation: React.FC<FloatingMonthNavigationProps> = ({
  currentDate,
  isVisible,
  onPrevMonth,
  onNextMonth,
  onMonthClick,
}) => {
  const theme = useTheme();
  const isCurrentMonth = isToday(currentDate);

  // Hide nav when the page is within the top 20% scroll
  const [hideByTopScroll, setHideByTopScroll] = useState(false);
  useEffect(() => {
    const update = () => {
      const doc = document.documentElement;
      const scrollable = Math.max(0, doc.scrollHeight - window.innerHeight);
      if (scrollable <= 0) {
        // No scrollable area: treat as top to keep nav hidden per requirement
        setHideByTopScroll(true);
        return;
      }
      const progress = Math.max(0, Math.min(1, window.scrollY / scrollable));
      setHideByTopScroll(progress <= 0.2);
    };
    update();
    window.addEventListener('scroll', update, { passive: true } as any);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update as any);
      window.removeEventListener('resize', update);
    };
  }, []);

  const finalVisible = isVisible && !hideByTopScroll;

  return (
    <Slide direction="left" in={finalVisible} mountOnEnter unmountOnExit>
      <Box
        sx={{
          position: 'fixed',
          top: { xs: 80, sm: 88 },
          right: { xs: 16, sm: 24 },
          zIndex: 1300,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 1
        }}
      >
        {/* Main Navigation Pill */}
        <Box
          sx={{
            backgroundColor: alpha(theme.palette.background.paper, 0.95),
            backdropFilter: 'blur(20px)',
            borderRadius: '24px',
            boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.12)}`,
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            p: 0.5,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: finalVisible ? 'translateY(0)' : 'translateY(-10px)',
            opacity: finalVisible ? 1 : 0,
            '&:hover': {
              boxShadow: `0 12px 40px ${alpha(theme.palette.common.black, 0.15)}`,
              transform: 'translateY(-2px)'
            }
          }}
        >
          {/* Previous Month Button */}
          <Tooltip title="Previous month" placement="bottom">
            <IconButton
              onClick={onPrevMonth}
              size="small"
              sx={{
                width: 36,
                height: 36,
                color: 'text.secondary',
                transition: 'all 0.2s ease',
                '&:hover': {
                  color: 'primary.main',
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  transform: 'scale(1.05)'
                }
              }}
            >
              <ChevronLeft fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* Month Display */}
          <Box
            onClick={onMonthClick}
            sx={{
              cursor: 'pointer',
              px: 2,
              py: 1,
              borderRadius: '16px',
              textAlign: 'center',
              transition: 'all 0.2s ease',
              position: 'relative',
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                transform: 'scale(1.02)'
              }
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700,
                fontSize: '0.9rem',
                color: 'text.primary',
                letterSpacing: '0.5px',
                lineHeight: 1.2
              }}
            >
              {format(currentDate, 'MMM')}


            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.75rem',
                color: 'text.secondary',
                fontWeight: 500,
                display: 'block',
                lineHeight: 1
              }}
            >
              {format(currentDate, 'yyyy')}
            </Typography>


          </Box>

          {/* Next Month Button */}
          <Tooltip title="Next month" placement="bottom">
            <IconButton
              onClick={onNextMonth}
              size="small"
              sx={{
                width: 36,
                height: 36,
                color: 'text.secondary',
                transition: 'all 0.2s ease',
                '&:hover': {
                  color: 'primary.main',
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  transform: 'scale(1.05)'
                }
              }}
            >
              <ChevronRight fontSize="small" />
            </IconButton>
          </Tooltip>


        </Box>


      </Box>
    </Slide>
  );
};

export default FloatingMonthNavigation;
