import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box, Snackbar, Alert } from '@mui/material';
import { createTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Calendar } from './types/dualWrite';
import { AuthProvider } from './contexts/SupabaseAuthContext';
import { useAuthState, AuthStateProvider } from './contexts/AuthStateContext';
import { TradeSyncProvider } from './contexts/TradeSyncContext';
import { NotificationsProvider } from './contexts/NotificationsContext';
import { UserPinnedEventsProvider } from './contexts/UserPinnedEventsContext';
import { UserEconomicFiltersProvider } from './contexts/UserEconomicFiltersContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import * as calendarService from './services/calendarService';
import { createAppTheme } from './theme';
import TradeLoadingIndicator from './components/TradeLoadingIndicator';
import { useCalendars } from './hooks/useCalendars';
import { logger } from './utils/logger';


import AppLoadingProgress from './components/AppLoadingProgress';


import AppHeader from './components/common/AppHeader';
import AppLayout from './components/layout/AppLayout';
import CalendarFormDialog, { CalendarFormData } from './components/CalendarFormDialog';
import CalendarLockedOverlay from './components/calendars/CalendarLockedOverlay';
import CalendarManagementDialogs from './components/calendars/CalendarManagementDialogs';
import { useCalendarPanelActions } from './hooks/useCalendarPanelActions';
import { SelectedCalendarProvider, useSelectedCalendar } from './contexts/SelectedCalendarContext';
import {
  CalendarsListPanelProvider,
  CalendarsListPanelActions,
} from './contexts/CalendarsListPanelContext';
import { SidePanelProvider, useSidePanel } from './contexts/SidePanelContext';
import type { SidePanelView } from './contexts/SidePanelContext';
import { TradeUIProvider } from './contexts/TradeUIContext';
import { PanelMutexProvider } from './contexts/PanelMutexContext';

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
const NotesPage = lazy(() => import('./pages/NotesPage'));
const EconomicEventsPage = lazy(() => import('./pages/EconomicEventsPage'));
// const SupabaseAuthTest = lazy(() => import('./components/auth/SupabaseAuthTest')); // Commented out - for testing only


// Loading component for Suspense
const LoadingFallback = () => <AppLoadingProgress />;

function AppContent() {
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
  // Routes that lock to viewport and own their own bottom spacing — App
  // outer pb would otherwise leave a visible gap below the page chrome.
  const isViewportLockedPage =
    location.pathname.startsWith('/events') ||
    location.pathname.startsWith('/notes');

  // Global Create Calendar dialog — triggered from side nav "+ New", lock
  // overlays, and any future entry point. Lifted to App.tsx so a single
  // dialog instance serves every route.
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreatingCalendar, setIsCreatingCalendar] = useState(false);

  // Simple feedback snackbar used by the calendars-list panel actions.
  const [snackbar, setSnackbar] = useState<{
    message: string;
    severity: 'success' | 'error';
  } | null>(null);
  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ message, severity });
  };

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

  // Calendars-list drawer actions (edit/duplicate/link/delete/restore/permanent-
  // delete + their dialog targets). Wired against App-level CRUD handlers so
  // any route that opens the drawer gets the same management surface.
  const panelActions = useCalendarPanelActions({
    userId: user?.uid,
    loadUserCalendars: async () => {
      await refreshCalendars();
    },
    showSnackbar,
    onUpdateCalendar: handleUpdateCalendar,
    onDuplicateCalendar: handleDuplicateCalendar,
    onDeleteCalendar: handleDeleteCalendar,
  });

  // Actions for the global calendars-list panel (inline at lg+, drawer <lg).
  // The provider owns open/close state — AppLayout consumes it for rendering
  // and HeaderCalendarSelector for opening from the dropdown footer.
  const calendarsListActions = useMemo<CalendarsListPanelActions>(
    () => ({
      onCalendarClick: (id: string) => navigate(`/calendar/${id}`),
      onEditCalendar: panelActions.setEditTarget,
      onDuplicateCalendar: panelActions.setDuplicateTarget,
      onLinkCalendar: panelActions.setLinkTarget,
      onDeleteCalendar: panelActions.setDeleteTarget,
      onUpdateCalendarProperty: async (id, updateCallback) => {
        const target = calendars.find((c) => c.id === id);
        if (!target) return undefined;
        const updated = updateCallback(target);
        await handleUpdateCalendar(id, updated);
        return updated;
      },
      onRestoreCalendar: panelActions.restoreCalendar,
      onPermanentDeleteCalendar: panelActions.permanentDeleteCalendar,
    }),
    [navigate, panelActions, calendars]
  );

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
      <SelectedCalendarProvider>
      <CalendarsListPanelProvider actions={calendarsListActions}>
      <TradeUIProvider>
      <SidePanelProvider defaultView={{ id: 'faq' }} defaultOpen={false}>
      <PanelMutexProvider>
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
            pb: isLandingPage || isViewportLockedPage ? 0 : 4,
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
            {/* Auth-gated routes share a persistent AppLayout via a layout
                route — AppLayout (and its SideNav) stay mounted across
                navigation between Home / Performance / Notes,
                preventing the shell from blanking on each click. About lives
                inside this layout so its side-nav slot can show the active
                state; for signed-out visitors it falls back to a public
                route below that renders without the shell. */}
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
                <Route
                  path="/events"
                  element={
                    <ProtectedRoute
                      title="View Economic Events"
                      subtitle="Sign in to view the economic events calendar"
                    >
                      <EconomicEventsPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/about" element={<AboutPage />} />
              </Route>
            ) : (
              <>
                <Route path="/" element={<LandingPage />} />
                <Route path="/about" element={<AboutPage />} />
              </>
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

      {/* Calendars-list edit/duplicate/link/delete dialogs — driven by
          useCalendarPanelActions targets. Render once at App level so they
          work from the inline panel and the mobile drawer alike. */}
      {user && (
        <CalendarManagementDialogs
          actions={panelActions}
          userCalendars={calendars}
        />
      )}
      </PanelMutexProvider>
      </SidePanelProvider>
      </TradeUIProvider>
      </CalendarsListPanelProvider>
      </SelectedCalendarProvider>

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

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={3000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snackbar ? (
          <Alert
            severity={snackbar.severity}
            variant="filled"
            onClose={() => setSnackbar(null)}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        ) : undefined}
      </Snackbar>
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
  const { calendarId: storedCalendarId } = useSelectedCalendar();
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
          subtitle="Create a calendar to start tracking trades. The Home, Performance and Notes sections unlock once one exists."
        />
      </Box>
    );
  }

  let targetId: string | undefined;
  if (storedCalendarId && activeCalendars.some((c) => c.id === storedCalendarId)) {
    targetId = storedCalendarId;
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
        <UserPinnedEventsProvider>
         <UserEconomicFiltersProvider>
          <NotificationsProvider>
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
          </NotificationsProvider>
         </UserEconomicFiltersProvider>
        </UserPinnedEventsProvider>
      </AuthStateProvider>
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

  // Sync URL → global calendar context so other pages (Performance, Notes)
  // and the AppHeader selector all reflect the calendar the user is viewing.
  // The context provider persists to localStorage internally.
  const { setCalendarId } = useSelectedCalendar();
  useEffect(() => {
    if (calendar?.id) setCalendarId(calendar.id);
  }, [calendar?.id, setCalendarId]);

  // Dispatch to the app-level SidePanelProvider — CalendarRoute lives outside
  // TradeCalendarPage's local provider, so `useSidePanel()` here resolves to
  // the global one. Page-level panels migrated to the global registry open
  // through this callback.
  const { replacePanel, setOpen: setSidePanelOpen } = useSidePanel();
  const openGlobalPanel = useCallback(
    (view: SidePanelView) => {
      replacePanel(view);
      setSidePanelOpen(true);
    },
    [replacePanel, setSidePanelOpen]
  );
  // Mutex partner: TradeCalendarPage's local panel opening calls this to
  // collapse the global panel. (The other direction is handled by
  // PanelMutexProvider firing the page's published closer.)
  const closeGlobalPanel = useCallback(() => {
    setSidePanelOpen(false);
  }, [setSidePanelOpen]);

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
      openGlobalPanel={openGlobalPanel}
      closeGlobalPanel={closeGlobalPanel}
    />
  );
};

export default App;
