import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Button,
  TextField,
  useTheme,
  alpha,
  Paper,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
  Divider
} from '@mui/material';
import {
  Google as GoogleIcon,
  TrendingUp,
  Analytics,
  CalendarMonth,
  SmartToy,
  MenuBook,
  Note,
  Visibility,
  VisibilityOff,
  ArrowBack,
  CheckCircle
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
  showFeatures?: boolean;
}

export interface LoginPromptContentProps {
  title?: string;
  subtitle?: string;
  showFeatures?: boolean;
  onAfterSignIn?: () => void;
}

type AuthStep = 'invite' | 'auth' | 'reset-password';
type EmailAuthType = 'signin' | 'signup';

export const LoginPromptContent: React.FC<LoginPromptContentProps> = ({
  title = 'Sign In',
  subtitle = 'Please sign in to access this feature',
  showFeatures = true,
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

  const features = [
    {
      icon: <MenuBook sx={{ fontSize: 28, color: 'primary.main' }} />,
      title: 'Journal Trades',
      description: 'Document and organize all your trades in one place'
    },
    {
      icon: <Note sx={{ fontSize: 28, color: 'warning.main' }} />,
      title: 'Notes',
      description: 'Capture your thoughts, ideas, and trade insights'
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
      description: 'Stay informed with real-time economic events'
    },
    {
      icon: <SmartToy sx={{ fontSize: 28, color: 'secondary.main' }} />,
      title: 'AI Trading Assistant',
      description: 'Get intelligent insights and analysis powered by AI'
    }
  ];

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
          {currentStep === 'invite' ? 'Enter your invite code to get started' : subtitle}
        </Typography>
      </Box>

      {/* Content Section */}
      <Box sx={{ p: 4 }}>
        {/* Step 1: Invite Code Verification */}
        {currentStep === 'invite' && (
          <Box>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
              You need an invite code to create an account
            </Typography>

            <TextField
              fullWidth
              label="Invite Code"
              value={inviteCode}
              onChange={(e) => {
                setInviteCode(e.target.value);
                setInviteError(null);
              }}
              error={!!inviteError}
              helperText={inviteError}
              disabled={inviteVerifying}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleVerifyInvite();
                }
              }}
              sx={{ mb: 2 }}
              InputProps={{
                endAdornment: inviteVerified && (
                  <InputAdornment position="end">
                    <CheckCircle color="success" />
                  </InputAdornment>
                )
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
                fontSize: '1rem',
                fontWeight: 600,
                textTransform: 'none'
              }}
            >
              {inviteVerifying ? (
                <>
                  <CircularProgress size={20} sx={{ mr: 1 }} color="inherit" />
                  Verifying...
                </>
              ) : (
                'Verify Invite Code'
              )}
            </Button>

            {showFeatures && (
              <Box sx={{ mt: 4 }}>
                <Divider sx={{ mb: 2 }} />
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
                    maxHeight: '250px',
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
                        borderRadius: 2
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
          </Box>
        )}

        {/* Step 2: Authentication Options */}
        {currentStep === 'auth' && (
          <Box>
            {/* Back Button */}
            <Button
              startIcon={<ArrowBack />}
              onClick={handleBackToInvite}
              sx={{ mb: 2, textTransform: 'none' }}
            >
              Change Invite Code
            </Button>

            {/* Error Alert */}
            {authError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setAuthError(null)}>
                {authError}
              </Alert>
            )}

            {/* Success Alert */}
            {authSuccess && (
              <Alert severity="success" sx={{ mb: 2 }} onClose={() => setAuthSuccess(null)}>
                {authSuccess}
              </Alert>
            )}

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
              sx={{ mb: 2 }}
            />

            {/* Display Name (Sign-Up Only) */}
            {emailAuthType === 'signup' && (
              <TextField
                fullWidth
                label="Display Name (Optional)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={authLoading}
                sx={{ mb: 2 }}
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
              helperText={emailAuthType === 'signup' ? 'Minimum 8 characters' : ''}
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
                fontSize: '1rem',
                fontWeight: 600,
                textTransform: 'none',
                mb: 2
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

            {/* Sign In / Sign Up Toggle Link */}
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {emailAuthType === 'signin' ? "Don't have an account? " : "Already have an account? "}
                <Button
                  onClick={() => {
                    setEmailAuthType(emailAuthType === 'signin' ? 'signup' : 'signin');
                    setAuthError(null);
                    setAuthSuccess(null);
                  }}
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
                  {emailAuthType === 'signin' ? 'Sign up' : 'Sign in'}
                </Button>
              </Typography>
            </Box>

            {/* Forgot Password Link (Sign In Only) */}
            {emailAuthType === 'signin' && (
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Button
                  onClick={() => {
                    setCurrentStep('reset-password');
                    setResetEmail(email); // Pre-fill with current email
                  }}
                  sx={{
                    textTransform: 'none',
                    p: 0,
                    minWidth: 'auto',
                    fontSize: '0.875rem',
                    color: 'text.secondary',
                    '&:hover': {
                      bgcolor: 'transparent',
                      textDecoration: 'underline',
                      color: 'primary.main'
                    }
                  }}
                >
                  Forgot password?
                </Button>
              </Box>
            )}

            {/* Divider with "or" text */}
            <Box sx={{ position: 'relative', mb: 3 }}>
              <Divider />
              <Typography
                variant="body2"
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  bgcolor: 'background.paper',
                  px: 2,
                  color: 'text.secondary'
                }}
              >
                or continue with
              </Typography>
            </Box>

            {/* Google Sign-In */}
            <Button
              variant="outlined"
              size="large"
              fullWidth
              startIcon={<GoogleIcon />}
              onClick={handleGoogleSignIn}
              disabled={authLoading}
              sx={{
                py: 1.5,
                fontSize: '1rem',
                fontWeight: 600,
                textTransform: 'none',
                borderColor: alpha(theme.palette.divider, 0.3),
                color: 'text.primary',
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  bgcolor: alpha(theme.palette.primary.main, 0.08)
                },
                transition: 'all 0.3s ease-in-out'
              }}
            >
              Google
            </Button>
          </Box>
        )}

        {/* Step 3: Password Reset */}
        {currentStep === 'reset-password' && (
          <Box>
            {/* Back Button */}
            <Button
              startIcon={<ArrowBack />}
              onClick={handleBackToAuth}
              sx={{ mb: 2, textTransform: 'none' }}
            >
              Back to Sign In
            </Button>

            <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
              Reset Your Password
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Enter your email address and we'll send you a link to reset your password.
            </Typography>

            {/* Error Alert */}
            {resetError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setResetError(null)}>
                {resetError}
              </Alert>
            )}

            {/* Success Alert */}
            {resetSuccess && (
              <Alert severity="success" sx={{ mb: 2 }} onClose={() => setResetSuccess(null)}>
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
                if (e.key === 'Enter') {
                  handlePasswordReset();
                }
              }}
              sx={{ mb: 2 }}
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
                fontSize: '1rem',
                fontWeight: 600,
                textTransform: 'none',
                mb: 2
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

            {/* Back to Sign In Link */}
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Remember your password?{' '}
                <Button
                  onClick={handleBackToAuth}
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
 * Features invite code verification followed by authentication options
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
