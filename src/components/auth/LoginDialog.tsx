import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Button,
  TextField,
  useTheme,
  useMediaQuery,
  alpha,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
  Divider,
  Stack
} from '@mui/material';
import {
  Google as GoogleIcon,
  Visibility,
  VisibilityOff,
  ArrowBack,
  CheckCircle,
  Close as CloseIcon,
  VpnKey
} from '@mui/icons-material';
import { useAuth } from '../../contexts/SupabaseAuthContext';
import { inviteService } from '../../services/inviteService';
import { logger } from '../../utils/logger';
import { dialogProps } from '../../styles/dialogStyles';
import { scrollbarStyles } from '../../styles/scrollbarStyles';

interface LoginDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
}

export interface LoginPromptContentProps {
  title?: string;
  subtitle?: string;
  onAfterSignIn?: () => void;
}

type AuthStep = 'invite' | 'auth' | 'reset-password';
type EmailAuthType = 'signin' | 'signup';

export const LoginPromptContent: React.FC<LoginPromptContentProps> = ({
  title = 'Welcome Back',
  subtitle = 'Sign in to continue to JournoTrades',
  onAfterSignIn,
}) => {
  const theme = useTheme();
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, requestPasswordReset } = useAuth();

  // Step management
  const [currentStep, setCurrentStep] = useState<AuthStep>('invite');

  // Invite code state
  const [inviteCode, setInviteCode] = useState('');
  const [inviteVerifying, setInviteVerifying] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteVerified, setInviteVerified] = useState(false);

  // Email auth state
  const [emailAuthType, setEmailAuthType] = useState<EmailAuthType>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Password reset state
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  // Handle invite verification
  const handleVerifyInvite = async () => {
    if (!inviteCode.trim()) {
      setInviteError('Please enter an invite code');
      return;
    }

    setInviteVerifying(true);
    setInviteError(null);

    try {
      const result = await inviteService.verifyInviteCode(inviteCode.trim());

      if (result.valid) {
        logger.info('Invite code verified successfully');
        setInviteVerified(true);
        setCurrentStep('auth');
      } else {
        setInviteError(result.message || 'Invalid invite code');
      }
    } catch (error) {
      logger.error('Error verifying invite:', error);
      setInviteError('An error occurred. Please try again.');
    } finally {
      setInviteVerifying(false);
    }
  };

  // Handle Google sign-in
  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);

    try {
      // Store invite code in localStorage before OAuth redirect (for new signups only)
      if (inviteVerified && inviteCode) {
        localStorage.setItem('pendingInviteCode', inviteCode.trim());
      }

      await signInWithGoogle();
      // Note: Code below won't execute due to OAuth redirect
    } catch (error: any) {
      logger.error('Failed to sign in with Google:', error);
      setAuthError(error.message || 'Failed to sign in with Google');
      setAuthLoading(false);
    }
  };

  // Handle email sign-in (existing users - don't consume invite)
  const handleEmailSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setAuthError('Please enter both email and password');
      return;
    }

    setAuthLoading(true);
    setAuthError(null);

    try {
      await signInWithEmail(email.trim(), password);
      // Existing users signing in - no invite consumption needed
      onAfterSignIn && onAfterSignIn();
    } catch (error: any) {
      logger.error('Failed to sign in with email:', error);
      setAuthError(error.message || 'Invalid email or password');
      setAuthLoading(false);
    }
  };

  // Handle email sign-up
  const handleEmailSignUp = async () => {
    if (!email.trim() || !password.trim()) {
      setAuthError('Please enter both email and password');
      return;
    }

    if (password.length < 8) {
      setAuthError('Password must be at least 8 characters');
      return;
    }

    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccess(null);

    try {
      // Store invite code in localStorage before signup (for new signups only)
      // This will be consumed in handleUserSignIn after user is authenticated
      if (inviteVerified && inviteCode) {
        localStorage.setItem('pendingInviteCode', inviteCode.trim());
      }

      await signUpWithEmail(email.trim(), password, displayName.trim() || undefined);

      // Show success message
      setAuthSuccess(
        'Account created successfully! Please check your email to confirm your account before signing in.'
      );

      // Switch to sign-in mode so user can sign in after confirming email
      setEmailAuthType('signin');

      // Clear password for security
      setPassword('');

      // Note: Don't call onAfterSignIn() here
      // Invite code will be consumed automatically when user signs in (after email confirmation)
      // This happens in supabaseAuthService.handleUserSignIn() for new users
    } catch (error: any) {
      logger.error('Failed to sign up with email:', error);
      setAuthError(error.message || 'Failed to create account');
      // Clear pending invite on error
      localStorage.removeItem('pendingInviteCode');
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle password reset request
  const handlePasswordReset = async () => {
    if (!resetEmail.trim()) {
      setResetError('Please enter your email address');
      return;
    }

    setResetLoading(true);
    setResetError(null);
    setResetSuccess(null);

    try {
      await requestPasswordReset(resetEmail.trim());
      setResetSuccess(
        'Password reset email sent! Please check your inbox and follow the instructions to reset your password.'
      );
      // Clear the email field
      setResetEmail('');
    } catch (error: any) {
      logger.error('Failed to request password reset:', error);
      setResetError(error.message || 'Failed to send reset email. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  // Handle back to invite step
  const handleBackToInvite = () => {
    setCurrentStep('invite');
    setAuthError(null);
    setAuthSuccess(null);
    setEmail('');
    setPassword('');
    setDisplayName('');
  };

  // Handle back to auth step from password reset
  const handleBackToAuth = () => {
    setCurrentStep('auth');
    setResetError(null);
    setResetSuccess(null);
    setResetEmail('');
  };

  return (
    <Box sx={{ minHeight: '100%' }}>
      {/* Header */}
      <Box
        sx={{
          pt: { xs: 4, sm: 5 },
          pb: { xs: 3, sm: 4 },
          px: { xs: 3, sm: 4 },
          textAlign: 'center'
        }}
      >
        {/* Logo */}
        <Box
          component="img"
          src="/android-chrome-192x192.png"
          alt="JournoTrades"
          sx={{
            width: { xs: 56, sm: 64 },
            height: { xs: 56, sm: 64 },
            borderRadius: 2.5,
            boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.25)}`,
            mb: 2.5
          }}
        />

        {/* Title */}
        <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            mb: 0.75,
            fontSize: { xs: '1.375rem', sm: '1.5rem' }
          }}
        >
          {currentStep === 'invite' ? 'Get Started' : currentStep === 'reset-password' ? 'Reset Password' : title}
        </Typography>

        {/* Subtitle */}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontSize: { xs: '0.875rem', sm: '0.9375rem' } }}
        >
          {currentStep === 'invite'
            ? 'Enter your invite code to continue'
            : currentStep === 'reset-password'
            ? "We'll send you a reset link"
            : subtitle}
        </Typography>
      </Box>

      {/* Content */}
      <Box sx={{ px: { xs: 3, sm: 4 }, pb: { xs: 3, sm: 4 } }}>
        {/* Step 1: Invite Code */}
        {currentStep === 'invite' && (
          <Stack spacing={2.5}>
            <TextField
              fullWidth
              label="Invite Code"
              placeholder="Enter your invite code"
              value={inviteCode}
              onChange={(e) => {
                setInviteCode(e.target.value.toUpperCase());
                setInviteError(null);
              }}
              error={!!inviteError}
              helperText={inviteError}
              disabled={inviteVerifying}
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleVerifyInvite();
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <VpnKey sx={{ color: 'text.disabled', fontSize: 20 }} />
                  </InputAdornment>
                ),
                endAdornment: inviteVerified && (
                  <InputAdornment position="end">
                    <CheckCircle color="success" />
                  </InputAdornment>
                )
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2
                }
              }}
            />

            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={handleVerifyInvite}
              disabled={inviteVerifying || !inviteCode.trim()}
              sx={{
                py: 1.5,
                borderRadius: 2,
                fontSize: '0.9375rem',
                fontWeight: 600,
                textTransform: 'none',
                boxShadow: 'none',
                '&:hover': {
                  boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`
                }
              }}
            >
              {inviteVerifying ? (
                <>
                  <CircularProgress size={20} sx={{ mr: 1 }} color="inherit" />
                  Verifying...
                </>
              ) : (
                'Continue'
              )}
            </Button>

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ textAlign: 'center', display: 'block' }}
            >
              Don't have an invite code? Check our Discord community.
            </Typography>
          </Stack>
        )}

        {/* Step 2: Authentication */}
        {currentStep === 'auth' && (
          <Stack spacing={2}>
            {/* Back Button */}
            <Button
              startIcon={<ArrowBack fontSize="small" />}
              onClick={handleBackToInvite}
              size="small"
              sx={{
                alignSelf: 'flex-start',
                textTransform: 'none',
                color: 'text.secondary',
                mb: 0.5
              }}
            >
              Back
            </Button>

            {/* Alerts */}
            {authError && (
              <Alert
                severity="error"
                onClose={() => setAuthError(null)}
                sx={{ borderRadius: 2 }}
              >
                {authError}
              </Alert>
            )}
            {authSuccess && (
              <Alert
                severity="success"
                onClose={() => setAuthSuccess(null)}
                sx={{ borderRadius: 2 }}
              >
                {authSuccess}
              </Alert>
            )}

            {/* Google Sign-In - Primary Option */}
            <Button
              variant="outlined"
              size="large"
              fullWidth
              startIcon={<GoogleIcon />}
              onClick={handleGoogleSignIn}
              disabled={authLoading}
              sx={{
                py: 1.5,
                borderRadius: 2,
                fontSize: '0.9375rem',
                fontWeight: 600,
                textTransform: 'none',
                borderColor: alpha(theme.palette.divider, 0.3),
                color: 'text.primary',
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  bgcolor: alpha(theme.palette.primary.main, 0.04)
                }
              }}
            >
              Continue with Google
            </Button>

            {/* Divider */}
            <Box sx={{ position: 'relative', py: 1 }}>
              <Divider />
              <Typography
                variant="caption"
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  bgcolor: 'background.paper',
                  px: 2,
                  color: 'text.disabled'
                }}
              >
                or
              </Typography>
            </Box>

            {/* Email Field */}
            <TextField
              fullWidth
              type="email"
              label="Email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setAuthError(null);
                setAuthSuccess(null);
              }}
              disabled={authLoading}
              size="medium"
              sx={{
                '& .MuiOutlinedInput-root': { borderRadius: 2 }
              }}
            />

            {/* Display Name (Sign-Up Only) */}
            {emailAuthType === 'signup' && (
              <TextField
                fullWidth
                label="Display Name (Optional)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={authLoading}
                size="medium"
                sx={{
                  '& .MuiOutlinedInput-root': { borderRadius: 2 }
                }}
              />
            )}

            {/* Password Field */}
            <TextField
              fullWidth
              type={showPassword ? 'text' : 'password'}
              label="Password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setAuthError(null);
                setAuthSuccess(null);
              }}
              disabled={authLoading}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  emailAuthType === 'signin' ? handleEmailSignIn() : handleEmailSignUp();
                }
              }}
              helperText={emailAuthType === 'signup' ? 'Minimum 8 characters' : undefined}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      size="small"
                    >
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
              sx={{
                '& .MuiOutlinedInput-root': { borderRadius: 2 }
              }}
            />

            {/* Submit Button */}
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={emailAuthType === 'signin' ? handleEmailSignIn : handleEmailSignUp}
              disabled={authLoading || !email.trim() || !password.trim()}
              sx={{
                py: 1.5,
                borderRadius: 2,
                fontSize: '0.9375rem',
                fontWeight: 600,
                textTransform: 'none',
                boxShadow: 'none',
                '&:hover': {
                  boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`
                }
              }}
            >
              {authLoading ? (
                <>
                  <CircularProgress size={20} sx={{ mr: 1 }} color="inherit" />
                  {emailAuthType === 'signin' ? 'Signing in...' : 'Creating account...'}
                </>
              ) : (
                emailAuthType === 'signin' ? 'Sign In' : 'Create Account'
              )}
            </Button>

            {/* Footer Links */}
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ pt: 0.5 }}
            >
              <Button
                onClick={() => {
                  setEmailAuthType(emailAuthType === 'signin' ? 'signup' : 'signin');
                  setAuthError(null);
                  setAuthSuccess(null);
                }}
                size="small"
                sx={{
                  textTransform: 'none',
                  fontWeight: 500,
                  fontSize: '0.8125rem'
                }}
              >
                {emailAuthType === 'signin' ? 'Create account' : 'Sign in instead'}
              </Button>

              {emailAuthType === 'signin' && (
                <Button
                  onClick={() => {
                    setCurrentStep('reset-password');
                    setResetEmail(email);
                  }}
                  size="small"
                  sx={{
                    textTransform: 'none',
                    color: 'text.secondary',
                    fontSize: '0.8125rem',
                    '&:hover': { color: 'primary.main' }
                  }}
                >
                  Forgot password?
                </Button>
              )}
            </Stack>
          </Stack>
        )}

        {/* Step 3: Password Reset */}
        {currentStep === 'reset-password' && (
          <Stack spacing={2}>
            {/* Back Button */}
            <Button
              startIcon={<ArrowBack fontSize="small" />}
              onClick={handleBackToAuth}
              size="small"
              sx={{
                alignSelf: 'flex-start',
                textTransform: 'none',
                color: 'text.secondary',
                mb: 0.5
              }}
            >
              Back
            </Button>

            {/* Alerts */}
            {resetError && (
              <Alert
                severity="error"
                onClose={() => setResetError(null)}
                sx={{ borderRadius: 2 }}
              >
                {resetError}
              </Alert>
            )}
            {resetSuccess && (
              <Alert
                severity="success"
                onClose={() => setResetSuccess(null)}
                sx={{ borderRadius: 2 }}
              >
                {resetSuccess}
              </Alert>
            )}

            {/* Email Field */}
            <TextField
              fullWidth
              type="email"
              label="Email Address"
              value={resetEmail}
              onChange={(e) => {
                setResetEmail(e.target.value);
                setResetError(null);
                setResetSuccess(null);
              }}
              disabled={resetLoading}
              onKeyPress={(e) => {
                if (e.key === 'Enter') handlePasswordReset();
              }}
              sx={{
                '& .MuiOutlinedInput-root': { borderRadius: 2 }
              }}
            />

            {/* Submit Button */}
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={handlePasswordReset}
              disabled={resetLoading || !resetEmail.trim()}
              sx={{
                py: 1.5,
                borderRadius: 2,
                fontSize: '0.9375rem',
                fontWeight: 600,
                textTransform: 'none',
                boxShadow: 'none',
                '&:hover': {
                  boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`
                }
              }}
            >
              {resetLoading ? (
                <>
                  <CircularProgress size={20} sx={{ mr: 1 }} color="inherit" />
                  Sending...
                </>
              ) : (
                'Send Reset Link'
              )}
            </Button>

            {/* Back Link */}
            <Button
              onClick={handleBackToAuth}
              size="small"
              sx={{
                alignSelf: 'center',
                textTransform: 'none',
                color: 'text.secondary',
                fontSize: '0.8125rem',
                '&:hover': { color: 'primary.main' }
              }}
            >
              Back to sign in
            </Button>
          </Stack>
        )}
      </Box>

      {/* Footer */}
      <Box sx={{ px: { xs: 3, sm: 4 }, pb: { xs: 2, sm: 3 } }}>
        <Typography
          variant="caption"
          color="text.disabled"
          sx={{
            textAlign: 'center',
            display: 'block',
            fontSize: '0.6875rem'
          }}
        >
          By continuing, you agree to our Terms of Service and Privacy Policy
        </Typography>
      </Box>
    </Box>
  );
};

/**
 * LoginDialog Component
 * Clean, minimal login dialog with invite code verification and authentication
 */
const LoginDialog: React.FC<LoginDialogProps> = ({
  open,
  onClose,
  title = 'Welcome Back',
  subtitle = 'Sign in to continue to JournoTrades',
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      fullScreen={isMobile}
      {...dialogProps}
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 3,
          overflow: 'hidden',
          bgcolor: 'background.paper',
          m: isMobile ? 0 : undefined,
          maxHeight: isMobile ? '100vh' : 'calc(100vh - 64px)',
          position: 'relative'
        }
      }}
    >
      {/* Close Button */}
      <IconButton
        onClick={onClose}
        size="small"
        sx={{
          position: 'absolute',
          right: 12,
          top: 12,
          zIndex: 1,
          color: 'text.secondary',
          bgcolor: alpha(theme.palette.action.hover, 0.08),
          '&:hover': {
            bgcolor: alpha(theme.palette.action.hover, 0.16),
            color: 'text.primary'
          }
        }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>

      <DialogContent
        sx={{
          p: 0,
          overflow: 'auto',
          ...scrollbarStyles(theme)
        }}
      >
        <LoginPromptContent
          title={title}
          subtitle={subtitle}
          onAfterSignIn={onClose}
        />
      </DialogContent>
    </Dialog>
  );
};

export default LoginDialog;
