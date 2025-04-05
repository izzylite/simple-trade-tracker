import React from 'react';
import { Box, CircularProgress, Typography, useTheme } from '@mui/material';
import { keyframes } from '@mui/system';

const pulse = keyframes`
  0% {
    transform: scale(0.95);
    opacity: 0.5;
  }
  50% {
    transform: scale(1);
    opacity: 0.8;
  }
  100% {
    transform: scale(0.95);
    opacity: 0.5;
  }
`;

interface LoadingAnimationProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
}

const LoadingAnimation: React.FC<LoadingAnimationProps> = ({
  message = 'Loading...',
  size = 'medium'
}) => {
  const theme = useTheme();

  const getSize = () => {
    switch (size) {
      case 'small':
        return {
          progress: 24,
          spacing: 1,
          fontSize: '0.875rem'
        };
      case 'large':
        return {
          progress: 48,
          spacing: 3,
          fontSize: '1.25rem'
        };
      default:
        return {
          progress: 36,
          spacing: 2,
          fontSize: '1rem'
        };
    }
  };

  const sizeConfig = getSize();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: sizeConfig.spacing,
        animation: `${pulse} 2s ease-in-out infinite`,
      }}
    >
      <CircularProgress
        size={sizeConfig.progress}
        thickness={4}
        sx={{
          color: theme.palette.primary.main,
          '& .MuiCircularProgress-circle': {
            strokeLinecap: 'round',
          },
        }}
      />
      {message && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            fontSize: sizeConfig.fontSize,
            fontWeight: 500,
          }}
        >
          {message}
        </Typography>
      )}
    </Box>
  );
};

export default LoadingAnimation; 