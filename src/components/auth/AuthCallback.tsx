/**
 * Auth Callback Component
 * Handles OAuth callback from Supabase Auth
 *
 * Following Supabase best practices:
 * - Uses onAuthStateChange for event-driven authentication
 * - No manual delays or polling
 * - Proper cleanup of auth listeners
 */

import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const hasRedirected = useRef(false);

  useEffect(() => {
    logger.info('AuthCallback: Starting callback handling');
    logger.info('AuthCallback: Current URL:', window.location.href);
    logger.info('AuthCallback: Search params:', Object.fromEntries(searchParams.entries()));

    // Check for OAuth errors first
    const oauthError = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (oauthError) {
      logger.error('OAuth error:', oauthError, errorDescription);
      setError(errorDescription || oauthError);
      setIsProcessing(false);
      return;
    }

    // Set up auth state listener for event-driven authentication
    // This is the recommended Supabase pattern instead of polling
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      logger.info('AuthCallback: Auth event received:', event);

      // Prevent multiple redirects
      if (hasRedirected.current) {
        return;
      }

      if (event === 'SIGNED_IN' && session) {
        logger.info('Authentication successful via SIGNED_IN event');
        logger.info('Session user:', session.user.email);
        hasRedirected.current = true;
        navigate('/dashboard', { replace: true });
      } else if (event === 'INITIAL_SESSION' && session) {
        // Handle case where session already exists on page load
        logger.info('Authentication successful via INITIAL_SESSION event');
        logger.info('Session user:', session.user.email);
        hasRedirected.current = true;
        navigate('/dashboard', { replace: true });
      } else if (event === 'INITIAL_SESSION' && !session) {
        // No session found after initial check
        logger.error('No session found after OAuth callback');
        setError('Authentication failed: No session created');
        setIsProcessing(false);
      }
    });

    // Cleanup function to unsubscribe from auth changes
    return () => {
      logger.info('AuthCallback: Cleaning up auth listener');
      subscription.unsubscribe();
    };
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
