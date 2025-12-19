import React from 'react';
import { Box, Container, useTheme, alpha, Paper } from '@mui/material';
import { LoginPromptContent } from './LoginDialog';

interface LoginPromptProps {
  title?: string;
  subtitle?: string;
}

/**
 * LoginPrompt Component
 * Displays a centered login prompt for unauthenticated users
 * Used across all protected pages to maintain consistent authentication UX
 */
const LoginPrompt: React.FC<LoginPromptProps> = ({
  title = 'Sign In Required',
  subtitle = 'Please sign in to access this feature',
}) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'custom.pageBackground',
        py: 8,
      }}
    >
      <Container maxWidth="sm">
        <Paper
          sx={{
            borderRadius: 3,
            boxShadow: theme.shadows[8],
            overflow: 'hidden',
            background: theme.palette.mode === 'dark'
              ? `linear-gradient(145deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(theme.palette.background.default, 0.98)} 100%)`
              : `linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.98) 100%)`,
          }}
        >
          <LoginPromptContent
            title={title}
            subtitle={subtitle}
          />
        </Paper>
      </Container>
    </Box>
  );
};

export default LoginPrompt;

