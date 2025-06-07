import React from 'react';
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
  Google as GoogleIcon
} from '@mui/icons-material';
import { useTheme, alpha } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface AppHeaderProps {
  onToggleTheme: () => void;
  mode: 'light' | 'dark';
  title?: string;
  showBackButton?: boolean;
  backButtonPath?: string;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  onToggleTheme,
  mode,
  title = 'Trade Tracker',
  showBackButton = false,
  backButtonPath = '/'
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user, signOut, signInWithGoogle } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Failed to sign in:', error);
    }
  };

  return (
    <AppBar
      position="fixed"
      color="transparent"
      elevation={0.7}
      sx={{
        backdropFilter: 'blur(8px)',
        backgroundColor: alpha(mode === 'light' ? '#ffffff' : theme.palette.background.default, 0.9),
        borderBottom: `1px solid ${theme.palette.divider}`,
        zIndex: (theme) => theme.zIndex.drawer + 1
      }}
    >
      <Toolbar>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexGrow: 1 }}>
          {showBackButton && (
            <IconButton
              onClick={() => navigate(backButtonPath)}
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
          <Typography variant="h5" component="h1" sx={{ flexGrow: 1 }}>
            {title}
          </Typography>
        </Box>
        
        {user ? (
          <Stack direction="row" spacing={2} alignItems="center">
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
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="text.secondary">
                {user.email}
              </Typography>
              <Avatar
                src={user.photoURL || undefined}
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: theme.palette.primary.main,
                  fontSize: '0.875rem'
                }}
              >
                {user.email ? user.email[0].toUpperCase() : 'U'}
              </Avatar>
            </Stack>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<LogoutIcon />}
              onClick={handleSignOut}
              size="small"
            >
              Sign Out
            </Button>
          </Stack>
        ) : (
          <Stack direction="row" spacing={2} alignItems="center">
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
              startIcon={<GoogleIcon />}
              onClick={handleSignIn}
              sx={{
                bgcolor: '#4285F4',
                '&:hover': {
                  bgcolor: '#3367D6'
                }
              }}
            >
              Sign in with Google
            </Button>
          </Stack>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default AppHeader;
