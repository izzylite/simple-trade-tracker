import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  LinearProgress,
  Typography,
  useMediaQuery,
  alpha,
  keyframes
} from '@mui/material';

// Animations
const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const float = keyframes`
  0%, 100% {
    transform: translateY(0px) scale(1);
  }
  50% {
    transform: translateY(-10px) scale(1.02);
  }
`;

const pulse = keyframes`
  0%, 100% {
    opacity: 0.4;
  }
  50% {
    opacity: 1;
  }
`;

const shimmer = keyframes`
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
`;

const rotate = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

const AppLoadingProgress: React.FC = () => {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  // Read theme from localStorage or use system preference
  const isDarkMode = useMemo(() => {
    const savedMode = localStorage.getItem('themeMode');
    return savedMode ? savedMode === 'dark' : prefersDarkMode;
  }, [prefersDarkMode]);

  // Define colors based on theme mode
  const colors = useMemo(() => ({
    background: {
      default: isDarkMode ? '#0a0e27' : '#f0f4f8',
    },
    primary: {
      main: isDarkMode ? '#90caf9' : '#1976d2',
      light: isDarkMode ? '#bbdefb' : '#42a5f5',
      dark: isDarkMode ? '#5c9dd8' : '#1565c0',
    },
    secondary: {
      main: isDarkMode ? '#ce93d8' : '#9c27b0',
      light: isDarkMode ? '#e1bee7' : '#ba68c8',
    },
    accent: {
      main: isDarkMode ? '#4fc3f7' : '#0288d1',
    },
    text: {
      primary: isDarkMode ? '#ffffff' : '#1a2027',
      secondary: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
    },
  }), [isDarkMode]);

  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('Initializing application');
  const [dots, setDots] = useState('');

  // Simulate progress
  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((oldProgress) => {
        if (oldProgress >= 90) {
          return Math.min(oldProgress + 0.5, 95);
        }
        return Math.min(oldProgress + (Math.random() * 5), 90);
      });
    }, 200);

    return () => {
      clearInterval(timer);
    };
  }, []);

  // Animated dots for loading text
  useEffect(() => {
    const dotsTimer = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 400);

    return () => clearInterval(dotsTimer);
  }, []);

  // Change loading text based on progress
  useEffect(() => {
    if (progress < 25) {
      setLoadingText('Initializing application');
    } else if (progress < 50) {
      setLoadingText('Loading components');
    } else if (progress < 75) {
      setLoadingText('Preparing interface');
    } else if (progress < 90) {
      setLoadingText('Finalizing setup');
    } else {
      setLoadingText('Almost ready');
    }
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
        bgcolor: colors.background.default,
        background: isDarkMode
          ? `radial-gradient(ellipse at 20% 20%, ${alpha(colors.primary.main, 0.15)} 0%, transparent 50%),
             radial-gradient(ellipse at 80% 80%, ${alpha(colors.secondary.main, 0.15)} 0%, transparent 50%),
             radial-gradient(ellipse at 50% 50%, ${alpha(colors.accent.main, 0.08)} 0%, transparent 60%),
             ${colors.background.default}`
          : `linear-gradient(135deg, ${alpha(colors.primary.light, 0.05)} 0%, ${alpha(colors.secondary.light, 0.05)} 100%),
             radial-gradient(ellipse at 20% 20%, ${alpha(colors.primary.main, 0.08)} 0%, transparent 50%),
             radial-gradient(ellipse at 80% 80%, ${alpha(colors.secondary.main, 0.06)} 0%, transparent 50%),
             ${colors.background.default}`,
      }}
    >
      {/* Animated background pattern */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: isDarkMode ? 0.03 : 0.08,
          backgroundImage: isDarkMode
            ? `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2v-4h4v-2h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2v-4h4v-2H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
            : `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%232d3748' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2v-4h4v-2h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2v-4h4v-2H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Main content container */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          zIndex: 1,
          animation: `${fadeIn} 0.8s cubic-bezier(0.4, 0, 0.2, 1)`,
        }}
      >
        {/* Logo container with animated background */}
        <Box
          sx={{
            position: 'relative',
            mb: 4,
            animation: `${float} 3s ease-in-out infinite`,
          }}
        >
          {/* Outer rotating ring */}
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 140,
              height: 140,
              borderRadius: '50%',
              background: `conic-gradient(from 0deg, ${alpha(colors.primary.main, 0.3)}, ${alpha(colors.secondary.main, 0.3)}, ${alpha(colors.accent.main, 0.3)}, ${alpha(colors.primary.main, 0.3)})`,
              animation: `${rotate} 4s linear infinite`,
              filter: 'blur(8px)',
            }}
          />

          {/* Middle pulsing ring */}
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 120,
              height: 120,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${alpha(colors.primary.main, 0.2)} 0%, transparent 70%)`,
              animation: `${pulse} 2s ease-in-out infinite`,
            }}
          />

          {/* Logo background */}
          <Box
            sx={{
              position: 'relative',
              width: 100,
              height: 100,
              borderRadius: 3,
              background: isDarkMode
                ? `linear-gradient(135deg, ${alpha(colors.primary.dark, 0.9)}, ${alpha(colors.secondary.main, 0.9)})`
                : `linear-gradient(135deg, ${colors.primary.main}, ${colors.secondary.main})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isDarkMode
                ? `0 8px 32px ${alpha(colors.primary.main, 0.4)}, 0 0 60px ${alpha(colors.secondary.main, 0.2)}`
                : `0 8px 32px ${alpha(colors.primary.main, 0.3)}`,
              overflow: 'hidden',
            }}
          >
            {/* Shimmer effect overlay */}
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: `linear-gradient(90deg, transparent, ${alpha('#ffffff', 0.3)}, transparent)`,
                backgroundSize: '200% 100%',
                animation: `${shimmer} 2s ease-in-out infinite`,
              }}
            />

            {/* Logo icon */}
            <Box
              component="img"
              src="/android-chrome-192x192.png"
              alt="JournoTrades Logo"
              sx={{
                width: 70,
                height: 70,
                borderRadius: 2,
                position: 'relative',
                zIndex: 1,
                filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2))',
              }}
            />
          </Box>
        </Box>

        {/* App name with gradient */}
        <Typography
          variant="h3"
          sx={{
            mb: 1,
            fontWeight: 800,
            textAlign: 'center',
            fontSize: { xs: '2rem', sm: '2.5rem' },
            background: `linear-gradient(135deg, ${colors.primary.main}, ${colors.secondary.main})`,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.02em',
          }}
        >
          JournoTrades
        </Typography>

        {/* Tagline */}
        <Typography
          variant="body1"
          sx={{
            mb: 2,
            color: colors.text.secondary,
            textAlign: 'center',
            fontSize: { xs: '0.875rem', sm: '1rem' },
            fontWeight: 500,
            letterSpacing: '0.02em',
          }}
        >
          Your Trading Journal
        </Typography>

        {/* Loading text with animated dots */}
        <Box
          sx={{
            mb: 2,
            minHeight: 24,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: colors.text.secondary,
              textAlign: 'center',
              fontSize: '0.9375rem',
              fontWeight: 500,
            }}
          >
            {loadingText}
            <Box
              component="span"
              sx={{
                display: 'inline-block',
                width: 24,
                textAlign: 'left',
              }}
            >
              {dots}
            </Box>
          </Typography>
        </Box>

        {/* Progress bar container */}
        <Box
          sx={{
            width: { xs: 280, sm: 360 },
            position: 'relative',
          }}
        >
          {/* Background track */}
          <Box
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: isDarkMode
                ? alpha(colors.primary.main, 0.15)
                : alpha(colors.primary.main, 0.12),
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Animated progress bar */}
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                width: `${progress}%`,
                borderRadius: 3,
                background: `linear-gradient(90deg, ${colors.primary.main}, ${colors.secondary.main}, ${colors.accent.main})`,
                backgroundSize: '200% 100%',
                animation: `${shimmer} 1.5s ease-in-out infinite`,
                transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: `0 0 20px ${alpha(colors.primary.main, 0.5)}`,
              }}
            />
          </Box>

       
        </Box>
      </Box>
    </Box>
  );
};

export default AppLoadingProgress;
