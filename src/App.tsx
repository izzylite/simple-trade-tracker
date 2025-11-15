import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box, useMediaQuery } from '@mui/material';
import { createTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { v4 as uuidv4 } from 'uuid';
import { Trade, Calendar } from './types/dualWrite';
import { AuthProvider, useAuth } from './contexts/SupabaseAuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import * as calendarService from './services/calendarService';
import { createAppTheme } from './theme';
import TradeLoadingIndicator from './components/TradeLoadingIndicator';
import { useRealtimeSubscription } from './hooks/useRealtimeSubscription';
import { useCalendars } from './hooks/useCalendars';
import { logger } from './utils/logger';
import { supabaseAuthService } from './services/supabaseAuthService';


import AppLoadingProgress from './components/AppLoadingProgress';


import SideNavigation from './components/common/SideNavigation';
import AppHeader from './components/common/AppHeader';

// Lazy load page components from pages directory
const Home = lazy(() => import('./pages/HomePage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const CalendarHome = lazy(() => import('./pages/CalendarHomePage').then(module => ({ default: module.CalendarHome })));
const TradeCalendar = lazy(() => import('./pages/TradeCalendarPage').then(module => ({ default: module.TradeCalendar })));
const SharedTradePage = lazy(() => import('./pages/SharedTradePage'));
const SharedCalendarPage = lazy(() => import('./pages/SharedCalendarPage'));
const AuthCallback = lazy(() => import('./pages/AuthCallbackPage'));
const PasswordResetPage = lazy(() => import('./pages/PasswordResetPage'));
const NotesPage = lazy(() => import('./pages/NotesPage'));
const NoteEditorPage = lazy(() => import('./pages/NoteEditorPage'));
const CommunityPage = lazy(() => import('./pages/CommunityPage'));
// const SupabaseAuthTest = lazy(() => import('./components/auth/SupabaseAuthTest')); // Commented out - for testing only


// Loading component for Suspense
const LoadingFallback = () => <AppLoadingProgress />;

/**
 * Shared interface for calendar management props
 * Used by HomePage and CalendarHomePage
 */
export interface CalendarManagementProps {
  calendars: Calendar[];
  onCreateCalendar: (
    name: string,
    account_balance: number,
    max_daily_drawdown: number,
    weeklyTarget?: number,
    monthlyTarget?: number,
    yearlyTarget?: number,
    riskPerTrade?: number,
    dynamic_risk_enabled?: boolean,
    increased_risk_percentage?: number,
    profit_threshold_percentage?: number,
    heroImageUrl?: string,
    heroImageAttribution?: any,
    heroImagePosition?: string
  ) => void;
  onDuplicateCalendar: (sourceCalendarId: string, newName: string, includeContent?: boolean) => void;
  onDeleteCalendar: (id: string) => void;
  onUpdateCalendar: (id: string, updates: Partial<Calendar>) => void;
  onToggleTheme: () => void;
  mode: 'light' | 'dark';
  onMenuClick: () => void;
  isLoading?: boolean;
}

function AppContent() {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  // Initialize theme from localStorage or system preference
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    const savedMode = localStorage.getItem('themeMode');
    return savedMode ? (savedMode as 'light' | 'dark') : (prefersDarkMode ? 'dark' : 'light');
  });

  const [isLoadingTrades, setIsLoadingTrades] = useState<boolean>(false); 
  const [loadingAction, setLoadingAction] = useState<'loading' | 'importing' | 'exporting'>('loading');
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Navigation drawer collapsed state - persist in localStorage
  const [navCollapsed, setNavCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('navCollapsed');
    return saved ? JSON.parse(saved) : false;
  });

  const { user } = useAuth();

  // Save navigation collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem('navCollapsed', JSON.stringify(navCollapsed));
  }, [navCollapsed]);

  // Use SWR to fetch calendars with automatic focus revalidation
  // This solves the Chrome Energy Saver tab freezing issue
  const {
    calendars: swrCalendars,
    isLoading: isLoadingCalendars,
    refresh: refreshCalendars,
  } = useCalendars(user?.uid, {
    revalidateOnFocus: true, // Auto-refetch when tab regains focus
  });

  // Local state for calendars to allow updates (like adding trades)
  const [calendars, setCalendars] = useState<Calendar[]>([]);

  // Sync SWR data to local state when it changes
  // Only update if we actually received data from SWR
  useEffect(() => {
    if (swrCalendars !== undefined) {
      setCalendars(swrCalendars);
    }
  }, [swrCalendars]);


   

  const theme = useMemo(() => createTheme(createAppTheme(mode)), [mode]);

  const handleCreateCalendar = async (name: string, account_balance: number, max_daily_drawdown: number, weekly_target?: number, monthly_target?: number, yearly_target?: number, risk_per_trade?: number, dynamic_risk_enabled?: boolean, increased_risk_percentage?: number, profit_threshold_percentage?: number, heroImageUrl?: string, heroImageAttribution?: any) => {
    if (!user) return;

    const newCalendar: Omit<Calendar, 'id' | 'user_id'> = {
      name,
      created_at: new Date(),
      updated_at: new Date(),
      account_balance,
      max_daily_drawdown,
      weekly_target,
      monthly_target,
      yearly_target,
      risk_per_trade,
      dynamic_risk_enabled,
      increased_risk_percentage,
      profit_threshold_percentage,
      hero_image_url: heroImageUrl,
      hero_image_attribution: heroImageAttribution
    };

    try {
      await calendarService.createCalendar(user.uid, newCalendar);
      // Refresh calendars from database to get properly sorted list (by updated_at desc)
      await refreshCalendars();
    } catch (error) {
      console.error('Error creating calendar:', error);
    }
  };

  const handleDuplicateCalendar = async (sourceCalendarId: string, newName: string, includeContent: boolean = false) => {
    if (!user) return;

    try {
      await calendarService.duplicateCalendar(user.uid, sourceCalendarId, newName, includeContent);
      // Refresh calendars from database to get properly sorted list (by updated_at desc)
      await refreshCalendars();
    } catch (error) {
      console.error('Error duplicating calendar:', error);
    }
  };

  const handleDeleteCalendar = async (id: string) => {
    try {
      if (!user) return;
      await calendarService.deleteCalendar(id, user.uid);
      setCalendars(prev => prev.filter(cal => cal.id !== id));
    } catch (error) {
      console.error('Error deleting calendar:', error);
    }
  };

  const handleUpdateCalendar = async (id: string, updates: Partial<Calendar>) => {
    try {
      const updatedCalendar = await calendarService.updateCalendar(id, updates);
      setCalendars(prev => {
        const updated = prev.map(cal =>
          cal.id === id
            ? { ...cal, ...updatedCalendar, updated_at: new Date() }
            : cal
        );
        // Re-sort by updated_at descending to match database order
        return updated.sort((a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
      });
    } catch (error) {
      console.error('Error updating calendar:', error);
    }
  };

  const setLoading = (
    loading: boolean,
    loadingAction: 'loading' | 'importing' | 'exporting' = "loading"
  ) => {
    if (!loading) {
      setIsLoadingTrades(false);
      setLoadingAction('loading'); // Reset to default action
    } else {
      setIsLoadingTrades(true);
      setLoadingAction(loadingAction);
    }
  }

  const toggleColorMode = () => {
    setMode(prevMode => {
      const newMode = prevMode === 'light' ? 'dark' : 'light';
      // Save theme preference to localStorage
      localStorage.setItem('themeMode', newMode);
      return newMode;
    });
  };





  

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        {/* App Header */}
        <AppHeader
          onToggleTheme={toggleColorMode}
          mode={mode}
          onMenuClick={() => setDrawerOpen(true)}
        />

        {/* Side Navigation */}
        <SideNavigation
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          collapsed={navCollapsed}
          onToggleCollapse={() => setNavCollapsed(!navCollapsed)}
        />

        {/* Main Content */}
        <Box
          sx={{
            flexGrow: 1,
            minHeight: '100vh',
            bgcolor: 'custom.pageBackground',
            position: 'relative',
            pb: 4,
            pt: 8, // Add top padding to account for fixed AppBar
            transition: theme.transitions.create(['margin', 'width'], {
              duration: theme.transitions.duration.shorter,
            })
          }}
        >
          <TradeLoadingIndicator
            isLoading={isLoadingTrades} 
            action={loadingAction}
          />
          <Routes>
            <Route path="/about" element={<AboutPage />} />
            <Route
              path="/"
              element={
                <Home
                  calendars={calendars}
                  onToggleTheme={toggleColorMode}
                  mode={mode}
                  isLoading={isLoadingCalendars}
                  onCreateCalendar={handleCreateCalendar}
                  onDuplicateCalendar={handleDuplicateCalendar}
                  onDeleteCalendar={handleDeleteCalendar}
                  onUpdateCalendar={handleUpdateCalendar}
                  onMenuClick={() => setDrawerOpen(true)}
                />
              }
            />
            <Route
              path="/calendars"
              element={
                <ProtectedRoute
                  title="Access Your Calendars"
                  subtitle="Sign in to view and manage your trading calendars"
                >
                  <CalendarHome
                    calendars={calendars}
                    onCreateCalendar={handleCreateCalendar}
                    onDuplicateCalendar={handleDuplicateCalendar}
                    onDeleteCalendar={handleDeleteCalendar}
                    onUpdateCalendar={handleUpdateCalendar}
                    onToggleTheme={toggleColorMode}
                    mode={mode}
                    isLoading={isLoadingCalendars}
                    onMenuClick={() => setDrawerOpen(true)}
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/calendar/:calendarId"
              element={
                <ProtectedRoute
                  title="Access Your Trading Calendar"
                  subtitle="Sign in to view and manage your trades"
                >
                  <CalendarRoute
                    calendars={calendars}
                    onToggleTheme={toggleColorMode}
                    mode={mode}
                    setLoading={setLoading}
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/shared/:shareId"
              element={<SharedTradePage />}
            />
            <Route
              path="/shared-calendar/:shareId"
              element={<SharedCalendarPage />}
            />
            <Route
              path="/auth/callback"
              element={<AuthCallback />}
            />
            <Route
              path="/auth/reset-password"
              element={<PasswordResetPage />}
            />
            <Route
              path="/notes"
              element={
                <ProtectedRoute
                  title="Access Trading Notes"
                  subtitle="Sign in to create and manage your trading notes"
                >
                  <NotesPage
                    onToggleTheme={toggleColorMode}
                    mode={mode}
                    onMenuClick={() => setDrawerOpen(true)}
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notes/:noteId"
              element={
                <ProtectedRoute
                  title="Edit Note"
                  subtitle="Sign in to edit your note"
                >
                  <NoteEditorPage
                    onToggleTheme={toggleColorMode}
                    mode={mode}
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/community"
              element={
                <ProtectedRoute
                  title="Join the Trading Community"
                  subtitle="Sign in to connect with other traders and share insights"
                >
                  <CommunityPage
                    onToggleTheme={toggleColorMode}
                    mode={mode}
                    onMenuClick={() => setDrawerOpen(true)}
                  />
                </ProtectedRoute>
              }
            />
            {/* Commented out - for testing only */}
            {/* <Route
            path="/auth-test"
            element={<SupabaseAuthTest />}
          /> */}

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Router>
          <Suspense fallback={<LoadingFallback />}>
            <AppContent />
          </Suspense>
        </Router>
      </LocalizationProvider>
    </AuthProvider>
  );
}

interface CalendarRouteProps {
  calendars: Calendar[];
  onToggleTheme: () => void;
  mode: 'light' | 'dark';
  setLoading: (loading: boolean, loadingAction?: "loading" | "importing" | "exporting") => void;
}

const CalendarRoute: React.FC<CalendarRouteProps> = ({
  calendars,
  onToggleTheme,
  mode,
  setLoading,
}) => {
  const { calendarId } = useParams<{ calendarId: string }>();
  const calendar = calendars.find((c: Calendar) => c.id === calendarId);

  // Scroll to top whenever navigating to a calendar page
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [calendarId]);

  if (!calendar) {
    return <Navigate to="/" replace />;
  }

  return (
    <TradeCalendar
      calendar={calendar}
      setLoading={setLoading}
      onToggleTheme={onToggleTheme}
      mode={mode}
    />
  );
};

export default App;
