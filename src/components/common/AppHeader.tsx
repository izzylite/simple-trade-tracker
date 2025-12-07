import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Button,
  Stack,
  Avatar,
  Box
} from '@mui/material';
import {
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
  Logout as LogoutIcon,
  ArrowBack as ArrowBackIcon,
  Dashboard as DashboardIcon,
  Home as HomeIcon,
  Article as ArticleIcon,
  CalendarMonth as CalendarIcon,
  Delete as TrashIcon,
  Menu as MenuIcon
} from '@mui/icons-material';
import { useTheme, alpha } from '@mui/material/styles';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/SupabaseAuthContext';
import { error } from '../../utils/logger';
import DebugPanel from './DebugPanel';
import LoginDialog from '../auth/LoginDialog';

interface AppHeaderProps {
  onToggleTheme: () => void;
  mode: 'light' | 'dark';
  onMenuClick?: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  onToggleTheme,
  mode,
  onMenuClick
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  

  // Check if current user is authorized for debug panel
  const isDebugAuthorized = user?.email === 'isl.israelite@gmail.com';

  // Debug panel keyboard shortcut (Ctrl+Shift+D) - only for authorized user
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Case-insensitive check, and also check keyCode for better browser compatibility
      const isD = event.key.toUpperCase() === 'D' || event.code === 'KeyD';
      if (event.ctrlKey && event.shiftKey && isD && isDebugAuthorized) {
        event.preventDefault();
        event.stopPropagation();
        setDebugPanelOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isDebugAuthorized]);

  // Expose debug panel opener to console for authorized users
  useEffect(() => {
    if (isDebugAuthorized) {
      (window as any).openDebugPanel = () => setDebugPanelOpen(true);
    }
    return () => {
      delete (window as any).openDebugPanel;
    };
  }, [isDebugAuthorized]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (err) {
      error('Error signing out:', err);
    }
  };

  const handleSignIn = () => {
    setLoginDialogOpen(true);
  };

  return (
    <>
    <AppBar
      position="fixed"
      color="transparent"
      elevation={0}
      sx={{
        backdropFilter: 'blur(8px)',
        backgroundColor: alpha(mode === 'light' ? '#ffffff' : theme.palette.background.default, 0.9),
        borderBottom: `1px solid ${theme.palette.divider}`,
        boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.08)',
        zIndex: (theme) => theme.zIndex.appBar,
        width: '100%'
      }}
    >
      <Toolbar sx={{ px: { xs: 1, sm: 3 } }}> {/* Responsive padding */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexGrow: 1,
          minWidth: 0 // Allow text truncation
        }}>
          {/* Hamburger Menu Icon */}
          {onMenuClick && (
            <IconButton
              onClick={onMenuClick}
              size="small"
              edge="start"
              sx={{
                color: 'text.secondary',
                mr: 1,
                '&:hover': {
                  color: 'primary.main',
                  bgcolor: alpha(theme.palette.primary.main, 0.08)
                }
              }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              cursor: 'pointer',
              '&:hover .logo-img': {
                transform: 'scale(1.05)'
              },
              '&:hover .logo-text': {
                filter: 'brightness(1.1)'
              }
            }}
            onClick={() => navigate('/')}
          >
            <Box
              component="img"
              src="/android-chrome-192x192.png"
              alt="JournoTrades Logo"
              className="logo-img"
              sx={{
                width: 32,
                height: 32, 
                borderRadius: 1,
                transition: 'transform 0.2s'
              }}
            />
            <Typography
              variant="h6"
              component="h1"
              className="logo-text"
              sx={{
                fontSize: { xs: '1.1rem', sm: '1.25rem' },
                fontWeight: 700,
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                transition: 'all 0.2s'
              }}
            >
              JournoTrades
            </Typography>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
        </Box>
        
        {user ? (
          <Stack
            direction="row"
            spacing={{ xs: 0.5, sm: 2 }} // Tighter spacing on mobile
            alignItems="center"
          >
            <IconButton
              onClick={onToggleTheme}
              color="inherit"
              size="small"
              sx={{
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                }
              }}
            >
              {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
            <Stack
              direction="row"
              spacing={{ xs: 0.5, sm: 1 }} // Tighter spacing on mobile
              alignItems="center"
              sx={{
                display: { xs: 'none', sm: 'flex' } // Hide email on mobile
              }}
            >
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  maxWidth: { xs: '80px', sm: 'none' }, // Limit width on small screens
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {user.email}
              </Typography>
            </Stack>
            <Avatar
              src={user.photoURL || undefined}
              sx={{
                width: { xs: 28, sm: 32 }, // Smaller avatar on mobile
                height: { xs: 28, sm: 32 },
                bgcolor: theme.palette.primary.main,
                fontSize: '0.875rem'
              }}
            >
              {user.email ? user.email[0].toUpperCase() : 'U'}
            </Avatar>
            <Button
              variant="outlined"
              color="inherit"
              onClick={handleSignOut}
              size="small"
              sx={{
                minWidth: { xs: 'auto', sm: 'auto' },
                px: { xs: 1, sm: 2 }, // Less padding on mobile
                fontSize: { xs: '0.75rem', sm: '0.875rem' } // Smaller text on mobile
              }}
            >
              <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 0.5 }}>
                <LogoutIcon sx={{ fontSize: 16 }} />
                Sign Out
              </Box>
              <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
                <LogoutIcon sx={{ fontSize: 16 }} />
              </Box>
            </Button>
          </Stack>
        ) : (
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton
              onClick={onToggleTheme}
              color="inherit"
              size="small"
              sx={{
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                }
              }}
            >
              {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSignIn}
              size="small"
              sx={{
                px: 2,
                fontSize: '0.875rem',
                textTransform: 'none'
              }}
            >
              Sign In
            </Button>
          </Stack>
        )}
      </Toolbar>
    </AppBar>

    {/* Debug Panel - Only for authorized user */}
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
