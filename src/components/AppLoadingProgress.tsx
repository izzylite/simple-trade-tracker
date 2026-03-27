import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  useMediaQuery,
  alpha,
  keyframes
} from '@mui/material';

const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const AppLoadingProgress: React.FC = () => {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  const isDarkMode = useMemo(() => {
    const savedMode = localStorage.getItem('themeMode');
    return savedMode ? savedMode === 'dark' : prefersDarkMode;
  }, [prefersDarkMode]);

  const colors = useMemo(() => ({
    background: isDarkMode ? '#0a0e27' : '#e8edf4',
    primary: isDarkMode ? '#a78bfa' : '#7c3aed',
    primaryDark: isDarkMode ? '#8b5cf6' : '#5b21b6',
    textPrimary: isDarkMode ? '#ffffff' : '#1a2027',
    textSecondary: isDarkMode ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)',
    trackBg: isDarkMode ? 'rgba(167,139,250,0.12)' : 'rgba(124,58,237,0.1)',
  }), [isDarkMode]);

  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('Initializing application');
  const [dots, setDots] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return Math.min(prev + 0.5, 95);
        return Math.min(prev + Math.random() * 5, 90);
      });
    }, 200);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const dotsTimer = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 400);
    return () => clearInterval(dotsTimer);
  }, []);

  useEffect(() => {
    if (progress < 25) setLoadingText('Initializing application');
    else if (progress < 50) setLoadingText('Loading components');
    else if (progress < 75) setLoadingText('Preparing interface');
    else if (progress < 90) setLoadingText('Finalizing setup');
    else setLoadingText('Almost ready');
  }, [progress]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        width: '100vw',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 9999,
        overflow: 'hidden',
        backgroundColor: colors.background,
        background: isDarkMode
          ? `radial-gradient(ellipse at 30% 30%, ${alpha(colors.primary, 0.12)} 0%, transparent 55%),
             radial-gradient(ellipse at 75% 75%, ${alpha(colors.primaryDark, 0.1)} 0%, transparent 55%),
             ${colors.background}`
          : `radial-gradient(ellipse at 30% 25%, ${alpha(colors.primary, 0.07)} 0%, transparent 55%),
             radial-gradient(ellipse at 75% 80%, ${alpha(colors.primaryDark, 0.05)} 0%, transparent 55%),
             ${colors.background}`,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          zIndex: 1,
          '@media (prefers-reduced-motion: no-preference)': {
            animation: `${fadeInUp} 0.6s cubic-bezier(0.4, 0, 0.2, 1) both`,
          },
        }}
      >
        {/* Logo */}
        <Box
          component="img"
          src="/android-chrome-192x192.png"
          alt="JournoTrades"
          sx={{
            width: 88,
            height: 88,
            borderRadius: '20px',
            mb: 3.5,
            filter: isDarkMode
              ? `drop-shadow(0 8px 24px ${alpha(colors.primary, 0.45)})`
              : `drop-shadow(0 8px 20px ${alpha(colors.primary, 0.3)})`,
          }}
        />

        {/* App name */}
        <Typography
          variant="h3"
          sx={{
            mb: 0.75,
            fontWeight: 800,
            textAlign: 'center',
            fontSize: { xs: '2rem', sm: '2.5rem' },
            letterSpacing: '-0.02em',
            background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          JournoTrades
        </Typography>

        {/* Tagline */}
        <Typography
          variant="body1"
          sx={{
            mb: 4,
            color: colors.textSecondary,
            textAlign: 'center',
            fontSize: { xs: '0.875rem', sm: '0.9375rem' },
            fontWeight: 500,
            letterSpacing: '0.03em',
          }}
        >
          Your Trading Journal
        </Typography>

        {/* Progress bar */}
        <Box sx={{ width: { xs: 260, sm: 320 } }}>
          <Box
            sx={{
              height: 5,
              borderRadius: 99,
              bgcolor: colors.trackBg,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                width: `${progress}%`,
                borderRadius: 99,
                background: `linear-gradient(90deg, ${colors.primary}, ${colors.primaryDark}, ${colors.primary})`,
                backgroundSize: '200% 100%',
                transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: `0 0 14px ${alpha(colors.primary, 0.55)}`,
                '@media (prefers-reduced-motion: no-preference)': {
                  animation: `${shimmer} 1.8s ease-in-out infinite`,
                },
              }}
            />
          </Box>

          {/* Loading text */}
          <Box sx={{ mt: 2, minHeight: 20, textAlign: 'center' }}>
            <Typography
              variant="caption"
              sx={{
                color: colors.textSecondary,
                fontSize: '0.8125rem',
                fontWeight: 500,
                letterSpacing: '0.01em',
              }}
            >
              {loadingText}
              <Box component="span" sx={{ display: 'inline-block', width: 20, textAlign: 'left' }}>
                {dots}
              </Box>
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default AppLoadingProgress;
