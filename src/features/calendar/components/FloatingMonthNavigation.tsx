import React, { useState, useEffect } from 'react';
import {
  Box,
  IconButton,
  Typography,
  useTheme,
  Fade,
  Tooltip
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
} from '@mui/icons-material';
import { format, isToday } from 'date-fns';
import { TNUM } from 'styles/designTokens';

interface FloatingMonthNavigationProps {
  currentDate: Date;
  isVisible: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onMonthClick: () => void;
  onTodayClick?: () => void;
  /** Scroll container ref — used for scroll progress detection when content scrolls inside a container instead of the window */
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

const FloatingMonthNavigation: React.FC<FloatingMonthNavigationProps> = ({
  currentDate,
  isVisible,
  onPrevMonth,
  onNextMonth,
  onMonthClick,
  scrollContainerRef,
}) => {
  const theme = useTheme();
  const isCurrentMonth = isToday(currentDate);

  // Hide nav when within the top 20% of scroll
  const [hideByTopScroll, setHideByTopScroll] = useState(false);
  useEffect(() => {
    const container = scrollContainerRef?.current;

    const update = () => {
      if (container) {
        const scrollable = Math.max(0, container.scrollHeight - container.clientHeight);
        if (scrollable <= 0) {
          setHideByTopScroll(true);
          return;
        }
        const progress = Math.max(0, Math.min(1, container.scrollTop / scrollable));
        setHideByTopScroll(progress <= 0.2);
      } else {
        const doc = document.documentElement;
        const scrollable = Math.max(0, doc.scrollHeight - window.innerHeight);
        if (scrollable <= 0) {
          setHideByTopScroll(true);
          return;
        }
        const progress = Math.max(0, Math.min(1, window.scrollY / scrollable));
        setHideByTopScroll(progress <= 0.2);
      }
    };

    const target = container || window;
    update();
    target.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      target.removeEventListener('scroll', update as any);
      window.removeEventListener('resize', update);
    };
  }, [scrollContainerRef]);

  // Track the right offset so the nav stays within the main content area
  // (not overlapping the side panel)
  const [rightOffset, setRightOffset] = useState(24);
  useEffect(() => {
    const container = scrollContainerRef?.current;
    const updateOffset = () => {
      if (container) {
        const rect = container.getBoundingClientRect();
        const viewportRight = window.innerWidth - rect.right;
        setRightOffset(viewportRight + 16);
      } else {
        setRightOffset(24);
      }
    };
    updateOffset();
    window.addEventListener('resize', updateOffset);

    // Observe container resize (panel open/close changes width)
    let observer: ResizeObserver | null = null;
    if (container) {
      observer = new ResizeObserver(updateOffset);
      observer.observe(container);
    }

    return () => {
      window.removeEventListener('resize', updateOffset);
      observer?.disconnect();
    };
  }, [scrollContainerRef]);

  const finalVisible = isVisible && !hideByTopScroll;

  // Floating element genuinely floats over the page — retain elevation via
  // theme.shadows[3] (no hardcoded alpha shadows).
  return (
    <Fade in={finalVisible} timeout={300} mountOnEnter unmountOnExit>
      <Box
        sx={{
          position: 'fixed',
          top: { xs: 80, sm: 88 },
          right: `${rightOffset}px`,
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
            bgcolor: 'background.paper',
            borderRadius: `${theme.palette.custom.radius.xxl}px`,
            boxShadow: theme.shadows[3],
            border: `1px solid ${theme.palette.divider}`,
            p: 0.5,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            transition: `transform 240ms ${theme.palette.custom.easing.smooth}, opacity 240ms ${theme.palette.custom.easing.smooth}`,
            transform: finalVisible ? 'translateY(0)' : 'translateY(-10px)',
            opacity: finalVisible ? 1 : 0,
          }}
        >
          {/* Previous Month Button */}
          <Tooltip title="Previous month" placement="bottom">
            <IconButton
              onClick={onPrevMonth}
              size="small"
              sx={{
                width: { xs: 40, sm: 36 },
                height: { xs: 40, sm: 36 },
                borderRadius: `${theme.palette.custom.radius.md}px`,
                color: 'text.secondary',
                transition: `background-color 150ms ${theme.palette.custom.easing.smooth}, color 150ms ${theme.palette.custom.easing.smooth}`,
                '&:hover': {
                  color: 'primary.main',
                  bgcolor: theme.palette.custom.tintViolet.soft,
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
              borderRadius: `${theme.palette.custom.radius.lg}px`,
              textAlign: 'center',
              transition: `background-color 150ms ${theme.palette.custom.easing.smooth}`,
              position: 'relative',
              '&:hover': {
                bgcolor: theme.palette.custom.tintViolet.soft,
              }
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700,
                fontSize: '0.9rem',
                color: 'text.primary',
                letterSpacing: '-0.01em',
                lineHeight: 1.2,
                fontFeatureSettings: TNUM,
              }}
            >
              {format(currentDate, 'MMM')}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.6875rem',
                color: 'text.tertiary',
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                display: 'block',
                lineHeight: 1,
                fontFeatureSettings: TNUM,
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
                width: { xs: 40, sm: 36 },
                height: { xs: 40, sm: 36 },
                borderRadius: `${theme.palette.custom.radius.md}px`,
                color: 'text.secondary',
                transition: `background-color 150ms ${theme.palette.custom.easing.smooth}, color 150ms ${theme.palette.custom.easing.smooth}`,
                '&:hover': {
                  color: 'primary.main',
                  bgcolor: theme.palette.custom.tintViolet.soft,
                }
              }}
            >
              <ChevronRight fontSize="small" />
            </IconButton>
          </Tooltip>


        </Box>


      </Box>
    </Fade>
  );
};

export default FloatingMonthNavigation;
