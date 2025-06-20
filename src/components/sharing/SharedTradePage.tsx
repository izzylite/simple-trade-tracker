import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Toolbar,
  Alert,
  ThemeProvider,
  CssBaseline
} from '@mui/material';
import { createTheme } from '@mui/material/styles';
import { createAppTheme } from '../../theme';
import SharedTradeView from './SharedTradeView';
import AppHeader from '../common/AppHeader';

const SharedTradePage: React.FC = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  // Check if we came from a referrer (link click)
  const referrerState = location.state as { referrer?: string; referrerCalendarId?: string } | null;

  // Local theme mode state for shared trade page
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    // Get saved theme preference or default to light
    const savedMode = localStorage.getItem('themeMode');
    return (savedMode as 'light' | 'dark') || 'light';
  });

  // Update theme mode in localStorage when it changes
  useEffect(() => {
    localStorage.setItem('themeMode', mode);
  }, [mode]);

  const handleToggleTheme = () => {
    setMode(prevMode => prevMode === 'light' ? 'dark' : 'light');
  };

  // Handle back navigation
  const handleBackClick = () => {
    if (referrerState?.referrer) {
      navigate(referrerState.referrer);
    } else {
      navigate('/');
    }
  };

  // Create theme based on current mode
  const theme = useMemo(() => createTheme(createAppTheme(mode)), [mode]);

  if (!shareId) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ minHeight: '100vh', backgroundColor: 'custom.pageBackground' }}>
          <AppHeader
            onToggleTheme={handleToggleTheme}
            mode={mode}
            title="📈 Trade Tracker - Shared Trade"
            showBackButton={!!referrerState?.referrer}
            onBackClick={handleBackClick}
          />
          <Toolbar />

          <Container
            maxWidth="md"
            sx={{
              pt: { xs: 2, sm: 4 },
              pb: { xs: 2, sm: 4 },
              px: { xs: 1, sm: 3 }
            }}
          >
            <Alert severity="error">
              Invalid share link
            </Alert>
          </Container>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', backgroundColor: 'custom.pageBackground' }}>
        <AppHeader
          onToggleTheme={handleToggleTheme}
          mode={mode}
          title="📈 Trade Tracker - Shared Trade"
          showBackButton={!!referrerState?.referrer}
          onBackClick={handleBackClick}
        />
        <Toolbar />

        <Container
          maxWidth="md"
          sx={{
            pt: { xs: 2, sm: 4 }, // Less top padding on mobile
            pb: { xs: 2, sm: 4 }, // Less bottom padding on mobile
            px: { xs: 1, sm: 3 }  // Less horizontal padding on mobile
          }}
        >
          <SharedTradeView shareId={shareId} />
        </Container>
      </Box>
    </ThemeProvider>
  );
};

export default SharedTradePage;
