import React, { useMemo, useState } from 'react';
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
  CircularProgress,
  IconButton,
  InputAdornment,
  Stack,
} from '@mui/material';
import {
  Google as GoogleIcon,
  Visibility,
  VisibilityOff,
  ArrowBack,
  CheckCircle,
  Close as CloseIcon,
  VpnKey,
  LockOutlined,
  PersonAddOutlined,
  EmailOutlined,
  ArrowForward as ArrowIcon,
  ErrorOutline as ErrorOutlineIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
} from '@mui/icons-material';
import { useAuth } from 'contexts/SupabaseAuthContext';
import { inviteService } from 'features/calendar/services/inviteService';
import { logger } from 'utils/logger';
import { isDarkMode } from 'utils/themeMode';
import { dialogProps } from 'styles/dialogStyles';
import { scrollbarStyles } from 'styles/scrollbarStyles';
import { useDialogTokens } from 'styles/dialogTokens';
import { getHairline } from 'styles/designTokens';

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
  title = 'Welcome back',
  subtitle = 'Sign in to continue to JournoTrades',
  onAfterSignIn,
}) => {
  const theme = useTheme();
  const isDark = isDarkMode(theme);
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

  // Dialog tokens — single source of truth
  const {
    violet, violetSoft, violetSofter, violetBorder,
    surfaceInset, hairline,
    monoLabelSx,
    optionalSx: optionalSxHook,
    inputSx,
  } = useDialogTokens();
  // Local optionalSx variant uses 0.68rem (hook default is 0.66rem)
  const optionalSx = { ...optionalSxHook, fontSize: '0.68rem' };

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

  // Header icon + copy per sub-flow
  const headerIcon =
    currentStep === 'invite' ? (
      <VpnKey sx={{ fontSize: 20 }} />
    ) : currentStep === 'reset-password' ? (
      <EmailOutlined sx={{ fontSize: 20 }} />
    ) : emailAuthType === 'signup' ? (
      <PersonAddOutlined sx={{ fontSize: 20 }} />
    ) : (
      <LockOutlined sx={{ fontSize: 20 }} />
    );

  const headerTitle =
    currentStep === 'invite'
      ? 'Get started'
      : currentStep === 'reset-password'
      ? 'Reset password'
      : emailAuthType === 'signup'
      ? 'Create account'
      : title;

  const headerSubtitle =
    currentStep === 'invite'
      ? 'Enter your invite code to continue'
      : currentStep === 'reset-password'
      ? "We'll send you a reset link"
      : emailAuthType === 'signup'
      ? 'Join JournoTrades and start journaling your trades'
      : subtitle;

  // Reusable tinted callout (error / success)
  const calloutSx = (severity: 'error' | 'success') => {
    const color =
      severity === 'error' ? theme.palette.error.main : theme.palette.success.main;
    return {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 1,
      px: 1.25,
      py: 1,
      borderRadius: 1.25,
      border: `1px solid ${alpha(color, 0.35)}`,
      backgroundColor: alpha(color, 0.08),
    };
  };

  const renderCallout = (
    severity: 'error' | 'success',
    message: string,
    onClose?: () => void,
  ) => {
    const color =
      severity === 'error' ? theme.palette.error.main : theme.palette.success.main;
    const Icon = severity === 'error' ? ErrorOutlineIcon : CheckCircleOutlineIcon;
    return (
      <Box sx={calloutSx(severity)}>
        <Icon sx={{ fontSize: 16, color, mt: 0.15, flexShrink: 0 }} />
        <Typography
          sx={{
            flex: 1,
            fontSize: '0.8rem',
            color: theme.palette.text.primary,
            lineHeight: 1.45,
          }}
        >
          {message}
        </Typography>
        {onClose && (
          <IconButton
            onClick={onClose}
            size="small"
            sx={{ p: 0.25, color: alpha(theme.palette.text.secondary, 0.8) }}
          >
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
        )}
      </Box>
    );
  };

  // Footer hairline-bordered surface
  const footerSurfaceSx = {
    px: { xs: 2.5, sm: 3 },
    py: 1.5,
    borderTop: `1px solid ${hairline}`,
    backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : alpha(theme.palette.text.primary, 0.02),
  };

  const ghostButtonSx = {
    textTransform: 'none' as const,
    fontWeight: 600,
    fontSize: '0.82rem',
    color: theme.palette.text.secondary,
    '&:hover': { backgroundColor: alpha(theme.palette.text.primary, 0.04) },
  };

  const primaryButtonSx = {
    textTransform: 'none' as const,
    fontWeight: 600,
    fontSize: '0.85rem',
    backgroundColor: violet,
    color: '#fff',
    borderRadius: 1.25,
    px: 1.75,
    py: 0.75,
    boxShadow: 'none',
    '&:hover': { backgroundColor: theme.palette.primary.dark, boxShadow: 'none' },
    '&.Mui-disabled': {
      backgroundColor: alpha(violet, 0.35),
      color: alpha('#fff', 0.7),
    },
  };

  // Social button — keep brand glyph, inset-surface card pattern
  const socialButtonSx = {
    textTransform: 'none' as const,
    fontWeight: 600,
    fontSize: '0.88rem',
    color: theme.palette.text.primary,
    backgroundColor: surfaceInset,
    border: `1px solid ${hairline}`,
    borderRadius: 1.5,
    py: 1.1,
    justifyContent: 'center',
    boxShadow: 'none',
    '&:hover': {
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : alpha(theme.palette.text.primary, 0.05),
      borderColor: alpha(violet, 0.4),
      boxShadow: 'none',
    },
  };

  return (
    <Box sx={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: { xs: 2.5, sm: 3 },
          py: 1.75,
          borderBottom: `1px solid ${hairline}`,
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1.25,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: violetSoft,
            color: violet,
            border: `1px solid ${violetBorder}`,
            flexShrink: 0,
          }}
        >
          {headerIcon}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.98rem', lineHeight: 1.2 }}>
            {headerTitle}
          </Typography>
          <Typography
            sx={{
              fontSize: '0.78rem',
              color: theme.palette.text.secondary,
              lineHeight: 1.3,
            }}
          >
            {headerSubtitle}
          </Typography>
        </Box>
      </Box>

      {/* Body */}
      <Box
        sx={{
          px: { xs: 2.5, sm: 3 },
          py: 2.25,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          ...scrollbarStyles(theme),
          overflowY: 'auto',
          flex: 1,
        }}
      >
        {/* Step 1: Invite Code */}
        {currentStep === 'invite' && (
          <Stack spacing={1.75}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Typography sx={monoLabelSx}>
                Invite code
                <Box
                  component="span"
                  sx={{ color: theme.palette.error.main, fontFamily: 'inherit' }}
                >
                  *
                </Box>
              </Typography>
              <TextField
                fullWidth
                placeholder="Enter your invite code"
                value={inviteCode}
                onChange={(e) => {
                  setInviteCode(e.target.value.toUpperCase());
                  setInviteError(null);
                }}
                error={!!inviteError}
                disabled={inviteVerifying}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleVerifyInvite();
                }}
                size="small"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <VpnKey
                        sx={{ color: theme.palette.text.secondary, fontSize: 18 }}
                      />
                    </InputAdornment>
                  ),
                  endAdornment: inviteVerified ? (
                    <InputAdornment position="end">
                      <CheckCircle sx={{ color: theme.palette.success.main, fontSize: 18 }} />
                    </InputAdornment>
                  ) : undefined,
                }}
                sx={inputSx}
              />
              {inviteError && (
                <Typography
                  sx={{ fontSize: '0.75rem', color: theme.palette.error.main, mt: 0.25 }}
                >
                  {inviteError}
                </Typography>
              )}
            </Box>

            <Button
              variant="contained"
              fullWidth
              onClick={handleVerifyInvite}
              disabled={inviteVerifying || !inviteCode.trim()}
              endIcon={
                inviteVerifying ? (
                  <CircularProgress size={14} thickness={5} sx={{ color: 'inherit' }} />
                ) : (
                  <ArrowIcon sx={{ fontSize: 16 }} />
                )
              }
              sx={{ ...primaryButtonSx, py: 1.1 }}
            >
              {inviteVerifying ? 'Verifying…' : 'Continue'}
            </Button>

            <Typography
              sx={{
                ...optionalSx,
                textAlign: 'center',
                display: 'block',
                color: theme.palette.text.secondary,
              }}
            >
              Don&apos;t have an invite code? Check our Discord community.
            </Typography>
          </Stack>
        )}

        {/* Step 2: Authentication */}
        {currentStep === 'auth' && (
          <Stack spacing={1.75}>
            {/* Back */}
            <Button
              startIcon={<ArrowBack sx={{ fontSize: 14 }} />}
              onClick={handleBackToInvite}
              size="small"
              sx={{
                alignSelf: 'flex-start',
                textTransform: 'none',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: theme.palette.text.secondary,
                px: 0.75,
                minHeight: 0,
                py: 0.25,
                '&:hover': { backgroundColor: alpha(theme.palette.text.primary, 0.04) },
              }}
            >
              Back
            </Button>

            {/* Callouts */}
            {authError && renderCallout('error', authError, () => setAuthError(null))}
            {authSuccess && renderCallout('success', authSuccess, () => setAuthSuccess(null))}

            {/* Google Sign-In */}
            <Button
              fullWidth
              startIcon={<GoogleIcon sx={{ fontSize: 18 }} />}
              onClick={handleGoogleSignIn}
              disabled={authLoading}
              sx={socialButtonSx}
            >
              Continue with Google
            </Button>

            {/* Hairline divider with 'or' */}
            <Box
              sx={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                py: 0.25,
              }}
            >
              <Box sx={{ flex: 1, height: 1, backgroundColor: hairline }} />
              <Typography
                sx={{
                  ...optionalSx,
                  px: 1.25,
                  color: alpha(theme.palette.text.secondary, 0.8),
                }}
              >
                or
              </Typography>
              <Box sx={{ flex: 1, height: 1, backgroundColor: hairline }} />
            </Box>

            {/* Email */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Typography sx={monoLabelSx}>
                Email
                <Box
                  component="span"
                  sx={{ color: theme.palette.error.main, fontFamily: 'inherit' }}
                >
                  *
                </Box>
              </Typography>
              <TextField
                fullWidth
                type="email"
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setAuthError(null);
                  setAuthSuccess(null);
                }}
                disabled={authLoading}
                size="small"
                sx={inputSx}
              />
            </Box>

            {/* Display Name (sign-up only) */}
            {emailAuthType === 'signup' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Typography sx={monoLabelSx}>
                  Display name
                  <Box component="span" sx={{ ...optionalSx, ml: 0.5 }}>
                    · Optional
                  </Box>
                </Typography>
                <TextField
                  fullWidth
                  placeholder="How should we address you?"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={authLoading}
                  size="small"
                  sx={inputSx}
                />
              </Box>
            )}

            {/* Password */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Typography sx={monoLabelSx}>
                  Password
                  <Box
                    component="span"
                    sx={{ color: theme.palette.error.main, fontFamily: 'inherit' }}
                  >
                    *
                  </Box>
                </Typography>
                {emailAuthType === 'signin' && (
                  <Button
                    onClick={() => {
                      setCurrentStep('reset-password');
                      setResetEmail(email);
                    }}
                    size="small"
                    sx={{
                      textTransform: 'none',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: violet,
                      minHeight: 0,
                      px: 0.75,
                      py: 0.25,
                      '&:hover': { backgroundColor: violetSofter },
                    }}
                  >
                    Forgot password?
                  </Button>
                )}
              </Box>
              <TextField
                fullWidth
                type={showPassword ? 'text' : 'password'}
                placeholder={
                  emailAuthType === 'signup' ? 'Minimum 8 characters' : 'Enter your password'
                }
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
                size="small"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        size="small"
                        sx={{ color: theme.palette.text.secondary }}
                      >
                        {showPassword ? (
                          <VisibilityOff sx={{ fontSize: 16 }} />
                        ) : (
                          <Visibility sx={{ fontSize: 16 }} />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={inputSx}
              />
              {emailAuthType === 'signup' && (
                <Typography
                  sx={{
                    fontSize: '0.72rem',
                    color: theme.palette.text.secondary,
                    mt: 0.15,
                  }}
                >
                  Use at least 8 characters.
                </Typography>
              )}
            </Box>

            {/* Submit */}
            <Button
              variant="contained"
              fullWidth
              onClick={
                emailAuthType === 'signin' ? handleEmailSignIn : handleEmailSignUp
              }
              disabled={authLoading || !email.trim() || !password.trim()}
              endIcon={
                authLoading ? (
                  <CircularProgress size={14} thickness={5} sx={{ color: 'inherit' }} />
                ) : (
                  <ArrowIcon sx={{ fontSize: 16 }} />
                )
              }
              sx={{ ...primaryButtonSx, py: 1.1 }}
            >
              {authLoading
                ? emailAuthType === 'signin'
                  ? 'Signing in…'
                  : 'Creating account…'
                : emailAuthType === 'signin'
                ? 'Sign in'
                : 'Create account'}
            </Button>

            {/* Switch sign-in/sign-up */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.75,
                pt: 0.25,
              }}
            >
              <Typography
                sx={{ fontSize: '0.8rem', color: theme.palette.text.secondary }}
              >
                {emailAuthType === 'signin'
                  ? "Don't have an account?"
                  : 'Already have an account?'}
              </Typography>
              <Button
                onClick={() => {
                  setEmailAuthType(emailAuthType === 'signin' ? 'signup' : 'signin');
                  setAuthError(null);
                  setAuthSuccess(null);
                }}
                size="small"
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  color: violet,
                  minHeight: 0,
                  px: 0.5,
                  py: 0.25,
                  '&:hover': { backgroundColor: violetSofter },
                }}
              >
                {emailAuthType === 'signin' ? 'Sign up' : 'Sign in'}
              </Button>
            </Box>
          </Stack>
        )}

        {/* Step 3: Password Reset */}
        {currentStep === 'reset-password' && (
          <Stack spacing={1.75}>
            <Button
              startIcon={<ArrowBack sx={{ fontSize: 14 }} />}
              onClick={handleBackToAuth}
              size="small"
              sx={{
                alignSelf: 'flex-start',
                textTransform: 'none',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: theme.palette.text.secondary,
                px: 0.75,
                minHeight: 0,
                py: 0.25,
                '&:hover': { backgroundColor: alpha(theme.palette.text.primary, 0.04) },
              }}
            >
              Back
            </Button>

            {resetError && renderCallout('error', resetError, () => setResetError(null))}
            {resetSuccess &&
              renderCallout('success', resetSuccess, () => setResetSuccess(null))}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Typography sx={monoLabelSx}>
                Email
                <Box
                  component="span"
                  sx={{ color: theme.palette.error.main, fontFamily: 'inherit' }}
                >
                  *
                </Box>
              </Typography>
              <TextField
                fullWidth
                type="email"
                placeholder="you@domain.com"
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
                size="small"
                sx={inputSx}
              />
            </Box>

            <Button
              variant="contained"
              fullWidth
              onClick={handlePasswordReset}
              disabled={resetLoading || !resetEmail.trim()}
              endIcon={
                resetLoading ? (
                  <CircularProgress size={14} thickness={5} sx={{ color: 'inherit' }} />
                ) : (
                  <ArrowIcon sx={{ fontSize: 16 }} />
                )
              }
              sx={{ ...primaryButtonSx, py: 1.1 }}
            >
              {resetLoading ? 'Sending…' : 'Send reset link'}
            </Button>

            <Button
              onClick={handleBackToAuth}
              size="small"
              sx={{
                alignSelf: 'center',
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.78rem',
                color: theme.palette.text.secondary,
                '&:hover': { color: violet, backgroundColor: violetSofter },
              }}
            >
              Back to sign in
            </Button>
          </Stack>
        )}
      </Box>

      {/* Footer */}
      <Box sx={footerSurfaceSx}>
        <Typography
          sx={{
            ...optionalSx,
            textAlign: 'center',
            display: 'block',
            color: alpha(theme.palette.text.secondary, 0.75),
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
 * Tag-dialog-style login flow with invite verification, email/Google auth,
 * and password reset.
 */
const LoginDialog: React.FC<LoginDialogProps> = ({
  open,
  onClose,
  title = 'Welcome back',
  subtitle = 'Sign in to continue to JournoTrades',
}) => {
  const theme = useTheme();
  const isDark = isDarkMode(theme);
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const hairline = getHairline(theme);

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
          borderRadius: isMobile ? 0 : 2,
          border: isMobile ? 'none' : `1px solid ${hairline}`,
          boxShadow: theme.shadows[10],
          backgroundImage: 'none',
          overflow: 'hidden',
          bgcolor: 'background.paper',
          m: isMobile ? 0 : undefined,
          maxHeight: isMobile ? '100vh' : 'calc(100vh - 64px)',
          position: 'relative',
        },
      }}
    >
      {/* Close Button */}
      <IconButton
        onClick={onClose}
        size="small"
        sx={{
          position: 'absolute',
          right: 10,
          top: 10,
          zIndex: 1,
          color: theme.palette.text.secondary,
          '&:hover': {
            backgroundColor: alpha(theme.palette.text.primary, 0.06),
            color: theme.palette.text.primary,
          },
        }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>

      <DialogContent
        sx={{
          p: 0,
          overflow: 'auto',
          ...scrollbarStyles(theme),
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
