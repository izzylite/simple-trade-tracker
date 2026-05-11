import React, { useState, Suspense } from 'react';
import {
  Box,
  IconButton,
  CircularProgress,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';
import { Outlet } from 'react-router-dom';
import SideNav, { SIDE_NAV_WIDTH } from './SideNav';

/**
 * Inline loading state for the route content area only. Renders inside
 * AppLayout's main slot so AppHeader + SideNav stay visible while a lazy
 * page chunk loads.
 */
const RouteSuspenseFallback: React.FC = () => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 'calc(100vh - 96px)',
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
}

/**
 * Authenticated app shell. Composes the side nav (persistent rail on lg+,
 * temporary drawer <lg) with the route content area. Page chrome (breadcrumbs,
 * sidepanel, etc.) lives inside the children.
 *
 * Renders a small floating menu trigger on <lg until a hamburger is added to
 * AppHeader in a later phase.
 */
const AppLayout: React.FC<AppLayoutProps> = ({ children, onNewCalendar }) => {
  const theme = useTheme();
  const isLgUp = useMediaQuery(theme.breakpoints.up('lg'));
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    // min-height accounts for AppHeader (64px) + App outer Box pb (32px).
    // Old value (100vh - 64px) caused 32px body overflow on viewport-locked
    // pages because AppLayout would extend past App outer's content area.
    <Box sx={{ display: 'flex', minHeight: 'calc(100vh - 96px)', position: 'relative' }}>
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
          minWidth: 0,
          width: { lg: `calc(100% - ${SIDE_NAV_WIDTH}px)` },
        }}
      >
        {children ?? (
          <Suspense fallback={<RouteSuspenseFallback />}>
            <Outlet />
          </Suspense>
        )}
      </Box>
    </Box>
  );
};

export default AppLayout;
