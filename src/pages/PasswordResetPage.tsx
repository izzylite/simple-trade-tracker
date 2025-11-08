/**
 * Password Reset Page
 * Handles password reset after user clicks the reset link in their email
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Paper,
  IconButton,
  InputAdornment,
  alpha,
  useTheme
} from '@mui/material';
import { Visibility, VisibilityOff, CheckCircle } from '@mui/icons-material';
import { useSupabaseAuth } from '../contexts/SupabaseAuthContext';
import { logger } from '../utils/logger';

const PasswordResetPage: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { updatePassword } = useSupabaseAuth();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Check if we have a valid session (user clicked reset link)
    // If not, redirect to home
    const checkSession = async () => {
      // The session will be handled automatically by Supabase
      // when user clicks the reset link
      logger.info('Password reset page loaded');
    };

    checkSession();
  }, []);

  const handleResetPassword = async () => {
    // Validation
    if (!newPassword.trim()) {
      setError('Please enter a new password');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await updatePassword(newPassword);
      setSuccess(true);

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 2000);
    } catch (err: any) {
      logger.error('Failed to reset password:', err);
      setError(err.message || 'Failed to reset password. Please try again or request a new reset link.');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          px: 2,
          background: theme.palette.mode === 'dark'
            ? `linear-gradient(145deg, ${alpha(theme.palette.background.default, 0.95)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`
            : `linear-gradient(145deg, rgba(248,250,252,0.98) 0%, rgba(255,255,255,0.95) 100%)`
        }}
      >
        <Paper
          sx={{
            p: 4,
            maxWidth: 400,
            width: '100%',
            textAlign: 'center',
            borderRadius: 3
          }}
        >
          <CheckCircle color="success" sx={{ fontSize: 64, mb: 2 }} />
          <Typography variant="h5" gutterBottom fontWeight={600}>
            Password Reset Successful!
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Your password has been updated successfully.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Redirecting to dashboard...
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        px: 2,
        background: theme.palette.mode === 'dark'
          ? `linear-gradient(145deg, ${alpha(theme.palette.background.default, 0.95)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`
          : `linear-gradient(145deg, rgba(248,250,252,0.98) 0%, rgba(255,255,255,0.95) 100%)`
      }}
    >
      <Paper
        sx={{
          p: 4,
          maxWidth: 400,
          width: '100%',
          borderRadius: 3
        }}
      >
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box
            component="img"
            src="/android-chrome-192x192.png"
            alt="TradeJourno Logo"
            sx={{
              width: 60,
              height: 60,
              borderRadius: '15px',
              mb: 2,
              mx: 'auto'
            }}
          />
          <Typography variant="h5" gutterBottom fontWeight={600}>
            Reset Your Password
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Enter your new password below
          </Typography>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* New Password Field */}
        <TextField
          fullWidth
          type={showPassword ? 'text' : 'password'}
          label="New Password"
          value={newPassword}
          onChange={(e) => {
            setNewPassword(e.target.value);
            setError(null);
          }}
          disabled={loading}
          sx={{ mb: 2 }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPassword(!showPassword)}
                  edge="end"
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            )
          }}
          helperText="Minimum 8 characters"
        />

        {/* Confirm Password Field */}
        <TextField
          fullWidth
          type={showConfirmPassword ? 'text' : 'password'}
          label="Confirm Password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            setError(null);
          }}
          disabled={loading}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleResetPassword();
            }
          }}
          sx={{ mb: 3 }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  edge="end"
                >
                  {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            )
          }}
        />

        {/* Submit Button */}
        <Button
          variant="contained"
          size="large"
          fullWidth
          onClick={handleResetPassword}
          disabled={loading || !newPassword.trim() || !confirmPassword.trim()}
          sx={{
            py: 1.5,
            fontSize: '1rem',
            fontWeight: 600,
            textTransform: 'none',
            mb: 2
          }}
        >
          {loading ? (
            <>
              <CircularProgress size={20} sx={{ mr: 1 }} color="inherit" />
              Resetting Password...
            </>
          ) : (
            'Reset Password'
          )}
        </Button>

        {/* Back to Login */}
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Remember your password?{' '}
            <Button
              onClick={() => navigate('/', { replace: true })}
              sx={{
                textTransform: 'none',
                p: 0,
                minWidth: 'auto',
                fontWeight: 600,
                '&:hover': {
                  bgcolor: 'transparent',
                  textDecoration: 'underline'
                }
              }}
            >
              Sign in
            </Button>
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default PasswordResetPage;
