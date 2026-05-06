import React from 'react';
import {
  Box,
  Drawer,
  ButtonBase,
  Typography,
  Divider,
  Tooltip,
  Stack,
  alpha,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Home as HomeIcon,
  ShowChart as PerformanceIcon,
  SmartToy as AssistantIcon,
  Notes as NotesIcon,
  AddCircleOutline as AddIcon,
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';

export const SIDE_NAV_WIDTH = 84;
const APP_HEADER_HEIGHT = 64;
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

interface SideNavProps {
  /** Triggered by the bottom "+ New Calendar" button. Phase 7 wires this up. */
  onNewCalendar?: () => void;
  /** Mobile drawer open state — only used when <lg. */
  mobileOpen: boolean;
  /** Closes the mobile drawer (after item click or backdrop tap). */
  onMobileClose: () => void;
}

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

  const renderItem = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    options?: { active?: boolean; disabled?: boolean; tooltip?: string }
  ) => {
    const active = options?.active ?? false;
    const disabled = options?.disabled ?? false;
    const button = (
      <ButtonBase
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        focusRipple
        sx={{
          width: '100%',
          py: 1,
          px: 0.5,
          borderRadius: 1.5,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.5,
          transition: 'all 0.15s',
          color: active ? 'primary.main' : 'text.secondary',
          bgcolor: active
            ? alpha(theme.palette.primary.main, 0.12)
            : 'transparent',
          opacity: disabled ? 0.5 : 1,
          '&:hover': disabled
            ? undefined
            : {
                bgcolor: active
                  ? alpha(theme.palette.primary.main, 0.16)
                  : alpha(theme.palette.action.hover, 1),
                color: active ? 'primary.main' : 'text.primary',
              },
          '& svg': { fontSize: 22 },
        }}
      >
        {icon}
        <Typography
          sx={{
            fontSize: '0.6875rem',
            fontWeight: active ? 600 : 500,
            lineHeight: 1.1,
            textAlign: 'center',
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
      <Stack spacing={0.25} sx={{ flex: 1, py: 1.5, px: 1 }}>
        {NAV_ITEMS.map((item) =>
          renderItem(
            item.label,
            item.icon,
            () => handleNavigate(resolvePath(item)),
            { active: isActive(item) }
          )
        )}
      </Stack>

      <Divider />

      <Box sx={{ p: 1 }}>
        {renderItem(
          'New',
          <AddIcon />,
          handleNewCalendar,
          {
            disabled: !onNewCalendar,
            tooltip: onNewCalendar ? '' : 'Coming soon',
          }
        )}
      </Box>
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
