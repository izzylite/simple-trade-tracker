import React, { useState } from 'react';
import { Box, IconButton, useTheme, useMediaQuery } from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';
import SideNav, { SIDE_NAV_WIDTH } from './SideNav';

interface AppLayoutProps {
  children: React.ReactNode;
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
    <Box sx={{ display: 'flex', minHeight: 'calc(100vh - 64px)', position: 'relative' }}>
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
        {children}
      </Box>
    </Box>
  );
};

export default AppLayout;
