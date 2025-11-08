import React from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Button,
  useTheme,
  alpha,
  Paper
} from '@mui/material';
import {
  Google as GoogleIcon,
  TrendingUp,
  Analytics,
  CalendarMonth,
  SmartToy,
  MenuBook,
  Note
} from '@mui/icons-material';
import { useAuth } from '../../contexts/SupabaseAuthContext';
import { logger } from '../../utils/logger';
import { dialogProps } from '../../styles/dialogStyles';
import { scrollbarStyles } from '../../styles/scrollbarStyles';

interface LoginDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  showFeatures?: boolean;
}

export interface LoginPromptContentProps {
  title?: string;
  subtitle?: string;
  showFeatures?: boolean;
  onAfterSignIn?: () => void;
}

export const LoginPromptContent: React.FC<LoginPromptContentProps> = ({
  title = 'Sign In',
  subtitle = 'Please sign in to access this feature',
  showFeatures = true,
  onAfterSignIn,
}) => {
  const theme = useTheme();
  const { signInWithGoogle } = useAuth();

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
      onAfterSignIn && onAfterSignIn();
    } catch (error) {
      logger.error('Failed to sign in:', error);
    }
  };

  const features = [
    {
      icon: <MenuBook sx={{ fontSize: 28, color: 'primary.main' }} />,
      title: 'Journal Trades',
      description: 'Document and organize all your trades in one place'
    },
    {
      icon: <Note sx={{ fontSize: 28, color: 'warning.main' }} />,
      title: 'Notes',
      description: 'Capture your thoughts, ideas, and trade insights with rich text notes'
    },
    {
      icon: <TrendingUp sx={{ fontSize: 28, color: 'success.main' }} />,
      title: 'Track Performance',
      description: 'Monitor your trading performance with detailed analytics'
    },
    {
      icon: <Analytics sx={{ fontSize: 28, color: 'info.main' }} />,
      title: 'Advanced Analytics',
      description: 'Get insights with comprehensive charts and metrics'
    },
    {
      icon: <CalendarMonth sx={{ fontSize: 28, color: 'warning.main' }} />,
      title: 'Economic Calendar',
      description: 'Stay informed with real-time economic events and news'
    },
    {
      icon: <SmartToy sx={{ fontSize: 28, color: 'secondary.main' }} />,
      title: 'AI Trading Assistant',
      description: 'Get intelligent insights and analysis powered by AI'
    }
  ];

  return (
    <React.Fragment>
      {/* Header with gradient background and app logo */}
      <Box
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
          py: 5,
          px: 3,
          textAlign: 'center'
        }}
      >
        {/* App Logo */}
        <Box
          sx={{
            margin: '0 auto',
            mb: 3
          }}
        >
          <Box
            component="img"
            src="/android-chrome-192x192.png"
            alt="Cotex Logo"
            sx={{
              width: 80,
              height: 80,
              borderRadius: '20px',
              boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.3)}`,
            }}
          />
        </Box>

        {/* Title */}
        <Typography variant="h4" sx={{ color: 'white', fontWeight: 700, mb: 1 }}>
          {title}
        </Typography>

        {/* Subtitle */}
        <Typography variant="body1" sx={{ color: alpha(theme.palette.common.white, 0.9) }}>
          {subtitle}
        </Typography>
      </Box>

      {/* Content Section */}
      <Box sx={{ p: 4 }}>
        {/* Sign In Button */}
        <Button
          variant="contained"
          size="large"
          fullWidth
          startIcon={<GoogleIcon />}
          onClick={handleSignIn}
          sx={{
            py: 1.5,
            fontSize: '1rem',
            fontWeight: 600,
            textTransform: 'none',
            bgcolor: '#4285F4',
            color: 'white',
            '&:hover': {
              bgcolor: '#3367D6',
              transform: 'translateY(-2px)',
              boxShadow: theme.shadows[8]
            },
            transition: 'all 0.3s ease-in-out',
            mb: showFeatures ? 4 : 0
          }}
        >
          Sign in with Google
        </Button>

        {/* Features Section */}
        {showFeatures && (
          <Box>
            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{ textAlign: 'center', mb: 2 }}
            >
              What you'll get:
            </Typography>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                maxHeight: '300px',
                overflow: 'auto',
                pr: 1,
                ...scrollbarStyles(theme)
              }}
            >
              {features.map((feature, index) => (
                <Paper
                  key={index}
                  sx={{
                    p: 2,
                    display: 'flex',
                    gap: 2,
                    alignItems: 'flex-start',
                    bgcolor: alpha(theme.palette.background.default, 0.5),
                    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    borderRadius: 2,
                    '&:hover': {
                      bgcolor: alpha(theme.palette.background.default, 0.8)
                    }
                  }}
                >
                  <Box sx={{ flexShrink: 0 }}>
                    {feature.icon}
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      {feature.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {feature.description}
                    </Typography>
                  </Box>
                </Paper>
              ))}
            </Box>
          </Box>
        )}

        {/* Footer text */}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ textAlign: 'center', mt: 3, display: 'block' }}
        >
          By signing in, you agree to our Terms of Service and Privacy Policy
        </Typography>
      </Box>
    </React.Fragment>
  );
};

/**
 * LoginDialog Component
 * Reusable dialog component that displays a login prompt for unauthenticated users
 * Features the app logo, customizable title/subtitle, and optional feature highlights
 */
const LoginDialog: React.FC<LoginDialogProps> = ({
  open,
  onClose,
  title = 'Sign In',
  subtitle = 'Please sign in to access this feature',
  showFeatures = true,
}) => {
  const theme = useTheme();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      {...dialogProps}
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden',
          background: theme.palette.mode === 'dark'
            ? `linear-gradient(145deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(theme.palette.background.default, 0.98)} 100%)`
            : `linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.98) 100%)`,
        }
      }}
    >
      <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
        <LoginPromptContent
          title={title}
          subtitle={subtitle}
          showFeatures={showFeatures}
          onAfterSignIn={onClose}
        />
      </DialogContent>
    </Dialog>
  );
};

export default LoginDialog;

