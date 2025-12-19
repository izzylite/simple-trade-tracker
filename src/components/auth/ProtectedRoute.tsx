import React from 'react';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '../../contexts/SupabaseAuthContext';
import LoginPrompt from './LoginPrompt';

interface ProtectedRouteProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

/**
 * ProtectedRoute Component
 * Wraps page content and shows LoginPrompt for unauthenticated users
 * Shows loading spinner while authentication state is being determined
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  title,
  subtitle
}) => {
  const { user, loading } = useAuth();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'custom.pageBackground'
        }}
      >
        <CircularProgress size={60} />
      </Box>
    );
  }

  // Show login prompt if not authenticated
  if (!user) {
    return (
      <LoginPrompt
        title={title}
        subtitle={subtitle}
      />
    );
  }

  // Render protected content if authenticated
  return <>{children}</>;
};

export default ProtectedRoute;

