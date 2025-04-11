import { Box, useTheme } from '@mui/material';
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
}

const Shimmer = ({ width = '100%', height = '100%', borderRadius = 8 }: ShimmerProps) => {
  const theme = useTheme();
  const baseColor = theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
  const shimmerColor = theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)';

  return (
    <Box
      sx={{
        width,
        height,
        borderRadius,
        background: `linear-gradient(90deg, ${baseColor} 25%, ${shimmerColor} 50%, ${baseColor} 75%)`,
        backgroundSize: '200% 100%',
        animation: `${shimmer} 1.5s infinite linear`,
      }}
    />
  );
};

export default Shimmer; 