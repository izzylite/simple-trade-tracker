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
  onBackClick?: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  onToggleTheme,
  mode,
  title = 'Trade Tracker',
  showBackButton = false,
  backButtonPath = '/',
  onBackClick
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

  const handleBackButtonClick = () => {
    if (onBackClick) {
      onBackClick();
    } else {
      navigate(backButtonPath);
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
      <Toolbar sx={{ px: { xs: 1, sm: 3 } }}> {/* Responsive padding */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 1, sm: 2 }, // Smaller gap on mobile
          flexGrow: 1,
          minWidth: 0 // Allow text truncation
        }}>
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
          <Typography
            variant="h5"
            component="h1"
            sx={{
              flexGrow: 1,
              fontSize: { xs: '1.1rem', sm: '1.5rem' }, // Responsive font size
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0
            }}
          >
            {title}
          </Typography>
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
            <Button
              variant="contained"
              onClick={handleSignIn}
              size="small"
              sx={{
                bgcolor: '#4285F4',
                '&:hover': {
                  bgcolor: '#3367D6'
                },
                px: { xs: 1.5, sm: 2 }, // Less padding on mobile
                fontSize: { xs: '0.75rem', sm: '0.875rem' }, // Smaller text on mobile
                minWidth: { xs: 'auto', sm: 'auto' }
              }}
            >
              <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 0.5 }}>
                <GoogleIcon sx={{ fontSize: 16 }} />
                Sign in with Google
              </Box>
              <Box sx={{ display: { xs: 'block', sm: 'none' } }}>Sign In</Box>
            </Button>
          </Stack>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default AppHeader;
