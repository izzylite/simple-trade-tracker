import React from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  useTheme,
  alpha,
  Chip,
  IconButton,
  Tooltip,
  useMediaQuery
} from '@mui/material';
import {
  Home as HomeIcon,
  CalendarMonth as CalendarIcon,
  Notes as EditIcon,
  People as CommunityIcon,
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

const DRAWER_WIDTH_EXPANDED = 310;
const DRAWER_WIDTH_COLLAPSED = 72;

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  badge?: string;
  comingSoon?: boolean;
}

interface SideNavigationProps {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const SideNavigation: React.FC<SideNavigationProps> = ({ open, onClose, collapsed, onToggleCollapse }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isMdDown = useMediaQuery(theme.breakpoints.down('md'));

  const navigationItems: NavigationItem[] = [
    {
      id: 'home',
      label: 'Home',
      icon: <HomeIcon />,
      path: '/'
    },
    {
      id: 'calendars',
      label: 'Calendars',
      icon: <CalendarIcon />,
      path: '/calendars'
    },
    {
      id: 'notes',
      label: 'Notes',
      icon: <EditIcon />,
      path: '/notes'
    },
    {
      id: 'community',
      label: 'Community',
      icon: <CommunityIcon />,
      path: '/community',
      comingSoon: true
    }
  ];

  const handleNavigate = (item: NavigationItem) => {
    if (item.comingSoon) {
      return;
    }
    navigate(item.path);
    // Close overlay drawer on small screens; otherwise auto-collapse if expanded
    if (isMdDown) {
      onClose();
    } else if (!collapsed) {
      onToggleCollapse();
    }
  };

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const effectiveCollapsed = isMdDown ? false : collapsed;
  const drawerWidth = effectiveCollapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH_EXPANDED;

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo/Brand Section */}
      <Box
        sx={{
          p: effectiveCollapsed ? 2 : 3,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          maxHeight: 65,
          display: 'flex',
          alignItems: 'center',
          justifyContent: effectiveCollapsed ? 'center' : 'flex-start',
          gap: 2,
          transition: theme.transitions.create(['padding', 'justify-content'], {
            duration: theme.transitions.duration.shorter,
          })
        }}
      >
        {effectiveCollapsed ? (
          <IconButton
            onClick={onToggleCollapse}
            sx={{
              color: 'primary.main',
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.1)
              }
            }}
          >
            <MenuIcon />
          </IconButton>
        ) : (
          <>
            <Box
              component="img"
              src="/android-chrome-192x192.png"
              alt="JournoTrades Logo"
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                opacity: effectiveCollapsed ? 0 : 1,
                transition: theme.transitions.create('opacity', {
                  duration: theme.transitions.duration.shorter,
                  delay: effectiveCollapsed ? 0 : theme.transitions.duration.shorter,
                })
              }}
            />
            <Box
              sx={{
                flex: 1
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  opacity: effectiveCollapsed ? 0 : 1,
                  visibility: effectiveCollapsed ? 'hidden' : 'visible',
                  transition: theme.transitions.create(['opacity', 'visibility'], {
                    duration: 800, // Slower fade-in (800ms)
                    delay: effectiveCollapsed ? 0 : 800, // Delay after drawer is fully expanded (800ms)
                  })
                }}
              >
                JournoTrades
              </Typography>
            </Box>
            <IconButton
              onClick={onToggleCollapse}
              sx={{
                display: { xs: 'none', lg: 'inline-flex' },
                color: 'primary.main',
                opacity: effectiveCollapsed ? 0 : 1,
                transition: theme.transitions.create('opacity', {
                  duration: theme.transitions.duration.shorter,
                  delay: effectiveCollapsed ? 0 : theme.transitions.duration.shorter,
                }),
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.1)
                }
              }}
            >
              <ChevronLeftIcon />
            </IconButton>
          </>
        )}
      </Box>

      {/* Navigation Items */}
      <List sx={{ flex: 1, pt: 2, px: effectiveCollapsed ? 1 : 1.5 }}>
        {navigationItems.map((item) => {
          const active = isActive(item.path);
          const navButton = (
            <ListItemButton
              onClick={() => handleNavigate(item)}
              disabled={item.comingSoon}
              sx={{
                borderRadius: 2,
                py: 1.5,
                px: effectiveCollapsed ? 0 : 2,
                justifyContent: effectiveCollapsed ? 'center' : 'flex-start',
                bgcolor: active ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                color: active ? theme.palette.primary.main : theme.palette.text.primary,
                transition: theme.transitions.create(['padding', 'justify-content'], {
                  duration: theme.transitions.duration.shorter,
                }),
                '&:hover': {
                  bgcolor: active
                    ? alpha(theme.palette.primary.main, 0.15)
                    : alpha(theme.palette.action.hover, 0.05)
                },
                '&.Mui-disabled': {
                  opacity: 0.6
                }
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: effectiveCollapsed ? 'auto' : 40,
                  color: active ? theme.palette.primary.main : theme.palette.text.secondary,
                  justifyContent: 'center',
                  transition: theme.transitions.create('min-width', {
                    duration: theme.transitions.duration.shorter,
                  })
                }}
              >
                {item.icon}
              </ListItemIcon>
              {!effectiveCollapsed && (
                <>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontSize: '0.95rem',
                      fontWeight: active ? 600 : 500
                    }}
                  />
                  {item.comingSoon && (
                    <Chip
                      label="Soon"
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.7rem',
                        bgcolor: alpha(theme.palette.info.main, 0.1),
                        color: theme.palette.info.main
                      }}
                    />
                  )}
                  {item.badge && (
                    <Chip
                      label={item.badge}
                      size="small"
                      color="primary"
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  )}
                </>
              )}
            </ListItemButton>
          );

          return (
            <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
              {effectiveCollapsed ? (
                <Tooltip title={item.label} placement="right" arrow>
                  {navButton}
                </Tooltip>
              ) : (
                navButton
              )}
            </ListItem>
          );
        })}
      </List>

      {/* Footer Section */}
      {!effectiveCollapsed && (
        <Box
          sx={{
            p: 2,
            borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
            © 2025 JournoTrades
          </Typography>
        </Box>
      )}
    </Box>
  );

  return (
    <Drawer
      variant={isMdDown ? 'temporary' : 'permanent'}
      open={isMdDown ? open : true}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        transition: theme.transitions.create('width', {
          duration: theme.transitions.duration.shorter,
        }),
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          bgcolor: 'background.paper',
          borderRight: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          transition: theme.transitions.create('width', {
            duration: theme.transitions.duration.shorter,
          }),
          overflowX: 'hidden'
        }
      }}
    >
      {drawerContent}
    </Drawer>
  );
};

export default SideNavigation;
export { DRAWER_WIDTH_EXPANDED, DRAWER_WIDTH_COLLAPSED };

