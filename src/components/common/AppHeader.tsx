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
  Google as GoogleIcon,
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

interface AppHeaderProps {
  onToggleTheme: () => void;
  mode: 'light' | 'dark';
  title?: string;
  showBackButton?: boolean;
  backButtonPath?: string;
  onBackClick?: () => void;
  onMenuClick?: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  onToggleTheme,
  mode,
  title = 'Cotex',
  showBackButton = false,
  backButtonPath = '/',
  onBackClick,
  onMenuClick
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut, signInWithGoogle } = useAuth();
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);

  const isHomePage = location.pathname === '/';
  const isDashboardPage = location.pathname === '/dashboard';
  const isBlogPage = location.pathname === '/blog';

  // Check if current user is authorized for debug panel
  const isDebugAuthorized = user?.email === 'isl.israelite@gmail.com';

  // Debug panel keyboard shortcut (Ctrl+Shift+D) - only for authorized user
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'D' && isDebugAuthorized) {
        event.preventDefault();
        setDebugPanelOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDebugAuthorized]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (err) {
      error('Error signing out:', err);
    }
  };

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      error('Failed to sign in:', err);
    }
  };

  const handleBackButtonClick = () => {
    if (onBackClick) {
      onBackClick();
    } else {
      navigate(backButtonPath);
    }
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
          gap: { xs: 1, sm: 2 }, // Smaller gap on mobile
          flexGrow: 1,
          minWidth: 0 // Allow text truncation
        }}>
          {/* Hamburger Menu Icon */}
          {onMenuClick && !showBackButton && (
            <IconButton
              onClick={onMenuClick}
              size="small"
              edge="start"
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  color: 'primary.main',
                  bgcolor: alpha(theme.palette.primary.main, 0.08)
                }
              }}
            >
              <MenuIcon />
            </IconButton>
          )}
          {showBackButton && (
            <IconButton
              onClick={handleBackButtonClick}
              size="small"
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  color: 'primary.main',
                  bgcolor: alpha(theme.palette.primary.main, 0.08)
                }
              }}
            >
              <ArrowBackIcon />
            </IconButton>
          )}
          <IconButton
            onClick={() => navigate('/')}
            size="small"
            sx={{
              p: 0.5,
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.08)
              }
            }}
          >
            <Box
              component="img"
              src="/android-chrome-192x192.png"
              alt="Cotex Logo"
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1
              }}
            />
          </IconButton>
          {showBackButton && (
            <Typography
              variant="h5"
              component="h1"
              sx={{
                flexGrow: 1,
                fontSize: { xs: '1.1rem', sm: '1.5rem' },
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0
              }}
            >
              {title}
            </Typography>
          )}
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
              startIcon={<GoogleIcon />}
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
  </>
  );
};

export default AppHeader;
