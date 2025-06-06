import React from 'react';
import {
  Box,
  IconButton,
  Typography,
  useTheme,
  alpha
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight
} from '@mui/icons-material';
import { format } from 'date-fns';

interface FloatingMonthNavigationProps {
  currentDate: Date;
  isVisible: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onMonthClick: () => void;
}

const FloatingMonthNavigation: React.FC<FloatingMonthNavigationProps> = ({
  currentDate,
  isVisible,
  onPrevMonth,
  onNextMonth,
  onMonthClick
}) => {
  const theme = useTheme();

  return (
    <>
      {isVisible && (
        <Box
          sx={{
            position: 'fixed',
            top: 80,
            right: 20,
            zIndex: 1200,
            backgroundColor: alpha(theme.palette.background.paper, 0.95),
            backdropFilter: 'blur(8px)',
            borderRadius: 3,
            boxShadow: theme.shadows[8],
            border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
            p: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: isVisible
              ? 'translateY(0) translateX(0) scale(1)'
              : 'translateY(-30px) translateX(20px) scale(0.8)',
            opacity: isVisible ? 1 : 0,
            visibility: isVisible ? 'visible' : 'hidden',
            pointerEvents: isVisible ? 'auto' : 'none',
            // Add subtle entrance animation
            animation: isVisible
              ? 'slideInFromTopRight 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards'
              : 'slideOutToTopRight 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards',
            '@keyframes slideInFromTopRight': {
              '0%': {
                transform: 'translateY(-40px) translateX(30px) scale(0.7)',
                opacity: 0,
                filter: 'blur(4px)'
              },
              '60%': {
                transform: 'translateY(-5px) translateX(-2px) scale(1.05)',
                opacity: 0.8,
                filter: 'blur(1px)'
              },
              '100%': {
                transform: 'translateY(0) translateX(0) scale(1)',
                opacity: 1,
                filter: 'blur(0px)'
              }
            },
            '@keyframes slideOutToTopRight': {
              '0%': {
                transform: 'translateY(0) translateX(0) scale(1)',
                opacity: 1,
                filter: 'blur(0px)'
              },
              '100%': {
                transform: 'translateY(-30px) translateX(20px) scale(0.8)',
                opacity: 0,
                filter: 'blur(2px)'
              }
            },
            // Add hover animation
            '&:hover': {
              transform: isVisible
                ? 'translateY(-2px) translateX(0) scale(1.02)'
                : 'translateY(-30px) translateX(20px) scale(0.8)',
              boxShadow: isVisible ? theme.shadows[12] : theme.shadows[8],
              transition: 'all 0.2s ease-out'
            }
          }}
        >
          <IconButton
            onClick={onPrevMonth}
            size="small"
            sx={{
              color: 'text.secondary',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                color: 'primary.main',
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                transform: 'scale(1.1)'
              },
              '&:active': {
                transform: 'scale(0.95)'
              }
            }}
          >
            <ChevronLeft />
          </IconButton>
          <Typography
            variant="body1"
            sx={{
              fontWeight: 600,
              cursor: 'pointer',
              minWidth: '140px',
              textAlign: 'center',
              fontSize: '0.95rem',
              color: 'text.primary',
              transition: 'all 0.2s ease-in-out',
              borderRadius: 1,
              px: 1,
              py: 0.5,
              '&:hover': {
                color: 'primary.main',
                bgcolor: alpha(theme.palette.primary.main, 0.05),
                transform: 'scale(1.02)'
              },
              '&:active': {
                transform: 'scale(0.98)'
              }
            }}
            onClick={onMonthClick}
          >
            {format(currentDate, 'MMM yyyy')}
          </Typography>
          <IconButton
            onClick={onNextMonth}
            size="small"
            sx={{
              color: 'text.secondary',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                color: 'primary.main',
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                transform: 'scale(1.1)'
              },
              '&:active': {
                transform: 'scale(0.95)'
              }
            }}
          >
            <ChevronRight />
          </IconButton>
        </Box>
      )}
    </>
  );
};

export default FloatingMonthNavigation;
