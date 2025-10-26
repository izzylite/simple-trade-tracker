/**
 * Auth Callback Component
 * Handles OAuth callback from Supabase Auth
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        logger.info('AuthCallback: Starting callback handling');
        logger.info('AuthCallback: Current URL:', window.location.href);
        logger.info('AuthCallback: Search params:', Object.fromEntries(searchParams.entries()));

        // Check for OAuth errors first
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (error) {
          logger.error('OAuth error:', error, errorDescription);
          setError(errorDescription || error);
          setIsProcessing(false);
          return;
        }

        logger.info('AuthCallback: Processing OAuth callback...');

        // For implicit flow, Supabase handles the session automatically
        // We just need to get the current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          logger.error('Error getting session:', sessionError);
          setError(sessionError.message);
          setIsProcessing(false);
          return;
        }

        if (session) {
          logger.info('Authentication successful, redirecting to dashboard');
          logger.info('Session user:', session.user.email);
          // Redirect to dashboard after successful authentication
          navigate('/dashboard', { replace: true });
        } else {
          logger.error('No session found after OAuth callback');
          setError('Authentication failed: No session created');
          setIsProcessing(false);
        }

      } catch (error) {
        logger.error('Auth callback error:', error);
        setError('Authentication failed: Unexpected error occurred');
        setIsProcessing(false);
      }
    };

    handleAuthCallback();
  }, [navigate, searchParams]);

  // Auto-redirect to home after error
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        navigate('/', { replace: true });
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [error, navigate]);

  if (isProcessing) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 2,
          px: 2
        }}
      >
        <CircularProgress size={48} />
        <Typography variant="h6" color="text.secondary">
          Completing sign in...
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Please wait while we finish setting up your account.
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 2,
          px: 2,
          maxWidth: 500,
          mx: 'auto'
        }}
      >
        <Alert severity="error" sx={{ width: '100%' }}>
          <Typography variant="h6" gutterBottom>
            Authentication Failed
          </Typography>
          <Typography variant="body2">
            {error}
          </Typography>
        </Alert>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          You will be redirected to the home page in a few seconds.
        </Typography>
      </Box>
    );
  }

  return null;
};

export default AuthCallback;
