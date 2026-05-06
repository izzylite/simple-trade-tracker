import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box, useMediaQuery } from '@mui/material';
import { createTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { v4 as uuidv4 } from 'uuid';
import { Trade, Calendar } from './types/dualWrite';
import { AuthProvider } from './contexts/SupabaseAuthContext';
import { useAuthState, AuthStateProvider } from './contexts/AuthStateContext';
import { TradeSyncProvider } from './contexts/TradeSyncContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import * as calendarService from './services/calendarService';
import { createAppTheme } from './theme';
import TradeLoadingIndicator from './components/TradeLoadingIndicator';
import { useRealtimeSubscription } from './hooks/useRealtimeSubscription';
import { useCalendars } from './hooks/useCalendars';
import { logger } from './utils/logger';
import { supabaseAuthService } from './services/supabaseAuthService';


import AppLoadingProgress from './components/AppLoadingProgress';


import AppHeader from './components/common/AppHeader';
import AppLayout from './components/layout/AppLayout';
import CalendarFormDialog, { CalendarFormData } from './components/CalendarFormDialog';
import CalendarLockedOverlay from './components/calendars/CalendarLockedOverlay';

// Lazy load page components from pages directory
const LandingPage = lazy(() => import('./pages/LandingPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const TradeCalendar = lazy(() => import('./pages/TradeCalendarPage').then(module => ({ default: module.TradeCalendar })));
const SharedTradePage = lazy(() => import('./pages/SharedTradePage'));
const SharedCalendarPage = lazy(() => import('./pages/SharedCalendarPage'));
const SharedNotePage = lazy(
  () => import('./pages/SharedNotePage')
);
const AuthCallback = lazy(() => import('./pages/AuthCallbackPage'));
const PasswordResetPage = lazy(() => import('./pages/PasswordResetPage'));
const CommunityPage = lazy(() => import('./pages/CommunityPage'));
const PerformancePage = lazy(() => import('./pages/PerformancePage'));
const AssistantPage = lazy(() => import('./pages/AssistantPage'));
const NotesPage = lazy(() => import('./pages/NotesPage'));
// const SupabaseAuthTest = lazy(() => import('./components/auth/SupabaseAuthTest')); // Commented out - for testing only


// Loading component for Suspense
const LoadingFallback = () => <AppLoadingProgress />;

// Persists the last calendar the user opened so the / resolver can route
// them back to it across sessions. CalendarRoute writes; HomeRouteResolver
// reads.
const LAST_ACTIVE_CALENDAR_KEY = 'last_active_calendar_id';

function AppContent() {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  // Initialize theme from localStorage or system preference
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    const savedMode = localStorage.getItem('themeMode');
    return savedMode ? (savedMode as 'light' | 'dark') : 'dark';
  });

  const [isLoadingTrades, setIsLoadingTrades] = useState<boolean>(false);
  const [loadingAction, setLoadingAction] = useState<'loading' | 'importing' | 'exporting'>('loading');

  const { user } = useAuthState();
  const location = useLocation();
  const navigate = useNavigate();
  const isLandingPage = !user && location.pathname === '/';

  // Global Create Calendar dialog — triggered from side nav "+ New", lock
  // overlays, and any future entry point. Lifted to App.tsx so a single
  // dialog instance serves every route.
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreatingCalendar, setIsCreatingCalendar] = useState(false);

  const openCreateCalendarDialog = () => setIsCreateDialogOpen(true);

  const handleCreateCalendarSubmit = async (data: CalendarFormData) => {
    setIsCreatingCalendar(true);
    try {
      const newCalendar = await handleCreateCalendar(
        data.name,
        data.account_balance,
        data.max_daily_drawdown,
        data.weekly_target,
        data.monthly_target,
        data.yearly_target,
        data.risk_per_trade,
        data.dynamic_risk_enabled,
        data.increased_risk_percentage,
        data.profit_threshold_percentage,
        data.hero_image_url,
        data.hero_image_attribution
      );
      setIsCreateDialogOpen(false);
      navigate(`/calendar/${newCalendar.id}`);
    } catch (err) {
      logger.error('Error creating calendar from global dialog:', err);
    } finally {
      setIsCreatingCalendar(false);
    }
  };


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

  const handleCreateCalendar = async (name: string, account_balance: number, max_daily_drawdown: number,
     weekly_target?: number, monthly_target?: number, yearly_target?: number, 
     risk_per_trade?: number, dynamic_risk_enabled?: boolean, increased_risk_percentage?: number,
      profit_threshold_percentage?: number, heroImageUrl?: string, heroImageAttribution?: any) : Promise<Calendar> =>  {
    if (!user)  throw new Error('Failed to create calendar... user is undefined');

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
      const data = await calendarService.createCalendar(user.uid, newCalendar);
      // Refresh calendars from database to get properly sorted list (by updated_at desc)
      await refreshCalendars();
      return data;
    } catch (error) {
      console.error('Error creating calendar:', error);
      throw error;
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
        {/* App Header — hidden on landing page (has its own nav) */}
        {!isLandingPage && (
          <AppHeader
            onToggleTheme={toggleColorMode}
            mode={mode}
          />
        )}

        {/* Main Content */}
        <Box
          sx={{
            flexGrow: 1,
            minHeight: '100vh',
            bgcolor: isLandingPage ? '#000' : 'custom.pageBackground',
            position: 'relative',
            pb: isLandingPage ? 0 : 4,
            pt: isLandingPage ? 0 : 8, // Add top padding to account for fixed AppBar
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
            {/* Auth-gated routes share a persistent AppLayout via a layout
                route — AppLayout (and its SideNav) stay mounted across
                navigation between Home / Performance / Assistant / Notes,
                preventing the shell from blanking on each click. */}
            {user ? (
              <Route
                element={<AppLayout onNewCalendar={openCreateCalendarDialog} />}
              >
                <Route
                  path="/"
                  element={
                    <HomeRouteResolver
                      calendars={calendars}
                      isLoadingCalendars={isLoadingCalendars}
                      onCreateCalendar={openCreateCalendarDialog}
                    />
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
                        onDuplicateCalendar={handleDuplicateCalendar}
                        onDeleteCalendar={handleDeleteCalendar}
                        onUpdateCalendar={handleUpdateCalendar}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/performance"
                  element={
                    <ProtectedRoute
                      title="View Performance"
                      subtitle="Sign in to view your trading performance"
                    >
                      <PerformancePage
                        onUpdateCalendar={handleUpdateCalendar}
                        onCreateCalendar={openCreateCalendarDialog}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/assistant"
                  element={
                    <ProtectedRoute
                      title="Chat with Orion"
                      subtitle="Sign in to use the assistant"
                    >
                      <AssistantPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/notes"
                  element={
                    <ProtectedRoute
                      title="View Notes"
                      subtitle="Sign in to access your notes"
                    >
                      <NotesPage />
                    </ProtectedRoute>
                  }
                />
              </Route>
            ) : (
              <Route path="/" element={<LandingPage />} />
            )}
            <Route
              path="/shared/:shareId"
              element={<SharedTradePage />}
            />
            <Route
              path="/shared-calendar/:shareId"
              element={<SharedCalendarPage />}
            />
            <Route
              path="/shared-note/:shareId"
              element={<SharedNotePage />}
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
              path="/community"
              element={
                <ProtectedRoute
                  title="Join the Trading Community"
                  subtitle="Sign in to connect with other traders and share insights"
                >
                  <CommunityPage
                    onToggleTheme={toggleColorMode}
                    mode={mode}
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

      {/* Global Create Calendar dialog — opened by side nav "+ New" and any
          calendar lock overlay. Single instance shared across routes. */}
      {user && (
        <CalendarFormDialog
          open={isCreateDialogOpen}
          onClose={() => setIsCreateDialogOpen(false)}
          onSubmit={handleCreateCalendarSubmit}
          isSubmitting={isCreatingCalendar}
          mode="create"
          title="Create Calendar"
          submitButtonText="Create"
        />
      )}
    </ThemeProvider>
  );
}

// Scrolls to top when route changes
const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

interface HomeRouteResolverProps {
  calendars: Calendar[];
  isLoadingCalendars: boolean;
  onCreateCalendar: () => void;
}

/**
 * Auth landing for "/". Routes the user to the most appropriate calendar:
 *  - prefers the last calendar they opened (localStorage)
 *  - falls back to the most recently updated non-trashed calendar
 *  - if zero calendars exist, renders the AppLayout shell with the lock
 *    overlay so the user can create one without leaving "/"
 *
 * Phase 8 replaces the previous "/ -> HomePage" wiring; HomePage itself
 * goes away in phase 9.
 */
const HomeRouteResolver: React.FC<HomeRouteResolverProps> = ({
  calendars,
  isLoadingCalendars,
  onCreateCalendar,
}) => {
  const activeCalendars = useMemo(
    () => calendars.filter((c) => !c.deleted_at),
    [calendars]
  );

  // Wait until calendars actually arrive before deciding. Without this we'd
  // briefly render the lock overlay (or wrong-calendar redirect) on every
  // cold load.
  if (isLoadingCalendars && activeCalendars.length === 0) {
    return <LoadingFallback />;
  }

  if (activeCalendars.length === 0) {
    return (
      <Box sx={{ position: 'relative', minHeight: 'calc(100vh - 64px)' }}>
        <CalendarLockedOverlay
          onCreateCalendar={onCreateCalendar}
          subtitle="Create a calendar to start tracking trades. The Home, Performance and Assistant sections unlock once one exists."
        />
      </Box>
    );
  }

  let targetId: string | undefined;
  try {
    const stored = localStorage.getItem(LAST_ACTIVE_CALENDAR_KEY) || '';
    if (stored && activeCalendars.some((c) => c.id === stored)) {
      targetId = stored;
    }
  } catch {
    // ignore disabled storage
  }

  if (!targetId) {
    targetId = [...activeCalendars].sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )[0].id;
  }

  return <Navigate to={`/calendar/${targetId}`} replace />;
};

function App() {
  return (
    <AuthProvider>
      <AuthStateProvider>
        <TradeSyncProvider>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Router>
              <ScrollToTop />
              <Suspense fallback={<LoadingFallback />}>
                <AppContent />
              </Suspense>
            </Router>
          </LocalizationProvider>
        </TradeSyncProvider>
      </AuthStateProvider>
    </AuthProvider>
  );
}

interface CalendarRouteProps {
  calendars: Calendar[];
  onToggleTheme: () => void;
  mode: 'light' | 'dark';
  setLoading: (loading: boolean, loadingAction?: "loading" | "importing" | "exporting") => void;
  onDuplicateCalendar?: (sourceCalendarId: string, newName: string, includeContent?: boolean) => Promise<void> | void;
  onDeleteCalendar?: (id: string) => Promise<void> | void;
  onUpdateCalendar?: (id: string, updates: Partial<Calendar>) => Promise<void> | void;
}

const CalendarRoute: React.FC<CalendarRouteProps> = ({
  calendars,
  onToggleTheme,
  mode,
  setLoading,
  onDuplicateCalendar,
  onDeleteCalendar,
  onUpdateCalendar,
}) => {
  const { calendarId } = useParams<{ calendarId: string }>();
  const calendar = calendars.find((c: Calendar) => c.id === calendarId);

  // Scroll to top whenever navigating to a calendar page
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [calendarId]);

  // Remember the last calendar the user actually opened so the / resolver
  // can route them back here on subsequent visits.
  useEffect(() => {
    if (calendar?.id) {
      try {
        localStorage.setItem(LAST_ACTIVE_CALENDAR_KEY, calendar.id);
      } catch {
        // ignore storage failures
      }
    }
  }, [calendar?.id]);

  if (!calendar) {
    // Active calendar is gone (deleted, soft-trashed, or URL points to a
    // calendar the user no longer has). Prefer hopping to the most recently
    // updated remaining calendar so the user stays in the calendar surface.
    // Only fall back to "/" when there's nothing left.
    const fallbackCalendar = [...calendars]
      .filter((c) => !c.deleted_at)
      .sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )[0];

    if (fallbackCalendar) {
      return <Navigate to={`/calendar/${fallbackCalendar.id}`} replace />;
    }
    return <Navigate to="/" replace />;
  }

  return (
    <TradeCalendar
      calendar={calendar}
      setLoading={setLoading}
      onToggleTheme={onToggleTheme}
      mode={mode}
      onDuplicateCalendar={onDuplicateCalendar}
      onDeleteCalendar={onDeleteCalendar}
      onUpdateCalendar={onUpdateCalendar}
    />
  );
};

export default App;
