import React from 'react';
import { Box, Container } from '@mui/material';
import { LoginPromptContent } from 'components/auth/LoginDialog';
import CardShell from 'components/common/CardShell';

interface LoginPromptProps {
  title?: string;
  subtitle?: string;
}

/**
 * LoginPrompt Component
 * Displays a centered login prompt for unauthenticated users.
 * Used across all protected pages to maintain consistent authentication UX.
 *
 * Wraps `LoginPromptContent` (which already supplies its own header band with
 * icon, title, and subtitle) in the canonical CardShell — divider-bordered
 * paper at 16px radius, no resting shadow.
 */
const LoginPrompt: React.FC<LoginPromptProps> = ({
  title = 'Sign In Required',
  subtitle = 'Please sign in to access this feature',
}) => {
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
        <CardShell radius="xl">
          <LoginPromptContent title={title} subtitle={subtitle} />
        </CardShell>
      </Container>
    </Box>
  );
};

export default LoginPrompt;
