import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box, Snackbar, Alert } from '@mui/material';
import { createTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Calendar } from 'features/calendar/types/dualWrite';
import { AuthProvider } from 'contexts/SupabaseAuthContext';
import { useAuthState, AuthStateProvider } from 'contexts/AuthStateContext';
import { TradeSyncProvider } from 'features/calendar/contexts/TradeSyncContext';
import { NotificationsProvider } from 'contexts/NotificationsContext';
import { UserPinnedEventsProvider } from 'features/events/contexts/UserPinnedEventsContext';
import ProtectedRoute from 'components/auth/ProtectedRoute';
import * as calendarService from 'features/calendar/services/calendarService';
import { createAppTheme } from 'theme';
import TradeLoadingIndicator from 'features/calendar/components/TradeLoadingIndicator';
import { useCalendars } from 'features/calendar/hooks/useCalendars';
import { logger } from 'utils/logger';


import AppLoadingProgress from 'components/AppLoadingProgress';


import AppHeader from 'components/common/AppHeader';
import AppLayout from 'components/layout/AppLayout';
import type { CalendarFormData } from 'features/calendar/components/CalendarFormDialog';
import CalendarManagementDialogs from 'features/calendar/components/calendars/CalendarManagementDialogs';
import { useCalendarPanelActions } from 'features/calendar/hooks/useCalendarPanelActions';
import { SelectedCalendarProvider, useSelectedCalendar } from 'features/calendar/contexts/SelectedCalendarContext';
import {
  CalendarsListPanelProvider,
  CalendarsListPanelActions,
} from 'features/calendar/contexts/CalendarsListPanelContext';
import { SidePanelProvider, useSidePanel } from 'contexts/SidePanelContext';
import type { SidePanelView } from 'contexts/SidePanelContext';
import { TradeUIProvider } from 'features/calendar/contexts/TradeUIContext';
import { TradesProvider } from 'features/calendar/contexts/TradesContext';
import { AIChatProvider } from 'features/orion/contexts/AIChatContext';
import { TradeViewerProvider } from 'features/calendar/contexts/TradeViewerContext';
import { TradeOperationsProvider } from 'features/calendar/contexts/TradeOperationsContext';
import { EventNotificationsProvider } from 'features/events/contexts/EventNotificationsContext';
import { SubscriptionProvider } from 'features/billing/contexts/SubscriptionContext';
import { PanelMutexProvider, usePanelMutexSlot } from 'contexts/PanelMutexContext';
import { useCalendarsListPanel } from 'features/calendar/contexts/CalendarsListPanelContext';

// Lazy load page components from pages directory
const LandingPage = lazy(() => import('pages/LandingPage'));
const AboutPage = lazy(() => import('pages/AboutPage'));
const PricingPage = lazy(() => import('pages/PricingPage'));
const TradeCalendar = lazy(() => import('pages/TradeCalendarPage').then(module => ({ default: module.TradeCalendar })));
const SharedTradePage = lazy(() => import('pages/SharedTradePage'));
const SharedCalendarPage = lazy(() => import('pages/SharedCalendarPage'));
const SharedNotePage = lazy(
  () => import('pages/SharedNotePage')
);
const AuthCallback = lazy(() => import('pages/AuthCallbackPage'));
const PasswordResetPage = lazy(() => import('pages/PasswordResetPage'));
const CommunityPage = lazy(() => import('pages/CommunityPage'));
const PerformancePage = lazy(() => import('pages/PerformancePage'));
const NotesPage = lazy(() => import('pages/NotesPage'));
const EconomicEventsPage = lazy(() => import('pages/EconomicEventsPage'));
const AccountBillingPage = lazy(() => import('pages/AccountBillingPage'));
// const SupabaseAuthTest = lazy(() => import('components/auth/SupabaseAuthTest')); // Commented out - for testing only

// Global app-level surfaces — lazy so AI chat (markdown/draft-js), trade
// viewer dialogs, etc. don't block first paint. Wrapped in <Suspense
// fallback={null}> at the mount site; fallback is null because these are
// invisible until the user interacts (no UI to skeleton).
// CalendarFormDialog only mounts when user clicks Create. Eager import drags
// MUI Dialog + form components into main bundle.
const CalendarFormDialog = lazy(() => import('features/calendar/components/CalendarFormDialog'));
const CalendarLimitDialog = lazy(() =>
  import('features/billing/components/CalendarLimitDialog').then((m) => ({
    default: m.CalendarLimitDialog,
  })),
);

const GlobalAIChat = lazy(() => import('features/orion/components/aiChat/GlobalAIChat'));
const GlobalAIChatFab = lazy(() => import('features/orion/components/aiChat/GlobalAIChatFab'));
const GlobalTradeViewer = lazy(() => import('features/calendar/components/trades/GlobalTradeViewer'));
const GlobalTradeOperations = lazy(() => import('features/calendar/components/trades/GlobalTradeOperations'));
const GlobalEventNotifications = lazy(() => import('features/events/components/notifications/GlobalEventNotifications'));


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

  const { user, isAuthLoading } = useAuthState();
  const location = useLocation();
  const navigate = useNavigate();
  // Treat root as landing only after auth resolves. Otherwise the very
  // first paint on cold load (before supabase returns getSession) shows
  // the landing page for one frame even when the user is signed in.
  const isLandingPage = !isAuthLoading && !user && location.pathname === '/';

  // Global Create Calendar dialog — triggered from side nav "+ New", lock
  // overlays, and any future entry point. Lifted to App.tsx so a single
  // dialog instance serves every route.
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreatingCalendar, setIsCreatingCalendar] = useState(false);
  // Upgrade nudge shown when a free-tier user trips the 1-calendar cap
  // (either the CalendarRepository client gate or the DB trigger fallback).
  const [showCalendarLimitDialog, setShowCalendarLimitDialog] = useState(false);

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
      // Free-tier cap surfaces as the literal string 'tier_limit_calendars'
      // from either the client gate in CalendarRepository.create() or the
      // DB trigger (P0001) on bypass — both flow through the thrown Error's
      // message. Close the form, show the upgrade nudge.
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('tier_limit_calendars')) {
        setIsCreateDialogOpen(false);
        setShowCalendarLimitDialog(true);
      } else {
        logger.error('Error creating calendar from global dialog:', err);
      }
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

  // True only after SWR returned (so we don't flash the overlay during the
  // initial fetch) AND the user has zero non-deleted calendars. AppLayout
  // uses this to dim every authenticated route except /about until the user
  // creates a calendar via the side nav "Create" button.
  //
  // Derived from `swrCalendars` directly — NOT the locally-mirrored
  // `calendars` state — so the overlay doesn't flash for one render on first
  // load. The mirror is populated by a `useEffect` that fires *after* the
  // render where SWR resolves, so on that render `swrCalendars` is already
  // `[cal1]` while local `calendars` is still `[]`. Reading the mirror here
  // would briefly evaluate to `true` even though the user does have data.
  const hasNoCalendars = useMemo(
    () =>
      swrCalendars !== undefined &&
      swrCalendars.filter((c) => !c.deleted_at).length === 0,
    [swrCalendars],
  );

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
    // Optimistic SWR mutate — UI reflects instantly. Every `useCalendars`
    // consumer (PerformancePage, HeaderCalendarSelector, CalendarListDialog,
    // etc.) and the local-state sync useEffect picks this up.
    refreshCalendars(
      (prev) =>
        (prev ?? [])
          .map((cal) => (cal.id === id ? { ...cal, ...updates, updated_at: new Date() } : cal))
          .sort(
            (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
          ),
      { revalidate: false },
    );
    try {
      const updatedCalendar = await calendarService.updateCalendar(id, updates);
      // Reconcile with server-truth (server-side timestamps, defaults, etc.)
      // without a network revalidate — we already have the canonical row.
      refreshCalendars(
        (prev) =>
          (prev ?? [])
            .map((cal) => (cal.id === id ? { ...cal, ...updatedCalendar } : cal))
            .sort(
              (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
            ),
        { revalidate: false },
      );
    } catch (error) {
      console.error('Error updating calendar:', error);
      // Roll back optimistic update by revalidating from server.
      refreshCalendars();
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
      onCreateCalendar: openCreateCalendarDialog,
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
      <TradesProvider calendars={calendars} setLoading={setLoading}>
      <TradeOperationsProvider>
      <EventNotificationsProvider>
      <TradeUIProvider>
      <TradeViewerProvider>
      <AIChatProvider>
      <SidePanelProvider defaultView={{ id: 'faq' }} defaultOpen={false}>
      <PanelMutexProvider>
      <GlobalSidePanelMutexBridge />
      <CalendarsListMutexBridge />
      {user && (
        <Suspense fallback={null}>
          <GlobalAIChat />
          <GlobalAIChatFab />
          <GlobalTradeViewer />
          <GlobalTradeOperations />
          <GlobalEventNotifications />
        </Suspense>
      )}
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
            // Landing scrolls (it has its own long-form content). Every other
            // route is locked to the viewport — each page owns its own scroll
            // container so the app shell never scrolls behind it.
            height: isLandingPage ? 'auto' : '100vh',
            minHeight: isLandingPage ? '100vh' : undefined,
            overflow: isLandingPage ? 'visible' : 'hidden',
            bgcolor: isLandingPage ? '#000' : 'custom.pageBackground',
            position: 'relative',
            pb: isLandingPage ? 0 : 0,
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
          {isAuthLoading ? (
            <LoadingFallback />
          ) : (
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
                element={
                  <AppLayout
                    onNewCalendar={openCreateCalendarDialog}
                    isLocked={hasNoCalendars}
                  />
                }
              >
                <Route
                  path="/"
                  element={
                    <HomeRouteResolver
                      calendars={calendars}
                      isLoadingCalendars={isLoadingCalendars}
                      hasFetchedCalendars={swrCalendars !== undefined}
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
                        hasFetchedCalendars={swrCalendars !== undefined}
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
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/account/billing" element={<AccountBillingPage />} />
              </Route>
            ) : (
              <>
                <Route path="/" element={<LandingPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/pricing" element={<PricingPage />} />
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
          )}
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
      </AIChatProvider>
      </TradeViewerProvider>
      </TradeUIProvider>
      </EventNotificationsProvider>
      </TradeOperationsProvider>
      </TradesProvider>
      </CalendarsListPanelProvider>
      </SelectedCalendarProvider>

      {/* Global Create Calendar dialog — opened by side nav "+ New" and any
          calendar lock overlay. Lazy-loaded; only mounts once user opens it. */}
      {user && isCreateDialogOpen && (
        <Suspense fallback={null}>
          <CalendarFormDialog
            open={isCreateDialogOpen}
            onClose={() => setIsCreateDialogOpen(false)}
            onSubmit={handleCreateCalendarSubmit}
            isSubmitting={isCreatingCalendar}
            mode="create"
            title="Create Calendar"
            submitButtonText="Create"
          />
        </Suspense>
      )}

      {/* Upgrade nudge — free users get a single calendar; show the pricing
          CTA when they hit the cap instead of a generic error snackbar. */}
      {user && showCalendarLimitDialog && (
        <Suspense fallback={null}>
          <CalendarLimitDialog
            open={showCalendarLimitDialog}
            onClose={() => setShowCalendarLimitDialog(false)}
          />
        </Suspense>
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

// Mutex bridges — small headless components mounted inside the provider
// stack so each panel surface registers a (id, close) slot with the mutex.
// When any slot signals open, the mutex closes every other slot.

const GlobalSidePanelMutexBridge: React.FC = () => {
  const { isOpen, setOpen } = useSidePanel();
  const close = useCallback(() => setOpen(false), [setOpen]);
  usePanelMutexSlot('global-side-panel', isOpen, close);
  return null;
};

const CalendarsListMutexBridge: React.FC = () => {
  const { open, closePanel } = useCalendarsListPanel();
  usePanelMutexSlot('calendars-list', open, closePanel);
  return null;
};

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
  /** True only after SWR has returned a defined value (even an empty
   *  array). Distinguishes "still fetching / awaiting first response"
   *  from "fetched, no calendars exist". */
  hasFetchedCalendars: boolean;
}

/**
 * Auth landing for "/". Routes the user to the most appropriate calendar:
 *  - prefers the last calendar they opened (localStorage)
 *  - falls back to the most recently updated non-trashed calendar
 *  - if zero calendars exist, renders nothing — AppLayout's global lock
 *    overlay covers the empty column and points at the side nav "Create"
 *    button.
 */
const HomeRouteResolver: React.FC<HomeRouteResolverProps> = ({
  calendars,
  isLoadingCalendars,
  hasFetchedCalendars,
}) => {
  const { calendarId: storedCalendarId } = useSelectedCalendar();
  const activeCalendars = useMemo(
    () => calendars.filter((c) => !c.deleted_at),
    [calendars]
  );

  // Wait until SWR has returned. Otherwise the local `calendars` state
  // (which starts as []) would make us treat an unresolved fetch as
  // "no calendars".
  if (!hasFetchedCalendars || isLoadingCalendars) {
    return <LoadingFallback />;
  }

  if (activeCalendars.length === 0) {
    // AppLayout handles the lock overlay; nothing to render under it.
    return null;
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
        <SubscriptionProvider>
          <UserPinnedEventsProvider>
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
          </UserPinnedEventsProvider>
        </SubscriptionProvider>
      </AuthStateProvider>
    </AuthProvider>
  );
}

interface CalendarRouteProps {
  calendars: Calendar[];
  /** True only after SWR returned (defined value). Without this, the
   *  initial render with calendars=[] redirects to "/" → flashes the
   *  HomeRouteResolver loading state and (in the past) lock overlay
   *  before SWR resolves and lets us actually find the calendar. */
  hasFetchedCalendars: boolean;
  onToggleTheme: () => void;
  mode: 'light' | 'dark';
  setLoading: (loading: boolean, loadingAction?: "loading" | "importing" | "exporting") => void;
}

const CalendarRoute: React.FC<CalendarRouteProps> = ({
  calendars,
  hasFetchedCalendars,
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

  // Wait for SWR to actually return before deciding the calendar is gone.
  // Without this, the very first render (calendars=[]) redirects to "/" on
  // cold reload, which then bounces back here once SWR resolves — a visible
  // flash of HomeRouteResolver (and previously the lock overlay) between.
  if (!hasFetchedCalendars) {
    return <LoadingFallback />;
  }

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
    />
  );
};

export default App;
