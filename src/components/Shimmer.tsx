import { Box, useTheme, alpha } from '@mui/material';
import { keyframes } from '@mui/system';

const shimmer = keyframes`
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
`;

interface ShimmerProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  variant?: 'default' | 'wave' | 'pulse';
  intensity?: 'low' | 'medium' | 'high';
  sx?: any; // Allow for additional styling
}

const Shimmer = ({
  width = '100%',
  height = '100%',
  borderRadius = 8,
  variant = 'default',
  intensity = 'medium',
  sx = {}
}: ShimmerProps) => {
  const theme = useTheme();

  // Calculate colors based on intensity
  const getColors = () => {
    const intensityValues = {
      low: {
        dark: { base: 0.03, shimmer: 0.08 },
        light: { base: 0.03, shimmer: 0.08 }
      },
      medium: {
        dark: { base: 0.05, shimmer: 0.15 },
        light: { base: 0.04, shimmer: 0.1 }
      },
      high: {
        dark: { base: 0.08, shimmer: 0.25 },
        light: { base: 0.06, shimmer: 0.15 }
      }
    };

    const values = intensityValues[intensity];
    const mode = theme.palette.mode;

    return {
      baseColor: mode === 'dark'
        ? `rgba(255, 255, 255, ${values.dark.base})`
        : `rgba(0, 0, 0, ${values.light.base})`,
      shimmerColor: mode === 'dark'
        ? `rgba(255, 255, 255, ${values.dark.shimmer})`
        : `rgba(0, 0, 0, ${values.light.shimmer})`,
      // Use neutral greys for tint to avoid blueish hue in dark mode
      primaryTint: alpha(
        theme.palette.mode === 'dark' ? theme.palette.grey[700] : theme.palette.grey[300],
        mode === 'dark' ? 0.25 : 0.2
      )
    };
  };

  const { baseColor, shimmerColor, primaryTint } = getColors();

  // Different animation styles
  const getAnimationStyles = () => {
    switch (variant) {
      case 'wave':
        return {
          background: `linear-gradient(90deg,
            ${baseColor} 0%,
            ${shimmerColor} 20%,
            ${baseColor} 40%
          )`,
          backgroundSize: '200% 100%',
          animation: `${shimmer} 2s infinite ease-in-out`,
        };
      case 'pulse':
        const pulse = keyframes`
          0% { opacity: ${theme.palette.mode === 'dark' ? 0.5 : 0.6}; }
          50% { opacity: ${theme.palette.mode === 'dark' ? 0.8 : 0.9}; }
          100% { opacity: ${theme.palette.mode === 'dark' ? 0.5 : 0.6}; }
        `;
        return {
          background: `linear-gradient(135deg, ${baseColor} 0%, ${primaryTint} 100%)`,
          animation: `${pulse} 1.8s infinite ease-in-out`,
        };
      default:
        return {
          background: `linear-gradient(90deg,
            ${baseColor} 25%,
            ${shimmerColor} 50%,
            ${baseColor} 75%
          )`,
          backgroundSize: '200% 100%',
          animation: `${shimmer} 1.5s infinite linear`,
        };
    }
  };

  return (
    <Box
      sx={{
        width,
        height,
        borderRadius,
        overflow: 'hidden',
        position: 'relative',
        willChange: 'background-position, opacity', // Optimize animation performance
        ...getAnimationStyles(),
        '&::after': variant === 'wave' ? {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `linear-gradient(90deg, transparent, ${alpha(theme.palette.background.paper, 0.1)}, transparent)`,
          transform: 'translateX(-100%)',
          animation: `shimmerWave 1.6s infinite`,
          '@keyframes shimmerWave': {
            '100%': {
              transform: 'translateX(100%)'
            }
          }
        } : {},
        ...sx // Apply additional styles
      }}
    />
  );
};

export default Shimmer;