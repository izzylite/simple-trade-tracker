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
            boxShadow: theme.shadows[4],
            border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
            p: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            transition: 'opacity 0.3s ease-in-out',
            opacity: isVisible ? 1 : 0,
            visibility: isVisible ? 'visible' : 'hidden',
            pointerEvents: isVisible ? 'auto' : 'none'
          }}
        >
          <IconButton
            onClick={onPrevMonth}
            size="small"
            sx={{
              color: 'text.secondary',
              '&:hover': {
                color: 'primary.main',
                bgcolor: alpha(theme.palette.primary.main, 0.08)
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
              borderRadius: 1,
              px: 1,
              py: 0.5,
              '&:hover': {
                color: 'primary.main',
                bgcolor: alpha(theme.palette.primary.main, 0.05)
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
              '&:hover': {
                color: 'primary.main',
                bgcolor: alpha(theme.palette.primary.main, 0.08)
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
