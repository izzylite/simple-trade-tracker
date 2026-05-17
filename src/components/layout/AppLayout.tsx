import React, { useEffect, useRef, useState, Suspense, lazy } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box,
  CircularProgress,
  IconButton,
  LinearProgress,
  Typography,
  Divider,
  alpha,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Close as CloseIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { Outlet } from 'react-router-dom';
import SideNav, { SIDE_NAV_WIDTH } from './SideNav';
import CalendarLockedOverlay from '../calendars/CalendarLockedOverlay';
import { useCalendarsListPanel } from '../../contexts/CalendarsListPanelContext';
// CalendarsListDrawer wraps CalendarsListContent for <lg viewports. Lazy
// keeps both out of the main bundle until the drawer actually opens.
import { useSelectedCalendar } from '../../contexts/SelectedCalendarContext';
import SidePanel from '../sidePanel/SidePanel';
import { useSidePanel } from '../../contexts/SidePanelContext';
import { appRenderView } from '../sidePanel/appRenderView';
import UnifiedDrawer from '../common/UnifiedDrawer';
// Eagerly imported so it can serve as the Suspense fallback for the lazy
// CalendarsListContent chunk below — must be ready before that chunk arrives.
import CalendarsPanelShimmer from '../sidePanel/content/CalendarsPanelShimmer';

// CalendarsListContent: pulls list-management UI + dialogs. Only rendered
// when the inline panel opens (lg+) — keep it out of main bundle.
const CalendarsListContent = lazy(
  () => import('../sidePanel/content/CalendarsListContent')
);
const CalendarsListDrawer = lazy(() => import('../calendars/CalendarsListDrawer'));

// Matches the local SidePanel width (sidePanel/SidePanel.tsx) so both global
// panels feel consistent and align with the <lg drawer standard (450px).
const PANEL_WIDTH = 'clamp(340px, 28vw, 450px)';
// Kept as an alias so existing readers see the legacy name in this file.
const CALENDARS_PANEL_WIDTH = PANEL_WIDTH;

/**
 * Inline loading state for the route content area. Centered spinner
 * inside the main column — AppHeader + SideNav stay mounted, only the
 * page area renders the loader while the chunk fetches.
 */
const RouteSuspenseFallback: React.FC = () => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 'calc(100vh - 64px)',
    }}
  >
    <CircularProgress size={28} />
  </Box>
);

interface AppLayoutProps {
  /**
   * Optional explicit content. When omitted, AppLayout renders the active
   * nested route via <Outlet />, which is the preferred pattern — it lets
   * the layout (and its SideNav) stay mounted across route changes.
   */
  children?: React.ReactNode;
  /** Forwarded to SideNav. Phase 7 wires this. */
  onNewCalendar?: () => void;
  /**
   * True when the signed-in user has zero calendars (after SWR has resolved).
   * Renders a dim/blur lock overlay over the main content area so the rest
   * of the app stays unusable until the user creates one via the SideNav
   * "Create" entry. The overlay sits *inside* the main column — SideNav,
   * calendars panel, and side panel stay interactive.
   *
   * The lock is skipped on `/about` since that route doesn't require a
   * calendar to be informational.
   */
  isLocked?: boolean;
}

/**
 * Authenticated app shell. Composes the side nav (persistent rail on lg+,
 * temporary drawer <lg) with the route content area. Page chrome (breadcrumbs,
 * sidepanel, etc.) lives inside the children.
 *
 * Renders a small floating menu trigger on <lg until a hamburger is added to
 * AppHeader in a later phase.
 *
 * Also hosts the global CalendarsList surface: an inline right-side panel on
 * lg+ and a UnifiedDrawer fallback on smaller viewports. The panel state and
 * actions are provided by CalendarsListPanelContext at App level.
 */
const AppLayout: React.FC<AppLayoutProps> = ({ children, onNewCalendar, isLocked = false }) => {
  const theme = useTheme();
  const isLgUp = useMediaQuery(theme.breakpoints.up('lg'));
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Brief top progress bar on every route transition. Suspense fires the
  // skeleton fallback when the chunk needs fetching (first nav); for cached
  // chunks the chunk is ready but the page still mounts + runs initial
  // hooks. This flash gives users a "something's happening" signal so the
  // shell never appears frozen on the first 300ms of a heavy page mount.
  const location = useLocation();
  const [navPending, setNavPending] = useState(false);
  const firstRenderRef = useRef(true);
  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    setNavPending(true);
    const t = setTimeout(() => setNavPending(false), 400);
    return () => clearTimeout(t);
  }, [location.pathname]);

  const { open: isCalendarsListOpen, closePanel, actions } = useCalendarsListPanel();
  const { calendarId } = useSelectedCalendar();
  const {
    isOpen: isSidePanelOpen,
    currentView,
    setOpen: setSidePanelOpen,
  } = useSidePanel();

  // `/about` is informational and stays accessible even without a calendar.
  // Every other authenticated route gets the dim lock overlay when locked.
  const showLockOverlay = isLocked && location.pathname !== '/about';

  const inlinePanelOpen = isLgUp && isCalendarsListOpen;
  // The provider's defaultView is `faq` so `currentView.id === 'faq'` could
  // mean either "user opened FAQ" or "nothing was ever pushed". Until FAQ is
  // migrated to the global panel (Task 5), gate the inline render so the
  // panel only takes layout space when the user has explicitly opened it.
  const inlineSidePanelOpen =
    isLgUp && isSidePanelOpen && currentView.id !== 'faq';
  const sidePanelConfig = appRenderView(currentView);

  return (
    // App outer Box owns overflow:hidden + height:100vh, with 64px top
    // padding for the AppHeader — so AppLayout fills the remaining viewport.
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', position: 'relative' }}>
      <SideNav
        onNewCalendar={onNewCalendar}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />

      {/* Floating mobile-nav trigger — temporary until AppHeader gets a hamburger */}
      {!isLgUp && (
        <IconButton
          onClick={() => setMobileNavOpen(true)}
          aria-label="open navigation"
          sx={{
            position: 'fixed',
            top: 72,
            left: 8,
            zIndex: theme.zIndex.appBar - 1,
            bgcolor: 'background.paper',
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: theme.shadows[2],
            '&:hover': { bgcolor: 'background.paper' },
          }}
          size="small"
        >
          <MenuIcon fontSize="small" />
        </IconButton>
      )}

      <Box
        component="main"
        sx={{
          flex: 1,
          minWidth: { xs: 0, lg: 360 },
          minHeight: 0,
          position: 'relative',
          // Pages that fix their own height (calendar / performance / notes /
          // events) fill this column exactly and manage their own internal
          // scroll. Pages that don't (About) scroll inside this column rather
          // than the page chrome.
          overflowY: 'auto',
          // When the calendars-list inline panel and/or the global side
          // panel are open at lg+, shrink the main column to make room.
          // Only one of the two is typically open at once today, but the
          // math tolerates both being open. minWidth above keeps the column
          // from collapsing if both panels open on a narrow lg viewport.
          width: {
            lg: (() => {
              const subtract: string[] = [`${SIDE_NAV_WIDTH}px`];
              if (inlinePanelOpen) subtract.push(CALENDARS_PANEL_WIDTH);
              if (inlineSidePanelOpen) subtract.push(PANEL_WIDTH);
              return `calc(100% - ${subtract.join(' - ')})`;
            })(),
          },
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {navPending && (
          <LinearProgress
            sx={{
              position: 'sticky',
              top: 0,
              left: 0,
              right: 0,
              height: 2,
              zIndex: theme.zIndex.appBar - 1,
            }}
          />
        )}
        {/* When locked, don't mount the active route at all — pages like
            PerformancePage / NotesPage / EconomicEventsPage would otherwise
            try to render against zero calendars. The dim overlay below sits
            on top of an empty placeholder so the column keeps its size. */}
        {showLockOverlay ? (
          <Box sx={{ minHeight: 'calc(100vh - 64px)' }} />
        ) : (
          children ?? (
            <Suspense fallback={<RouteSuspenseFallback />}>
              <Outlet />
            </Suspense>
          )
        )}

        {showLockOverlay && <CalendarLockedOverlay />}
      </Box>

      {/* Inline calendars-list panel — lg+ only. <lg uses the drawer below. */}
      {isLgUp && (
        <Box
          sx={{
            width: inlinePanelOpen ? CALENDARS_PANEL_WIDTH : 0,
            overflow: 'hidden',
            transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            flexShrink: 0,
            borderLeft: inlinePanelOpen
              ? `1px solid ${alpha(theme.palette.divider, 0.08)}`
              : 'none',
            bgcolor: theme.palette.mode === 'dark'
              ? alpha(theme.palette.background.paper, 0.4)
              : alpha(theme.palette.background.paper, 0.7),
          }}
        >
          {inlinePanelOpen && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                minWidth: CALENDARS_PANEL_WIDTH,
                overflow: 'hidden',
              }}
            >
              {/* Panel header — matches SidePanelHeader's spacing/typography so
                  the surface reads as one of the app's familiar side panels. */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  px: 2,
                  py: 1.5,
                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                }}
              >
                <CalendarIcon
                  sx={{ fontSize: 18, color: 'text.secondary' }}
                />
                <Typography
                  sx={{
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    color: 'text.primary',
                    flex: 1,
                  }}
                >
                  Calendars
                </Typography>
                <IconButton
                  size="small"
                  onClick={closePanel}
                  aria-label="close calendars panel"
                  sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
              <Divider sx={{ my: 0 }} />
              <Box
                sx={{
                  flex: 1,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                }}
              >
                <Suspense
                  fallback={
                    <Box sx={{ px: 2, pt: 2, pb: 1 }}>
                      <CalendarsPanelShimmer /> 
                    </Box>
                  }
                >
                  <CalendarsListContent
                    isActive={inlinePanelOpen}
                    activeCalendarId={calendarId || undefined}
                    onCalendarClick={(id) => {
                      actions.onCalendarClick(id);
                      closePanel();
                    }}
                    onCreateCalendar={
                      actions.onCreateCalendar
                        ? () => {
                            actions.onCreateCalendar?.();
                            closePanel();
                          }
                        : undefined
                    }
                    onEditCalendar={actions.onEditCalendar}
                    onDuplicateCalendar={actions.onDuplicateCalendar}
                    onLinkCalendar={actions.onLinkCalendar}
                    onDeleteCalendar={actions.onDeleteCalendar}
                    onUpdateCalendarProperty={actions.onUpdateCalendarProperty}
                    onRestoreCalendar={actions.onRestoreCalendar}
                    onPermanentDeleteCalendar={actions.onPermanentDeleteCalendar}
                  />
                </Suspense>
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* Global app-level side panel — inline at lg+. The panel is always
          mounted so its width transition runs; SidePanel itself collapses
          to width 0 when `isOpen` is false. */}
      {isLgUp && <SidePanel renderView={appRenderView} />}

      {/* Drawer fallback — <lg only; lazy-mounted on first open. */}
      {!isLgUp && isCalendarsListOpen && (
        <Suspense fallback={null}>
          <CalendarsListDrawer
            open={isCalendarsListOpen}
            onClose={closePanel}
            activeCalendarId={calendarId || undefined}
            onCalendarClick={(id) => {
              actions.onCalendarClick(id);
              closePanel();
            }}
            onCreateCalendar={
              actions.onCreateCalendar
                ? () => {
                    actions.onCreateCalendar?.();
                    closePanel();
                  }
                : undefined
            }
            onEditCalendar={actions.onEditCalendar}
            onDuplicateCalendar={actions.onDuplicateCalendar}
            onLinkCalendar={actions.onLinkCalendar}
            onDeleteCalendar={actions.onDeleteCalendar}
            onUpdateCalendarProperty={actions.onUpdateCalendarProperty}
            onRestoreCalendar={actions.onRestoreCalendar}
            onPermanentDeleteCalendar={actions.onPermanentDeleteCalendar}
          />
        </Suspense>
      )}

      {/* Global app-level side panel — drawer fallback at <lg. */}
      {!isLgUp && (
        <UnifiedDrawer
          open={isSidePanelOpen}
          onClose={() => setSidePanelOpen(false)}
          title={sidePanelConfig?.title ?? ''}
          icon={sidePanelConfig?.icon}
          width={{ xs: '100%', sm: 450 }}
          contentSx={{
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <SidePanel renderView={appRenderView} />
        </UnifiedDrawer>
      )}
    </Box>
  );
};

export default AppLayout;
