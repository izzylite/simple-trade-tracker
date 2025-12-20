import React from 'react';
import { Box, alpha, useTheme } from '@mui/material';

interface AnimatedBackgroundProps {
  children?: React.ReactNode;
}

/**
 * Animated background mesh component with radial gradients and SVG pattern overlay.
 * Used across app pages for consistent visual styling.
 */
const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({ children }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <>
      {/* Animated Background Mesh */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 0,
          bgcolor: isDark ? 'background.default' : '#f8fafc',
          background: isDark
            ? `radial-gradient(circle at 20% 20%, ${alpha(theme.palette.primary.main, 0.12)} 0%, transparent 40%),
               radial-gradient(circle at 80% 80%, ${alpha(theme.palette.secondary.main, 0.12)} 0%, transparent 40%),
               radial-gradient(circle at 50% 50%, ${alpha(theme.palette.primary.dark, 0.05)} 0%, transparent 60%)`
            : `linear-gradient(180deg, #f0f4f8 0%, #ffffff 50%, #f8fafc 100%),
               radial-gradient(ellipse at 20% 0%, ${alpha(theme.palette.primary.main, 0.08)} 0%, transparent 50%),
               radial-gradient(ellipse at 80% 100%, ${alpha(theme.palette.secondary.main, 0.06)} 0%, transparent 50%)`,
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: isDark
              ? `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2v-4h4v-2h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2v-4h4v-2H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
              : `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%232d3748' fill-opacity='0.08'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2v-4h4v-2h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2v-4h4v-2H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          },
          pointerEvents: 'none',
        }}
      />
      {children}
    </>
  );
};

export default AnimatedBackground;
