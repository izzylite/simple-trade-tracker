/**
 * Economic Event Notification Slider
 * Shows a sliding notification when economic events are updated
 */

import React, { useState, useEffect } from 'react';
import {
  Slide,
  Paper,
  Typography,
  Box,
  Chip,
  IconButton,
  useTheme
} from '@mui/material';
import {
  Close as CloseIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Remove as NeutralIcon
} from '@mui/icons-material';
import { EconomicEvent } from '../../types/economicCalendar';

interface EconomicEventNotificationProps {
  event: EconomicEvent | null;
  onClose: () => void;
  autoHideDuration?: number; // Duration in milliseconds
}

const EconomicEventNotification: React.FC<EconomicEventNotificationProps> = ({
  event,
  onClose,
  autoHideDuration = 5000 // 5 seconds default
}) => {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (event) {
      setOpen(true);
      
      // Auto-hide after specified duration
      const timer = setTimeout(() => {
        handleClose();
      }, autoHideDuration);

      return () => clearTimeout(timer);
    }
  }, [event, autoHideDuration]);

  const handleClose = () => {
    setOpen(false);
    // Wait for slide animation to complete before calling onClose
    setTimeout(() => {
      onClose();
    }, 300);
  };

  if (!event) return null;

  // Determine impact color
  const getImpactColor = (impact: string) => {
    switch (impact.toLowerCase()) {
      case 'high': return theme.palette.error.main;
      case 'medium': return theme.palette.warning.main;
      case 'low': return theme.palette.info.main;
      default: return theme.palette.grey[500];
    }
  };

  // Determine trend icon and color based on actual vs forecast
  const getTrendInfo = () => {
    if (!event.actual || !event.forecast) {
      return { icon: <NeutralIcon />, color: theme.palette.grey[500], text: 'Updated' };
    }

    const actual = parseFloat(event.actual.replace(/[^\d.-]/g, ''));
    const forecast = parseFloat(event.forecast.replace(/[^\d.-]/g, ''));

    if (isNaN(actual) || isNaN(forecast)) {
      return { icon: <NeutralIcon />, color: theme.palette.grey[500], text: 'Updated' };
    }

    if (actual > forecast) {
      return { icon: <TrendingUpIcon />, color: theme.palette.success.main, text: 'Above Forecast' };
    } else if (actual < forecast) {
      return { icon: <TrendingDownIcon />, color: theme.palette.error.main, text: 'Below Forecast' };
    } else {
      return { icon: <NeutralIcon />, color: theme.palette.info.main, text: 'As Expected' };
    }
  };

  const trendInfo = getTrendInfo();

  return (
    <Slide direction="left" in={open} mountOnEnter unmountOnExit>
      <Paper
        elevation={8}
        sx={{
          position: 'fixed',
          top: 80,
          right: 16,
          width: 400,
          maxWidth: 'calc(100vw - 32px)',
          zIndex: theme.zIndex.snackbar,
          borderRadius: 2,
          overflow: 'hidden',
          background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`,
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        {/* Header */}
        <Box
          sx={{
            background: `linear-gradient(90deg, ${getImpactColor(event.impact)} 0%, ${getImpactColor(event.impact)}80 100%)`,
            color: 'white',
            p: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {trendInfo.icon}
            <Typography variant="subtitle2" fontWeight="bold">
              Economic Event Updated
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={handleClose}
            sx={{ color: 'white', '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' } }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ p: 2 }}>
          {/* Event Name and Currency */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Chip
              label={event.currency}
              size="small"
              sx={{
                backgroundColor: getImpactColor(event.impact),
                color: 'white',
                fontWeight: 'bold'
              }}
            />
            <Typography variant="body1" fontWeight="medium" sx={{ flex: 1 }}>
              {event.event}
            </Typography>
          </Box>

          {/* Data Values */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {event.actual && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  Actual:
                </Typography>
                <Typography variant="body2" fontWeight="bold" color={trendInfo.color}>
                  {event.actual}
                </Typography>
              </Box>
            )}
            
            {event.forecast && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  Forecast:
                </Typography>
                <Typography variant="body2">
                  {event.forecast}
                </Typography>
              </Box>
            )}
            
            {event.previous && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  Previous:
                </Typography>
                <Typography variant="body2">
                  {event.previous}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Trend Status */}
          <Box
            sx={{
              mt: 1.5,
              p: 1,
              borderRadius: 1,
              backgroundColor: `${trendInfo.color}15`,
              border: `1px solid ${trendInfo.color}30`,
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            {trendInfo.icon}
            <Typography variant="caption" color={trendInfo.color} fontWeight="medium">
              {trendInfo.text}
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Slide>
  );
};

export default EconomicEventNotification;
