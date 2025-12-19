import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Button,
  Stack,
  Avatar,
  Box,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  SvgIcon
} from '@mui/material';
import {
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
  Logout as LogoutIcon,
  BugReport as BugReportIcon
} from '@mui/icons-material';
import { useTheme, alpha } from '@mui/material/styles';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/SupabaseAuthContext';
import { error } from '../../utils/logger';
import DebugPanel from './DebugPanel';
import LoginDialog from '../auth/LoginDialog';

// Discord icon component
const DiscordIcon = (props: any) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </SvgIcon>
);

interface AppHeaderProps {
  onToggleTheme: () => void;
  mode: 'light' | 'dark';
}

interface NavItem {
  label: string;
  path: string;
  authRequired?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', path: '/' },
  { label: 'About', path: '/about' }
];

const AppHeader: React.FC<AppHeaderProps> = ({ onToggleTheme, mode }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();

  const [debugPanelOpen, setDebugPanelOpen] = useState(false);
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);

  const isDebugAuthorized = user?.email === 'isl.israelite@gmail.com';

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  const handleNavClick = (path: string) => {
    if (path === '/' && user) {
      navigate('/dashboard');
    } else {
      navigate(path);
    }
  };

  const handleSignOut = async () => {
    setUserMenuAnchor(null);
    try {
      await signOut();
      navigate('/');
    } catch (err) {
      error('Error signing out:', err);
    }
  };

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  return (
    <>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          bgcolor: alpha(theme.palette.background.paper, 0.8),
          backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        }}
      >
        <Toolbar
          sx={{
            px: { xs: 2, sm: 3 },
            minHeight: { xs: 56, sm: 64 },
            gap: 2
          }}
        >
          {/* Logo */}
          <Box
            onClick={() => navigate(user ? '/dashboard' : '/')}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              cursor: 'pointer',
              '&:hover': {
                '& .logo-img': { transform: 'scale(1.05)' },
                '& .logo-text': { opacity: 0.8 }
              }
            }}
          >
            <Box
              component="img"
              src="/android-chrome-192x192.png"
              alt="JournoTrades"
              className="logo-img"
              sx={{
                width: { xs: 36, sm: 40 },
                height: { xs: 36, sm: 40 },
                borderRadius: 1.5,
                transition: 'transform 0.2s ease'
              }}
            />
            <Typography
              variant="h6"
              className="logo-text"
              sx={{
                display: { xs: 'none', sm: 'block' },
                fontWeight: 700,
                fontSize: { xs: '1.25rem', sm: '1.375rem' },
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                transition: 'opacity 0.2s ease'
              }}
            >
              JournoTrades
            </Typography>
          </Box>

          {/* Spacer */}
          <Box sx={{ flexGrow: 1 }} />

          {/* Right Section: Navigation + Actions */}
          <Stack direction="row" spacing={{ xs: 1, sm: 2 }} alignItems="center">
            {/* Navigation */}
            <Stack
              component="nav"
              direction="row"
              spacing={0.5}
              sx={{ mr: { xs: 0, sm: 1 } }}
            >
              {NAV_ITEMS.map((item) => {
                const active = isActive(item.path);
                return (
                  <Button
                    key={item.path}
                    onClick={() => handleNavClick(item.path)}
                    size="small"
                    sx={{
                      px: { xs: 1.5, sm: 2 },
                      py: 0.75,
                      borderRadius: 2,
                      fontSize: { xs: '0.8125rem', sm: '0.875rem' },
                      fontWeight: active ? 600 : 500,
                      color: active ? 'primary.main' : 'text.secondary',
                      bgcolor: active ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                      textTransform: 'none',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        bgcolor: active
                          ? alpha(theme.palette.primary.main, 0.12)
                          : alpha(theme.palette.action.hover, 0.08),
                        color: active ? 'primary.main' : 'text.primary'
                      }
                    }}
                  >
                    {item.label}
                  </Button>
                );
              })}
            </Stack>
            {/* Debug Button - Admin only */}
            {isDebugAuthorized && (
              <IconButton
                onClick={() => setDebugPanelOpen(true)}
                size="small"
                sx={{
                  color: 'text.secondary',
                  '&:hover': {
                    color: 'warning.main',
                    bgcolor: alpha(theme.palette.warning.main, 0.08)
                  }
                }}
              >
                <BugReportIcon fontSize="small" />
              </IconButton>
            )}

            {/* Discord */}
            <IconButton
              component="a"
              href="https://discord.gg/9Dt2fNVpr"
              target="_blank"
              rel="noopener noreferrer"
              size="small"
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  color: '#5865F2',
                  bgcolor: alpha('#5865F2', 0.08)
                }
              }}
            >
              <DiscordIcon fontSize="small" />
            </IconButton>

            {/* Theme Toggle */}
            <IconButton
              onClick={onToggleTheme}
              size="small"
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  color: mode === 'dark' ? 'warning.light' : 'primary.main',
                  bgcolor: alpha(
                    mode === 'dark' ? theme.palette.warning.main : theme.palette.primary.main,
                    0.08
                  )
                }
              }}
            >
              {mode === 'dark' ? (
                <LightModeIcon fontSize="small" />
              ) : (
                <DarkModeIcon fontSize="small" />
              )}
            </IconButton>

            {/* User Section */}
            {user ? (
              <>
                <Avatar
                  src={user.photoURL || undefined}
                  onClick={handleUserMenuOpen}
                  sx={{
                    width: 32,
                    height: 32,
                    cursor: 'pointer',
                    bgcolor: theme.palette.primary.main,
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    '&:hover': {
                      transform: 'scale(1.05)',
                      boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.3)}`
                    }
                  }}
                >
                  {user.email?.[0]?.toUpperCase() || 'U'}
                </Avatar>

                <Menu
                  anchorEl={userMenuAnchor}
                  open={Boolean(userMenuAnchor)}
                  onClose={handleUserMenuClose}
                  transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                  anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                  slotProps={{
                    paper: {
                      sx: {
                        mt: 1,
                        minWidth: 200,
                        borderRadius: 2,
                        boxShadow: theme.shadows[8],
                        border: `1px solid ${alpha(theme.palette.divider, 0.08)}`
                      }
                    }
                  }}
                >
                  <Box sx={{ px: 2, py: 1.5 }}>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {user.displayName || 'User'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {user.email}
                    </Typography>
                  </Box>
                  <Divider />
                  <MenuItem
                    onClick={handleSignOut}
                    sx={{
                      py: 1.5,
                      color: 'error.main',
                      '&:hover': {
                        bgcolor: alpha(theme.palette.error.main, 0.08)
                      }
                    }}
                  >
                    <ListItemIcon>
                      <LogoutIcon fontSize="small" color="error" />
                    </ListItemIcon>
                    <ListItemText>Sign Out</ListItemText>
                  </MenuItem>
                </Menu>
              </>
            ) : (
              <Button
                variant="contained"
                size="small"
                onClick={() => setLoginDialogOpen(true)}
                sx={{
                  px: 2.5,
                  py: 0.75,
                  borderRadius: 2,
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  boxShadow: 'none',
                  '&:hover': {
                    boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`
                  }
                }}
              >
                Sign In
              </Button>
            )}
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Debug Panel */}
      {isDebugAuthorized && (
        <DebugPanel
          open={debugPanelOpen}
          onClose={() => setDebugPanelOpen(false)}
        />
      )}

      {/* Login Dialog */}
      <LoginDialog
        open={loginDialogOpen}
        onClose={() => setLoginDialogOpen(false)}
      />
    </>
  );
};

export default AppHeader;
