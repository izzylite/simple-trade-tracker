/**
 * Supabase Auth Test Component
 * For testing Supabase authentication during migration
 */

import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Alert,
  Divider,
  Stack,
  Chip
} from '@mui/material';
import { Google as GoogleIcon } from '@mui/icons-material';
import { SupabaseAuthProvider, useSupabaseAuth } from '../../contexts/SupabaseAuthContext';
import { logger } from '../../utils/logger';

const SupabaseAuthTestContent: React.FC = () => {
  const { user, loading, signInWithGoogle, signOut, isAuthenticated, getAccessToken } = useSupabaseAuth();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    try {
      setError(null);
      await signInWithGoogle();
    } catch (error: any) {
      logger.error('Sign in error:', error);
      setError(error.message || 'Failed to sign in');
    }
  };

  const handleSignOut = async () => {
    try {
      setError(null);
      await signOut();
      setAccessToken(null);
    } catch (error: any) {
      logger.error('Sign out error:', error);
      setError(error.message || 'Failed to sign out');
    }
  };

  const handleGetToken = async () => {
    try {
      setError(null);
      const token = await getAccessToken();
      setAccessToken(token);
    } catch (error: any) {
      logger.error('Get token error:', error);
      setError(error.message || 'Failed to get access token');
    }
  };

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Supabase Auth Test
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Authentication Status
          </Typography>
          
          <Stack spacing={2}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Loading: {loading ? 'Yes' : 'No'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Authenticated: {isAuthenticated ? 'Yes' : 'No'}
              </Typography>
            </Box>

            {user && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  User Information:
                </Typography>
                <Typography variant="body2">
                  <strong>ID:</strong> {user.id}
                </Typography>
                <Typography variant="body2">
                  <strong>Email:</strong> {user.email}
                </Typography>
                <Typography variant="body2">
                  <strong>Display Name:</strong> {user.displayName || 'Not set'}
                </Typography>
                <Typography variant="body2">
                  <strong>Provider:</strong> {user.provider}
                </Typography>
                {user.photoURL && (
                  <Box sx={{ mt: 1 }}>
                    <img 
                      src={user.photoURL} 
                      alt="Profile" 
                      style={{ width: 40, height: 40, borderRadius: '50%' }}
                    />
                  </Box>
                )}
              </Box>
            )}

            <Divider />

            <Stack direction="row" spacing={2} flexWrap="wrap">
              {!isAuthenticated ? (
                <Button
                  variant="contained"
                  startIcon={<GoogleIcon />}
                  onClick={handleSignIn}
                  disabled={loading}
                  sx={{
                    bgcolor: '#4285F4',
                    '&:hover': { bgcolor: '#3367D6' }
                  }}
                >
                  Sign in with Google
                </Button>
              ) : (
                <>
                  <Button
                    variant="outlined"
                    onClick={handleSignOut}
                    disabled={loading}
                  >
                    Sign Out
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={handleGetToken}
                    disabled={loading}
                  >
                    Get Access Token
                  </Button>
                </>
              )}
            </Stack>

            {accessToken && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Access Token:
                </Typography>
                <Chip 
                  label={`${accessToken.substring(0, 20)}...`}
                  variant="outlined"
                  size="small"
                />
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Box sx={{ mt: 3 }}>
        <Typography variant="body2" color="text.secondary">
          This is a test component for Supabase authentication. 
          It will be removed after the migration is complete.
        </Typography>
      </Box>
    </Box>
  );
};

const SupabaseAuthTest: React.FC = () => {
  return (
    <SupabaseAuthProvider>
      <SupabaseAuthTestContent />
    </SupabaseAuthProvider>
  );
};

export default SupabaseAuthTest;
