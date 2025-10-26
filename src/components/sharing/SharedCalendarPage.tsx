import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Toolbar,
  Alert,
  ThemeProvider,
  CssBaseline,
  CircularProgress,
  Typography
} from '@mui/material';
import { createTheme } from '@mui/material/styles';
import { createAppTheme } from '../../theme';
import { TradeCalendar } from '../TradeCalendar';
import AppHeader from '../common/AppHeader';
import { getSharedTradesWithCalendar } from '../../services/sharingService';
import { Trade, Calendar } from '../../types/dualWrite';
import { logger } from '../../utils/logger';

interface SharedCalendarData {
  calendar: Calendar;
  trades: Trade[];
  shareInfo: {
    id: string;
    createdAt: Date;
    viewCount: number;
    userId: string;
  };
}

const SharedCalendarPage: React.FC = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  // Check if we came from a referrer (link click)
  const referrerState = location.state as { referrer?: string; referrerCalendarId?: string } | null;

  // Local theme mode state for shared calendar page
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    // Get saved theme preference or default to light
    const savedMode = localStorage.getItem('themeMode');
    return (savedMode as 'light' | 'dark') || 'light';
  });

  const [calendarData, setCalendarData] = useState<SharedCalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    const fetchSharedCalendar = async () => {
      if (!shareId) {
        setError('Invalid share link');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const data = await getSharedTradesWithCalendar(shareId);

        // Data is already in the correct format from the service
        const calendar: Calendar = data.calendar;
        const trades: Trade[] = data.trades;

        const shareInfo = {
          ...data.shareInfo,
          createdAt: new Date(data.shareInfo.createdAt)
        };

        setCalendarData({
          calendar,
          trades,
          shareInfo
        });

        // Update document title
        document.title = `${calendar.name} - Shared Calendar | Trade Tracker`;

      } catch (error: any) {
        logger.error('Error fetching shared calendar:', error);

        if (error.code === 'functions/not-found') {
          setError('This shared calendar could not be found. It may have been removed or the link is invalid.');
        } else if (error.code === 'functions/permission-denied') {
          setError('This shared calendar is no longer available.');
        } else {
          setError('Failed to load shared calendar. Please try again later.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchSharedCalendar();
  }, [shareId]);

  if (!shareId) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ minHeight: '100vh', backgroundColor: 'custom.pageBackground' }}>
          <AppHeader
            onToggleTheme={handleToggleTheme}
            mode={mode}
            title="📈 Trade Tracker - Shared Calendar"
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

  if (loading) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ minHeight: '100vh', backgroundColor: 'custom.pageBackground' }}>
          <AppHeader
            onToggleTheme={handleToggleTheme}
            mode={mode}
            title="📈 Trade Tracker - Shared Calendar"
            showBackButton={!!referrerState?.referrer}
            onBackClick={handleBackClick}
          />
          <Toolbar />

          <Container
            maxWidth="md"
            sx={{
              pt: { xs: 2, sm: 4 },
              pb: { xs: 2, sm: 4 },
              px: { xs: 1, sm: 3 },
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '50vh'
            }}
          >
            <CircularProgress size={60} sx={{ mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Loading shared calendar...
            </Typography>
          </Container>
        </Box>
      </ThemeProvider>
    );
  }

  if (error) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ minHeight: '100vh', backgroundColor: 'custom.pageBackground' }}>
          <AppHeader
            onToggleTheme={handleToggleTheme}
            mode={mode}
            title="📈 Trade Tracker - Shared Calendar"
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
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                Calendar Not Found
              </Typography>
              <Typography variant="body2">
                {error}
              </Typography>
            </Alert>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 3 }}>
              If you believe this is an error, please contact the person who shared this calendar with you.
            </Typography>
          </Container>
        </Box>
      </ThemeProvider>
    );
  }

  if (!calendarData) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ minHeight: '100vh', backgroundColor: 'custom.pageBackground' }}>
          <AppHeader
            onToggleTheme={handleToggleTheme}
            mode={mode}
            title="📈 Trade Tracker - Shared Calendar"
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
            <Alert severity="warning">
              <Typography variant="h6" gutterBottom>
                No Calendar Data
              </Typography>
              <Typography variant="body2">
                The shared calendar data could not be loaded.
              </Typography>
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
          title={`${calendarData.calendar.name} - Shared Calendar`}
          showBackButton={!!referrerState?.referrer}
          onBackClick={handleBackClick}
        />
      

       

        {/* Calendar Content - Using TradeCalendar in read-only mode */}
        <TradeCalendar
          trades={calendarData.trades}
          title={`${calendarData.calendar.name} - Shared Calendar`}
          accountBalance={calendarData.calendar.account_balance}
          maxDailyDrawdown={calendarData.calendar.max_daily_drawdown}
          weeklyTarget={calendarData.calendar.weekly_target}
          monthly_target={calendarData.calendar.monthly_target}
          yearlyTarget={calendarData.calendar.yearly_target}
          dynamicRiskSettings={{
            account_balance: calendarData.calendar.account_balance,
            dynamic_risk_enabled: calendarData.calendar.dynamic_risk_enabled || false,
            risk_per_trade: calendarData.calendar.risk_per_trade || 0,
            increased_risk_percentage: calendarData.calendar.increased_risk_percentage || 0,
            profit_threshold_percentage: calendarData.calendar.profit_threshold_percentage || 0
          }}
          requiredTagGroups={calendarData.calendar.required_tag_groups}
          allTags={calendarData.calendar.tags}
          calendarName={calendarData.calendar.name}
          calendarNote={calendarData.calendar.note}
          heroImageUrl={calendarData.calendar.hero_image_url}
          heroImageAttribution={calendarData.calendar.hero_image_attribution}
          calendarDayNotes={calendarData.calendar.days_notes ? Object.entries(calendarData.calendar.days_notes).reduce((map, [k, v]) => map.set(k, v), new Map<string, string>()) : new Map<string, string>()}
          scoreSettings={calendarData.calendar.score_settings}
          onClearMonthTrades={() => { }} // No-op for read-only
          onToggleTheme={handleToggleTheme}
          mode={mode}
          totalPnL={calendarData.calendar.total_pnl}
          onAccountBalanceChange={() => { }} // No-op for read-only
          calendar={calendarData.calendar}
          isReadOnly={true} // Enable read-only mode for shared calendars
        />

        {/* Share Statistics */}
        <Container maxWidth="lg" sx={{ py: 2 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              This calendar has been viewed {calendarData.shareInfo.viewCount} time{calendarData.shareInfo.viewCount !== 1 ? 's' : ''}
            </Typography>
          </Box>
        </Container>
      </Box>
    </ThemeProvider>
  );
};

export default SharedCalendarPage;
