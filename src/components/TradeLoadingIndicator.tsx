import React, { useEffect, useState } from 'react';
import { LinearProgress, Box, Typography, Fade, useTheme, alpha } from '@mui/material';
import { CloudDownload, FileUpload, FileDownload } from '@mui/icons-material';

interface TradeLoadingIndicatorProps {
  isLoading: boolean;
  calendarName?: string;
  action?: 'loading' | 'importing' | 'exporting' | 'updating_tags';
}

const TradeLoadingIndicator: React.FC<TradeLoadingIndicatorProps> = ({ isLoading, calendarName, action = 'loading' }) => {
  const theme = useTheme();
  const [loadingText, setLoadingText] = useState<string>('Loading trades...');
  const [dots, setDots] = useState(0);

  // Animate the loading text with dots
  useEffect(() => {
    if (!isLoading) return;

    const interval = setInterval(() => {
      setDots(prev => (prev + 1) % 4);
    }, 500);

    return () => clearInterval(interval);
  }, [isLoading]);

  // Update the loading text with animated dots
  useEffect(() => {
    let baseText;

    switch (action) {
      case 'importing':
        baseText = calendarName
          ? `Importing trades for "${calendarName}"`
          : 'Importing trades';
        break;
      case 'exporting':
        baseText = calendarName
          ? `Exporting trades from "${calendarName}"`
          : 'Exporting trades';
        break;
      case 'updating_tags':
        baseText = calendarName
          ? `Updating tags for "${calendarName}"`
          : 'Updating tags';
        break;
      default: // 'loading'
        baseText = calendarName
          ? `Loading trades for "${calendarName}"`
          : 'Loading trades';
    }

    setLoadingText(`${baseText}${'.'.repeat(dots)}`);
  }, [dots, calendarName, action]);

  if (!isLoading) return null;
 

  return (
    <Fade in={isLoading} timeout={300}>
      <Box
        sx={{
          position: 'fixed',
          top: 64, // Height of AppBar
          left: 0,
          right: 0,
          zIndex: 1100,
          bgcolor: alpha(theme.palette.background.paper, 0.95), // Slightly transparent background
          boxShadow: 3, // Add a shadow for depth
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(4px)',
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          '@keyframes pulse': {
            '0%': { opacity: 0.6, transform: 'scale(0.95)' },
            '50%': { opacity: 1, transform: 'scale(1.05)' },
            '100%': { opacity: 0.6, transform: 'scale(0.95)' },
          },
        }}
      > 

        <Box sx={{ flexGrow: 1, maxWidth: '100%' }}>
          

          <LinearProgress
            sx={{
              height: 4, 
              backgroundColor: alpha(theme.palette.primary.main, 0.15),
              '& .MuiLinearProgress-bar': {
                borderRadius: 3,
              }
            }}
          />
        </Box>
      </Box>
    </Fade>
  );
};

export default TradeLoadingIndicator;
