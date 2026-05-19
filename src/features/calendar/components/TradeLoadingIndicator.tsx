import React, { useEffect, useState } from 'react';
import { Box, Fade, useTheme } from '@mui/material';
import CompareBar from 'components/common/CompareBar';

interface TradeLoadingIndicatorProps {
  isLoading: boolean;
  calendarName?: string;
  action?: 'loading' | 'importing' | 'exporting' | 'updating_tags';
}

const TradeLoadingIndicator: React.FC<TradeLoadingIndicatorProps> = ({ isLoading, calendarName, action = 'loading' }) => {
  const theme = useTheme();
  const [loadingText, setLoadingText] = useState<string>('Loading trades...');
  const [dots, setDots] = useState(0);
  // Indeterminate-style sweep: animate a 0→100 percent on a 1.2s loop.
  const [sweep, setSweep] = useState(0);

  // Animate the loading text with dots
  useEffect(() => {
    if (!isLoading) return;

    const interval = setInterval(() => {
      setDots(prev => (prev + 1) % 4);
    }, 500);

    return () => clearInterval(interval);
  }, [isLoading]);

  // Drive the sweep value (replaces the MUI indeterminate LinearProgress).
  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      setSweep(prev => (prev + 8) % 100);
    }, 60);
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
          bgcolor: 'background.paper',
          boxShadow: theme.shadows[3],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box sx={{ flexGrow: 1, maxWidth: '100%' }}>
          <CompareBar
            value={sweep}
            pct
            color={theme.palette.primary.main}
            height={4}
            sx={{ borderRadius: 0 }}
          />
        </Box>
      </Box>
    </Fade>
  );
};

export default TradeLoadingIndicator;
