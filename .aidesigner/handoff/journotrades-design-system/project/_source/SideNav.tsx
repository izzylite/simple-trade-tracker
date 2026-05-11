import React from 'react';
import {
  Box,
  Drawer,
  ButtonBase,
  Typography,
  Tooltip,
  Stack,
  alpha,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Home as HomeIcon,
  BarChart as PerformanceIcon,
  SmartToy as AssistantIcon,
  Notes as NotesIcon,
  Add as AddIcon,
  InfoOutlined as AboutIcon,
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';

export const SIDE_NAV_WIDTH = 92;
const APP_HEADER_HEIGHT = 64;
const TILE_SIZE = 44;
const LAST_ACTIVE_CALENDAR_KEY = 'last_active_calendar_id';

/**
 * Resolve the destination for the Home nav item. CalendarRoute writes
 * last_active_calendar_id whenever the user opens a calendar, so we can
 * usually navigate straight there and avoid the "/ -> resolver -> Navigate"
 * hop, which briefly unmounts TradeCalendarPage. If nothing is stored yet
 * (or storage is disabled) fall back to "/" — the resolver picks the right
 * calendar from there.
 */
const resolveHomePath = (): string => {
  try {
    const stored = localStorage.getItem(LAST_ACTIVE_CALENDAR_KEY);
    if (stored) return `/calendar/${stored}`;
  } catch {
    // ignore
  }
  return '/';
};

interface NavItem {
  label: string;
  /** Static path, OR a function evaluated at click time (used by Home). */
  path: string | (() => string);
  icon: React.ReactNode;
  /**
   * Match function — when provided, used instead of strict `path === pathname`.
   * Useful for routes with params (e.g. `/calendar/:id`).
   */
  match?: (pathname: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Home',
    path: resolveHomePath,
    icon: <HomeIcon />,
    match: (p) => p === '/' || p.startsWith('/calendar/') || p === '/dashboard',
  },
  { label: 'Performance', path: '/performance', icon: <PerformanceIcon /> },
  { label: 'Assistant', path: '/assistant', icon: <AssistantIcon /> },
  { label: 'Notes', path: '/notes', icon: <NotesIcon /> },
];

/**
 * Utility-tier items live at the bottom of the rail under a hairline divider.
 * Calendar is canonical (Design Principle 4) — utility surfaces sit visibly
 * but visually demoted so the primary NAV_ITEMS keep their weight.
 */
const UTILITY_ITEMS: NavItem[] = [
  { label: 'About', path: '/about', icon: <AboutIcon /> },
];

interface SideNavProps {
  /** Triggered by the top "Create" button. */
  onNewCalendar?: () => void;
  /** Mobile drawer open state — only used when <lg. */
  mobileOpen: boolean;
  /** Closes the mobile drawer (after item click or backdrop tap). */
  onMobileClose: () => void;
}

/**
 * Vertical icon-rail. Each item is rendered as a rounded icon-tile stacked
 * over a small label. The active route fills its tile with the brand violet
 * (One Purple Rule from DESIGN.md — the only saturated colour the rail uses).
 * "Create" lives at the top so the primary action is the first thing seen.
 */
const SideNav: React.FC<SideNavProps> = ({
  onNewCalendar,
  mobileOpen,
  onMobileClose,
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isLgUp = useMediaQuery(theme.breakpoints.up('lg'));

  const resolvePath = (item: NavItem) =>
    typeof item.path === 'function' ? item.path() : item.path;

  const isActive = (item: NavItem) =>
    item.match
      ? item.match(location.pathname)
      : location.pathname === resolvePath(item);

  const handleNavigate = (path: string) => {
    navigate(path);
    if (!isLgUp) onMobileClose();
  };

  const handleNewCalendar = () => {
    if (onNewCalendar) onNewCalendar();
    if (!isLgUp) onMobileClose();
  };

  /**
   * Three visual variants:
   *  - 'nav'    → tile fills with violet when active, slate hover otherwise
   *  - 'create' → always-on primary CTA. Tile carries a soft violet background
   *               so it reads as the page's first action without competing
   *               with an active route's solid pill.
   */
  const renderItem = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    options?: {
      active?: boolean;
      disabled?: boolean;
      tooltip?: string;
      variant?: 'nav' | 'create';
    }
  ) => {
    const active = options?.active ?? false;
    const disabled = options?.disabled ?? false;
    const variant = options?.variant ?? 'nav';
    const isCreate = variant === 'create';

    // Tile colours
    const tileBg = isCreate
      ? alpha(theme.palette.primary.main, 0.12)
      : active
        ? theme.palette.primary.main
        : 'transparent';
    const tileHoverBg = isCreate
      ? alpha(theme.palette.primary.main, 0.18)
      : active
        ? theme.palette.primary.dark
        : theme.palette.action.hover;
    const iconColor = isCreate
      ? theme.palette.primary.main
      : active
        ? theme.palette.primary.contrastText
        : theme.palette.text.secondary;
    const labelColor = active && !isCreate
      ? theme.palette.primary.main
      : theme.palette.text.primary;

    const button = (
      <ButtonBase
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        focusRipple
        sx={{
          width: '100%',
          py: 0.75,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.625,
          opacity: disabled ? 0.4 : 1,
          borderRadius: 1.5,
          transition:
            'background 180ms cubic-bezier(0.22, 1, 0.36, 1), transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
          '& .nav-tile': {
            width: TILE_SIZE,
            height: TILE_SIZE,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: tileBg,
            color: iconColor,
            transition:
              'background 180ms cubic-bezier(0.22, 1, 0.36, 1), color 180ms cubic-bezier(0.22, 1, 0.36, 1)',
            '& svg': { fontSize: 22 },
          },
          '&:hover:not(:disabled) .nav-tile': {
            bgcolor: tileHoverBg,
            color: isCreate ? theme.palette.primary.dark : iconColor,
          },
          '&:active:not(:disabled) .nav-tile': {
            transform: 'scale(0.96)',
          },
          '&:focus-visible .nav-tile': {
            boxShadow: `0 0 0 2px ${theme.palette.background.paper}, 0 0 0 4px ${alpha(theme.palette.primary.main, 0.45)}`,
          },
        }}
      >
        <Box className="nav-tile">{icon}</Box>
        <Typography
          sx={{
            fontSize: '0.6875rem',
            fontWeight: active || isCreate ? 600 : 500,
            lineHeight: 1.1,
            color: labelColor,
            textAlign: 'center',
            letterSpacing: '-0.005em',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </Typography>
      </ButtonBase>
    );

    if (options?.tooltip) {
      return (
        <Tooltip key={label} title={options.tooltip} placement="right">
          <span>{button}</span>
        </Tooltip>
      );
    }
    return <span key={label}>{button}</span>;
  };

  const navContent = (
    <Box
      sx={{
        width: SIDE_NAV_WIDTH,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        borderRight: `1px solid ${theme.palette.divider}`,
      }}
    >
      {/* Create — always-visible primary action at the top of the rail. */}
      <Box sx={{ pt: 1.5, pb: 1, px: 1 }}>
        {renderItem(
          'Create',
          <AddIcon />,
          handleNewCalendar,
          {
            variant: 'create',
            disabled: !onNewCalendar,
            tooltip: onNewCalendar ? '' : 'Coming soon',
          }
        )}
      </Box>

      {/* Hairline separator between the CTA and the route list. Pure-pixel
          divider rather than a heavy bar so the rail stays calm. */}
      <Box
        sx={{
          mx: 2,
          height: '1px',
          bgcolor: theme.palette.divider,
        }}
      />

      <Stack spacing={0.25} sx={{ flex: 1, py: 1, px: 1 }}>
        {NAV_ITEMS.map((item) =>
          renderItem(
            item.label,
            item.icon,
            () => handleNavigate(resolvePath(item)),
            { active: isActive(item) }
          )
        )}
      </Stack>

      {/* Utility tier — hairline divider above marks the demotion in
          hierarchy without adding chrome. */}
      <Box
        sx={{
          mx: 2,
          height: '1px',
          bgcolor: theme.palette.divider,
        }}
      />
      <Stack spacing={0.25} sx={{ py: 1, px: 1, pb: 1.5 }}>
        {UTILITY_ITEMS.map((item) =>
          renderItem(
            item.label,
            item.icon,
            () => handleNavigate(resolvePath(item)),
            { active: isActive(item) }
          )
        )}
      </Stack>
    </Box>
  );

  if (isLgUp) {
    return (
      <Drawer
        variant="permanent"
        sx={{
          width: SIDE_NAV_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: SIDE_NAV_WIDTH,
            boxSizing: 'border-box',
            top: APP_HEADER_HEIGHT,
            height: `calc(100vh - ${APP_HEADER_HEIGHT}px)`,
            borderRight: 0,
          },
        }}
      >
        {navContent}
      </Drawer>
    );
  }

  return (
    <Drawer
      variant="temporary"
      open={mobileOpen}
      onClose={onMobileClose}
      ModalProps={{ keepMounted: true }}
      sx={{
        '& .MuiDrawer-paper': {
          width: SIDE_NAV_WIDTH,
          boxSizing: 'border-box',
        },
      }}
    >
      {navContent}
    </Drawer>
  );
};

export default SideNav;
